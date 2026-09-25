// WhatsApp webhook: Evolution API events + bot ride-request flow — v8 with security hardening (token required)
// v8.2: bot conversation resets on ride end (cancel/complete) so passengers can request again. Cancel ride on dispatch failure.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function toBrazilianWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits;
  return `55${digits}`;
}

// whatsapp-webhook: handles Evolution API events + incoming messages from passengers (v2)
// Saves all incoming and outgoing messages to whatsapp_chats / whatsapp_messages tables.
// Also routes passenger messages to ride_messages table for driver chat.
// Bot: when no active ride exists, intercepts messages to run a ride-request flow.

function stripMediaFromPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    // Strip base64 audio/image data from Evolution API format
    const data = clone.data as Record<string, unknown> | undefined;
    if (data?.message && typeof data.message === "object") {
      const msg = data.message as Record<string, unknown>;
      if (msg.audioMessage && typeof msg.audioMessage === "object") {
        const aud = msg.audioMessage as Record<string, unknown>;
        if (aud.base64) aud.base64 = "[stripped]";
        if (aud.buffer) aud.buffer = "[stripped]";
        if (aud.stream) aud.stream = "[stripped]";
      }
      if (msg.imageMessage && typeof msg.imageMessage === "object") {
        const img = msg.imageMessage as Record<string, unknown>;
        if (img.base64) img.base64 = "[stripped]";
        if (img.buffer) img.buffer = "[stripped]";
        if (img.jpegThumbnail) img.jpegThumbnail = "[stripped]";
      }
      if (msg.videoMessage && typeof msg.videoMessage === "object") {
        const vid = msg.videoMessage as Record<string, unknown>;
        if (vid.base64) vid.base64 = "[stripped]";
        if (vid.buffer) vid.buffer = "[stripped]";
      }
    }
    // Strip from Meta Cloud API format
    if (Array.isArray(clone.entry)) {
      for (const entry of clone.entry) {
        const e = entry as Record<string, unknown>;
        if (Array.isArray(e.changes)) {
          for (const change of e.changes) {
            const c = change as Record<string, unknown>;
            const v = c.value as Record<string, unknown> | undefined;
            if (v?.messages && Array.isArray(v.messages)) {
              for (const m of v.messages) {
                const msg = m as Record<string, unknown>;
                if (msg.audio && typeof msg.audio === "object") {
                  const aud = msg.audio as Record<string, unknown>;
                  if (aud.data) aud.data = "[stripped]";
                }
                if (msg.image && typeof msg.image === "object") {
                  const img = msg.image as Record<string, unknown>;
                  if (img.data) img.data = "[stripped]";
                }
              }
            }
          }
        }
      }
    }
    // Strip from Z-API format
    if (clone.audio && typeof clone.audio === "object") {
      const aud = clone.audio as Record<string, unknown>;
      if (aud.audioUrl) aud.audioUrl = "[stripped]";
    }
    return clone;
  } catch {
    return null;
  }
}

async function saveMessage(
  _companyId: string,
  _phone: string,
  _direction: "incoming" | "outgoing",
  _body: string,
  _rawPayload?: Record<string, unknown>,
): Promise<void> {
  return;
  const cleanPhone = phone.replace(/\D/g, "");

  // Upsert chat
  const { data: chat } = await supabase
    .from("whatsapp_chats")
    .upsert(
      {
        company_id: companyId,
        phone: cleanPhone,
        last_message_preview: body.slice(0, 200),
        last_message_at: new Date().toISOString(),
        unread_count: direction === "incoming" ? 1 : 0,
      },
      { onConflict: "company_id,phone" },
    )
    .select("id")
    .maybeSingle();

  // If upsert didn't return the chat (race condition), fetch it
  let chatId = chat?.id;
  if (!chatId) {
    const { data: existing } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("company_id", companyId)
      .eq("phone", cleanPhone)
      .maybeSingle();
    chatId = existing?.id;
  }
  if (!chatId) return;

  // If incoming, increment unread_count
  if (direction === "incoming") {
    try {
      const { data: cur } = await supabase
        .from("whatsapp_chats")
        .select("unread_count")
        .eq("id", chatId)
        .maybeSingle();
      if (cur) {
        await supabase
          .from("whatsapp_chats")
          .update({ unread_count: (cur.unread_count ?? 0) + 1 })
          .eq("id", chatId);
      }
    } catch { /* ignore */ }
  }

  // Insert message
  await supabase.from("whatsapp_messages").insert({
    chat_id: chatId,
    company_id: companyId,
    direction,
    phone: cleanPhone,
    body,
    message_type: "text",
    raw_payload: stripMediaFromPayload(rawPayload) ?? null,
    sent_at: new Date().toISOString(),
  });
}

async function getWhatsAppConfig(): Promise<{ provider: string; fields: Record<string, string> }> {
  const { data } = await supabase
    .from("system_settings")
    .select("key_value")
    .eq("key_name", "GLOBAL_WHATSAPP_CONFIG")
    .maybeSingle();
  if (data?.key_value) {
    try {
      const config = JSON.parse(data.key_value);
      return { provider: config.provider || "evolution", fields: config.fields || {} };
    } catch { /* ignore */ }
  }
  return { provider: "evolution", fields: {} };
}

async function getCompanyWhatsAppConfig(companyId: string): Promise<{ provider: string; fields: Record<string, string> }> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("whatsapp_provider, evolution_api_url, evolution_global_token, instance_name, provider_token, provider_phone_id, provider_waba_id, provider_api_url, connection_status")
    .eq("company_id", companyId)
    .maybeSingle();

  if (instance && instance.connection_status === "connected" && instance.whatsapp_provider) {
    const fields: Record<string, string> = {};
    const p = instance.whatsapp_provider;
    if (p === "evolution" || p === "veloov") {
      if (instance.evolution_api_url) fields["evo_url"] = instance.evolution_api_url;
      if (instance.evolution_global_token) fields["evo_token"] = instance.evolution_global_token;
      if (instance.instance_name) fields["evo_instance"] = instance.instance_name;
    } else if (p === "zapi") {
      if (instance.provider_api_url) fields["zapi_url"] = instance.provider_api_url;
      if (instance.provider_token) fields["zapi_instance_token"] = instance.provider_token;
      if (instance.provider_waba_id) fields["zapi_client_token"] = instance.provider_waba_id;
    } else if (p === "zpro") {
      if (instance.provider_api_url) fields["zpro_url"] = instance.provider_api_url;
      if (instance.provider_token) fields["zpro_instance_token"] = instance.provider_token;
      if (instance.provider_waba_id) fields["zpro_client_token"] = instance.provider_waba_id;
    } else if (p === "meta_cloud") {
      if (instance.provider_token) fields["meta_token"] = instance.provider_token;
      if (instance.provider_phone_id) fields["meta_phone_id"] = instance.provider_phone_id;
      if (instance.provider_waba_id) fields["meta_waba_id"] = instance.provider_waba_id;
    } else if (p === "custom_webhook") {
      if (instance.provider_api_url) fields["custom_url"] = instance.provider_api_url;
      if (instance.provider_token) fields["custom_token"] = instance.provider_token;
    }
    return { provider: p, fields };
  }

  // Fallback: check bot_whatsapp_conexoes (the bot connection may be the connected one)
  const { data: botConn } = await supabase
    .from("bot_whatsapp_conexoes")
    .select("provider, evolution_api_url, evolution_global_token, instance_name, provider_api_url, provider_token, meta_phone_id, meta_waba_id, connection_status")
    .eq("company_id", companyId)
    .eq("connection_status", "connected")
    .maybeSingle();

  if (botConn && botConn.provider) {
    const fields: Record<string, string> = {};
    const p = botConn.provider;
    if (p === "evolution" || p === "veloov") {
      if (botConn.evolution_api_url) fields["evo_url"] = botConn.evolution_api_url;
      if (botConn.evolution_global_token) fields["evo_token"] = botConn.evolution_global_token;
      if (botConn.instance_name) fields["evo_instance"] = botConn.instance_name;
    } else if (p === "zapi") {
      if (botConn.provider_api_url) fields["zapi_url"] = botConn.provider_api_url;
      if (botConn.provider_token) fields["zapi_instance_token"] = botConn.provider_token;
      if (botConn.meta_waba_id) fields["zapi_client_token"] = botConn.meta_waba_id;
    } else if (p === "zpro") {
      if (botConn.provider_api_url) fields["zpro_url"] = botConn.provider_api_url;
      if (botConn.provider_token) fields["zpro_instance_token"] = botConn.provider_token;
      if (botConn.meta_waba_id) fields["zpro_client_token"] = botConn.meta_waba_id;
    } else if (p === "meta_cloud") {
      if (botConn.provider_token) fields["meta_token"] = botConn.provider_token;
      if (botConn.meta_phone_id) fields["meta_phone_id"] = botConn.meta_phone_id;
      if (botConn.meta_waba_id) fields["meta_waba_id"] = botConn.meta_waba_id;
    } else if (p === "custom_webhook") {
      if (botConn.provider_api_url) fields["custom_url"] = botConn.provider_api_url;
      if (botConn.provider_token) fields["custom_token"] = botConn.provider_token;
    }
    return { provider: p, fields };
  }

  return await getWhatsAppConfig();
}

async function sendWhatsAppMessageWithProvider(
  provider: string,
  f: Record<string, string>,
  cleanPhone: string,
  message: string,
): Promise<boolean> {
  if (provider === "evolution" || provider === "veloov") {
    const url = f["evo_url"] ?? "";
    const token = f["evo_token"] ?? "";
    if (!url || !token) return false;
    const instance = f["evo_instance"] || "veloov";
    const resp = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ number: cleanPhone, text: message, delay: 1200, presence: "available" }),
    });
    return resp.ok;
  }

  if (provider === "zapi") {
    const url = (f["zapi_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceToken) return false;
    const resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return resp.ok;
  }

  if (provider === "zpro") {
    const url = (f["zpro_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zpro_instance_token"] ?? "";
    const clientToken = f["zpro_client_token"] ?? "";
    if (!url || !instanceToken) return false;
    const resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return resp.ok;
  }

  if (provider === "meta_cloud") {
    const token = f["meta_token"] ?? "";
    const phoneId = f["meta_phone_id"] ?? "";
    if (!token || !phoneId) return false;
    const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    });
    return resp.ok;
  }

  if (provider === "custom_webhook") {
    const url = f["custom_url"] ?? "";
    const token = f["custom_token"] ?? "";
    const headersJson = f["custom_headers"] ?? "{}";
    if (!url) return false;
    let extraHeaders: Record<string, string> = {};
    try { extraHeaders = JSON.parse(headersJson); } catch { /* ignore */ }
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        ...extraHeaders,
      },
      body: JSON.stringify({ phone: cleanPhone, message, text: message, number: cleanPhone }),
    });
    return resp.ok;
  }

  return false;
}

// ── Bot: WhatsApp ride-request flow ──
// State machine: inicio -> aguardando_endereco -> aguardando_destino -> [aguardando_endereco_destino] -> aguardando_confirmacao -> [aguardando_categoria] -> aguardando_pagamento -> corrida_solicitada

interface BotConversation {
  id: string;
  company_id: string;
  phone: string;
  passenger_name: string | null;
  state: string;
  address_text: string | null;
  address_lat: number | null;
  address_lng: number | null;
  address_formatted: string | null;
  address_is_fallback: boolean;
  destination_text: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_formatted: string | null;
  ride_id: string | null;
  selected_category_id: string | null;
  selected_payment_method: string | null;
}

async function getBotConnectionConfig(connectionId: string): Promise<{ provider: string; fields: Record<string, string> } | null> {
  const { data: conn } = await supabase
    .from("bot_whatsapp_conexoes")
    .select("provider, evolution_api_url, evolution_global_token, instance_name, meta_phone_id, meta_waba_id, provider_token, provider_api_url, provider_waba_id, provider_phone_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (!conn) return null;
  const fields: Record<string, string> = {};
  const p = conn.provider || "evolution";
  if (p === "evolution" || p === "veloov") {
    if (conn.evolution_api_url) fields["evo_url"] = conn.evolution_api_url;
    if (conn.evolution_global_token) fields["evo_token"] = conn.evolution_global_token;
    if (conn.instance_name) fields["evo_instance"] = conn.instance_name;
  } else if (p === "zapi") {
    if (conn.provider_api_url) fields["zapi_url"] = conn.provider_api_url;
    if (conn.provider_token) fields["zapi_instance_token"] = conn.provider_token;
    if (conn.provider_waba_id) fields["zapi_client_token"] = conn.provider_waba_id;
  } else if (p === "zpro") {
    if (conn.provider_api_url) fields["zpro_url"] = conn.provider_api_url;
    if (conn.provider_token) fields["zpro_instance_token"] = conn.provider_token;
    if (conn.provider_waba_id) fields["zpro_client_token"] = conn.provider_waba_id;
  } else if (p === "meta_cloud") {
    if (conn.provider_token) fields["meta_token"] = conn.provider_token;
    if (conn.provider_phone_id || conn.meta_phone_id) fields["meta_phone_id"] = conn.provider_phone_id ?? conn.meta_phone_id;
    if (conn.provider_waba_id || conn.meta_waba_id) fields["meta_waba_id"] = conn.provider_waba_id ?? conn.meta_waba_id;
  } else if (p === "custom_webhook") {
    if (conn.provider_api_url) fields["custom_url"] = conn.provider_api_url;
    if (conn.provider_token) fields["custom_token"] = conn.provider_token;
  }
  return { provider: p, fields };
}

async function sendBotMessage(companyId: string, phone: string, connectionId: string | undefined, message: string): Promise<void> {
  try {
    let provider: string;
    let f: Record<string, string>;
    if (connectionId) {
      const botConfig = await getBotConnectionConfig(connectionId);
      if (botConfig) { provider = botConfig.provider; f = botConfig.fields; }
      else { const c = await getCompanyWhatsAppConfig(companyId); provider = c.provider; f = c.fields; }
    } else {
      const c = await getCompanyWhatsAppConfig(companyId); provider = c.provider; f = c.fields;
    }
    const sent = await sendWhatsAppMessageWithProvider(provider, f, phone, message);
    if (sent) {
      await saveMessage(companyId, phone, "outgoing", message);
    } else {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_bot",
        level: "error",
        message: `Falha ao enviar mensagem do bot para ${phone} usando ${provider}`,
      });
    }
  } catch (error) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_bot",
      level: "error",
      message: `Erro ao enviar mensagem do bot para ${phone}: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    });
  }
}

async function geocodeAddress(address: string, city?: string, state?: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const q = city ? `${address}, ${city}` : address;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br&addressdetails=1`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "VeloovBot/1.0" } });
    if (!resp.ok) return null;
    const results = await resp.json();
    if (Array.isArray(results) && results.length > 0) {
      const r = results[0];
      return {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        formatted: r.display_name ?? address,
      };
    }
  } catch { /* ignore */ }
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "VeloovBot/1.0" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.display_name ?? null;
  } catch { /* ignore */ }
  return null;
}

async function transcribeAudio(audioBase64OrUrl: string, mimetype: string, companyId?: string): Promise<string | null> {
  // Try per-company transcription config first
  let apiKey: string | undefined;
  let provider = "groq";
  let extra: Record<string, string> = {};
  if (companyId) {
    const { data: config } = await supabase
      .from("bot_transcription_config")
      .select("provider, api_key, is_valid, additional_config")
      .eq("company_id", companyId)
      .maybeSingle();
    if (config?.is_valid && config.api_key) {
      apiKey = config.api_key;
      provider = config.provider;
      extra = (config.additional_config ?? {}) as Record<string, string>;
    }
  }
  // Fallback to env vars if no per-company config (OpenAI/Groq only)
  if (!apiKey) {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!groqKey && !openaiKey) return null;
    apiKey = groqKey || openaiKey;
    provider = groqKey ? "groq" : "openai";
  }

  try {
    let audioBlob: Blob;
    if (audioBase64OrUrl.startsWith("data:")) {
      const base64Data = audioBase64OrUrl.split(",")[1] ?? audioBase64OrUrl;
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      audioBlob = new Blob([bytes], { type: mimetype || "audio/ogg" });
    } else if (audioBase64OrUrl.startsWith("http")) {
      const resp = await fetch(audioBase64OrUrl);
      audioBlob = await resp.blob();
    } else {
      const binaryStr = atob(audioBase64OrUrl);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      audioBlob = new Blob([bytes], { type: mimetype || "audio/ogg" });
    }

    // OpenAI & Groq share the same Whisper-compatible API
    if (provider === "openai" || provider === "groq") {
      const apiUrl = provider === "openai"
        ? "https://api.openai.com/v1/audio/transcriptions"
        : "https://api.groq.com/openai/v1/audio/transcriptions";
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.ogg");
      formData.append("model", provider === "openai" ? "whisper-1" : "whisper-large-v3");
      formData.append("language", "pt");
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.text ?? null;
    }

    if (provider === "deepgram") {
      const resp = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true", {
        method: "POST",
        headers: { "Authorization": `Token ${apiKey}`, "Content-Type": mimetype || "audio/ogg" },
        body: audioBlob,
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? null;
    }

    if (provider === "assemblyai") {
      // AssemblyAI requires a public URL — upload to their storage first
      const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: { "Authorization": apiKey },
        body: audioBlob,
      });
      if (!uploadResp.ok) return null;
      const uploadData = await uploadResp.json();
      const audioUrl = uploadData?.upload_url;
      if (!audioUrl) return null;
      const transcriptResp = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { "Authorization": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioUrl, language_code: "pt" }),
      });
      if (!transcriptResp.ok) return null;
      const transcriptData = await transcriptResp.json();
      const transcriptId = transcriptData?.id;
      if (!transcriptId) return null;
      // Poll for completion (max 5 attempts)
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { "Authorization": apiKey },
        });
        if (!pollResp.ok) return null;
        const pollData = await pollResp.json();
        if (pollData?.status === "completed") return pollData?.text ?? null;
        if (pollData?.status === "error") return null;
      }
      return null;
    }

    if (provider === "google") {
      const projectId = extra.projectId || "";
      if (!projectId) return null;
      const audioBase64 = await blobToBase64(audioBlob);
      const resp = await fetch(
        `https://speech.googleapis.com/v1/projects/${projectId}/locations/global:recognize`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            config: { languageCode: "pt-BR" },
            audio: { content: audioBase64 },
          }),
        },
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.results?.[0]?.alternatives?.[0]?.transcript ?? null;
    }

    if (provider === "azure") {
      const region = extra.region || "eastus";
      // Azure Speech REST short audio API
      const audioArray = new Uint8Array(await audioBlob.arrayBuffer());
      const resp = await fetch(
        `https://${region}.api.cognitive.microsoft.com/speechrecognition/dictation/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=8000",
            "Accept": "application/json",
          },
          body: audioArray,
        },
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.DisplayText ?? data?.text ?? null;
    }

    return null;
  } catch { return null; }
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  });
}

async function getCompanyLocationInfo(companyId: string): Promise<{ city: string | null; state: string | null; lat: number | null; lng: number | null; slug: string | null }> {
  const { data: cred } = await supabase
    .from("company_credentials")
    .select("city, state, lat, lng")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: company } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .maybeSingle();

  return {
    city: cred?.city ?? null,
    state: cred?.state ?? null,
    lat: cred?.lat ?? null,
    lng: cred?.lng ?? null,
    slug: company?.slug ?? null,
  };
}

async function getCategoriesForConnection(companyId: string, connectionId?: string): Promise<{ id: string; label: string; machine_category_id: string | null }[]> {
  if (connectionId) {
    const { data: conn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("bot_category_ids, location_id")
      .eq("id", connectionId)
      .maybeSingle();
    const catIds = conn?.bot_category_ids as string[] | null;
    if (catIds && catIds.length > 0) {
      const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      const uuidIds = catIds.filter(isUuid);
      const machineIds = catIds.filter((s) => !isUuid(s));

      let cats: { id: string; label: string; machine_category_id: string | null }[] = [];
      if (uuidIds.length > 0) {
        const { data } = await supabase
          .from("vehicle_categories")
          .select("id, label, machine_category_id")
          .eq("company_id", companyId)
          .in("id", uuidIds)
          .order("sort_order", { ascending: true });
        cats = (data ?? []) as { id: string; label: string; machine_category_id: string | null }[];
      }
      if (machineIds.length > 0) {
        const { data } = await supabase
          .from("vehicle_categories")
          .select("id, label, machine_category_id")
          .eq("company_id", companyId)
          .in("machine_category_id", machineIds)
          .order("sort_order", { ascending: true });
        const machineCats = (data ?? []) as { id: string; label: string; machine_category_id: string | null }[];
        const existingIds = new Set(cats.map((c) => c.id));
        for (const c of machineCats) if (!existingIds.has(c.id)) cats.push(c);
      }
      // Deduplicate by machine_category_id+label to avoid showing the same category twice (one per location)
      const seen = new Set<string>();
      const deduped = cats.filter((c) => {
        const key = `${c.machine_category_id ?? c.id}|${c.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length > 0) return deduped;
    }
  }
  // Fallback: first active category (by location if available)
  let query = supabase
    .from("vehicle_categories")
    .select("id, label, machine_category_id")
    .eq("company_id", companyId)
    .eq("is_active", true);
  if (connectionId) {
    const { data: conn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("location_id")
      .eq("id", connectionId)
      .maybeSingle();
    if (conn?.location_id) query = query.eq("location_id", conn.location_id);
  }
  const { data: cats } = await query.order("sort_order", { ascending: true });
  return (cats ?? []) as { id: string; label: string; machine_category_id: string | null }[];
}

async function createAndDispatchRide(
  companyId: string,
  companySlug: string,
  passengerName: string,
  passengerPhone: string,
  origin: { lat: number; lng: number; address: string },
  categoryLabel: string,
  machineCategoryId: string | null,
  paymentMethod: string | null = null,
  destination?: { lat: number; lng: number; address: string } | null,
): Promise<{ rideId: string; success: boolean; error?: string; machineMessage?: string }> {
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .insert({
      company_id: companyId,
      passenger_name: passengerName,
      passenger_phone: passengerPhone,
      origin_label: origin.address,
      origin_lat: origin.lat,
      origin_lng: origin.lng,
      category_label: categoryLabel,
      payment_method: paymentMethod,
      ...(destination ? {
        destination_label: destination.address,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      } : {}),
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (rideErr || !ride) {
    return { rideId: "", success: false, error: "Failed to create ride" };
  }

  try {
    const dispatchUrl = `${supabaseUrl}/functions/v1/dispatch-ride`;
    const dispatchResp = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        companySlug,
        companyId,
        integrationMode: "machine",
        rideId: ride.id,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        origin,
        category: machineCategoryId || categoryLabel,
        ...(destination ? { destination } : {}),
      }),
    });

    if (!dispatchResp.ok) {
      const errBody = await dispatchResp.text().catch(() => "");
      return { rideId: ride.id, success: false, error: `Dispatch failed: ${errBody.slice(0, 200)}` };
    }

    const dispatchData = await dispatchResp.json().catch(() => ({}));
    if (dispatchData?.success === false) {
      return { rideId: ride.id, success: false, error: dispatchData.error ?? "Dispatch failed" };
    }

    // Extract Machine API response message if present
    const machineMessage: string | undefined =
      dispatchData?.data?.message ??
      dispatchData?.data?.mensagem ??
      dispatchData?.data?.response?.message ??
      dispatchData?.data?.response?.mensagem ??
      dispatchData?.message ??
      dispatchData?.mensagem ??
      undefined;

    return { rideId: ride.id, success: true, machineMessage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dispatch request failed";
    return { rideId: ride.id, success: false, error: msg };
  }
}

async function proceedAfterDestination(
  companyId: string,
  cleanPhone: string,
  connectionId: string | undefined,
  convId: string,
  msg: (key: string, fallback: string) => string,
): Promise<void> {
  const categories = await getCategoriesForConnection(companyId, connectionId);

  if (categories.length > 1) {
    await supabase.from("bot_conversas")
      .update({ state: "aguardando_categoria", updated_at: new Date().toISOString() })
      .eq("id", convId);
    const opts = categories.map((c, i) => `${i + 1} - ${c.label}`).join("\n");
    await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_category", `Qual categoria voce deseja?\n\n${opts}\n\nResponda com o numero da opcao.`));
    return;
  }

  const category = categories[0] ?? null;
  await supabase.from("bot_conversas")
    .update({
      state: "aguardando_pagamento",
      selected_category_id: category?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", convId);
  await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_payment", `Qual a forma de pagamento?\n\n1 - Dinheiro\n2 - Pix\n3 - Cartao\n\nResponda com o numero da opcao.`));
}

async function handleBotMessage(
  companyId: string,
  cleanPhone: string,
  text: string | null,
  pushName: string | null,
  location: { lat: number; lng: number } | null,
  audio: { data: string; mimetype: string } | null,
  connectionId?: string,
): Promise<void> {
  // Load custom messages for this connection
  let customMessages: Record<string, string> = {};
  if (connectionId) {
    const { data: conn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("bot_custom_messages")
      .eq("id", connectionId)
      .maybeSingle();
    if (conn?.bot_custom_messages) customMessages = conn.bot_custom_messages as Record<string, string>;
  }
  const msg = (key: string, fallback: string): string => customMessages[key] || fallback;

  const { data: existingConv } = await supabase
    .from("bot_conversas")
    .select("*")
    .eq("company_id", companyId)
    .eq("phone", cleanPhone)
    .maybeSingle();

  let conv = existingConv as BotConversation | null;

  if (!conv) {
    const { data: newConv } = await supabase
      .from("bot_conversas")
      .insert({
        company_id: companyId,
        phone: cleanPhone,
        passenger_name: pushName,
        state: "menu_inicial",
      })
      .select("*")
      .single();
    conv = newConv as BotConversation;

    await sendBotMessage(companyId, cleanPhone, connectionId, msg("welcome_menu", "Ola! Como podemos ajudar?\n\n1 - Solicitar corrida\n2 - Suporte\n\nResponda com o numero da opcao."));
    return;
  }

  if (!conv.passenger_name && pushName) {
    await supabase.from("bot_conversas")
      .update({ passenger_name: pushName, updated_at: new Date().toISOString() })
      .eq("id", conv.id);
    conv.passenger_name = pushName;
  }

  const normalizedText = (text ?? "").trim().toLowerCase();

  switch (conv.state) {
    case "menu_inicial":
    case "inicio": {
      if (["1", "corrida", "sim", "sim.", "quero", "viagem", "sim!"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "Perfeito! Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
      } else if (["2", "suporte", "ajuda", "suport"].includes(normalizedText)) {
        // Fetch company support WhatsApp
        const { data: company } = await supabase
          .from("companies")
          .select("support_whatsapp, name")
          .eq("id", companyId)
          .maybeSingle();

        if (company?.support_whatsapp) {
          await supabase.from("bot_conversas")
            .update({ state: "suporte", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_forward", `Você sera direcionado para o suporte da ${company.name}. Envie sua mensagem e nossa equipe ira responder.`));

          // Forward the passenger's phone to the support WhatsApp
          const supportPhone = toBrazilianWhatsAppNumber(company.support_whatsapp);
          const supportIntro = `Novo chamado de suporte via bot.
Passageiro: ${pushName ?? "Sem nome"}
Telefone: ${cleanPhone}

As mensagens do passageiro serao encaminhadas a partir de agora.`;
          try {
            const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
            await sendWhatsAppMessageWithProvider(provider, f, supportPhone, supportIntro);
            await saveMessage(companyId, supportPhone, "outgoing", supportIntro);
          } catch { /* best-effort */ }
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_unavailable", "O suporte nao esta disponivel no momento. Tente novamente mais tarde ou solicite uma corrida digitando 1."));
          await supabase.from("bot_conversas")
            .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      } else if (["nao", "nao.", "cancelar", "n"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("decline", "Tudo bem! Quando precisar de uma corrida, e so nos mandar uma mensagem."));
      } else {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("welcome_repeat", "Como podemos ajudar?\n\n1 - Solicitar corrida\n2 - Suporte\n\nResponda com o numero da opcao."));
      }
      break;
    }

    case "aguardando_endereco": {
      let addressText: string | null = null;
      let lat: number | null = null;
      let lng: number | null = null;

      if (location) {
        lat = location.lat;
        lng = location.lng;
        const reversed = await reverseGeocode(lat, lng);
        addressText = reversed ?? `Localizacao: ${lat}, ${lng}`;
      } else if (audio) {
        const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
        if (transcribed) {
          addressText = transcribed.trim();
          await sendBotMessage(companyId, cleanPhone, connectionId, `Entendi: "${addressText}". Validando o endereco...`);
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de embarque ou envie sua localizacao.");
          return;
        }
      } else if (text) {
        addressText = text.trim();
      }

      if (!addressText) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_retry", "Por favor, envie o endereco de embarque. Voce pode digitar, enviar sua localizacao ou mandar um audio."));
        return;
      }

      // Check address suggestions first (before geocoding)
      let suggestionMatch: { address_text: string; lat: number | null; lng: number | null } | null = null;
      if (connectionId) {
        const { data: suggestions } = await supabase
          .from("bot_address_suggestions")
          .select("nickname, address_text, lat, lng")
          .eq("connection_id", connectionId);
        if (suggestions && suggestions.length > 0) {
          const normalizedInput = addressText.toLowerCase().trim();
          for (const sug of suggestions) {
            const nick = (sug.nickname || "").toLowerCase().trim();
            if (nick && (normalizedInput === nick || normalizedInput.includes(nick) || nick.includes(normalizedInput))) {
              suggestionMatch = { address_text: sug.address_text, lat: sug.lat, lng: sug.lng };
              break;
            }
          }
        }
      }

      let finalLat: number;
      let finalLng: number;
      let finalAddress: string;
      let isFallback = false;

      if (suggestionMatch) {
        // Use the suggestion's real address
        if (suggestionMatch.lat != null && suggestionMatch.lng != null) {
          finalLat = suggestionMatch.lat;
          finalLng = suggestionMatch.lng;
        } else {
          // Geocode the suggestion's real address
          const companyLoc = await getCompanyLocationInfo(companyId);
          const geocoded = await geocodeAddress(suggestionMatch.address_text, companyLoc.city ?? undefined, companyLoc.state ?? undefined);
          if (geocoded) {
            finalLat = geocoded.lat;
            finalLng = geocoded.lng;
          } else if (companyLoc.lat != null && companyLoc.lng != null) {
            finalLat = companyLoc.lat;
            finalLng = companyLoc.lng;
            isFallback = true;
          } else {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_not_found", "Nao consegui encontrar esse endereco. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade) ou compartilhe sua localizacao."));
            return;
          }
        }
        finalAddress = suggestionMatch.address_text;
      } else if (location) {
        // Location was already set above
        finalLat = lat!;
        finalLng = lng!;
        finalAddress = addressText;
      } else {
        // Geocode the text address
        const companyLoc = await getCompanyLocationInfo(companyId);
        const geocoded = await geocodeAddress(addressText, companyLoc.city ?? undefined, companyLoc.state ?? undefined);

        if (geocoded) {
          finalLat = geocoded.lat;
          finalLng = geocoded.lng;
          finalAddress = geocoded.formatted;
        } else {
          if (companyLoc.lat != null && companyLoc.lng != null) {
            finalLat = companyLoc.lat;
            finalLng = companyLoc.lng;
            finalAddress = addressText;
            isFallback = true;
          } else {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_not_found", "Nao consegui encontrar esse endereco. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade) ou compartilhe sua localizacao."));
            return;
          }
        }
      }

      await supabase.from("bot_conversas")
        .update({
          state: "aguardando_destino",
          address_text: addressText,
          address_lat: finalLat,
          address_lng: finalLng,
          address_formatted: finalAddress,
          address_is_fallback: isFallback,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);

      await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_destination", "Para onde voce vai?\n\n1 - Digitar o Endereco de Destino\n2 - Nao informar Endereco\n\nResponda com o numero da opcao."));
      break;
    }

    case "aguardando_destino": {
      if (normalizedText === "2" || normalizedText === "nao" || normalizedText === "nao informar") {
        await supabase.from("bot_conversas")
          .update({
            state: "aguardando_confirmacao",
            destination_text: null,
            destination_lat: null,
            destination_lng: null,
            destination_formatted: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.id);
        const pickupAddr = conv.address_formatted || conv.address_text || "Endereco nao informado";
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `Confirma o embarque em: ${pickupAddr}?\n\nResponda SIM para confirmar ou NAO para corrigir.`));
      } else if (normalizedText === "1" || location || audio || (text && !["1","2"].includes(normalizedText))) {
        // Accept "1" (menu choice), location, audio, or any typed text as a destination address
        if (normalizedText === "1" && !location && !audio) {
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_endereco_destino", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_destination_address", "Digite o endereco de destino. Voce pode digitar, enviar sua localizacao ou mandar um audio."));
        } else {
          // Process the destination directly — reuse the aguardando_endereco_destino logic
          let destText: string | null = null;
          let destLat: number | null = null;
          let destLng: number | null = null;

          if (location) {
            destLat = location.lat;
            destLng = location.lng;
            const reversed = await reverseGeocode(destLat, destLng);
            destText = reversed ?? `Localizacao: ${destLat}, ${destLng}`;
          } else if (audio) {
            const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
            if (transcribed) {
              destText = transcribed.trim();
              await sendBotMessage(companyId, cleanPhone, connectionId, `Entendi: "${destText}". Validando o destino...`);
            } else {
              await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de destino.");
              return;
            }
          } else if (text) {
            destText = text.trim();
          }

          if (!destText) {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_retry", "Por favor, envie o endereco de destino. Voce pode digitar, mandar um audio ou compartilhar a localizacao."));
            return;
          }

          let destSuggestionMatch: { address_text: string; lat: number | null; lng: number | null } | null = null;
          if (connectionId) {
            const { data: suggestions } = await supabase
              .from("bot_address_suggestions")
              .select("nickname, address_text, lat, lng")
              .eq("connection_id", connectionId);
            if (suggestions && suggestions.length > 0) {
              const normalizedInput = destText.toLowerCase().trim();
              for (const sug of suggestions) {
                const nick = (sug.nickname || "").toLowerCase().trim();
                if (nick && (normalizedInput === nick || normalizedInput.includes(nick) || nick.includes(normalizedInput))) {
                  destSuggestionMatch = { address_text: sug.address_text, lat: sug.lat, lng: sug.lng };
                  break;
                }
              }
            }
          }

          let finalDestLat: number;
          let finalDestLng: number;
          let finalDestAddress: string;

          if (destSuggestionMatch) {
            if (destSuggestionMatch.lat != null && destSuggestionMatch.lng != null) {
              finalDestLat = destSuggestionMatch.lat;
              finalDestLng = destSuggestionMatch.lng;
            } else {
              const companyLoc = await getCompanyLocationInfo(companyId);
              const geocoded = await geocodeAddress(destSuggestionMatch.address_text, companyLoc.city ?? undefined, companyLoc.state ?? undefined);
              if (geocoded) {
                finalDestLat = geocoded.lat;
                finalDestLng = geocoded.lng;
              } else {
                await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_not_found", "Nao consegui encontrar o endereco de destino. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade)."));
                return;
              }
            }
            finalDestAddress = destSuggestionMatch.address_text;
          } else if (location) {
            finalDestLat = destLat!;
            finalDestLng = destLng!;
            finalDestAddress = destText;
          } else {
            const companyLoc = await getCompanyLocationInfo(companyId);
            const geocoded = await geocodeAddress(destText, companyLoc.city ?? undefined, companyLoc.state ?? undefined);
            if (geocoded) {
              finalDestLat = geocoded.lat;
              finalDestLng = geocoded.lng;
              finalDestAddress = geocoded.formatted;
            } else {
              await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_not_found", "Nao consegui encontrar o endereco de destino. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade)."));
              return;
            }
          }

          const pickupAddr = conv.address_formatted || conv.address_text || "Endereco nao informado";
          await supabase.from("bot_conversas")
            .update({
              state: "aguardando_confirmacao",
              destination_text: destText,
              destination_lat: finalDestLat,
              destination_lng: finalDestLng,
              destination_formatted: finalDestAddress,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `Confirma os dados da corrida?\n\nEmbarque: ${pickupAddr}\nDestino: ${finalDestAddress}\n\nResponda SIM para confirmar ou NAO para corrigir.`));
        }
      } else {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_menu_retry", `Opcao invalida.\n\n1 - Digitar o Endereco de Destino\n2 - Nao informar Endereco\n\nResponda com o numero da opcao.`));
      }
      break;
    }

    case "aguardando_endereco_destino": {
      let destText: string | null = null;
      let destLat: number | null = null;
      let destLng: number | null = null;

      if (location) {
        destLat = location.lat;
        destLng = location.lng;
        const reversed = await reverseGeocode(destLat, destLng);
        destText = reversed ?? `Localizacao: ${destLat}, ${destLng}`;
      } else if (audio) {
        const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
        if (transcribed) {
          destText = transcribed.trim();
          await sendBotMessage(companyId, cleanPhone, connectionId, `Entendi: "${destText}". Validando o destino...`);
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de destino.");
          return;
        }
      } else if (text) {
        destText = text.trim();
      }

      if (!destText) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_retry", "Por favor, envie o endereco de destino. Voce pode digitar, mandar um audio ou compartilhar a localizacao."));
        return;
      }

      // Check destination address suggestions
      let destSuggestionMatch: { address_text: string; lat: number | null; lng: number | null } | null = null;
      if (connectionId) {
        const { data: suggestions } = await supabase
          .from("bot_address_suggestions")
          .select("nickname, address_text, lat, lng")
          .eq("connection_id", connectionId);
        if (suggestions && suggestions.length > 0) {
          const normalizedInput = destText.toLowerCase().trim();
          for (const sug of suggestions) {
            const nick = (sug.nickname || "").toLowerCase().trim();
            if (nick && (normalizedInput === nick || normalizedInput.includes(nick) || nick.includes(normalizedInput))) {
              destSuggestionMatch = { address_text: sug.address_text, lat: sug.lat, lng: sug.lng };
              break;
            }
          }
        }
      }

      let finalDestLat: number;
      let finalDestLng: number;
      let finalDestAddress: string;

      if (destSuggestionMatch) {
        if (destSuggestionMatch.lat != null && destSuggestionMatch.lng != null) {
          finalDestLat = destSuggestionMatch.lat;
          finalDestLng = destSuggestionMatch.lng;
        } else {
          const companyLoc = await getCompanyLocationInfo(companyId);
          const geocoded = await geocodeAddress(destSuggestionMatch.address_text, companyLoc.city ?? undefined, companyLoc.state ?? undefined);
          if (geocoded) {
            finalDestLat = geocoded.lat;
            finalDestLng = geocoded.lng;
          } else {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_not_found", "Nao consegui encontrar o endereco de destino. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade)."));
            return;
          }
        }
        finalDestAddress = destSuggestionMatch.address_text;
      } else if (location) {
        finalDestLat = destLat!;
        finalDestLng = destLng!;
        finalDestAddress = destText;
      } else {
        const companyLoc = await getCompanyLocationInfo(companyId);
        const geocoded = await geocodeAddress(destText, companyLoc.city ?? undefined, companyLoc.state ?? undefined);
        if (geocoded) {
          finalDestLat = geocoded.lat;
          finalDestLng = geocoded.lng;
          finalDestAddress = geocoded.formatted;
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_not_found", "Nao consegui encontrar o endereco de destino. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade)."));
          return;
        }
      }

      const pickupAddr = conv.address_formatted || conv.address_text || "Endereco nao informado";
      await supabase.from("bot_conversas")
        .update({
          state: "aguardando_confirmacao",
          destination_text: destText,
          destination_lat: finalDestLat,
          destination_lng: finalDestLng,
          destination_formatted: finalDestAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);
      await sendBotMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `Confirma os dados da corrida?\n\nEmbarque: ${pickupAddr}\nDestino: ${finalDestAddress}\n\nResponda SIM para confirmar ou NAO para corrigir.`));
      break;
    }

    case "aguardando_confirmacao": {
      if (["sim", "sim.", "s", "confirmo", "confirmar", "sim!"].includes(normalizedText)) {
        const companyLoc = await getCompanyLocationInfo(companyId);
        if (!companyLoc.slug) {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
          return;
        }

        await proceedAfterDestination(companyId, cleanPhone, connectionId, conv.id, msg);
      } else if (["nao", "nao.", "n", "errado", "nao!"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_correction", "Sem problema! Qual e o endereco correto de embarque? Voce pode digitar, enviar sua localizacao ou mandar um audio."));
      } else {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("confirm_retry", "Por favor, responda SIM para confirmar ou NAO para corrigir."));
      }
      break;
    }

    case "aguardando_categoria": {
      const categories = await getCategoriesForConnection(companyId, connectionId);
      if (categories.length === 0) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ride_error", "Nenhuma categoria disponivel. Tente novamente mais tarde."));
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        return;
      }

      // Parse the passenger's choice (number or label)
      const choiceNum = parseInt(normalizedText, 10);
      let chosenCat: { id: string; label: string; machine_category_id: string | null } | null = null;
      if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= categories.length) {
        chosenCat = categories[choiceNum - 1];
      } else {
        // Try matching by label
        chosenCat = categories.find((c) => c.label.toLowerCase() === normalizedText) ?? null;
      }

      if (!chosenCat) {
        const opts = categories.map((c, i) => `${i + 1} - ${c.label}`).join("\n");
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("category_retry", `Opcao invalida. Escolha uma categoria:\n\n${opts}\n\nResponda com o numero da opcao.`));
        return;
      }

      // Category chosen — ask payment method
      await supabase.from("bot_conversas")
        .update({
          state: "aguardando_pagamento",
          selected_category_id: chosenCat.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);
      await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_payment", `Qual a forma de pagamento?\n\n1 - Dinheiro\n2 - Pix\n3 - Cartao\n\nResponda com o numero da opcao.`));
      break;
    }

    case "aguardando_pagamento": {
      const paymentMap: Record<string, string> = {
        "1": "Dinheiro",
        "2": "Pix",
        "3": "Cartao",
        "dinheiro": "Dinheiro",
        "pix": "Pix",
        "cartao": "Cartao",
        "cartão": "Cartao",
      };
      const paymentMethod = paymentMap[normalizedText] ?? null;

      if (!paymentMethod) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("payment_retry", `Opcao invalida. Qual a forma de pagamento?\n\n1 - Dinheiro\n2 - Pix\n3 - Cartao\n\nResponda com o numero da opcao.`));
        return;
      }

      const companyLoc = await getCompanyLocationInfo(companyId);
      if (!companyLoc.slug) {
        await sendBotMessage(companyId, cleanPhone, connectionId, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
        return;
      }

      // Get the selected category
      let categoryLabel = "Padrao";
      let machineCategoryId: string | null = null;
      if (conv.selected_category_id) {
        const { data: cat } = await supabase
          .from("vehicle_categories")
          .select("label, machine_category_id")
          .eq("id", conv.selected_category_id)
          .maybeSingle();
        if (cat) {
          categoryLabel = cat.label;
          machineCategoryId = cat.machine_category_id;
        }
      }

      const passengerName = conv.passenger_name || "Passageiro";
      const origin = {
        lat: conv.address_lat!,
        lng: conv.address_lng!,
        address: conv.address_formatted || conv.address_text || "Endereco nao informado",
      };

      const destination = conv.destination_lat != null && conv.destination_lng != null
        ? { lat: conv.destination_lat, lng: conv.destination_lng, address: conv.destination_formatted || conv.destination_text || "" }
        : null;

      const result = await createAndDispatchRide(
        companyId,
        companyLoc.slug,
        passengerName,
        cleanPhone,
        origin,
        categoryLabel,
        machineCategoryId,
        paymentMethod,
        destination,
      );

      if (result.success) {
        await supabase.from("bot_conversas")
          .update({
            state: "corrida_solicitada",
            ride_id: result.rideId,
            selected_payment_method: paymentMethod,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.id);

        const successMsg = result.machineMessage || msg("ride_success", `Corrida solicitada com sucesso! Pagamento: ${paymentMethod}. Um motorista vai aceitar em breve. Aguarde.`);
        await sendBotMessage(companyId, cleanPhone, connectionId, successMsg);

        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_bot",
          level: "info",
          message: `Corrida solicitada via bot por ${passengerName} (${cleanPhone}) — categoria: ${categoryLabel}, pagamento: ${paymentMethod}, endereco: ${origin.address}${destination ? `, destino: ${destination.address}` : ""}`,
          ride_id: result.rideId,
        });
      } else {
        if (result.rideId) {
          await supabase.from("rides")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("id", result.rideId);
        }
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ride_error", `Houve um erro ao solicitar a corrida: ${result.error ?? "erro desconhecido"}.\n\nPara tentar novamente, envie uma mensagem.`));
        await supabase.from("bot_conversas")
          .update({ state: "menu_inicial", ride_id: null, updated_at: new Date().toISOString() })
          .eq("id", conv.id);
      }
      break;
    }

    case "suporte": {
      // Forward passenger messages to the company's support WhatsApp
      const { data: company } = await supabase
        .from("companies")
        .select("support_whatsapp")
        .eq("id", companyId)
        .maybeSingle();

      if (company?.support_whatsapp && text) {
        const supportPhone = toBrazilianWhatsAppNumber(company.support_whatsapp);
        const forwardMsg = `Mensagem do Passageiro: ${text.trim()}`;
        try {
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          await sendWhatsAppMessageWithProvider(provider, f, supportPhone, forwardMsg);
          await saveMessage(companyId, supportPhone, "outgoing", forwardMsg);
        } catch { /* best-effort */ }

        // Check if passenger wants to exit support mode
        if (["sair", "voltar", "corrida", "1", "menu", "fim"].includes(normalizedText)) {
          await supabase.from("bot_conversas")
            .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_exit", "Voce saiu do suporte.\n\n1 - Solicitar corrida\n2 - Suporte\n\nResponda com o numero da opcao."));
          break;
        }
      } else if (text && ["sair", "voltar", "corrida", "1", "menu", "fim"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_exit", "Voce saiu do suporte.\n\n1 - Solicitar corrida\n2 - Suporte\n\nResponda com o numero da opcao."));
      }
      break;
    }

    case "corrida_solicitada": {
      await supabase.from("bot_conversas")
        .update({ state: "menu_inicial", ride_id: null, updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      await sendBotMessage(companyId, cleanPhone, connectionId, msg("welcome_back", "Ola! Como podemos ajudar?\n\n1 - Solicitar corrida\n2 - Suporte\n\nResponda com o numero da opcao."));
      break;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Meta Cloud API webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      const metaVerifyToken = Deno.env.get("META_VERIFY_TOKEN") ?? "veloov_meta_verify";
      if (!token || token === metaVerifyToken) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Auth: require a valid webhook token. If WHATSAPP_WEBHOOK_TOKEN is not set, deny all requests.
  const expectedToken = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN");
  if (!expectedToken) {
    return new Response(JSON.stringify({ error: "Webhook token not configured" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const receivedToken = req.headers.get("apikey") ?? req.headers.get("evo-apikey");
  if (receivedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Meta Cloud API webhook (POST) — format: { entry: [{ changes: [{ value: { messages: [...] } }] }] }
    if (body?.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        const changes = (entry as Record<string, unknown>)?.changes;
        if (!Array.isArray(changes)) continue;
        for (const change of changes) {
          const value = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
          if (!value) continue;

          // Status updates (sent, delivered, read) — acknowledge but skip
          if (value.statuses && Array.isArray(value.statuses)) continue;

          const messages = value.messages as Record<string, unknown>[] | undefined;
          if (!messages || !Array.isArray(messages)) continue;

          // Find the bot connection by phone_number_id
          const phoneNumberId = value.metadata?.phone_number_id as string | undefined;
          const wabaId = value.metadata?.waba_id as string | undefined;

          let botConn: { id: string; company_id: string } | null = null;
          if (phoneNumberId) {
            const { data: conn } = await supabase
              .from("bot_whatsapp_conexoes")
              .select("id, company_id")
              .eq("meta_phone_id", phoneNumberId)
              .maybeSingle();
            botConn = conn as { id: string; company_id: string } | null;
          }
          if (!botConn && wabaId) {
            const { data: conn } = await supabase
              .from("bot_whatsapp_conexoes")
              .select("id, company_id")
              .eq("meta_waba_id", wabaId)
              .maybeSingle();
            botConn = conn as { id: string; company_id: string } | null;
          }
          if (!botConn) continue;

          for (const msg of messages) {
            const msgType = msg.type as string;
            const from = msg.from as string;
            const msgId = msg.id as string;

            let text: string | null = null;
            let location: { lat: number; lng: number } | null = null;
            let audio: { data: string; mimetype: string } | null = null;

            if (msgType === "text" && msg.text?.body) {
              text = String(msg.text.body);
            } else if (msgType === "audio") {
              const audioId = msg.audio?.id as string | undefined;
              const mimeType = msg.audio?.mime_type as string | undefined;
              if (audioId) {
                // Download audio from Meta Cloud API using per-connection token
                const botConnConfig = await getBotConnectionConfig(botConn.id);
                const metaToken = botConnConfig?.fields["meta_token"] ?? Deno.env.get("META_ACCESS_TOKEN") ?? "";
                try {
                  const audioResp = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
                    headers: { Authorization: `Bearer ${metaToken}` },
                  });
                  if (audioResp.ok) {
                    const audioBlob = await audioResp.blob();
                    const arrayBuf = await audioBlob.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuf);
                    let binary = "";
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    audio = { data: btoa(binary), mimetype: mimeType || "audio/ogg" };
                  }
                } catch { /* best-effort */ }
              }
            } else if (msgType === "location") {
              const lat = msg.location?.latitude != null ? Number(msg.location.latitude) : null;
              const lng = msg.location?.longitude != null ? Number(msg.location.longitude) : null;
              if (lat != null && lng != null) location = { lat, lng };
            } else if (msgType === "interactive" && msg.interactive?.button_reply?.id) {
              text = String(msg.interactive.button_reply.id);
            } else if (msgType === "interactive" && msg.interactive?.list_reply?.id) {
              text = String(msg.interactive.list_reply.id);
            }

            if (!from) continue;
            if (!text && !location && !audio) continue;

            const cleanPhone = from.replace(/\D/g, "");
            const pushName = (msg.context?.forwarded ?? false) ? null : (value.contacts?.[0] as Record<string, unknown>)?.name as string | null;

            // Save incoming message
            if (text) await saveMessage(botConn.company_id, cleanPhone, "incoming", text, body);

            // Build a normalized data object that handleIncomingMessage can process
            const normalizedData: Record<string, unknown> = {
              key: { remoteJid: `${from}@s.whatsapp.net` },
              message: text ? { conversation: text } : {},
              pushName: pushName ?? undefined,
            };
            if (location) {
              (normalizedData.message as Record<string, unknown>).locationMessage = {
                degreesLatitude: location.lat,
                degreesLongitude: location.lng,
              };
            }
            if (audio) {
              (normalizedData.message as Record<string, unknown>).audioMessage = {
                base64: audio.data,
                mimetype: audio.mimetype,
              };
            }

            await handleIncomingMessage(botConn.company_id, normalizedData, undefined, botConn.id);
          }
        }
      }
      return new Response(JSON.stringify({ success: true, meta: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Z-API / Z-Pro webhook — format: { type: "ReceivedCallback", phone, text: { message }, instanceId, ... }
    if (body?.type === "ReceivedCallback" || body?.type === "DeliveryCallback") {
      const zapiPhone = body.phone as string | undefined;
      const zapiInstance = body.instanceId as string | undefined;
      const zapiFromMe = body.fromMe as boolean | undefined;
      const zapiSenderName = body.senderName as string | undefined;

      // Skip messages sent by us (delivery callbacks)
      if (body.type === "DeliveryCallback") {
        return new Response(JSON.stringify({ success: true, zapi: true, delivery: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!zapiPhone || zapiFromMe) {
        return new Response(JSON.stringify({ success: true, zapi: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the bot connection or whatsapp instance by instanceId
      let zapiCompanyId: string | null = null;
      let zapiConnId: string | null = null;

      if (zapiInstance) {
        // Try bot connections first
        const { data: botConn } = await supabase
          .from("bot_whatsapp_conexoes")
          .select("id, company_id, provider")
          .or(`instance_name.eq.${zapiInstance},evolution_global_token.eq.${zapiInstance}`)
          .maybeSingle();
        if (botConn) {
          zapiCompanyId = botConn.company_id;
          zapiConnId = botConn.id;
        }
      }
      if (!zapiCompanyId && zapiInstance) {
        const { data: waInst } = await supabase
          .from("whatsapp_instances")
          .select("id, company_id")
          .or(`instance_name.eq.${zapiInstance},provider_token.eq.${zapiInstance}`)
          .maybeSingle();
        if (waInst) {
          zapiCompanyId = waInst.company_id;
        }
      }
      if (!zapiCompanyId) {
        return new Response(JSON.stringify({ error: "Instance not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanZapiPhone = String(zapiPhone).replace(/\D/g, "");

      // Extract text
      let zapiText: string | null = null;
      const textObj = body.text as Record<string, unknown> | undefined;
      if (textObj?.message) {
        zapiText = String(textObj.message);
      } else if (typeof body.text === "string") {
        zapiText = body.text;
      } else if (body.caption) {
        zapiText = String(body.caption);
      }

      // Extract location
      let zapiLocation: { lat: number; lng: number } | null = null;
      const locObj = body.location as Record<string, unknown> | undefined;
      if (locObj?.latitude != null && locObj?.longitude != null) {
        zapiLocation = {
          lat: Number(locObj.latitude),
          lng: Number(locObj.longitude),
        };
      }

      // Extract audio
      let zapiAudio: { data: string; mimetype: string } | null = null;
      const audioObj = body.audio as Record<string, unknown> | undefined;
      if (audioObj?.audioUrl) {
        zapiAudio = {
          data: String(audioObj.audioUrl),
          mimetype: String(audioObj.mimeType ?? "audio/ogg"),
        };
      }

      if (!zapiText && !zapiLocation && !zapiAudio) {
        return new Response(JSON.stringify({ success: true, zapi: true, no_content: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save incoming message
      if (zapiText) await saveMessage(zapiCompanyId, cleanZapiPhone, "incoming", zapiText, body);

      // Build normalized data for handleIncomingMessage
      const normalizedZapiData: Record<string, unknown> = {
        key: { remoteJid: `${cleanZapiPhone}@s.whatsapp.net` },
        message: zapiText ? { conversation: zapiText } : {},
        pushName: zapiSenderName ?? undefined,
      };
      if (zapiLocation) {
        (normalizedZapiData.message as Record<string, unknown>).locationMessage = {
          degreesLatitude: zapiLocation.lat,
          degreesLongitude: zapiLocation.lng,
        };
      }
      if (zapiAudio) {
        (normalizedZapiData.message as Record<string, unknown>).audioMessage = {
          url: zapiAudio.data,
          mimetype: zapiAudio.mimetype,
        };
      }

      await handleIncomingMessage(zapiCompanyId, normalizedZapiData, undefined, zapiConnId ?? undefined);

      return new Response(JSON.stringify({ success: true, zapi: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event, instance, data } = body;

    // Find the whatsapp instance by instance_name
    let { data: waInstance } = await supabase
      .from("whatsapp_instances")
      .select("id, company_id, instance_name")
      .eq("instance_name", instance)
      .maybeSingle();

    // Check if this is a bot WhatsApp connection (separate from the main instance)
    let isBotInstance = false;
    if (!waInstance) {
      const { data: botConn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("id, company_id, instance_name, connection_status, evolution_api_url, evolution_global_token")
        .eq("instance_name", instance)
        .maybeSingle();

      if (botConn) {
        isBotInstance = true;
        // Update connection status on connection events
        if (event === "connection.update" || event === "CONNECTION_UPDATE" || event === "status.connect") {
          const state = data?.state ?? data?.status ?? "";
          if (state === "open" || state === "CONNECTED") {
            await supabase.from("bot_whatsapp_conexoes")
              .update({ connection_status: "connected", qr_code: null, updated_at: new Date().toISOString() })
              .eq("id", botConn.id);
          } else if (state === "close" || state === "DISCONNECTED") {
            await supabase.from("bot_whatsapp_conexoes")
              .update({ connection_status: "disconnected", updated_at: new Date().toISOString() })
              .eq("id", botConn.id);
          }
        }

        // Handle incoming messages via bot flow
        if (event === "messages.upsert" || event === "MESSAGES_UPSERT" || event === "message.receive") {
          const key = data?.key as Record<string, unknown> | undefined;
          // Skip outgoing messages (from the bot itself)
          if (key?.fromMe === true) {
            return new Response(JSON.stringify({ success: true, bot: true, skipped: "outgoing" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const msg = data?.message as Record<string, unknown> | undefined;
          let rawPhone: string | null = key?.remoteJid ? String(key.remoteJid).replace(/@.*$/, "") : (data?.from ? String(data.from) : null);
          let text: string | null = msg?.conversation ? String(msg.conversation) : (msg?.text ? String(msg.text) : null);
          if (typeof data?.body === "string") text = data.body;
          else if (data?.body && typeof data.body === "object") text = String((data.body as Record<string, unknown>).text ?? "");

          if (!text && msg?.locationMessage) {
            const loc = msg.locationMessage as Record<string, unknown>;
            text = `[Localizacao: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
          }
          if (!text && msg?.audioMessage) {
            text = `[Audio recebido]`;
          }

          if (rawPhone && text) {
            await saveMessage(botConn.company_id, rawPhone, "incoming", text, body);
          }
          await handleIncomingMessage(botConn.company_id, data, instance, botConn.id);
        }

        return new Response(JSON.stringify({ success: true, bot: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If not found by name, check if this is the global Veloov instance
    if (!waInstance) {
      const { data: globalConfig } = await supabase
        .from("system_settings")
        .select("key_value")
        .eq("key_name", "GLOBAL_WHATSAPP_CONFIG")
        .maybeSingle();

      if (globalConfig?.key_value) {
        try {
          const config = JSON.parse(globalConfig.key_value);
          const globalInstanceName = config?.fields?.evo_instance ?? config?.fields?.instance;
          if (globalInstanceName === instance) {
            // This is the global Veloov instance — find companies that use "veloov" provider.
            // Only assign if exactly one match exists to avoid cross-tenant misattribution.
            const { data: veloovInstances } = await supabase
              .from("whatsapp_instances")
              .select("id, company_id, instance_name")
              .eq("whatsapp_provider", "veloov")
              .order("created_at", { ascending: true })
              .limit(2);
            if (veloovInstances && veloovInstances.length === 1) {
              waInstance = veloovInstances[0];
            } else if (veloovInstances && veloovInstances.length > 1) {
              console.warn(`Multiple veloov-provider instances found (${veloovInstances.length}) for global instance "${instance}" — skipping ambiguous fallback`);
            }
          }
        } catch { /* ignore parse error */ }
      }
    }

    if (!waInstance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle connection.update events
    if (event === "connection.update" || event === "CONNECTION_UPDATE" || event === "status.connect") {
      const state = data?.state ?? data?.status ?? "";

      if (state === "open" || state === "CONNECTED") {
        await supabase
          .from("whatsapp_instances")
          .update({
            connection_status: "connected",
            qr_code: null,
            last_connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", waInstance.id);
      } else if (state === "close" || state === "DISCONNECTED") {
        await supabase
          .from("whatsapp_instances")
          .update({
            connection_status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", waInstance.id);
      }

      // Log the event
      await supabase.from("admin_logs").insert({
        company_id: waInstance.company_id,
        source: "whatsapp_webhook",
        level: "info",
        message: `WhatsApp connection state: ${state}`,
        payload: body,
      });
    }

    // Handle incoming messages from passengers (e.g. "cancelar")
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT" || event === "message.receive") {
      // Skip outgoing messages (from the instance itself)
      const key = data?.key as Record<string, unknown> | undefined;
      if (key?.fromMe === true) {
        return new Response(JSON.stringify({ success: true, skipped: "outgoing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Save ALL incoming messages to chat history (not just "cancelar")
      const msg = data?.message as Record<string, unknown> | undefined;
      let rawPhone: string | null = key?.remoteJid ? String(key.remoteJid).replace(/@.*$/, "") : (data?.from ? String(data.from) : null);
      let text: string | null = msg?.conversation ? String(msg.conversation) : (msg?.text ? String(msg.text) : null);
      if (typeof data?.body === "string") text = data.body;
      else if (data?.body && typeof data.body === "object") text = String((data.body as Record<string, unknown>).text ?? "");

      // Extract location and audio for display in chat history
      if (!text && msg?.locationMessage) {
        const loc = msg.locationMessage as Record<string, unknown>;
        text = `[Localizacao: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
      }
      if (!text && msg?.audioMessage) {
        text = `[Audio recebido]`;
      }

      if (rawPhone && text) {
        await saveMessage(waInstance.company_id, rawPhone, "incoming", text, body);
      }

      await handleIncomingMessage(waInstance.company_id, data, instance);
    }

    // Handle ride status updates from Machine API
    if (event === "ride.status_update" && data?.ride_id) {
      const newStatus = data.status;
      const rideId = data.ride_id;

      if (newStatus) {
        await supabase
          .from("rides")
          .update({
            status: newStatus,
            driver_name: data.driver_name || null,
            driver_phone: data.driver_phone || null,
            vehicle_plate: data.vehicle_plate || null,
            vehicle_model: data.vehicle_model || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rideId);
      }

      // Send WhatsApp notification to passenger if a global provider is configured
      if (data.passenger_phone) {
        const statusMessages: Record<string, string> = {
          accepted: "Seu motorista aceitou a corrida! Esta a caminho do ponto de partida.",
          en_route: "Seu motorista chegou ao local de embarque! Procure pelo veiculo.",
          in_progress: "Sua viagem esta em andamento.",
          completed: "Sua viagem foi concluida. Obrigado!",
        };

        const message = statusMessages[newStatus];
        if (message) {
          const cleanPhone = toBrazilianWhatsAppNumber(String(data.passenger_phone));
          try {
            const { provider, fields: f } = await getCompanyWhatsAppConfig(waInstance.company_id);
            await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, message);
            await saveMessage(waInstance.company_id, cleanPhone, "outgoing", message);
          } catch {
            // Silent — notification is best-effort
          }
        }
      }
    }

    // Handle admin reply from the chat panel
    if (event === "admin.reply" && data?.phone && data?.text) {
      const replyPhone = String(data.phone);
      const replyText = String(data.text);
      const cleanReplyPhone = toBrazilianWhatsAppNumber(replyPhone);
      try {
        const { provider, fields } = await getCompanyWhatsAppConfig(waInstance.company_id);
        await sendWhatsAppMessageWithProvider(provider, fields, cleanReplyPhone, replyText);
        await saveMessage(waInstance.company_id, cleanReplyPhone, "outgoing", replyText);
      } catch {
        // best-effort
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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

async function handleIncomingMessage(companyId: string, data: Record<string, unknown>, _instanceName?: string, connectionId?: string): Promise<void> {
  // Evolution API v1 sends: { key: { remoteJid: "5516999998888@s.whatsapp.net" }, message: { conversation: "cancelar" } }
  // Evolution API v2 sends: { message: { text: "cancelar" }, key: { remoteJid: "..." } }
  // Some versions: { from: "5516999998888", body: { text: "cancelar" } }

  const key = data?.key as Record<string, unknown> | undefined;

  // Skip outgoing messages (from the bot/instance itself) — only process incoming human messages
  if (key?.fromMe === true) return;

  let rawPhone: string | null = null;
  let text: string | null = null;

  if (key?.remoteJid) {
    rawPhone = String(key.remoteJid).replace(/@.*$/, "");
  } else if (data?.from) {
    rawPhone = String(data.from);
  }

  const message = data?.message as Record<string, unknown> | undefined;
  if (message?.conversation) {
    text = String(message.conversation);
  } else if (message?.text) {
    text = String(message.text);
  } else if (data?.body && typeof data.body === "object") {
    text = String((data.body as Record<string, unknown>).text ?? "");
  } else if (typeof data?.body === "string") {
    text = data.body;
  }

  // Extract pushName (passenger profile name from WhatsApp)
  const pushName = (data?.pushName ? String(data.pushName) : null) ?? (key?.pushName ? String(key.pushName) : null);

  // Extract location data (WhatsApp location share)
  let location: { lat: number; lng: number } | null = null;
  if (message?.locationMessage) {
    const loc = message.locationMessage as Record<string, unknown>;
    const lat = loc.degreesLatitude != null ? Number(loc.degreesLatitude) : null;
    const lng = loc.degreesLongitude != null ? Number(loc.degreesLongitude) : null;
    if (lat != null && lng != null) location = { lat, lng };
  }

  // Extract audio data
  let audio: { data: string; mimetype: string } | null = null;
  if (message?.audioMessage) {
    const aud = message.audioMessage as Record<string, unknown>;
    const audioData = aud.base64 ? String(aud.base64) : (aud.url ? String(aud.url) : null);
    const mimetype = aud.mimetype ? String(aud.mimetype) : "audio/ogg";
    if (audioData) audio = { data: audioData, mimetype };
  }

  if (!rawPhone) return;
  if (!text && !location && !audio) return;

  const cleanPhone = rawPhone.replace(/\D/g, "");
  const normalizedText = (text ?? "").trim().toLowerCase();

  // Check if sender is the support number replying to a passenger in suporte mode
  const { data: companyForSupport } = await supabase
    .from("companies")
    .select("support_whatsapp")
    .eq("id", companyId)
    .maybeSingle();
  if (companyForSupport?.support_whatsapp && text) {
    const supportPhone = toBrazilianWhatsAppNumber(companyForSupport.support_whatsapp);
    if (cleanPhone === supportPhone) {
      const { data: supportConv } = await supabase
        .from("bot_conversas")
        .select("id, phone, passenger_name")
        .eq("company_id", companyId)
        .eq("state", "suporte")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (supportConv) {
        const replyMsg = `Mensagem do Suporte: ${text.trim()}`;
        try {
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          await sendWhatsAppMessageWithProvider(provider, f, supportConv.phone, replyMsg);
          await saveMessage(companyId, supportConv.phone, "outgoing", replyMsg);
        } catch { /* best-effort */ }
      }
      return;
    }
  }

  // Find the passenger's active ride by phone number, scoped to this company
  const normalizedQueryDigits = cleanPhone.replace(/^55/, "");

  const { data: activeRides } = await supabase
    .from("rides")
    .select("id, machine_order_id, company_id, passenger_name, passenger_phone, driver_phone, status, machine_driver_id")
    .eq("company_id", companyId)
    .in("status", ["pending", "accepted", "en_route", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(50);

  const ride = activeRides?.find((r) => {
    const storedDigits = (r.passenger_phone ?? "").replace(/\D/g, "");
    const storedNo55 = storedDigits.replace(/^55/, "");
    return storedDigits === cleanPhone ||
      storedNo55 === normalizedQueryDigits ||
      storedDigits === normalizedQueryDigits;
  }) ?? null;

  // Check if sender is a driver of an active ride replying via WhatsApp
  const driverRide = activeRides?.find((r) => {
    const driverDigits = (r.driver_phone ?? "").replace(/\D/g, "");
    const driverNo55 = driverDigits.replace(/^55/, "");
    return driverDigits !== "" && (
      driverDigits === cleanPhone ||
      driverNo55 === normalizedQueryDigits ||
      driverDigits === normalizedQueryDigits
    );
  }) ?? null;

  if (driverRide && text) {
    // Check if driver wants to cancel the ride
    if (normalizedText.includes("cancel")) {
      if (driverRide.status === "en_route" || driverRide.status === "in_progress") {
        try {
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          const blockMsg = "O passageiro ja foi embarcado. Nao e possivel cancelar neste momento.";
          await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, blockMsg);
          await saveMessage(companyId, cleanPhone, "outgoing", blockMsg);
        } catch { /* best-effort */ }
        return;
      }

      // Cancel in Machine API if applicable
      if (driverRide.machine_order_id) {
        const { data: credentials } = await supabase
          .from("company_credentials")
          .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
          .eq("company_id", companyId)
          .maybeSingle();
        const { data: tenantRows } = await supabase
          .from("tenant_secrets")
          .select("secret_name, secret_value")
          .eq("tenant_id", companyId);
        const tenantMap = new Map(
          (tenantRows ?? []).map((r: { secret_name: string; secret_value: string }) => [r.secret_name, r.secret_value])
        );
        const baseUrl = (credentials?.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
        const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials?.machine_api_key || "";
        const user = tenantMap.get("TAXIMETRO_USER") || credentials?.taximetro_username || "";
        const pass = tenantMap.get("TAXIMETRO_PASSWORD") || credentials?.taximetro_password || "";
        if (apiKey && user && pass) {
          try {
            await fetch(`${baseUrl}/api/v2/integracao/corridas/${driverRide.machine_order_id}/cancelar`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": apiKey,
                "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
              },
              body: JSON.stringify({ motivo_id: 1 }),
            });
          } catch { /* best-effort — cancel locally anyway */ }
        }
      }

      await supabase.from("rides").update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      }).eq("id", driverRide.id);

      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "info",
        message: `Corrida ${driverRide.id.slice(0, 8)} cancelada via WhatsApp pelo motorista (${cleanPhone})`,
        ride_id: driverRide.id,
      });

      // Notify passenger
      try {
        const passengerPhone = toBrazilianWhatsAppNumber(driverRide.passenger_phone);
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const cancelMsg = "O motorista cancelou a corrida. Por favor, solicite uma nova viagem.";
        await sendWhatsAppMessageWithProvider(provider, f, passengerPhone, cancelMsg);
        await saveMessage(companyId, passengerPhone, "outgoing", cancelMsg);
      } catch { /* best-effort */ }

      // Confirm to driver
      try {
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const driverConfirm = "Corrida cancelada com sucesso.";
        await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, driverConfirm);
        await saveMessage(companyId, cleanPhone, "outgoing", driverConfirm);
      } catch { /* best-effort */ }
      return;
    }

    await supabase.from("ride_messages").insert({
      ride_id: driverRide.id,
      company_id: companyId,
      sender: "motorista",
      sender_type: "human",
      content: text.trim(),
      status: "entregue",
    });
    const passengerPhone = toBrazilianWhatsAppNumber(driverRide.passenger_phone);
    const fwdMsg = `Mensagem do Motorista: ${text.trim()}`;
    try {
      const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
      await sendWhatsAppMessageWithProvider(provider, f, passengerPhone, fwdMsg);
      await saveMessage(companyId, passengerPhone, "outgoing", fwdMsg);
    } catch { /* best-effort */ }
    return;
  }

  // If there's an active ride, save the message to ride_messages (chat)
  if (ride) {
    if (text) {
      await supabase.from("ride_messages").insert({
        ride_id: ride.id,
        company_id: companyId,
        sender: "passageiro",
        sender_type: "human",
        content: text.trim(),
        status: "entregue",
      });

      if (ride.driver_phone) {
        try {
          const driverPhone = toBrazilianWhatsAppNumber(ride.driver_phone);
          const fwdMsg = `Mensagem do Passageiro: ${text.trim()}`;
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          await sendWhatsAppMessageWithProvider(provider, f, driverPhone, fwdMsg);
          await saveMessage(companyId, driverPhone, "outgoing", fwdMsg);
        } catch { /* best-effort */ }
      }
    }
  }

  // If no active ride, route to bot for ride-request flow (only for bot instances)
  if (!ride) {
    // Check if this company's plan includes bot
    const { data: company } = await supabase
      .from("companies")
      .select("plan_id")
      .eq("id", companyId)
      .maybeSingle();

    let botAllowed = false;
    if (company?.plan_id) {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("bot_incluso")
        .eq("id", company.plan_id)
        .maybeSingle();
      botAllowed = plan?.bot_incluso ?? false;
    }

    if (botAllowed) {
      await handleBotMessage(companyId, cleanPhone, text, pushName, location, audio, connectionId);
    }
    return;
  }

  // Only handle "cancelar" (and variations like "cancelar corrida", "cancela")
  if (!normalizedText.includes("cancel")) return;

  // Block cancellation when driver has arrived (en_route)
  if (ride.status === "en_route") {
    try {
      const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
      const msg = "Seu motorista ja chegou ao local de embarque. Nao e possivel cancelar neste momento.";
      await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, msg);
      await saveMessage(companyId, cleanPhone, "outgoing", msg);
    } catch { /* best-effort */ }
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `Cancelamento via WhatsApp bloqueado — corrida ${ride.id.slice(0, 8)} status: ${ride.status}`,
      ride_id: ride.id,
    });
    return;
  }

  // Cancel the ride: call the dispatch-ride edge function's cancel action
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
    .eq("company_id", ride.company_id)
    .maybeSingle();

  const { data: tenantRows } = await supabase
    .from("tenant_secrets")
    .select("secret_name, secret_value")
    .eq("tenant_id", ride.company_id);
  const tenantMap = new Map(
    (tenantRows ?? []).map((r: { secret_name: string; secret_value: string }) => [r.secret_name, r.secret_value])
  );

  let machineCanceled = false;

  if (ride.machine_order_id && credentials) {
    const baseUrl = (credentials.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
    const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials.machine_api_key || "";
    const user = tenantMap.get("TAXIMETRO_USER") || credentials.taximetro_username || "";
    const pass = tenantMap.get("TAXIMETRO_PASSWORD") || credentials.taximetro_password || "";

    if (apiKey && user && pass) {
      try {
        const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${ride.machine_order_id}/cancelar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
            "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
          },
          body: JSON.stringify({ motivo_id: 1 }),
        });

        machineCanceled = resp.ok;
        if (!resp.ok) {
          const errorBody = await resp.text();
          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "machine_api",
            level: "error",
            message: `Cancel via WhatsApp failed (${resp.status}): ${errorBody.slice(0, 300)}`,
            ride_id: ride.id,
          });
          // On transient errors (429, 5xx), don't cancel locally — ride may still be active
          if (resp.status !== 404 && resp.status !== 410 && resp.status !== 409) {
            return;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cancel request failed";
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "machine_api",
          level: "error",
          message: `Cancel via WhatsApp exception: ${msg}`,
          ride_id: ride.id,
        });
        // Network exception — don't cancel locally, ride may still be active
        return;
      }
    }
  }

  // Cancel locally regardless
  await supabase.from("rides").update({
    status: "canceled",
    updated_at: new Date().toISOString(),
  }).eq("id", ride.id);

  await supabase.from("admin_logs").insert({
    company_id: companyId,
    source: "whatsapp_webhook",
    level: "info",
    message: `Corrida ${ride.id.slice(0, 8)} cancelada via WhatsApp por ${ride.passenger_name} (${cleanPhone})${machineCanceled ? " — Machine API cancelada" : " — cancelada localmente"}`,
    ride_id: ride.id,
  });

  // Send confirmation message back to passenger via global WhatsApp provider
  try {
    const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
    const confirmMsg = "Sua corrida foi cancelada com sucesso. Para solicitar uma nova viagem, use o totem.";
    await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, confirmMsg);
    await saveMessage(companyId, cleanPhone, "outgoing", confirmMsg);
  } catch {
    // Best-effort
  }
}

