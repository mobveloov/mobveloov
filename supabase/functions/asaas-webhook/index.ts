// asaas-webhook edge function — Veloov Mob
// Handles payment events (subscription invoices + license activation) and NFS-e invoice events.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ASAAS_API_URL = "https://asaas.com";

const PERIOD_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

const CONFIRMED_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
const CONFIRMED_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY") ?? "";

    const body = await req.json();
    const { event, payment, invoice } = body;

    // --- NFS-e invoice events (INVOICE_CREATED, INVOICE_AUTHORIZED, INVOICE_ERROR, etc.) ---
    if (INVOICE_EVENTS.has(event) && invoice) {
      const invoiceId: string = invoice.id ?? "";
      const invoiceStatus: string = invoice.status ?? "";
      const paymentRef: string = invoice.payment ?? "";

      let companyId: string | null = null;
      if (paymentRef) {
        const { data: inv } = await supabase
          .from("subscription_invoices")
          .select("company_id")
          .eq("asaas_payment_id", String(paymentRef))
          .maybeSingle();
        companyId = inv?.company_id ?? null;
      }

      const level = event === "INVOICE_AUTHORIZED" ? "info" : event === "INVOICE_ERROR" ? "error" : "info";

      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "asaas_webhook",
        level,
        message: `Evento fiscal: ${event} — NFSe ${invoiceId} (status: ${invoiceStatus})`,
        payload: { event, invoice_id: invoiceId, invoice_status: invoiceStatus, payment_id: paymentRef },
      });

      return new Response(JSON.stringify({ success: true, event, invoice_id: invoiceId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Payment events ---
    if (!payment || !payment.id) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId: string = payment.id;
    const asaasStatus: string = payment.status || "";
    const externalRef: string = payment.externalReference || "";

    // Look up subscription_invoice by asaas_payment_id, then by externalReference (slug)
    let subInvoice: {
      id: string;
      company_id: string;
      plan_id: string | null;
      cycle: string;
      status: string;
    } | null = null;

    const { data: invByPayment } = await supabase
      .from("subscription_invoices")
      .select("id, company_id, plan_id, cycle, status")
      .eq("asaas_payment_id", paymentId)
      .maybeSingle();
    subInvoice = invByPayment ?? null;

    if (!subInvoice && externalRef) {
      const { data: invByRef } = await supabase
        .from("subscription_invoices")
        .select("id, company_id, plan_id, cycle, status")
        .eq("company_id", externalRef)
        .maybeSingle();
      subInvoice = invByRef ?? null;
    }

    // If not found in subscription_invoices, try matching directly on companies
    if (!subInvoice) {
      const { data: company } = await supabase
        .from("companies")
        .select("id, slug, name, plan_id, asaas_customer_id, expires_at")
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();

      if (company) {
        // Fetch plan for cycle info
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id, billing_period, name")
          .eq("id", company.plan_id)
          .maybeSingle();

        const cycle = plan?.billing_period ?? "monthly";

        // Create a subscription_invoice record on-the-fly
        const { data: newInv } = await supabase
          .from("subscription_invoices")
          .insert({
            company_id: company.id,
            plan_id: company.plan_id,
            cycle,
            amount: payment.value ?? 0,
            status: "pending",
            asaas_payment_id: paymentId,
            asaas_status: asaasStatus,
            due_date: payment.dueDate ? new Date(payment.dueDate).toISOString() : new Date().toISOString(),
          })
          .select("id, company_id, plan_id, cycle, status")
          .single();

        subInvoice = newInv ?? null;
      }
    }

    if (!subInvoice) {
      return new Response(JSON.stringify({ message: "No invoice or company found for this payment" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isConfirmed =
      CONFIRMED_EVENTS.includes(event) || CONFIRMED_STATUSES.includes(asaasStatus);

    if (isConfirmed) {
      // Mark invoice as paid
      await supabase
        .from("subscription_invoices")
        .update({
          status: "paid",
          asaas_status: asaasStatus,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subInvoice.id);

      // Update company: extend expiration and set status to active
      const cycleDays = PERIOD_DAYS[subInvoice.cycle] ?? 30;

      const { data: company } = await supabase
        .from("companies")
        .select("id, expires_at, plan_id, asaas_customer_id, has_mobility_service")
        .eq("id", subInvoice.company_id)
        .maybeSingle();

      if (company) {
        const currentExpiry = company.expires_at ? new Date(company.expires_at) : new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(baseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

        await supabase
          .from("companies")
          .update({
            status: "active",
            expires_at: newExpiry.toISOString(),
            plan_id: subInvoice.plan_id || company.plan_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", company.id);

        // Try to issue NFS-e automatically via Asaas API
        let nfseId: string | null = null;
        if (asaasApiKey) {
          try {
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("name")
              .eq("id", subInvoice.plan_id)
              .maybeSingle();

            // Determine which municipal service to use
            // If the company has the mobility service add-on, use the mobility service ID
            // from system_settings instead of the account's default service.
            const invoicePayload: Record<string, unknown> = {
              payment: paymentId,
              description: `Disponibilização, hospedagem e processamento de dados de plataforma e aplicativo de mobilidade urbana e gestão de motoristas parceiros Veloov Mob (SaaS). Referente à assinatura do plano ${plan?.name ?? "contratado"}.`,
              observations: "Referente à assinatura de plataforma de tecnologia de mobilidade Veloov Mob.",
            };

            const invoiceRes = await fetch(`${ASAAS_API_URL}/v3/invoices`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "access_token": asaasApiKey,
              },
              body: JSON.stringify(invoicePayload),
            });

            if (invoiceRes.ok) {
              const invoiceData = await invoiceRes.json();
              nfseId = invoiceData.id ?? null;
            } else {
              const errBody = await invoiceRes.text();
              await supabase.from("admin_logs").insert({
                company_id: company.id,
                source: "asaas_webhook",
                level: "warning",
                message: `Falha ao emitir NFSe para pagamento ${paymentId}: ${errBody}`,
                payload: { event, payment_id: paymentId, invoice_error: errBody },
              });
            }
          } catch (nfseErr) {
            const msg = nfseErr instanceof Error ? nfseErr.message : "Unknown error";
            await supabase.from("admin_logs").insert({
              company_id: company.id,
              source: "asaas_webhook",
              level: "warning",
              message: `Erro de conexão ao emitir NFSe: ${msg}`,
              payload: { event, payment_id: paymentId, invoice_error: msg },
            });
          }
        }

        await supabase.from("admin_logs").insert({
          company_id: company.id,
          source: "asaas_webhook",
          level: "info",
          message: `Pagamento confirmado (${event}). Licença estendida por ${cycleDays} dias. NFSe: ${nfseId ?? "não emitida"}${company.has_mobility_service ? " (serviço: mobilidade)" : ""}. Nova expiração: ${newExpiry.toISOString()}`,
          payload: { event, payment_id: paymentId, cycle_days: cycleDays, nfse_id: nfseId, mobility_service: company.has_mobility_service },
        });
      }

      return new Response(JSON.stringify({ success: true, event, invoice_id: subInvoice.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-confirmed payment event — update status only
    await supabase
      .from("subscription_invoices")
      .update({
        asaas_status: asaasStatus,
        status: asaasStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subInvoice.id);

    await supabase.from("admin_logs").insert({
      company_id: subInvoice.company_id,
      source: "asaas_webhook",
      level: "info",
      message: `Evento de pagamento: ${event} (pagamento ${paymentId}, status: ${asaasStatus})`,
      payload: { event, payment_id: paymentId, asaas_status: asaasStatus },
    });

    return new Response(JSON.stringify({ success: true, event, invoice_id: subInvoice.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
