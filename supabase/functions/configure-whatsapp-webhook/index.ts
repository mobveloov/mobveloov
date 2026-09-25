// Auto-configures Evolution API webhook + settings on a WhatsApp instance.
// Called after instance creation or reconnect so the webhook never needs manual setup.
// Supports Evolution API v2 (Evolution Exchange) format.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
];

async function configureEvolutionWebhook(
  apiUrl: string,
  globalToken: string,
  instanceName: string,
  webhookUrl: string,
  webhookToken: string,
): Promise<{ success: boolean; error?: string }> {
  const cleanUrl = apiUrl.replace(/\/+$/, "");

  // 1. Configure webhook URL + events + auth header (Evolution API v2 format)
  try {
    const resp = await fetch(`${cleanUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: globalToken },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          events: WEBHOOK_EVENTS,
          webhookByEvents: true,
          webhookBase64: true,
          base64: true,
          headers: {
            apikey: webhookToken,
          },
        },
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { success: false, error: `webhook/set failed (${resp.status}): ${body.slice(0, 300)}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "webhook/set network error" };
  }

  // 2. Configure instance settings — reject calls, read receipts, presence
  try {
    const resp = await fetch(`${cleanUrl}/settings/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: globalToken },
      body: JSON.stringify({
        rejectCall: true,
        msgCall: "Chamadas de voz não são suportadas. Envie uma mensagem de texto.",
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: true,
        syncFullHistory: false,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.log(`settings/set non-critical failure (${resp.status}): ${body.slice(0, 200)}`);
    }
  } catch {
    // Non-critical
  }

  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { apiUrl, globalToken, instanceName, companyId, connectionId } = body;

    if (!apiUrl || !globalToken || !instanceName) {
      return new Response(JSON.stringify({ error: "apiUrl, globalToken e instanceName são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    const webhookToken = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN") ?? "";

    const result = await configureEvolutionWebhook(apiUrl, globalToken, instanceName, webhookUrl, webhookToken);

    await supabase.from("admin_logs").insert({
      company_id: companyId ?? null,
      source: "whatsapp_webhook_config",
      level: result.success ? "info" : "error",
      message: result.success
        ? `Webhook auto-configurado para instância ${instanceName} — URL: ${webhookUrl}`
        : `Erro ao configurar webhook para instância ${instanceName}: ${result.error}`,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
