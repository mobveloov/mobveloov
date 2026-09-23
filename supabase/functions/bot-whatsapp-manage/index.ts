import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, companyId, connectionId, apiUrl, globalToken, instanceName } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plan allows bot
    const { data: company } = await supabase
      .from("companies")
      .select("plan_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!company?.plan_id) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("bot_incluso, limite_conexoes_bot, name")
      .eq("id", company.plan_id)
      .maybeSingle();

    if (!plan?.bot_incluso) {
      return new Response(JSON.stringify({ error: "Seu plano não inclui o bot de WhatsApp. Faça upgrade para o plano Black ou Diamante." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: connections } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });

      return new Response(JSON.stringify({ success: true, connections, planLimit: plan.limite_conexoes_bot, planName: plan.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Check connection limit
      const { count } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      if ((count ?? 0) >= plan.limite_conexoes_bot) {
        return new Response(JSON.stringify({
          error: `Limite de conexões do plano atingido (${count}/${plan.limite_conexoes_bot}). Faça upgrade para o plano Diamante para conectar mais números.`,
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!apiUrl || !globalToken || !instanceName) {
        return new Response(JSON.stringify({ error: "URL, token e nome da instância são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create instance in Evolution API
      const cleanUrl = apiUrl.trim().replace(/\/+$/, "");
      let qrCode: string | null = null;
      let connectionStatus = "disconnected";

      try {
        const createResp = await fetch(`${cleanUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: globalToken },
          body: JSON.stringify({ instanceName, qrcode: true }),
        });

        if (createResp.ok) {
          const createData = await createResp.json();
          qrCode = extractQrCode(createData);
        }

        // Try to connect and get QR
        const connectResp = await fetch(`${cleanUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: { apikey: globalToken },
        });

        if (connectResp.ok) {
          const connectData = await connectResp.json();
          if (!qrCode) qrCode = extractQrCode(connectData);
          const state = getEvolutionState(connectData);
          if (state === "OPEN" || state === "CONNECTED") connectionStatus = "connected";
        }
      } catch { /* ignore — connection will be updated via webhook */ }

      const { data: conn, error: connErr } = await supabase
        .from("bot_whatsapp_conexoes")
        .insert({
          company_id: companyId,
          instance_name: instanceName,
          evolution_api_url: cleanUrl,
          evolution_global_token: globalToken,
          connection_status: connectionStatus,
          qr_code: qrCode,
        })
        .select("*")
        .single();

      if (connErr) {
        return new Response(JSON.stringify({ error: "Erro ao salvar conexão: " + connErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, connection: conn }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_qr") {
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let qrCode: string | null = null;
      try {
        const resp = await fetch(`${conn.evolution_api_url}/instance/connect/${conn.instance_name}`, {
          method: "GET",
          headers: { apikey: conn.evolution_global_token },
        });
        if (resp.ok) {
          const data = await resp.json();
          qrCode = extractQrCode(data);
        }
      } catch { /* ignore */ }

      await supabase
        .from("bot_whatsapp_conexoes")
        .update({ qr_code: qrCode, updated_at: new Date().toISOString() })
        .eq("id", connectionId);

      return new Response(JSON.stringify({ success: true, qrCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (conn) {
        // Disconnect from Evolution API
        try {
          await fetch(`${conn.evolution_api_url}/instance/logout/${conn.instance_name}`, {
            method: "DELETE",
            headers: { apikey: conn.evolution_global_token },
          });
        } catch { /* ignore */ }

        await supabase.from("bot_whatsapp_conexoes").delete().eq("id", connectionId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractQrCode(payload: unknown): string | null {
  if (typeof payload !== "object" || !payload) return null;
  const value = payload as Record<string, unknown>;
  const candidates: unknown[] = [value.base64, value.qr, value.qrcode, value.code, value.data, value.response];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const qr = c.trim();
      if (qr.startsWith("data:image/")) return qr;
      if (qr.startsWith("http")) return qr;
      if (qr.length >= 40) return `data:image/png;base64,${qr.replace(/\s/g, "")}`;
    }
    if (typeof c === "object" && c) {
      const nested = extractQrCode(c);
      if (nested) return nested;
    }
  }
  return null;
}

function getEvolutionState(payload: unknown): string {
  if (typeof payload !== "object" || !payload) return "";
  const value = payload as Record<string, unknown>;
  const nested = value.instance && typeof value.instance === "object"
    ? value.instance as Record<string, unknown>
    : null;
  return String(nested?.state ?? nested?.status ?? value.state ?? value.status ?? "").toUpperCase();
}
