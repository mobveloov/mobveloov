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

async function saveMessage(
  companyId: string,
  phone: string,
  direction: "incoming" | "outgoing",
  body: string,
  rawPayload?: Record<string, unknown>,
): Promise<void> {
  if (!phone || !body) return;
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
    raw_payload: rawPayload ?? null,
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

  if (instance && instance.connection_status === "connected" && instance.whatsapp_provider && instance.whatsapp_provider !== "veloov") {
    const fields: Record<string, string> = {};
    if (instance.evolution_api_url) fields["evo_url"] = instance.evolution_api_url;
    if (instance.evolution_global_token) fields["evo_token"] = instance.evolution_global_token;
    if (instance.instance_name) fields["evo_instance"] = instance.instance_name;
    if (instance.provider_api_url) fields["zapi_url"] = instance.provider_api_url;
    if (instance.provider_token) fields["zapi_instance_token"] = instance.provider_token;
    if (instance.provider_waba_id) fields["zapi_client_token"] = instance.provider_waba_id;
    if (instance.provider_token) fields["meta_token"] = instance.provider_token;
    if (instance.provider_phone_id) fields["meta_phone_id"] = instance.provider_phone_id;
    if (instance.provider_waba_id) fields["meta_waba_id"] = instance.provider_waba_id;
    return { provider: instance.whatsapp_provider, fields };
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
// State machine: inicio → aguardando_endereco → aguardando_confirmacao → corrida_solicitada

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
  ride_id: string | null;
}

async function sendBotMessage(companyId: string, phone: string, message: string): Promise<void> {
  try {
    const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
    await sendWhatsAppMessageWithProvider(provider, f, phone, message);
    await saveMessage(companyId, phone, "outgoing", message);
  } catch { /* best-effort */ }
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

async function transcribeAudio(audioBase64OrUrl: string, mimetype: string): Promise<string | null> {
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!groqKey && !openaiKey) return null;

  const apiUrl = groqKey
    ? "https://api.groq.com/openai/v1/audio/transcriptions"
    : "https://api.openai.com/v1/audio/transcriptions";
  const authKey = groqKey || openaiKey;

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

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", groqKey ? "whisper-large-v3" : "whisper-1");
    formData.append("language", "pt");

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${authKey}` },
      body: formData,
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.text ?? null;
  } catch { return null; }
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

async function getFirstActiveCategory(companyId: string): Promise<{ id: string; label: string; machine_category_id: string | null } | null> {
  const { data: cat } = await supabase
    .from("vehicle_categories")
    .select("id, label, machine_category_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return cat ? { id: cat.id, label: cat.label, machine_category_id: cat.machine_category_id } : null;
}

async function createAndDispatchRide(
  companyId: string,
  companySlug: string,
  passengerName: string,
  passengerPhone: string,
  origin: { lat: number; lng: number; address: string },
  categoryLabel: string,
  machineCategoryId: string | null,
): Promise<{ rideId: string; success: boolean; error?: string }> {
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
        integrationMode: "machine",
        rideId: ride.id,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        origin,
        category: machineCategoryId || categoryLabel,
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

    return { rideId: ride.id, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dispatch request failed";
    return { rideId: ride.id, success: false, error: msg };
  }
}

async function handleBotMessage(
  companyId: string,
  cleanPhone: string,
  text: string | null,
  pushName: string | null,
  location: { lat: number; lng: number } | null,
  audio: { data: string; mimetype: string } | null,
): Promise<void> {
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
        state: "inicio",
      })
      .select("*")
      .single();
    conv = newConv as BotConversation;

    await sendBotMessage(companyId, cleanPhone, "Ola! Voce quer solicitar uma corrida? Responda SIM para continuar.");
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
    case "inicio": {
      if (["sim", "sim.", "quero", "1", "corrida", "viagem", "sim!"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, "Perfeito! Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio.");
      } else if (["nao", "nao.", "cancelar", "n"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, "Tudo bem! Quando precisar de uma corrida, e so nos mandar uma mensagem.");
      } else {
        await sendBotMessage(companyId, cleanPhone, "Voce quer solicitar uma corrida? Responda SIM para continuar.");
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
        const transcribed = await transcribeAudio(audio.data, audio.mimetype);
        if (transcribed) {
          addressText = transcribed.trim();
          await sendBotMessage(companyId, cleanPhone, `Entendi: "${addressText}". Validando o endereco...`);
        } else {
          await sendBotMessage(companyId, cleanPhone, "Nao consegui transcrever o audio. Por favor, digite o endereco de embarque ou envie sua localizacao.");
          return;
        }
      } else if (text) {
        addressText = text.trim();
      }

      if (!addressText) {
        await sendBotMessage(companyId, cleanPhone, "Por favor, envie o endereco de embarque. Voce pode digitar, enviar sua localizacao ou mandar um audio.");
        return;
      }

      const companyLoc = await getCompanyLocationInfo(companyId);
      const geocoded = await geocodeAddress(addressText, companyLoc.city ?? undefined, companyLoc.state ?? undefined);

      let finalLat: number;
      let finalLng: number;
      let finalAddress: string;
      let isFallback = false;

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
          await sendBotMessage(companyId, cleanPhone, "Nao consegui encontrar esse endereco. Tente enviar um endereco mais completo (ex: Rua, numero, bairro, cidade) ou compartilhe sua localizacao.");
          return;
        }
      }

      await supabase.from("bot_conversas")
        .update({
          state: "aguardando_confirmacao",
          address_text: addressText,
          address_lat: finalLat,
          address_lng: finalLng,
          address_formatted: finalAddress,
          address_is_fallback: isFallback,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);

      const fallbackNote = isFallback ? " (nao foi possivel localizar no mapa, usando localizacao aproximada da cidade)" : "";
      await sendBotMessage(companyId, cleanPhone, `Confirma que o embarque e em: ${finalAddress}${fallbackNote}?\n\nResponda SIM para confirmar ou NAO para corrigir.`);
      break;
    }

    case "aguardando_confirmacao": {
      if (["sim", "sim.", "s", "confirmo", "confirmar", "sim!"].includes(normalizedText)) {
        const companyLoc = await getCompanyLocationInfo(companyId);
        if (!companyLoc.slug) {
          await sendBotMessage(companyId, cleanPhone, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
          return;
        }

        const category = await getFirstActiveCategory(companyId);
        const passengerName = conv.passenger_name || "Passageiro";
        const origin = {
          lat: conv.address_lat!,
          lng: conv.address_lng!,
          address: conv.address_formatted || conv.address_text || "Endereco nao informado",
        };

        const result = await createAndDispatchRide(
          companyId,
          companyLoc.slug,
          passengerName,
          cleanPhone,
          origin,
          category?.label ?? "Padrao",
          category?.machine_category_id ?? null,
        );

        if (result.success) {
          await supabase.from("bot_conversas")
            .update({
              state: "corrida_solicitada",
              ride_id: result.rideId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);

          await sendBotMessage(companyId, cleanPhone, "Corrida solicitada com sucesso! Um motorista vai aceitar em breve. Aguarde.");

          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_bot",
            level: "info",
            message: `Corrida solicitada via bot por ${passengerName} (${cleanPhone}) — endereco: ${origin.address}`,
            ride_id: result.rideId,
          });
        } else {
          await sendBotMessage(companyId, cleanPhone, `Houve um erro ao solicitar a corrida: ${result.error ?? "erro desconhecido"}. Tente novamente enviando o endereco.`);
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      } else if (["nao", "nao.", "n", "errado", "nao!"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, "Sem problema! Qual e o endereco correto de embarque? Voce pode digitar, enviar sua localizacao ou mandar um audio.");
      } else {
        await sendBotMessage(companyId, cleanPhone, "Por favor, responda SIM para confirmar o endereco ou NAO para corrigir.");
      }
      break;
    }

    case "corrida_solicitada": {
      await supabase.from("bot_conversas")
        .update({ state: "inicio", updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      await sendBotMessage(companyId, cleanPhone, "Ola! Voce quer solicitar uma nova corrida? Responda SIM para continuar.");
      break;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Auth: accept if no token is configured, or if the Evolution API sends the correct one
  const expectedToken = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN");
  if (expectedToken) {
    const receivedToken = req.headers.get("apikey") ?? req.headers.get("evo-apikey");
    if (receivedToken && receivedToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = await req.json();
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
          await handleIncomingMessage(botConn.company_id, data, instance);
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
            // This is the global Veloov instance — find any company that uses "veloov" provider
            const { data: veloovInstance } = await supabase
              .from("whatsapp_instances")
              .select("id, company_id, instance_name")
              .eq("whatsapp_provider", "veloov")
              .maybeSingle();
            if (veloovInstance) {
              waInstance = veloovInstance;
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
      // Save ALL incoming messages to chat history (not just "cancelar")
      const key = data?.key as Record<string, unknown> | undefined;
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

async function handleIncomingMessage(companyId: string, data: Record<string, unknown>, _instanceName?: string): Promise<void> {
  // Evolution API v1 sends: { key: { remoteJid: "5516999998888@s.whatsapp.net" }, message: { conversation: "cancelar" } }
  // Evolution API v2 sends: { message: { text: "cancelar" }, key: { remoteJid: "..." } }
  // Some versions: { from: "5516999998888", body: { text: "cancelar" } }

  let rawPhone: string | null = null;
  let text: string | null = null;

  // Try Evolution API formats
  const key = data?.key as Record<string, unknown> | undefined;
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

  // Find the passenger's active ride by phone number, scoped to this company
  const normalizedQueryDigits = cleanPhone.replace(/^55/, "");

  const { data: activeRides } = await supabase
    .from("rides")
    .select("id, machine_order_id, company_id, passenger_name, passenger_phone, status, machine_driver_id")
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

  // If there's an active ride, save the message to ride_messages (chat)
  if (ride) {
    if (text) {
      await supabase.from("ride_messages").insert({
        ride_id: ride.id,
        company_id: companyId,
        sender: "passageiro",
        content: text.trim(),
        status: "entregue",
      });

      if (ride.machine_driver_id) {
        try {
          await forwardMessageToMachineDriver(companyId, ride.machine_driver_id, text.trim(), ride.machine_order_id);
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
      await handleBotMessage(companyId, cleanPhone, text, pushName, location, audio);
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

async function forwardMessageToMachineDriver(
  companyId: string,
  machineDriverId: string,
  message: string,
  machineOrderId?: string | null,
): Promise<void> {
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

  if (!apiKey || !user || !pass) return;

  const authHeaders = {
    "Content-Type": "application/json",
    "api-key": apiKey,
    "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
  };

  const driverIdNum = parseInt(machineDriverId, 10);
  if (isNaN(driverIdNum)) return;

  const titulo = "Mensagem do passageiro";
  const body = message.slice(0, 255);
  const orderIdNum = machineOrderId ? parseInt(machineOrderId, 10) : null;

  // Try in-app messaging first (shows as modal in driver app, linked to the ride)
  try {
    const inAppBody: Record<string, unknown> = {
      condutor_id: driverIdNum,
      titulo,
      body,
    };
    if (orderIdNum && !isNaN(orderIdNum)) {
      inAppBody.solicitacao_id = orderIdNum;
    }

    const inAppResp = await fetch(`${baseUrl}/api/v2/integracao/notificacoes/condutor/in-app-messaging/individual`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(inAppBody),
    });

    if (inAppResp.ok) {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_api",
        level: "info",
        message: `Passenger message forwarded to driver ${machineDriverId} via in-app messaging`,
      });
      return;
    }
  } catch {
    // fall through to push
  }

  // Fallback: push notification
  try {
    const pushResp = await fetch(`${baseUrl}/api/v2/integracao/notificacoes/condutor/push/individual`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        condutor_id: driverIdNum,
        titulo,
        mensagem: body,
      }),
    });

    if (!pushResp.ok) {
      const errorBody = await pushResp.text().catch(() => "");
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_api",
        level: "error",
        message: `Forward message to driver ${machineDriverId} via push failed (${pushResp.status}): ${errorBody.slice(0, 200)}`,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: `Forward message to driver ${machineDriverId} exception: ${msg}`,
    });
  }
}
