// asaas-webhook edge function — receives Asaas payment callbacks and activates licenses (v2)
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PERIOD_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Asaas webhook payload: { event, payment, ... }
    const event = body.event ?? body.Event;
    const paymentId = body.payment?.id ?? body.Payment?.id ?? body.id;

    if (!event || !paymentId) {
      return new Response(JSON.stringify({ error: "Missing event or payment id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process payment confirmation events
    if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
      return new Response(JSON.stringify({ success: true, ignored: true, reason: `Event ${event} not handled` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find company by asaas_payment_id
    const { data: company } = await supabase
      .from("companies")
      .select("id, slug, name, plan_id, asaas_payment_id, expires_at")
      .eq("asaas_payment_id", String(paymentId))
      .maybeSingle();

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found for this payment" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch plan to determine extension days
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("billing_period, name")
      .eq("id", company.plan_id)
      .maybeSingle();

    const extensionDays = plan ? (PERIOD_DAYS[plan.billing_period] ?? 30) : 30;

    // Calculate new expiration: extend from current expires_at or from now
    const baseDate = company.expires_at ? new Date(company.expires_at) : new Date();
    if (baseDate < new Date()) {
      // If already expired, extend from now
      baseDate.setTime(Date.now());
    }
    const newExpiry = new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

    // Update company: activate + extend expiration
    await supabase
      .from("companies")
      .update({
        status: "active",
        expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    // Log
    await supabase.from("admin_logs").insert({
      company_id: company.id,
      source: "asaas_webhook",
      level: "info",
      message: `Pagamento confirmado (${event}). Licença estendida por ${extensionDays} dias. Nova expiração: ${newExpiry.toISOString()}`,
      payload: { event, payment_id: paymentId, extension_days: extensionDays },
    });

    return new Response(JSON.stringify({
      success: true,
      company_id: company.id,
      new_expires_at: newExpiry.toISOString(),
    }), {
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
