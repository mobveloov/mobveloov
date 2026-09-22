// asaas-webhook edge function — receives Asaas payment + invoice callbacks
// Validates webhook token, activates licenses on payment, and tracks NFS-e status.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const ASAAS_API_URL = "https://asaas.com";

const PERIOD_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

const PAYMENT_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_OVERDUE",
]);

const INVOICE_EVENTS = new Set([
  "INVOICE_CREATED",
  "INVOICE_SYNCHRONIZED",
  "INVOICE_AUTHORIZED",
  "INVOICE_ERROR",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validate webhook auth token (if configured)
    if (ASAAS_WEBHOOK_TOKEN) {
      const receivedToken = req.headers.get("asaas-access-token");
      if (receivedToken !== ASAAS_WEBHOOK_TOKEN) {
        return new Response(
          JSON.stringify({ error: "Invalid webhook token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const body = await req.json();
    const event: string = body.event ?? body.Event ?? "";
    const paymentId: string = body.payment?.id ?? body.Payment?.id ?? body.id ?? "";
    const eventId: string = body.id ?? "";

    if (!event) {
      return new Response(
        JSON.stringify({ error: "Missing event type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Idempotency check ---
    if (eventId) {
      const { data: existing } = await supabase
        .from("admin_logs")
        .select("id")
        .eq("source", "asaas_webhook")
        .eq("payload->>event_id", eventId)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // --- Invoice events ---
    if (INVOICE_EVENTS.has(event)) {
      const invoiceId: string = body.invoice?.id ?? body.Invoice?.id ?? "";
      const invoiceStatus: string = body.invoice?.status ?? body.Invoice?.status ?? "";
      const paymentRef: string = body.invoice?.payment ?? body.Invoice?.payment ?? "";

      let companyId: string | null = null;
      if (paymentRef) {
        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("asaas_payment_id", String(paymentRef))
          .maybeSingle();
        companyId = company?.id ?? null;
      }

      const level = event === "INVOICE_AUTHORIZED" ? "info" : event === "INVOICE_ERROR" ? "error" : "info";

      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "asaas_webhook",
        level,
        message: `Evento fiscal: ${event} — NFSe ${invoiceId} (status: ${invoiceStatus})`,
        payload: { event_id: eventId, event, invoice_id: invoiceId, invoice_status: invoiceStatus, payment_id: paymentRef },
      });

      return new Response(
        JSON.stringify({ success: true, event, invoice_id: invoiceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Payment events ---
    if (!PAYMENT_EVENTS.has(event)) {
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: `Event ${event} not handled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "Missing payment id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find company by asaas_payment_id
    const { data: company } = await supabase
      .from("companies")
      .select("id, slug, name, plan_id, asaas_payment_id, asaas_customer_id, expires_at")
      .eq("asaas_payment_id", String(paymentId))
      .maybeSingle();

    if (!company) {
      // Not all payment events belong to a company tracked here
      return new Response(
        JSON.stringify({ error: "Company not found for this payment" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only activate license on actual confirmation
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      // Fetch plan to determine extension days
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("billing_period, name")
        .eq("id", company.plan_id)
        .maybeSingle();

      const extensionDays = plan ? (PERIOD_DAYS[plan.billing_period] ?? 30) : 30;

      const baseDate = company.expires_at ? new Date(company.expires_at) : new Date();
      if (baseDate < new Date()) {
        baseDate.setTime(Date.now());
      }
      const newExpiry = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

      await supabase
        .from("companies")
        .update({
          status: "active",
          expires_at: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      // Try to issue NFS-e automatically via Asaas API
      let invoiceResult: string | null = null;
      if (ASAAS_API_KEY && company.asaas_customer_id) {
        try {
          const invoiceRes = await fetch(`${ASAAS_API_URL}/v3/invoices`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "access_token": ASAAS_API_KEY,
            },
            body: JSON.stringify({
              payment: paymentId,
            }),
          });

          if (invoiceRes.ok) {
            const invoiceData = await invoiceRes.json();
            invoiceResult = invoiceData.id ?? null;
          } else {
            const errBody = await invoiceRes.text();
            invoiceResult = null;
            await supabase.from("admin_logs").insert({
              company_id: company.id,
              source: "asaas_webhook",
              level: "warning",
              message: `Falha ao emitir NFSe para pagamento ${paymentId}: ${errBody}`,
              payload: { event_id: eventId, event, payment_id: paymentId, invoice_error: errBody },
            });
          }
        } catch (invoiceErr) {
          const msg = invoiceErr instanceof Error ? invoiceErr.message : "Unknown error";
          await supabase.from("admin_logs").insert({
            company_id: company.id,
            source: "asaas_webhook",
            level: "warning",
            message: `Erro de conexão ao emitir NFSe: ${msg}`,
            payload: { event_id: eventId, event, payment_id: paymentId, invoice_error: msg },
          });
        }
      }

      await supabase.from("admin_logs").insert({
        company_id: company.id,
        source: "asaas_webhook",
        level: "info",
        message: `Pagamento confirmado (${event}). Licença estendida por ${extensionDays} dias. NFSe: ${invoiceResult ?? "não emitida"}. Nova expiração: ${newExpiry.toISOString()}`,
        payload: { event_id: eventId, event, payment_id: paymentId, extension_days: extensionDays, invoice_id: invoiceResult },
      });

      return new Response(
        JSON.stringify({
          success: true,
          company_id: company.id,
          new_expires_at: newExpiry.toISOString(),
          invoice_id: invoiceResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Other payment events (CREATED, UPDATED, OVERDUE) — just log
    await supabase.from("admin_logs").insert({
      company_id: company.id,
      source: "asaas_webhook",
      level: "info",
      message: `Evento de pagamento: ${event} (pagamento ${paymentId})`,
      payload: { event_id: eventId, event, payment_id: paymentId },
    });

    return new Response(
      JSON.stringify({ success: true, event, payment_id: paymentId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
