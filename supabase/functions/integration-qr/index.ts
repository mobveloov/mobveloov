import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface WhatsAppConfig {
  provider?: string;
  fields?: Record<string, string>;
}

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanBase64(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 100) return null;
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}

async function getConfig(): Promise<WhatsAppConfig> {
  const { data, error } = await serviceClient
    .from("system_settings")
    .select("key_value")
    .eq("key_name", "GLOBAL_WHATSAPP_CONFIG")
    .maybeSingle();

  if (error || !data?.key_value) throw new Error("Configuração do gateway não encontrada");
  const config = JSON.parse(data.key_value) as WhatsAppConfig;
  return { provider: config.provider ?? "evolution", fields: config.fields ?? {} };
}

async function requestQr(config: WhatsAppConfig): Promise<Record<string, unknown>> {
  const provider = config.provider ?? "evolution";
  const fields = config.fields ?? {};

  if (provider === "evolution") {
    const baseUrl = (fields.evo_url ?? "").replace(/\/$/, "");
    const token = fields.evo_token ?? "";
    const instance = fields.evo_instance || "veloov";
    if (!baseUrl || !token) throw new Error("URL e token da Evolution não estão configurados");

    const target = `${baseUrl}/instance/connect/${encodeURIComponent(instance)}`;
    const upstream = await fetch(target, { headers: { apikey: token } });
    const raw = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`Evolution retornou uma resposta inválida (${upstream.status})`);
    }

    if (!upstream.ok) {
      throw new Error(`Evolution recusou a conexão (${upstream.status})`);
    }

    const qr = cleanBase64(data.base64)
      ?? cleanBase64((data.qrcode as Record<string, unknown> | undefined)?.base64)
      ?? cleanBase64(data.code);
    const state = String(data.status ?? (data.instance as Record<string, unknown> | undefined)?.state ?? "").toLowerCase();
    if (qr) return { base64: qr };
    if (state === "connected" || state === "open") return { connected: true };
    throw new Error("A Evolution não retornou um QR Code. Confirme se a instância existe e está desconectada.");
  }

  if (provider === "zapi" || provider === "zpro") {
    const prefix = provider === "zapi" ? "zapi" : "zpro";
    const baseUrl = (fields[`${prefix}_url`] ?? "").replace(/\/$/, "");
    const instanceId = fields[`${prefix}_instance_id`] ?? "";
    const instanceToken = fields[`${prefix}_instance_token`] ?? "";
    if (!baseUrl || !instanceId || !instanceToken) {
      throw new Error("URL, Instance ID e Instance Token não estão configurados");
    }

    const upstream = await fetch(`${baseUrl}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/qr-code`);
    const raw = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`O provedor retornou uma resposta inválida (${upstream.status})`);
    }
    if (!upstream.ok) throw new Error(`O provedor recusou a conexão (${upstream.status})`);

    const qr = cleanBase64(data.base64)
      ?? cleanBase64(data.qr)
      ?? cleanBase64((data.qrcode as Record<string, unknown> | undefined)?.base64);
    if (qr) return { base64: qr };
    throw new Error("O provedor não retornou um QR Code válido");
  }

  throw new Error("Este provedor não utiliza QR Code");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return response({ error: "Método não permitido" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return response({ error: "Não autorizado" }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: authError } = await serviceClient.auth.getUser(token);
    const role = (userData.user?.app_metadata as { role?: string } | undefined)?.role;
    if (authError || !userData.user || role !== "superadmin") return response({ error: "Acesso restrito ao SuperAdmin" }, 403);

    const config = await getConfig();
    const result = await requestQr(config);
    return response(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível obter o QR Code";
    return response({ error: message }, 502);
  }
});
