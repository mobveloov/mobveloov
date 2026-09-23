// Bot WhatsApp management edge function — v2 with category + transcription
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

      // Check if company is using Veloov shared instance (not their own)
      const { data: waInstance } = await supabase
        .from("whatsapp_instances")
        .select("whatsapp_provider")
        .eq("company_id", companyId)
        .maybeSingle();
      const usingVeloovShared = waInstance?.whatsapp_provider === "veloov";

      // Check if Machine API is configured
      const { data: cred } = await supabase
        .from("company_credentials")
        .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
        .eq("company_id", companyId)
        .maybeSingle();
      const machineConfigured = !!(cred?.machine_api_url && (cred?.machine_api_key || cred?.taximetro_username));

      return new Response(JSON.stringify({
        success: true,
        connections,
        planLimit: plan.limite_conexoes_bot,
        planName: plan.name,
        usingVeloovShared,
        machineConfigured,
      }), {
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

    if (action === "list_suggestions") {
      if (!connectionId) return err400("connectionId required");
      const { data: suggestions } = await supabase
        .from("bot_address_suggestions")
        .select("*")
        .eq("connection_id", connectionId)
        .order("created_at", { ascending: true });
      return json({ success: true, suggestions });
    }

    if (action === "add_suggestion") {
      if (!connectionId) return err400("connectionId required");
      const { nickname, addressText, lat, lng } = body;
      if (!nickname || !addressText) return err400("nickname e addressText são obrigatórios");
      // Verify connection belongs to company
      const { data: conn } = await supabase.from("bot_whatsapp_conexoes").select("id").eq("id", connectionId).eq("company_id", companyId).maybeSingle();
      if (!conn) return err400("Conexão não encontrada");
      const { data: sug, error: sugErr } = await supabase.from("bot_address_suggestions").insert({
        connection_id: connectionId, nickname, address_text: addressText, lat: lat ?? null, lng: lng ?? null,
      }).select("*").single();
      if (sugErr) return err500("Erro ao salvar sugestão: " + sugErr.message);
      return json({ success: true, suggestion: sug });
    }

    if (action === "update_suggestion") {
      if (!connectionId) return err400("connectionId required");
      const { suggestionId, nickname, addressText, lat, lng } = body;
      if (!suggestionId) return err400("suggestionId required");
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (nickname !== undefined) update.nickname = nickname;
      if (addressText !== undefined) update.address_text = addressText;
      if (lat !== undefined) update.lat = lat;
      if (lng !== undefined) update.lng = lng;
      const { data, error: upErr } = await supabase.from("bot_address_suggestions").update(update).eq("id", suggestionId).eq("connection_id", connectionId).select("*").single();
      if (upErr) return err500("Erro ao atualizar: " + upErr.message);
      return json({ success: true, suggestion: data });
    }

    if (action === "delete_suggestion") {
      const { suggestionId } = body;
      if (!suggestionId) return err400("suggestionId required");
      await supabase.from("bot_address_suggestions").delete().eq("id", suggestionId);
      return json({ success: true });
    }

    if (action === "update_messages") {
      if (!connectionId) return err400("connectionId required");
      const { customMessages } = body;
      const { error: msgErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ bot_custom_messages: customMessages ?? {}, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (msgErr) return err500("Erro ao salvar mensagens: " + msgErr.message);
      return json({ success: true });
    }

    if (action === "list_categories") {
      const { data: categories } = await supabase
        .from("vehicle_categories")
        .select("id, label, machine_category_id, is_active, sort_order")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return json({ success: true, categories: categories ?? [] });
    }

    if (action === "update_categories") {
      if (!connectionId) return err400("connectionId required");
      const { categoryIds } = body;
      if (!Array.isArray(categoryIds)) return err400("categoryIds must be an array");
      const { error: catErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ bot_category_ids: categoryIds, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (catErr) return err500("Erro ao salvar categorias: " + catErr.message);
      return json({ success: true });
    }

    if (action === "get_transcription_config") {
      const { data: config } = await supabase
        .from("bot_transcription_config")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      return json({ success: true, config: config ?? null });
    }

    if (action === "update_transcription_config") {
      const { provider, apiKey } = body;
      if (!provider || !apiKey) return err400("provider e apiKey são obrigatórios");
      const { error: upErr } = await supabase.from("bot_transcription_config")
        .upsert({
          company_id: companyId,
          provider,
          api_key: apiKey,
          is_valid: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id" });
      if (upErr) return err500("Erro ao salvar: " + upErr.message);
      return json({ success: true });
    }

    if (action === "test_transcription") {
      const { provider, apiKey } = body;
      if (!provider || !apiKey) return err400("provider e apiKey são obrigatórios");

      // Create a tiny valid OGG/Opus audio (silence, ~0.1s) as base64
      // We'll use a minimal WAV file instead — more universally accepted
      const sampleRate = 8000;
      const numSamples = 400; // 50ms of silence
      const dataSize = numSamples * 2; // 16-bit samples
      const buf = new Uint8Array(44 + dataSize);
      const view = new DataView(buf.buffer);
      // WAV header
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + dataSize, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, dataSize, true);
      // samples are all zero (silence) — buf already zeroed

      const audioBlob = new Blob([buf], { type: "audio/wav" });
      const formData = new FormData();
      formData.append("file", audioBlob, "test.wav");
      formData.append("model", provider === "openai" ? "whisper-1" : "whisper-large-v3");

      const apiUrl = provider === "openai"
        ? "https://api.openai.com/v1/audio/transcriptions"
        : "https://api.groq.com/openai/v1/audio/transcriptions";

      try {
        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });

        if (resp.ok) {
          // Even if transcription returns empty (silence), the key is valid
          await supabase.from("bot_transcription_config")
            .upsert({
              company_id: companyId,
              provider,
              api_key: apiKey,
              is_valid: true,
              last_tested_at: new Date().toISOString(),
              last_test_result: "OK — chave válida",
              updated_at: new Date().toISOString(),
            }, { onConflict: "company_id" });
          return json({ success: true, valid: true, message: "Integração funcionando! Chave válida." });
        } else {
          const errBody = await resp.text().catch(() => "");
          let errMsg = `HTTP ${resp.status}`;
          try {
            const errJson = JSON.parse(errBody);
            errMsg = errJson?.error?.message ?? errJson?.message ?? errMsg;
          } catch { if (errBody) errMsg = errBody.slice(0, 300); }

          await supabase.from("bot_transcription_config")
            .upsert({
              company_id: companyId,
              provider,
              api_key: apiKey,
              is_valid: false,
              last_tested_at: new Date().toISOString(),
              last_test_result: errMsg,
              updated_at: new Date().toISOString(),
            }, { onConflict: "company_id" });
          return json({ success: true, valid: false, message: errMsg });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erro de conexão";
        await supabase.from("bot_transcription_config")
          .upsert({
            company_id: companyId,
            provider,
            api_key: apiKey,
            is_valid: false,
            last_tested_at: new Date().toISOString(),
            last_test_result: errMsg,
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id" });
        return json({ success: true, valid: false, message: errMsg });
      }
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

// Helper response builders
function err400(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err500(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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

