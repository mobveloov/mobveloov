// WhatsApp webhook: Evolution API events + bot ride-request flow — v9.2 with flow settings toggles (welcome menu, destination, confirmation, category, payment)
// v8.2: bot conversation resets on ride end (cancel/complete) so passengers can request again. Cancel ride on dispatch failure.
// v8.3: fix "volta pro inicio" — reuse passenger's message when transitioning from corrida_solicitada; detect ride-details in menu_inicial.
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(`${url}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: token },
        body: JSON.stringify({ number: cleanPhone, text: message, delay: 1200 }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `sendText Evolution fetch error for ${cleanPhone}: ${fetchErr instanceof Error ? fetchErr.message.slice(0, 500) : String(fetchErr).slice(0, 500)}`,
      });
      return false;
    }
    clearTimeout(timeout);
    const respBody = await resp.text().catch(() => "");
    if (!resp.ok) {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook",
        level: "error",
        message: `sendText Evolution HTTP ${resp.status} for ${cleanPhone}: ${respBody.slice(0, 500)}`,
      });
    } else {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook",
        level: "info",
        message: `sendText Evolution OK for ${cleanPhone}: ${respBody.slice(0, 300)}`,
      });
    }
    return resp.ok;
  }

  if (provider === "zapi") {
    const url = (f["zapi_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceToken) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
        body: JSON.stringify({ phone: cleanPhone, message }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `sendText Z-API fetch error for ${cleanPhone}: ${fetchErr instanceof Error ? fetchErr.message.slice(0, 500) : String(fetchErr).slice(0, 500)}`,
      });
      return false;
    }
    clearTimeout(timeout);
    return resp.ok;
  }

  if (provider === "zpro") {
    const url = (f["zpro_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zpro_instance_token"] ?? "";
    const clientToken = f["zpro_client_token"] ?? "";
    if (!url || !instanceToken) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
        body: JSON.stringify({ phone: cleanPhone, message }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `sendText Z-Pro fetch error for ${cleanPhone}: ${fetchErr instanceof Error ? fetchErr.message.slice(0, 500) : String(fetchErr).slice(0, 500)}`,
      });
      return false;
    }
    clearTimeout(timeout);
    return resp.ok;
  }

  if (provider === "meta_cloud") {
    const token = f["meta_token"] ?? "";
    const phoneId = f["meta_phone_id"] ?? "";
    if (!token || !phoneId) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: message },
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `sendText Meta Cloud fetch error for ${cleanPhone}: ${fetchErr instanceof Error ? fetchErr.message.slice(0, 500) : String(fetchErr).slice(0, 500)}`,
      });
      return false;
    }
    clearTimeout(timeout);
    return resp.ok;
  }

  if (provider === "custom_webhook") {
    const url = f["custom_url"] ?? "";
    const token = f["custom_token"] ?? "";
    const headersJson = f["custom_headers"] ?? "{}";
    if (!url) return false;
    let extraHeaders: Record<string, string> = {};
    try { extraHeaders = JSON.parse(headersJson); } catch { /* ignore */ }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
          ...extraHeaders,
        },
        body: JSON.stringify({ phone: cleanPhone, message, text: message, number: cleanPhone }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `sendText custom webhook fetch error for ${cleanPhone}: ${fetchErr instanceof Error ? fetchErr.message.slice(0, 500) : String(fetchErr).slice(0, 500)}`,
      });
      return false;
    }
    clearTimeout(timeout);
    return resp.ok;
  }

  return false;
}

// ── Bot: Poll-based interactive menus ──
// Meta blocks interactive buttons on Baileys/QR instances, so we use WhatsApp
// native Polls (Evolution /message/sendPoll) which render as clickable options.

interface InteractiveButton {
  id: string;
  label: string;
}

async function sendPollMessage(
  companyId: string,
  phone: string,
  connectionId: string | undefined,
  bodyText: string,
  buttons: InteractiveButton[],
): Promise<void> {
  // Polls and interactive buttons don't work reliably: WhatsApp encrypts poll
  // votes and Meta blocks buttons on non-official instances. Send plain text
  // with numbered options so the passenger can reply by typing or audio.
  const optionText = buttons.map((b, i) => `${i + 1} - ${b.label}`).join("\n");
  const message = `${bodyText}\n\n${optionText}\n\nResponda com o numero ou nome da opcao.`;
  await sendBotMessage(companyId, phone, connectionId, message);
}

// ── Bot: WhatsApp ride-request flow ──
// State machine: inicio -> aguardando_endereco -> [aguardando_selecao_rua] -> aguardando_destino -> [aguardando_endereco_destino] -> aguardando_confirmacao -> [aguardando_categoria] -> aguardando_pagamento -> corrida_solicitada

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
  human_takeover: boolean;
  taken_over_at: string | null;
  taken_over_by: string | null;
  updated_at: string | null;
  pending_fuzzy_options: Array<{ streetName: string; normalized: string; similarity: number; lat: number | null; lng: number | null; formatted: string | null }> | null;
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

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const AFFIRMATIVE_WORDS = new Set([
  "sim", "si", "s", "sin", "ss", "simr", "comcerteza", "com certeza", "pode mandar",
  "manda", "bora", "ok", "okay", "okk", "confirmo", "confirmar", "confirma", "comfima",
  "comfirma", "isso", "exato", "claro", "certo", "correto", "pode ser", "fechado",
  "1", "conf_sim", "sim confirmar", "sim, confirmar",
]);

const NEGATIVE_WORDS = new Set([
  "nao", "nn", "n", "naum", "naum", "nop", "nope", "errado", "errada", "engano",
  "cancelar", "cancela", "canselar", "cansela", "mudei de ideia", "mudei", "corrigir",
  "corrigi", "mudar", "muda", "parar", "para", "nao confirmar", "2", "conf_nao",
  "nao corrigir", "nao, corrigir",
]);

function isAffirmative(text: string): boolean {
  const d = deaccent(text).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  if (AFFIRMATIVE_WORDS.has(d)) return true;
  if (d.startsWith("sim") || d.startsWith("confirma") || d.startsWith("confirmo")) return true;
  return false;
}

function isNegative(text: string): boolean {
  const d = deaccent(text).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  if (NEGATIVE_WORDS.has(d)) return true;
  if (d.startsWith("nao") || d.startsWith("nn") || d.startsWith("cancel") || d.startsWith("cansel") || d.startsWith("errad")) return true;
  return false;
}

function isCancelConfirmation(text: string): boolean {
  const d = deaccent(text).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  return ["1", "sim cancelar", "sim cancelar corrida", "confirmar cancelamento", "btn_cancelar_sim", "conf_sim", "cancelar", "cancela", "canselar", "cansela"].includes(d)
    || (isAffirmative(d) && !isNegative(d));
}

function isCancelDenial(text: string): boolean {
  const d = deaccent(text).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  return ["2", "nao manter", "nao manter corrida", "btn_cancelar_nao", "manter"].includes(d)
    || isNegative(d);
}

// Evolution v2 button replies may carry the display text instead of the button id.
// Map the display text back to the semantic id (conf_sim, cat_..., pay_...) so the
// state machine can match it. Falls back to the raw id when no known label matches.
function resolveButtonReply(buttonsResp: Record<string, unknown> | undefined): string | null {
  if (!buttonsResp) return null;
  const id = buttonsResp.selectedButtonId != null ? String(buttonsResp.selectedButtonId) : "";
  const display = buttonsResp.selectedDisplayText != null ? String(buttonsResp.selectedDisplayText) : "";
  const raw = display || id;
  if (!raw) return null;
  const d = deaccent(raw).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const labelMap: Record<string, string> = {
    "sim": "conf_sim",
    "nao": "conf_nao",
    "digitar endereco": "dest_digitar",
    "nao informar": "dest_nao_informar",
    "dinheiro": "pay_dinheiro",
    "pix": "pay_pix",
    "cartao": "pay_cartao",
    "solicitar corrida": "menu_corrida",
    "suporte": "menu_suporte",
    "sim cancelar": "btn_cancelar_sim",
    "nao manter": "btn_cancelar_nao",
  };
  if (labelMap[d]) return labelMap[d];
  if (id.startsWith("cat_") || id.startsWith("pay_") || id.startsWith("conf_") || id.startsWith("dest_") || id.startsWith("menu_") || id.startsWith("btn_") || id.startsWith("freq_")) return id;
  return raw;
}

// Detect whether a transcribed text contains address-like content.
// Returns true if it looks like a street, place, or landmark reference.
function looksLikeAddress(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 3) return false;
  const addressMarkers = [
    "rua", "avenida", "av ", "av.", "praca", "travessa", "alameda", "estrada",
    "rodovia", "viela", "beco", "numero", "casa", "predio", "bloco", "apt",
    "bairro", "condominio", "shopping", "hospital", "posto", "farmacia",
    "padaria", "mercado", "supermercado", "escola", "colegio", "universidade",
    "praca", "parque", "prainha", "praia", "aeroporto", "rodoviaria",
    "estacao", "metro", "ponto", "bar", "restaurante", "loja", "academia",
    "igreja", "templo", "banco", "caixa", "loterica", "farmacia",
  ];
  const hasMarker = addressMarkers.some((m) => lower.includes(m));
  const hasNumber = /\b\d{1,6}\b/.test(lower);
  return hasMarker || (hasNumber && lower.length > 5);
}

function normalizePlaceText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  let s = value.trim();
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s
      .replace(/^eu\s+estou\s+(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/^estou\s+(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/^to\s+(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/^tô\s+(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/^me\s+(?:pega|busca|pega\s+ai|busca\s+ai)\s+(?:na|no|em)\s+/i, "")
      .replace(/^me\s+(?:leva|leve)\s+(?:ate|até|no|na|para|pra|pro|a|o)\s+/i, "")
      .replace(/^(?:vou|irei|indo|quero\s+ir)\s+(?:para|pra|pro|no|na|em)\s+/i, "")
      .replace(/^(?:quero\s+ir\s+para\s+o|quero\s+ir\s+para\s+a|quero\s+ir\s+no|quero\s+ir\s+na)\s+/i, "")
      .replace(/^(?:leve|leva|levar)\s+(?:ate|até|no|na|para|pra|pro)\s+/i, "")
      .replace(/^(?:ate|até|a|o)\s+/i, "")
      .replace(/^(?:lá|la)\s+(?:no|na|em)\s+/i, "")
      .replace(/^(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/[,\s]+eu\s*$/i, "")
      .replace(/^eu\s+quero\s+um\s+carro\s+(?:aqui\s+)?(?:na|no|em)\s+/i, "")
      .replace(/^eu\s+/i, "")
      .trim();
    if (s === before) break;
  }
  s = s.replace(/[.!?,;:]+$/g, "").replace(/\s+/g, " ").trim();
  return s ? s.toUpperCase() : null;
}

function normalizePickupForDispatch(value: string | null | undefined): string | null {
  let normalized = normalizePlaceText(value);
  if (!normalized) return null;

  normalized = normalized
    .replace(/\s*,?\s*EU\s*$/i, "")
    .replace(/\s*,?\s*(?:NUMERO|N[º°]?|NRO)\s*(\d+[A-Z]?)\s*$/i, ", $1")
    .replace(/\s*,\s*,/g, ",")
    .replace(/[.!?,;:]+$/g, "")
    .trim();

  if (/\b\d{1,6}[A-Z]?\b/.test(normalized) && !/\b(?:RUA|AVENIDA|AV\.?|TRAVESSA|ALAMEDA|ESTRADA|RODOVIA|VIELA|BECO)\b/.test(normalized)) {
    normalized = `RUA ${normalized}`;
  }

  return normalized;
}

function normalizeDestinationForDispatch(value: string | null | undefined): string | null {
  const normalized = normalizePlaceText(value);
  if (!normalized) return null;
  return normalized.replace(/\bPESQUEIRO\s+DO\s+DIO\b/g, "PESQUEIRO DO DIU");
}

function extractBairroFromFormatted(formatted: string): string | null {
  // Nominatim format: "Rua Arthur Mesquita, 57 - Jardim Santa Vitoria - Pitangueiras - SP"
  const dashParts = formatted.split(" - ").map((s) => s.trim()).filter(Boolean);
  if (dashParts.length >= 3) return dashParts[1] || null;
  // Google/comma format: "Rua Arthur Mesquita, 57, Jardim Santa Vitoria, Pitangueiras - SP"
  const commaParts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 4) return commaParts[commaParts.length - 3] || null;
  if (commaParts.length === 3) return commaParts[1] || null;
  return null;
}

// Search Nominatim for informal place names (POIs) like "Santa Casa", "Amarelinha Supermercados"
// within the city/area of the bot connection. Returns coordinates + formatted address.
async function geocodePOI(
  placeName: string,
  city?: string,
  state?: string,
  biasLat?: number,
  biasLng?: number,
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  // 1. Try Google Geocoding API if a key is configured (per-company or env)
  let googleKey: string | undefined;
  if (companyIdForGeocoding) {
    const { data: config } = await supabase
      .from("bot_transcription_config")
      .select("additional_config")
      .eq("company_id", companyIdForGeocoding)
      .maybeSingle();
    const extra = (config?.additional_config ?? {}) as Record<string, string>;
    googleKey = extra.google_geocoding_key;
  }
  if (!googleKey) {
    // Try integration_credentials table (per-company, then global fallback)
    if (companyIdForGeocoding) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials")
        .eq("tenant_id", companyIdForGeocoding)
        .eq("category", "maps")
        .eq("provider", "google_maps")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) googleKey = (cred.credentials as Record<string, string>).api_key;
    }
    if (!googleKey) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials")
        .is("tenant_id", null)
        .eq("category", "maps")
        .eq("provider", "google_maps")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) googleKey = (cred.credentials as Record<string, string>).api_key;
    }
  }
  if (!googleKey) googleKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");

  if (googleKey) {
    try {
      let googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&language=pt-BR&region=br&key=${googleKey}`;
      if (city) googleUrl += `&components=locality:${encodeURIComponent(city)}`;
      if (biasLat != null && biasLng != null) {
        googleUrl += `&bounds=${(biasLat - 0.45)},${(biasLng - 0.45)}|${(biasLat + 0.45)},${(biasLng + 0.45)}`;
      }
      const gResp = await fetch(googleUrl);
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData?.results?.length > 0) {
          const r = gData.results[0];
          return {
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            formatted: r.formatted_address ?? placeName,
          };
        }
      }
    } catch { /* fall through to Nominatim */ }
  }

  // 2. Nominatim with viewbox bias
  const q = city ? `${placeName}, ${city}` : placeName;
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br&addressdetails=1`;
  if (biasLat != null && biasLng != null) {
    const delta = 0.45;
    const left = biasLng - delta;
    const right = biasLng + delta;
    const top = biasLat + delta;
    const bottom = biasLat - delta;
    url += `&viewbox=${left},${top},${right},${bottom}&bounded=1`;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: { "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)" } });
      if (resp.ok) {
        const results = await resp.json();
        if (Array.isArray(results) && results.length > 0) {
          const r = results[0];
          const formatted = r.display_name ?? placeName;
          return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formatted };
        }
        if (biasLat != null && biasLng != null) {
          // No results with bounded viewbox — retry without boundary restriction
          const unboundedUrl = url.replace(/&viewbox=[^&]+&bounded=1/, "");
          const resp2 = await fetch(unboundedUrl, { headers: { "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)" } });
          if (resp2.ok) {
            const results2 = await resp2.json();
            if (Array.isArray(results2) && results2.length > 0) {
              const r = results2[0];
              const formatted = r.display_name ?? placeName;
              return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formatted };
            }
          }
        }
        return null;
      }
      if (resp.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 2200));
        continue;
      }
      return null;
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1100));
    }
  }

  // 3. Photon fallback — different POI database, sometimes finds places Nominatim misses
  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(placeName)}&limit=1`;
    if (biasLat != null && biasLng != null) {
      photonUrl += `&lat=${biasLat}&lon=${biasLng}&radius=20`;
    }
    const photonResp = await fetch(photonUrl);
    if (photonResp.ok) {
      const photon = await photonResp.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> };
      const feat = photon.features?.[0];
      if (feat?.geometry?.coordinates) {
        const [lng, lat] = feat.geometry.coordinates;
        const props = feat.properties ?? {};
        const parts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean).map(String);
        const formatted = parts.join(", ") || placeName;
        return { lat, lng, formatted };
      }
    }
  } catch { /* best-effort */ }

  return null;
}

// NLU: Uses LLM (OpenAI/Groq chat completion) to extract structured ride intent from a free-form message.
// Falls back to null if no LLM key is configured, letting the regex-based parseCombinedAddress handle it.
// Updated: added post-LLM normalization to strip residual "EU" suffix and fix common transcription errors.
interface ParsedRideIntent {
  eh_rua_oficial: boolean;
  origem_identificada_por_foto: boolean;
  intencao_usuario: "SIM" | "NAO" | "SOLICITAR_CORRIDA" | null;
  geolocalizacao_origem: string | null;
  texto_embarque_motorista: string | null;
  geolocalizacao_destino: null;
  texto_destino_motorista: string | null;
  payload_enquete_whatsapp: { name: string; options: string[]; selectableOptionsCount: number } | null;
  // Compatibility fields derived from dados_extraidos
  endereco_origem: string | null;
  endereco_destino: null;
}

async function interpretMessageWithLLM(
  text: string,
  companyId: string | undefined,
  context?: { city: string | null; state: string | null; totemReference: string | null; isTotemFixo: boolean },
): Promise<ParsedRideIntent | null> {
  let apiKey: string | undefined;
  let provider = "groq";
  let model = "llama-3.3-70b-versatile";

  if (companyId) {
    const { data: config } = await supabase
      .from("bot_transcription_config")
      .select("provider, api_key, is_valid, additional_config")
      .eq("company_id", companyId)
      .maybeSingle();
    if (config?.is_valid && config.api_key) {
      apiKey = config.api_key;
      provider = config.provider;
      const extra = (config.additional_config ?? {}) as Record<string, string>;
      if (extra.nlu_model) model = extra.nlu_model;
    }
  }
  if (!apiKey) {
    // Try integration_credentials table (per-company, then global fallback)
    if (companyId) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials, provider")
        .eq("tenant_id", companyId)
        .eq("category", "transcription")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) {
        const c = cred.credentials as Record<string, string>;
        if (c.api_key) { apiKey = c.api_key; provider = cred.provider; }
      }
    }
    if (!apiKey) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials, provider")
        .is("tenant_id", null)
        .eq("category", "transcription")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) {
        const c = cred.credentials as Record<string, string>;
        if (c.api_key) { apiKey = c.api_key; provider = cred.provider; }
      }
    }
  }
  if (!apiKey) {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!groqKey && !openaiKey) {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "warn",
        message: `LLM NLU skipped: no API key configured (company_id=${companyId ?? "none"})`,
      });
      return null;
    }
    apiKey = groqKey || openaiKey;
    provider = groqKey ? "groq" : "openai";
  }

  // Use chat-compatible models per provider
  if (provider === "openai") model = "gpt-4o-mini";
  else if (provider === "groq") model = "llama-3.3-70b-versatile";
  else return null; // deepgram/assemblyai/google/azure are transcription-only

  const apiUrl = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

  const cidade = context?.city || "cidade";
  const estado = context?.state || "estado";
  const refTotem = context?.totemReference || "";
  const isTotemFixo = context?.isTotemFixo ?? false;
  const canal = isTotemFixo ? "TOTEM_FIXO" : "BOT_WHATSAPP";
  const fallbackAddr = refTotem ? `${refTotem}, ${cidade} - ${estado}` : `Rua Pernambuco, 402 - Vila Caroni, ${cidade} - ${estado}`;
  const nomeTotem = refTotem ? refTotem.toUpperCase() : "TOTEM CENTRAL";

  const systemPrompt = `Voce e o modulo de Inteligencia Artificial, Visao Computacional e Engenharia Geografica Avancada de uma plataforma de mobilidade urbana profissional (Bot de Corridas no WhatsApp e Totens Fisicos). Sua principal especialidade e a Tolerancia a Falhas Textuais e Foneticas (NLU/Fuzzy Matching).

Sua missao e interpretar a intencao real do passageiro, mesmo que ele escreva ou fale com graves erros de portugues, girias ou abreviacoes.

### CONTEXTO DA OPERACAO DESTA INSTANCIA (INJETADO DINAMICAMENTE)
- Canal de Entrada: ${canal} (Valores possiveis: "BOT_WHATSAPP" ou "TOTEM_FIXO")
- Cidade de Operacao Padrao: ${cidade}
- Estado: ${estado}
- Endereco de Fallback do Bot (Mapa): "${fallbackAddr}"
${isTotemFixo ? `- Endereco Real de Instalacao do Totem: "${fallbackAddr}"\n- Nome Identificador do Totem: "${nomeTotem}"\n` : ""}

### DICIONARIO DE TOLERANCIA A FALHAS E INTERPRETACAO SEMANTICA:

1. INTENCAO DE CONFIRMACAO (SIM):
   - Variacoes aceitas: "sim", "si", "s", "sin", "comcerteza", "pode mandar", "manda", "bora", "ok", "confirmar", "comfima", "comfirma".
   - Mapeamento intencao_usuario: "SIM"

2. INTENCAO DE CANCELAMENTO / CORRECAO (NAO):
   - Variacoes aceitas: "nao", "nn", "n", "canselar", "cancelar", "cancela", "mudei de ideia", "errado", "corrigir", "mudar", "parar".
   - Mapeamento intencao_usuario: "NAO"

3. CORRECAO FONETICA DE RUAS E BAIRROS LOCAIS:
   - Se o usuario escrever nomes de ruas de forma errada, use aproximacao fonetica para deduzir a rua oficial (Ex: "artu mesquita" -> "Rua Arthur Mesquita"; "pernanbuco" -> "Rua Pernambuco"; "vila carone" -> "Vila Caroni"). Marque "eh_rua_oficial": true.

4. CORRECAO DE LOCAIS INFORMAIS / APELIDOS:
   - Trate girias e erros de digitacao de pontos turisticos comuns (Ex: "amarelina", "amarelinha da av", "amarelinha do centro" -> "AMARELINHA DA AVENIDA"; "prainha", "prainha de pitangueiras", "praninha" -> "PRAINHA").

### REGRA 1: TRATAMENTO DE EMBARQUE POR CANAL (TOTEM VS BOT)

1. SE O CANAL FOR "TOTEM_FIXO":
   - O endereco de embarque e FIXO e IMUTAVEL. Ignore qualquer rua ou foto enviada para a origem.
   - A geolocalizacao_origem deve ser EXCLUSIVAMENTE o valor injetado em "${fallbackAddr}".
   - O texto_embarque_motorista deve ser rigorosamente "${nomeTotem}".
   - Defina "eh_rua_oficial": false para pular buscas externas de mapas.

2. SE O CANAL FOR "BOT_WHATSAPP":
   - SE O INPUT FOR IMAGEM/FOTO: Atue com visao computacional. Identifique o letreiro ou fachada comercial (Ex: "CAIXA"). Formate o nome do local em MAIUSCULAS no campo texto_embarque_motorista (Ex: "AGENCIA DA CAIXA ECONOMICA FEDERAL") e defina a geolocalizacao_origem como o endereco de fallback ("${fallbackAddr}"). Defina origem_identificada_por_foto: true.
   - SE O INPUT FOR LOCAL INFORMAL/APELIDO (Ex: "Amarelinha da Avenida", "Santa Casa", "Bar do Carlao"): Defina a geolocalizacao_origem como o endereco de fallback ("${fallbackAddr}"), mas preserve o termo original digitado em MAIUSCULAS no campo texto_embarque_motorista. Defina "eh_rua_oficial": false. O backend tentara geolocalizar o local no OpenStreetMap usando o nome + cidade da instancia; se nao encontrar, usara o endereco de fallback.
   - SE O INPUT FOR APENAS RUA E NUMERO (Ex: "to na arthur mesquita numero 57"): Limpe os ruidos do texto e extraia apenas o logradouro e numero (Ex: "Rua Arthur Mesquita, 57, ${cidade} - ${estado}"). Defina "eh_rua_oficial": true para o backend consultar o OpenStreetMap, e salve o texto limpo em MAIUSCULAS em texto_embarque_motorista (Ex: "RUA ARTHUR MESQUITA, 57"). O backend completara o bairro e cidade automaticamente via OpenStreetMap.

### REGRA 2: TRATAMENTO DE DESTINO E CALCULO POR KM
1. NUNCA tente geolocalizar o destino no mapa. A propriedade geolocalizacao_destino deve ser OBRIGATORIAMENTE configurada como null em todos os casos para forcar a Machine a calcular o valor da corrida por KM rodado (taximetro) com base na categoria escolhida.
2. Extraia o destino digitado pelo cliente para o campo texto_destino_motorista em MAIUSCULAS (Ex: "PRAINHA"). Se nao informado, use "DEFINIR NO CARRO".

### REGRA 3: FLUXO DE CONFIRMACAO VIA ENQUETE (POLL)
O bot nao deve gerar textos explicativos intermedios ou botoes tradicionais quebrados. Estruture a pergunta e as opcoes de clique em formato de Enquete nativa do WhatsApp (Poll Options). A enquete permite apenas selecao unica.

### REGRA DE OURO (SEM TRAVAMENTOS)
1. NUNCA exiba mensagens de erro gramatical. Se o usuario digitar algo muito confuso, tente extrair o maximo de letras e jogue no Fallback ("${fallbackAddr}"), mas envie o texto original digitado em MAIUSCULO para a tela do motorista.
2. A geolocalizacao_destino deve ser SEMPRE NULL para permitir o calculo livre por KM rodado da categoria.

### FORMATO DE SAIDA EXCLUSIVO (JSON)
Retorne APENAS o objeto JSON valido abaixo, sem textos explicativos fora do bloco:
{
  "dados_extraidos": {
    "canal_de_entrada": "${canal}",
    "intencao_usuario": "SIM" ou "NAO" ou "SOLICITAR_CORRIDA",
    "eh_rua_oficial": true,
    "origem_identificada_por_foto": false,
    "geolocalizacao_origem": "Endereco estruturado para o mapa ou fallback/totem fixo",
    "texto_embarque_motorista": "TEXTO LIMPO EM MAIUSCULO PARA A TELA DO MOTORISTA",
    "geolocalizacao_destino": null,
    "texto_destino_motorista": "DESTINO EM MAIUSCULO PARA A TELA DO MOTORISTA"
  },
  "payload_enquete_whatsapp": {
    "name": "EMBARQUE: {{texto_embarque_motorista}}\nDESTINO: {{texto_destino_motorista}}\n\nConfirma os dados da sua corrida?",
    "options": ["SIM, CONFIRMAR", "NAO, CORRIGIR"],
    "selectableOptionsCount": 1
  }
}

### EXEMPLOS DE COMPORTAMENTO:

Exemplo 1 (BOT_WHATSAPP - Rua oficial com erro fonetico):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "Estou aqui na artu mesquita numero 57 perto da igreja e vou para o hospital"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":true,"origem_identificada_por_foto":false,"geolocalizacao_origem":"Rua Arthur Mesquita, 57, ${cidade} - ${estado}","texto_embarque_motorista":"RUA ARTHUR MESQUITA, 57","geolocalizacao_destino":null,"texto_destino_motorista":"HOSPITAL"},"payload_enquete_whatsapp":{"name":"EMBARQUE: RUA ARTHUR MESQUITA, 57\nDESTINO: HOSPITAL\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}
Nota: O backend completara o bairro (ex: Jardim Santa Vitoria) automaticamente via OpenStreetMap.

Exemplo 2 (BOT_WHATSAPP - Local informal com erro de digitacao):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "Me pega na amarelina da av e leva na prainha"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":"AMARELINHA DA AVENIDA","geolocalizacao_destino":null,"texto_destino_motorista":"PRAINHA"},"payload_enquete_whatsapp":{"name":"EMBARQUE: AMARELINHA DA AVENIDA\nDESTINO: PRAINHA\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

Exemplo 3 (BOT_WHATSAPP - Audio com "vou la no"):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "Eu quero um carro aqui na amarelinha da avenida porque eu vou la no pesqueiro do diu"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":"AMARELINHA DA AVENIDA","geolocalizacao_destino":null,"texto_destino_motorista":"PESQUEIRO DO DIU"},"payload_enquete_whatsapp":{"name":"EMBARQUE: AMARELINHA DA AVENIDA\nDESTINO: PESQUEIRO DO DIU\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

Exemplo 4 (BOT_WHATSAPP - Variacao "to no"):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "to no bar do carlao e quero ir pro hospital"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":"BAR DO CARLAO","geolocalizacao_destino":null,"texto_destino_motorista":"HOSPITAL"},"payload_enquete_whatsapp":{"name":"EMBARQUE: BAR DO CARLAO\nDESTINO: HOSPITAL\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

Exemplo 5 (BOT_WHATSAPP - Rua com numero sem destino):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "rua pernanbuco 402 centro"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":true,"origem_identificada_por_foto":false,"geolocalizacao_origem":"Rua Pernambuco, 402, ${cidade} - ${estado}","texto_embarque_motorista":"RUA PERNAMBUCO, 402","geolocalizacao_destino":null,"texto_destino_motorista":"DEFINIR NO CARRO"},"payload_enquete_whatsapp":{"name":"EMBARQUE: RUA PERNAMBUCO, 402\nDESTINO: DEFINIR NO CARRO\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

Exemplo 6 (BOT_WHATSAPP - Confirmacao com erro):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "si pode mandar"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"SIM","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":null,"geolocalizacao_destino":null,"texto_destino_motorista":null},"payload_enquete_whatsapp":{"name":"Confirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

Exemplo 7 (BOT_WHATSAPP - Cancelamento com erro):
Contexto: Canal="BOT_WHATSAPP", Cidade="${cidade}", Estado="${estado}"
Input: "nn canselar"
Output: {"dados_extraidos":{"canal_de_entrada":"BOT_WHATSAPP","intencao_usuario":"NAO","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":null,"geolocalizacao_destino":null,"texto_destino_motorista":null},"payload_enquete_whatsapp":{"name":"Confirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}

${isTotemFixo ? `Exemplo 8 (TOTEM_FIXO - Cliente so digita o destino):
Contexto: Canal="TOTEM_FIXO", Cidade="${cidade}", Estado="${estado}", Totem="${nomeTotem}", Fallback="${fallbackAddr}"
Input: "Quero ir para o Hospital Sao Paulo"
Output: {"dados_extraidos":{"canal_de_entrada":"TOTEM_FIXO","intencao_usuario":"SOLICITAR_CORRIDA","eh_rua_oficial":false,"origem_identificada_por_foto":false,"geolocalizacao_origem":"${fallbackAddr}","texto_embarque_motorista":"${nomeTotem}","geolocalizacao_destino":null,"texto_destino_motorista":"HOSPITAL SAO PAULO"},"payload_enquete_whatsapp":{"name":"EMBARQUE: ${nomeTotem}\nDESTINO: HOSPITAL SAO PAULO\n\nConfirma os dados da sua corrida?","options":["SIM, CONFIRMAR","NAO, CORRIGIR"],"selectableOptionsCount":1}}
` : ""}`

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error", message: `LLM ${provider} HTTP ${resp.status}: ${errBody.slice(0, 500)}` });
      return null;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content as string | undefined;
    if (!content) {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "warn",
        message: `LLM returned empty content for: ${text.slice(0, 200)}`,
      });
      return null;
    }
    let parsed: ParsedRideIntent;
    try {
      const raw = JSON.parse(content) as Record<string, unknown>;
      const dados = (raw.dados_extraidos ?? raw) as Record<string, unknown>;
      const intencao = (dados.intencao_usuario as string | undefined)?.toUpperCase().trim();
      parsed = {
        eh_rua_oficial: !!dados.eh_rua_oficial,
        origem_identificada_por_foto: !!dados.origem_identificada_por_foto,
        intencao_usuario: (intencao === "SIM" || intencao === "NAO" || intencao === "SOLICITAR_CORRIDA") ? intencao as "SIM" | "NAO" | "SOLICITAR_CORRIDA" : null,
        geolocalizacao_origem: (dados.geolocalizacao_origem as string) ?? null,
        texto_embarque_motorista: (dados.texto_embarque_motorista as string) ?? null,
        geolocalizacao_destino: null,
        texto_destino_motorista: (dados.texto_destino_motorista as string) ?? null,
        payload_enquete_whatsapp: (raw.payload_enquete_whatsapp as { name: string; options: string[]; selectableOptionsCount: number }) ?? null,
        endereco_origem: (dados.geolocalizacao_origem as string) ?? null,
        endereco_destino: null,
      };
    } catch (parseErr) {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "error",
        message: `LLM JSON parse failed: ${(parseErr instanceof Error ? parseErr.message : String(parseErr)).slice(0, 300)} | content: ${content.slice(0, 300)}`,
      });
      return null;
    }
    if (!parsed.texto_embarque_motorista) {
      await supabase.from("admin_logs").insert({
        source: "whatsapp_webhook", level: "warn",
        message: `LLM returned no texto_embarque_motorista: ${content.slice(0, 300)}`,
      });
    }
    return {
      eh_rua_oficial: !!parsed.eh_rua_oficial,
      origem_identificada_por_foto: !!parsed.origem_identificada_por_foto,
      intencao_usuario: parsed.intencao_usuario ?? null,
      geolocalizacao_origem: parsed.geolocalizacao_origem ?? null,
      texto_embarque_motorista: parsed.texto_embarque_motorista ?? null,
      geolocalizacao_destino: null,
      texto_destino_motorista: parsed.texto_destino_motorista ?? null,
      payload_enquete_whatsapp: parsed.payload_enquete_whatsapp ?? null,
      endereco_origem: parsed.geolocalizacao_origem ?? null,
      endereco_destino: null,
    } as ParsedRideIntent;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await supabase.from("admin_logs").insert({
      source: "whatsapp_webhook", level: "error", message: `LLM exception: ${errMsg.slice(0, 500)}` });
    return null;
  }
}

// Fuzzy search for POIs/suggestions in the bot_address_suggestions table.
// Uses ILIKE with accent-insensitive matching so "amarelinha do centro" matches
// "Amarelinha da Avenida" etc.
async function findAddressSuggestionFuzzy(
  connectionId: string,
  input: string,
): Promise<{ address_text: string; lat: number | null; lng: number | null } | null> {
  const { data: suggestions } = await supabase
    .from("bot_address_suggestions")
    .select("nickname, address_text, lat, lng")
    .eq("connection_id", connectionId);
  if (!suggestions || suggestions.length === 0) return null;

  const normalizedInput = deaccent(input);
  // Sort by similarity: exact > startsWith > includes > ILIKE
  let bestMatch: { address_text: string; lat: number | null; lng: number | null } | null = null;
  let bestScore = 0;

  for (const sug of suggestions) {
    const nick = deaccent(sug.nickname || "");
    const addr = deaccent(sug.address_text || "");
    let score = 0;
    if (nick === normalizedInput || addr === normalizedInput) score = 100;
    else if (nick && (nick.startsWith(normalizedInput) || normalizedInput.startsWith(nick))) score = 80;
    else if (nick && (nick.includes(normalizedInput) || normalizedInput.includes(nick))) score = 60;
    else if (addr && (addr.includes(normalizedInput) || normalizedInput.includes(addr))) score = 40;
    // Word-level overlap for partial matches like "amarelinha centro" vs "amarelinha da avenida centro"
    if (score === 0 && normalizedInput.length > 3) {
      const inputWords = normalizedInput.split(/\s+/).filter((w) => w.length > 2);
      const targetWords = (nick + " " + addr).split(/\s+/).filter((w) => w.length > 2);
      const overlap = inputWords.filter((w) => targetWords.some((t) => t.includes(w) || w.includes(t))).length;
      if (overlap >= Math.ceil(inputWords.length * 0.6)) score = 30 + overlap * 5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { address_text: sug.address_text, lat: sug.lat, lng: sug.lng };
    }
  }
  return bestScore >= 30 ? bestMatch : null;
}

// ── Fuzzy street matching helpers ──

// Normalize a street name for comparison: lowercase, remove accents, remove
// common prefixes (rua/avenida/av/r/travessa/alameda), remove special chars.
function normalizeStreetName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^(rua|avenida|av|av\.|travessa|tr|alameda|estrada|rodovia|viela|beco|praca|pca)\s+/i, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein distance between two strings (iterative, O(n*m)).
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Similarity ratio between two strings (0..1) based on Levenshtein distance.
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

interface StreetCacheEntry {
  id: string;
  street_name: string;
  street_name_normalized: string;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
}

interface FuzzyMatchResult {
  matches: Array<{ streetName: string; normalized: string; similarity: number; lat: number | null; lng: number | null; formatted: string | null }>;
}

// Look up streets in the cache for a given company + city that fuzzy-match
// the input street name. Returns matches sorted by similarity descending.
async function fuzzyMatchStreet(
  companyId: string,
  city: string | undefined,
  inputStreet: string,
): Promise<FuzzyMatchResult> {
  if (!companyId || !inputStreet) return { matches: [] };
  const normalizedInput = normalizeStreetName(inputStreet);
  if (normalizedInput.length < 3) return { matches: [] };

  let query = supabase
    .from("street_cache")
    .select("id, street_name, street_name_normalized, lat, lng, formatted_address")
    .eq("company_id", companyId);
  if (city) query = query.eq("city", city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const { data: streets, error } = await query.limit(500);

  if (error || !streets || streets.length === 0) return { matches: [] };

  const scored = (streets as StreetCacheEntry[])
    .map((s) => ({
      streetName: s.street_name,
      normalized: s.street_name_normalized,
      similarity: similarity(normalizedInput, s.street_name_normalized),
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
      formatted: s.formatted_address,
    }))
    .filter((s) => s.similarity >= 0.75)
    .sort((a, b) => b.similarity - a.similarity);

  return { matches: scored };
}

// Cache a successfully geocoded street for future fuzzy matching.
async function cacheStreet(
  companyId: string,
  city: string | undefined,
  state: string | undefined,
  streetName: string,
  lat: number,
  lng: number,
  formattedAddress: string,
): Promise<void> {
  if (!companyId || !streetName) return;
  const normalized = normalizeStreetName(streetName);
  if (normalized.length < 3) return;
  const cityNorm = city ? city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "unknown";
  try {
    await supabase
      .from("street_cache")
      .upsert(
        {
          company_id: companyId,
          city: cityNorm,
          state: state ?? "SP",
          street_name: streetName,
          street_name_normalized: normalized,
          lat,
          lng,
          formatted_address: formattedAddress,
        },
        { onConflict: "company_id,city,street_name_normalized", ignoreDuplicates: true },
      );
  } catch { /* best-effort */ }
}

// Extract the street name (without number) from a formatted address string.
function extractStreetName(formatted: string): string | null {
  // Try "Rua X, 123 - Bairro - Cidade - Estado" format
  const dashParts = formatted.split(" - ");
  if (dashParts.length >= 2) {
    const firstPart = dashParts[0].trim();
    // Remove house number from "Rua X, 123"
    const commaParts = firstPart.split(",");
    if (commaParts.length >= 1) return commaParts[0].trim();
  }
  // Try "Rua X, 123, Bairro, Cidade - Estado" format
  const commaParts = formatted.split(",");
  if (commaParts.length >= 2) return commaParts[0].trim();
  return null;
}

async function geocodeAddress(address: string, city?: string, state?: string, biasLat?: number, biasLng?: number): Promise<{ lat: number; lng: number; formatted: string } | null> {
  // Extract house number from the original address text so we can preserve it
  // in the formatted result even if the geocoder drops it.
  const houseNumberMatch = address.match(/\b(\d{1,6}(?:[A-Za-z]?)|s\/n)\b/i);
  const passengerHouseNumber = houseNumberMatch ? houseNumberMatch[1] : null;

  // 0. Fuzzy match against cached streets for this company + city
  fuzzyMatchesForCaller = [];
  if (companyIdForGeocoding && city) {
    const fuzzy = await fuzzyMatchStreet(companyIdForGeocoding, city, address);
    if (fuzzy.matches.length === 1 && fuzzy.matches[0].similarity >= 0.9 && fuzzy.matches[0].lat != null && fuzzy.matches[0].lng != null) {
      // Single high-confidence match (>= 90%) — use it directly
      const m = fuzzy.matches[0];
      let formatted = m.formatted ?? m.streetName;
      if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
        formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
      }
      await supabase.from("admin_logs").insert({
        company_id: companyIdForGeocoding, source: "whatsapp_webhook", level: "info",
        message: `FUZZY MATCH (auto): input="${address}" matched="${m.streetName}" sim=${(m.similarity * 100).toFixed(0)}%`,
      });
      return { lat: m.lat!, lng: m.lng!, formatted };
    }
    if (fuzzy.matches.length >= 2 && fuzzy.matches[0].similarity >= 0.75 && fuzzy.matches[0].lat != null) {
      // Multiple matches >= 75% — signal caller to present options
      fuzzyMatchesForCaller = fuzzy.matches.slice(0, 5);
      await supabase.from("admin_logs").insert({
        company_id: companyIdForGeocoding, source: "whatsapp_webhook", level: "info",
        message: `FUZZY MATCH (multi): input="${address}" matches=${fuzzy.matches.length} best="${fuzzy.matches[0].streetName}" sim=${(fuzzy.matches[0].similarity * 100).toFixed(0)}%`,
      });
      // Return null so the caller checks fuzzyMatchesForCaller before treating as not-found
      return null;
    }
  }

  // 1. Try Google Geocoding API if a key is configured (per-company or env)
  let googleKey: string | undefined;
  if (companyIdForGeocoding) {
    const { data: config } = await supabase
      .from("bot_transcription_config")
      .select("additional_config")
      .eq("company_id", companyIdForGeocoding)
      .maybeSingle();
    const extra = (config?.additional_config ?? {}) as Record<string, string>;
    googleKey = extra.google_geocoding_key;
  }
  if (!googleKey) {
    // Try integration_credentials table (per-company, then global fallback)
    if (companyIdForGeocoding) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials")
        .eq("tenant_id", companyIdForGeocoding)
        .eq("category", "maps")
        .eq("provider", "google_maps")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) googleKey = (cred.credentials as Record<string, string>).api_key;
    }
    if (!googleKey) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials")
        .is("tenant_id", null)
        .eq("category", "maps")
        .eq("provider", "google_maps")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) googleKey = (cred.credentials as Record<string, string>).api_key;
    }
  }
  if (!googleKey) googleKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");

  if (googleKey) {
    try {
      let googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=pt-BR&region=br&key=${googleKey}`;
      if (city) googleUrl += `&components=locality:${encodeURIComponent(city)}`;
      if (biasLat != null && biasLng != null) {
        googleUrl += `&bounds=${(biasLat - 0.45)},${(biasLng - 0.45)}|${(biasLat + 0.45)},${(biasLng + 0.45)}`;
      }
      const gResp = await fetch(googleUrl);
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData?.results?.length > 0) {
          const r = gData.results[0];
          let formatted = r.formatted_address ?? address;
          // Preserve passenger's house number if not in the formatted result
          if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
            formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
          }
          if (companyIdForGeocoding) { const sn = extractStreetName(formatted); if (sn) await cacheStreet(companyIdForGeocoding, city, state, sn, r.geometry.location.lat, r.geometry.location.lng, formatted); }
          return {
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            formatted,
          };
        }
      }
    } catch { /* fall through to Nominatim */ }
  }

  // 2. Fallback: Nominatim structured search (street + city) — most reliable for Brazilian streets
  const normalizedAddress = address.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
  if (city) {
    const streetOnly = normalizedAddress.replace(/^rua\s+/i, "").replace(/,\s*\d+\s*$/, "").trim();
    const structuredUrl = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(streetOnly)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state ?? "SP")}&countrycodes=br&format=json&limit=1&addressdetails=1`;
    try {
      const resp = await fetch(structuredUrl, { headers: { "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)" } });
      if (resp.ok) {
        const results = await resp.json();
        if (Array.isArray(results) && results.length > 0) {
          const r = results[0];
          let formatted = r.display_name ?? address;
          if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
            formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
          }
          if (companyIdForGeocoding) { const sn = extractStreetName(formatted); if (sn) await cacheStreet(companyIdForGeocoding, city, state, sn, parseFloat(r.lat), parseFloat(r.lon), formatted); }
          return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formatted };
        }
      }
    } catch { /* fall through to unstructured search */ }
  }

  // 3. Nominatim unstructured search with multiple query variants
  const queryCandidates = Array.from(new Set([
    city ? `${normalizedAddress}, ${city}, ${state ?? "SP"}` : normalizedAddress,
    city ? `${normalizedAddress.replace(/^rua\s+/i, "")}, ${city}, ${state ?? "SP"}` : normalizedAddress.replace(/^rua\s+/i, ""),
    city ? `${normalizedAddress.replace(/,\s*\d+\s*$/, "")}, ${city}, ${state ?? "SP"}` : normalizedAddress.replace(/,\s*\d+\s*$/, ""),
    city ? `${normalizedAddress.replace(/^rua\s+/i, "").replace(/,\s*\d+\s*$/, "")}, ${city}, ${state ?? "SP"}` : normalizedAddress.replace(/^rua\s+/i, "").replace(/,\s*\d+\s*$/, ""),
  ]));

  for (let candidateIdx = 0; candidateIdx < queryCandidates.length; candidateIdx++) {
    const candidateQ = queryCandidates[candidateIdx];
    let candidateUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(candidateQ)}&format=json&limit=1&countrycodes=br&addressdetails=1`;
    if (biasLat != null && biasLng != null) {
      const delta = 0.45;
      candidateUrl += `&viewbox=${biasLng - delta},${biasLat + delta},${biasLng + delta},${biasLat - delta}&bounded=1`;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(candidateUrl, { headers: { "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)" } });
        if (resp.ok) {
          const results = await resp.json();
          if (Array.isArray(results) && results.length > 0) {
            const r = results[0];
            let formatted = r.display_name ?? address;
            if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
              formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
            }
            if (companyIdForGeocoding) { const sn = extractStreetName(formatted); if (sn) await cacheStreet(companyIdForGeocoding, city, state, sn, parseFloat(r.lat), parseFloat(r.lon), formatted); }
            return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formatted };
          }
          // No results with bounded viewbox — try unbounded
          if (biasLat != null && biasLng != null) {
            const unboundedUrl = candidateUrl.replace(/&viewbox=[^&]+&bounded=1/, "");
            const resp2 = await fetch(unboundedUrl, { headers: { "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)" } });
            if (resp2.ok) {
              const results2 = await resp2.json();
              if (Array.isArray(results2) && results2.length > 0) {
                const r = results2[0];
                let formatted = r.display_name ?? address;
                if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
                  formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
                }
                if (companyIdForGeocoding) { const sn = extractStreetName(formatted); if (sn) await cacheStreet(companyIdForGeocoding, city, state, sn, parseFloat(r.lat), parseFloat(r.lon), formatted); }
                return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), formatted };
              }
            }
          }
          break; // try next candidate
        }
        if (resp.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2200));
          continue;
        }
        break;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1100));
      }
    }
  }

  // 3. Photon fallback — sometimes finds streets Nominatim misses
  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
    if (biasLat != null && biasLng != null) {
      photonUrl += `&lat=${biasLat}&lon=${biasLng}&radius=20`;
    }
    const photonResp = await fetch(photonUrl);
    if (photonResp.ok) {
      const photon = await photonResp.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> }> };
      const feat = photon.features?.[0];
      if (feat?.geometry?.coordinates) {
        const [lng, lat] = feat.geometry.coordinates;
        const props = feat.properties ?? {};
        let formatted = address;
        const street = props.street ?? props.name;
        if (street) {
          const parts = [street, props.city, props.state].filter(Boolean).map(String);
          formatted = parts.join(", ") || address;
        }
        if (passengerHouseNumber && !formatted.toLowerCase().includes(passengerHouseNumber.toLowerCase())) {
          formatted = preserveHouseNumberInFormatted(formatted, passengerHouseNumber);
        }
        if (companyIdForGeocoding) { const sn = extractStreetName(formatted); if (sn) await cacheStreet(companyIdForGeocoding, city, state, sn, lat, lng, formatted); }
        return { lat, lng, formatted };
      }
    }
  } catch { /* best-effort */ }

  return null;
}

// Insert the passenger's house number into the formatted address right after the street name.
// Handles "Street Name - Neighborhood - City - State" format (common in Brazil).
function preserveHouseNumberInFormatted(formatted: string, houseNumber: string): string {
  const parts = formatted.split(" - ");
  if (parts.length >= 2) {
    // Insert number after the first part (street name)
    parts[0] = `${parts[0]}, ${houseNumber}`;
    return parts.join(" - ");
  }
  // If format is comma-separated, insert after street
  const commaParts = formatted.split(", ");
  if (commaParts.length >= 2) {
    commaParts[0] = `${commaParts[0]}, ${houseNumber}`;
    return commaParts.join(", ");
  }
  return `${formatted} ${houseNumber}`;
}

// Module-level variable set during handleBotMessage so geocodeAddress can access
// the company ID for Google Geocoding key lookup without changing its signature.
let companyIdForGeocoding: string | null = null;

// Fuzzy match alternatives populated by geocodeAddress when multiple streets
// match the input with >= 75% similarity. The caller (handleBotMessage) reads
// this to present interactive options to the passenger.
let fuzzyMatchesForCaller: Array<{ streetName: string; normalized: string; similarity: number; lat: number | null; lng: number | null; formatted: string | null }> = [];

function cleanAddressPart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function formatReverseAddress(data: Record<string, unknown>): string | null {
  const street = cleanAddressPart(data.streetName ?? data.road ?? data.street ?? data.pedestrian ?? data.residential);
  const number = cleanAddressPart(data.houseNumber ?? data.house_number ?? data.housenumber);
  const neighborhood = cleanAddressPart(data.district ?? data.neighbourhood ?? data.suburb ?? data.city_district);
  const city = cleanAddressPart(data.city ?? data.town ?? data.municipality ?? data.locality);
  const state = cleanAddressPart(data.principalSubdivision ?? data.state);
  const parts = [
    street ? (number ? `${street}, ${number}` : street) : null,
    neighborhood,
    city,
    state,
  ].filter((part, index, all) => part && all.indexOf(part) === index) as string[];
  if (!street && !number) return null;
  return parts.length > 0 ? parts.join(" - ") : null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Nominatim first — at zoom=18 it returns street-level detail (road + housenumber).
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1&zoom=18&accept-language=pt-BR`;
    const nomResp = await fetch(nomUrl, {
      headers: {
        "User-Agent": "VeloovBot/1.0 (contato@veloov.com.br)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (nomResp.ok) {
      const data = await nomResp.json() as Record<string, unknown>;
      const address = data.address as Record<string, unknown> | undefined;
      const formatted = address ? formatReverseAddress(address) : null;
      if (formatted) return formatted;
      const displayName = cleanAddressPart(data.display_name);
      if (displayName) return displayName;
    }
  } catch { /* try the next provider */ }

  // BigDataCloud fallback — no API key needed, but may only return neighborhood/city.
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=pt`;
    const bdcResp = await fetch(bdcUrl);
    if (bdcResp.ok) {
      const bdc = await bdcResp.json() as Record<string, unknown>;
      const formatted = formatReverseAddress(bdc);
      if (formatted) return formatted;
    }
  } catch { /* try the next provider */ }

  // Photon fallback is useful when Nominatim is rate-limited from an Edge Function.
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const photonResp = await fetch(photonUrl);
    if (photonResp.ok) {
      const photon = await photonResp.json() as { features?: Array<{ properties?: Record<string, unknown> }> };
      const properties = photon.features?.[0]?.properties;
      if (properties) {
        const formatted = formatReverseAddress(properties);
        if (formatted) return formatted;
      }
    }
  } catch { /* no address provider available */ }

  return null;
}

function normalizeAudioMime(mimetype: string): string {
  const mt = (mimetype || "").toLowerCase().trim();
  if (mt.includes("audio/ogg") || mt.includes("opus")) return "audio/ogg";
  if (mt.includes("audio/mp4") || mt.includes("audio/m4a")) return "audio/mp4";
  if (mt.includes("audio/mpeg") || mt.includes("audio/mp3")) return "audio/mpeg";
  if (mt.includes("audio/webm")) return "audio/webm";
  if (mt.includes("audio/wav") || mt.includes("audio/wave")) return "audio/wav";
  if (mt.includes("audio/flac")) return "audio/flac";
  return "audio/ogg";
}

function normalizeAudioExt(mimetype: string): string {
  const mt = (mimetype || "").toLowerCase().trim();
  if (mt.includes("audio/ogg") || mt.includes("opus") || mt.includes("octet-stream")) return "ogg";
  if (mt.includes("audio/mp4") || mt.includes("audio/m4a")) return "mp4";
  if (mt.includes("audio/mpeg") || mt.includes("audio/mp3")) return "mp3";
  if (mt.includes("audio/webm")) return "webm";
  if (mt.includes("audio/wav") || mt.includes("audio/wave")) return "wav";
  if (mt.includes("audio/flac")) return "flac";
  return "ogg";
}

/**
 * Decrypts WhatsApp encrypted media (audio) using HKDF-SHA256 + AES-CBC.
 * WhatsApp encrypts media with a mediaKey derived via HKDF into a 112-byte
 * key split: 16 bytes IV, 32 bytes cipher key, 32 bytes mac key, 32 bytes
 * ref key. The last 10 bytes of the downloaded file are the HMAC-SHA256 mac.
 */
async function decryptWhatsAppAudio(
  mediaUrl: string,
  mediaKeyRaw: unknown,
  companyId: string,
): Promise<string | null> {
  // Convert mediaKey to Uint8Array regardless of input format
  let mediaKey: Uint8Array;
  if (typeof mediaKeyRaw === "string") {
    // Could be base64 or base64url
    let b64 = mediaKeyRaw.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    // Strip data: prefix if present
    if (b64.startsWith("data:")) b64 = b64.split(",")[1] ?? b64;
    try {
      const binary = atob(b64);
      mediaKey = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) mediaKey[i] = binary.charCodeAt(i);
    } catch {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "error",
        message: `mediaKey base64 decode failed, len=${mediaKeyRaw.length}, first20=${mediaKeyRaw.slice(0, 20)}`,
      });
      return null;
    }
  } else if (mediaKeyRaw instanceof Uint8Array || mediaKeyRaw instanceof ArrayBuffer) {
    mediaKey = new Uint8Array(mediaKeyRaw);
  } else if (Array.isArray(mediaKeyRaw)) {
    mediaKey = new Uint8Array(mediaKeyRaw as number[]);
  } else {
    const obj = mediaKeyRaw as Record<string, unknown>;
    if (obj?.type === "Buffer" && Array.isArray(obj.data)) {
      mediaKey = new Uint8Array(obj.data as number[]);
    } else {
      // Object with numeric keys (0,1,2,...) — serialized Uint8Array/Buffer
      const keys = obj ? Object.keys(obj) : [];
      const allNumeric = keys.length > 0 && keys.every((k) => /^\d+$/.test(k));
      if (allNumeric) {
        const maxIdx = Math.max(...keys.map((k) => Number(k)));
        mediaKey = new Uint8Array(maxIdx + 1);
        for (const k of keys) {
          mediaKey[Number(k)] = Number(obj[k]);
        }
      } else {
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "error",
          message: `mediaKey unknown format: ${typeof mediaKeyRaw}, keys=${keys.join(",")}`,
        });
        return null;
      }
    }
  }

  await supabase.from("admin_logs").insert({
    company_id: companyId,
    source: "whatsapp_webhook",
    level: "info",
    message: `mediaKey decoded: ${mediaKey.length} bytes`,
  });

  // Download media from CDN (may be encrypted or already decrypted if Evolution uses MinIO/S3)
  const mediaResp = await fetch(mediaUrl, {
    headers: { "User-Agent": "WhatsApp/2.0" },
  });
  if (!mediaResp.ok) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "error",
      message: `CDN audio download failed: HTTP ${mediaResp.status}, url=${mediaUrl.slice(0, 80)}`,
    });
    return null;
  }
  const downloadedBytes = new Uint8Array(await mediaResp.arrayBuffer());

  // Check first bytes to determine if already decrypted audio
  const headerHex = Array.from(downloadedBytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const isOgg = downloadedBytes[0] === 0x4f && downloadedBytes[1] === 0x67 && downloadedBytes[2] === 0x67 && downloadedBytes[3] === 0x53;
  const isMp4 = downloadedBytes[4] === 0x66 && downloadedBytes[5] === 0x74 && downloadedBytes[6] === 0x79 && downloadedBytes[7] === 0x70;
  const isWebM = downloadedBytes[0] === 0x1a && downloadedBytes[1] === 0x45 && downloadedBytes[2] === 0xdf && downloadedBytes[3] === 0xa3;

  await supabase.from("admin_logs").insert({
    company_id: companyId,
    source: "whatsapp_webhook",
    level: "info",
    message: `CDN download: ${downloadedBytes.length} bytes, header: ${headerHex}, isOgg=${isOgg}, isMp4=${isMp4}, isWebM=${isWebM}`,
  });

  // If already decrypted audio (Evolution MinIO/S3), return directly as base64
  if (isOgg || isMp4 || isWebM) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `CDN returned decrypted audio — using directly without HKDF`,
    });
    let binary = "";
    for (let i = 0; i < downloadedBytes.length; i++) binary += String.fromCharCode(downloadedBytes[i]);
    return btoa(binary);
  }

  const encryptedBytes = downloadedBytes;

  // HKDF: derive 112 bytes from mediaKey using WhatsApp's app-specific info
  // WhatsApp uses: "WhatsApp Audio Keys" for audio, with zero salt
  const info = new TextEncoder().encode("WhatsApp Audio Keys");
  const salt = new Uint8Array(32);

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    mediaKey as BufferSource,
    "HKDF",
    false,
    ["deriveBits"],
  );
  const expandedKey = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
      hkdfKey,
      112 * 8,
    ),
  );

  // Split: iv (16) + cipherKey (32) + macKey (32) + refKey (32)
  const iv = expandedKey.slice(0, 16);
  const cipherKey = expandedKey.slice(16, 48);
  const macKey = expandedKey.slice(48, 80);

  // Encrypted media: last 10 bytes are MAC, rest is ciphertext
  const mac = encryptedBytes.slice(encryptedBytes.length - 10);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 10);

  // Verify HMAC-SHA256 (first 10 bytes of HMAC match the mac)
  const macKeyObj = await crypto.subtle.importKey(
    "raw",
    macKey as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computedMacFull = await crypto.subtle.sign("HMAC", macKeyObj, ciphertext as BufferSource);
  const computedMac = new Uint8Array(computedMacFull).slice(0, 10);
  let macValid = true;
  for (let i = 0; i < 10; i++) {
    if (computedMac[i] !== mac[i]) { macValid = false; break; }
  }
  if (!macValid) {
    // MAC failed — try decrypting anyway as a last resort (some providers use non-standard encryption)
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "warn",
      message: `WhatsApp audio MAC verification failed — attempting decryption anyway`,
    });
  }

  // Decrypt with AES-CBC, no padding (raw decryption, strip padding manually)
  const cipherKeyObj = await crypto.subtle.importKey(
    "raw",
    cipherKey as BufferSource,
    { name: "AES-CBC", iv: iv as BufferSource },
    false,
    ["decrypt"],
  );

  try {
    // Pad ciphertext to multiple of 16 if needed
    const paddedLen = Math.ceil(ciphertext.length / 16) * 16;
    const paddedCiphertext = new Uint8Array(paddedLen);
    paddedCiphertext.set(ciphertext, 0);
    if (paddedLen > ciphertext.length) {
      paddedCiphertext.fill(0, ciphertext.length);
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv as BufferSource },
      cipherKeyObj,
      paddedCiphertext as BufferSource,
    );
    const decryptedBytes = new Uint8Array(decrypted);
    // Convert to base64
    let binary = "";
    for (let i = 0; i < decryptedBytes.length; i++) binary += String.fromCharCode(decryptedBytes[i]);
    return btoa(binary);
  } catch (err) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "error",
      message: `AES-CBC decrypt failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
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
    // Try integration_credentials table (per-company, then global fallback)
    if (companyId) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials, provider")
        .eq("tenant_id", companyId)
        .eq("category", "transcription")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) {
        const c = cred.credentials as Record<string, string>;
        if (c.api_key) { apiKey = c.api_key; provider = cred.provider; }
      }
    }
    if (!apiKey) {
      const { data: cred } = await supabase
        .from("integration_credentials")
        .select("credentials, provider")
        .is("tenant_id", null)
        .eq("category", "transcription")
        .eq("is_active", true)
        .order("priority")
        .limit(1)
        .maybeSingle();
      if (cred?.credentials) {
        const c = cred.credentials as Record<string, string>;
        if (c.api_key) { apiKey = c.api_key; provider = cred.provider; }
      }
    }
  }
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
      audioBlob = new Blob([bytes], { type: normalizeAudioMime(mimetype) });
    } else if (audioBase64OrUrl.startsWith("http")) {
      const resp = await fetch(audioBase64OrUrl);
      audioBlob = await resp.blob();
    } else {
      const binaryStr = atob(audioBase64OrUrl);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      audioBlob = new Blob([bytes], { type: normalizeAudioMime(mimetype) });
    }

    // OpenAI & Groq share the same Whisper-compatible API
    if (provider === "openai" || provider === "groq") {
      const apiUrl = provider === "openai"
        ? "https://api.openai.com/v1/audio/transcriptions"
        : "https://api.groq.com/openai/v1/audio/transcriptions";
      // Derive a valid file extension from the mimetype so Groq accepts the payload
      const ext = normalizeAudioExt(mimetype);
      const fileName = `audio.${ext}`;
      const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
      const signature = Array.from(audioBytes.slice(0, 4)).map((byte) => String.fromCharCode(byte)).join("");
      const formData = new FormData();
      formData.append("file", new Blob([audioBytes], { type: normalizeAudioMime(mimetype) }), fileName);
      formData.append("model", provider === "openai" ? "whisper-1" : "whisper-large-v3");
      formData.append("language", "pt");
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.error(`[transcribeAudio] ${provider} HTTP ${resp.status}: ${errBody.slice(0, 500)}`);
        if (companyId) {
          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_webhook",
            level: "error",
            message: `Falha na transcricao: HTTP ${resp.status}, arquivo=${fileName}, bytes=${audioBytes.length}, assinatura=${JSON.stringify(signature)}, resposta=${errBody.slice(0, 300)}`,
          });
        }
        return null;
      }
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
  } catch (err) {
    console.error(`[transcribeAudio] exception: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  });
}

// Splits a combined message like "Quero um carro na rua Arthur mesquita 57 vou para amarelinha do centro"
// into { pickup: "rua Arthur mesquita 57", destination: "amarelinha do centro" }
// Returns null if no destination separator is found.
function parseCombinedAddress(rawText: string): { pickup: string; destination: string } | null {
  const deaccented = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Common separators passengers use to split pickup from destination
  const separators = [
    /\be vou la no\b/i,
    /\be vou la na\b/i,
    /\be vou para\b/i,
    /\be vou pra\b/i,
    /\be vou no\b/i,
    /\be vou na\b/i,
    /\be vou\b/i,
    /\bvou para\b/i,
    /\bvou pra\b/i,
    /\bvou la no\b/i,
    /\bvou la na\b/i,
    /\bvou no\b/i,
    /\bvou na\b/i,
    /\bvou pro\b/i,
    /\bvou pra\b/i,
    /\blevo no\b/i,
    /\blevo na\b/i,
    /\blevar no\b/i,
    /\blevar na\b/i,
    /\bquero ir para\b/i,
    /\bquero ir pra\b/i,
    /\bquero ir no\b/i,
    /\bquero ir na\b/i,
    /\bir para\b/i,
    /\bir pra\b/i,
    /\bir no\b/i,
    /\bir na\b/i,
    /\bdestino\b/i,
    /\bpara a\b/i,
    /\bpara o\b/i,
    /\bpra\b/i,
  ];
  for (const sep of separators) {
    const match = deaccented.match(sep);
    if (match && match.index != null) {
      const sepEnd = match.index + match[0].length;
      let pickup = deaccented.slice(0, match.index).trim();
      let destination = deaccented.slice(sepEnd).trim();
      pickup = pickup.replace(/^(?:eu\s+)?(?:quero|preciso|gostaria)[\s\S]*?\b(?:aqui\s+)?(?:na|no|em)\s+/i, "").trim();
      pickup = pickup.replace(/^(?:estou|to|estou aqui)\s+(?:na|no|em)\s+/i, "").trim();
      pickup = pickup.replace(/^(?:aqui\s+)?(?:na|no|em)\s+/i, "").trim();
      destination = destination.replace(/^(?:la\s+|lá\s+)?(?:na|no|em|para|pra|pro)\s+/i, "").trim();
      if (pickup && destination) {
        return { pickup, destination };
      }
    }
  }
  return null;
}

function looksLikeOfficialAddress(text: string): boolean {
  return /\b(?:rua|avenida|av\.?|travessa|alameda|estrada|rodovia|viela|beco)\b[\s\S]*\b\d{1,6}\b/i.test(text);
}

function cleanPickupReference(text: string): string {
  const combined = parseCombinedAddress(text);
  if (combined) return normalizePlaceText(combined.pickup) ?? text.trim();
  return normalizePlaceText(text)
    ?.replace(/^(?:eu\s+)?(?:quero|preciso|gostaria)[\s\S]*?\b(?:aqui\s+)?(?:na|no|em)\s+/i, "")
    .replace(/^(?:estou|to)\s+(?:na|no|em)\s+/i, "")
    .trim() ?? text.trim();
}

async function getCompanyLocationInfo(companyId: string, connectionId?: string): Promise<{ city: string | null; state: string | null; lat: number | null; lng: number | null; slug: string | null; totemName: string | null; pickupAddress: string | null }> {
  // If a bot connection is provided, try its linked location first (per-totem city)
  if (connectionId) {
    const { data: conn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("location_id")
      .eq("id", connectionId)
      .maybeSingle();
    if (conn?.location_id) {
      const { data: loc } = await supabase
        .from("company_locations")
        .select("city, state, lat, lng, name, pickup_address")
        .eq("id", conn.location_id)
        .maybeSingle();
      if (loc) {
        const { data: company } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", companyId)
          .maybeSingle();
        return {
          city: loc.city ?? null,
          state: loc.state ?? null,
          lat: loc.lat ?? null,
          lng: loc.lng ?? null,
          slug: company?.slug ?? null,
          totemName: loc.name ?? null,
          pickupAddress: loc.pickup_address ?? null,
        };
      }
    }
  }

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
    totemName: null,
    pickupAddress: null,
  };
}

async function getCategoriesForConnection(companyId: string, connectionId?: string): Promise<{ id: string; label: string; machine_category_id: string | null }[]> {
  let conn: { bot_category_ids: string[] | null; location_id: string | null } | null = null;
  if (connectionId) {
    const { data } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("bot_category_ids, location_id")
      .eq("id", connectionId)
      .maybeSingle();
    conn = data as typeof conn;
  } else {
    const { data } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("bot_category_ids, location_id")
      .eq("company_id", companyId)
      .eq("connection_status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conn = data as typeof conn;
  }

  if (conn) {
    const catIds = conn.bot_category_ids as string[] | null;
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
      return deduped;
    }
    return [];
  }

  // Fallback only when no bot connection exists for the company.
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
  originReference?: string | null,
  destinationReference?: string | null,
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
      origin_reference: originReference ?? null,
      category_label: categoryLabel,
      payment_method: paymentMethod,
      ...(destination ? {
        destination_label: destination.address,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      } : {}),
      destination_reference: destinationReference ?? null,
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
        payment_method: paymentMethod ?? "",
        origin_reference: originReference ?? null,
        destination_reference: destinationReference ?? null,
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

type FlowSettings = {
  show_welcome_menu: boolean;
  ask_destination: boolean;
  ask_payment: boolean;
  ask_category: boolean;
  confirm_address: boolean;
};

const FLOW_DEFAULTS: FlowSettings = {
  show_welcome_menu: true,
  ask_destination: true,
  ask_payment: true,
  ask_category: true,
  confirm_address: true,
};

async function dispatchRideFromConversation(
  companyId: string,
  cleanPhone: string,
  connectionId: string | undefined,
  conv: BotConversation,
  msg: (key: string, fallback: string) => string,
  paymentMethod: string | null,
): Promise<void> {
  const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
  if (!companyLoc.slug) {
    await sendBotMessage(companyId, cleanPhone, connectionId, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
    return;
  }

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
  const originReference = conv.origin_reference ?? null;
  const destinationReference = conv.destination_reference ?? null;

  const destination = conv.destination_lat != null && conv.destination_lng != null
    ? { lat: conv.destination_lat, lng: conv.destination_lng, address: conv.destination_formatted || conv.destination_text || "" }
    : null;

  const result = await createAndDispatchRide(
    companyId, companyLoc.slug, passengerName, cleanPhone,
    origin, categoryLabel, machineCategoryId, paymentMethod,
    destination, originReference, destinationReference,
  );

  if (result.success) {
    await supabase.from("bot_conversas")
      .update({ state: "corrida_solicitada", ride_id: result.rideId, selected_payment_method: paymentMethod, updated_at: new Date().toISOString() })
      .eq("id", conv.id);

    try {
      const addrText = conv.address_text || "";
      if (addrText) {
        const { data: existing } = await supabase.from("passenger_frequent_addresses").select("id, use_count").eq("company_id", companyId).eq("phone", cleanPhone).ilike("address_text", addrText).maybeSingle();
        if (existing) {
          await supabase.from("passenger_frequent_addresses").update({ use_count: (existing.use_count || 0) + 1, last_used_at: new Date().toISOString(), address_formatted: conv.address_formatted ?? null, address_lat: conv.address_lat ?? null, address_lng: conv.address_lng ?? null, origin_reference: conv.origin_reference ?? null }).eq("id", existing.id);
        } else {
          await supabase.from("passenger_frequent_addresses").insert({ company_id: companyId, phone: cleanPhone, address_text: addrText, address_formatted: conv.address_formatted ?? null, address_lat: conv.address_lat ?? null, address_lng: conv.address_lng ?? null, origin_reference: conv.origin_reference ?? null, use_count: 1, last_used_at: new Date().toISOString() });
        }
      }
    } catch { /* best-effort */ }

    let successMsg = result.machineMessage;
    if (successMsg) {
      successMsg = successMsg.replace(/(?:passageiro|nome|cliente)\s*:\s*[^\n]+/gi, "").replace(/(?:telefone|fone|whatsapp|celular)\s*:\s*\+?\d[\d\s\-()]{6,}/gi, "").replace(/\b\d{10,13}\b/g, (m) => m.length >= 10 && m.length <= 13 && /^\d+$/.test(m) ? "" : m).replace(/\n{3,}/g, "\n\n").trim();
      if (!successMsg) successMsg = null;
    }
    const payInfo = paymentMethod ? ` Pagamento: ${paymentMethod}.` : "";
    successMsg = successMsg || msg("ride_success", `\u2705 Corrida solicitada com sucesso!${payInfo} Um motorista vai aceitar em breve. Aguarde.`);
    await sendBotMessage(companyId, cleanPhone, connectionId, successMsg);

    await supabase.from("admin_logs").insert({ company_id: companyId, source: "whatsapp_bot", level: "info", message: `Corrida solicitada via bot por ${passengerName} (${cleanPhone}) \u2014 categoria: ${categoryLabel}${paymentMethod ? `, pagamento: ${paymentMethod}` : ""}, endereco: ${origin.address}${destination ? `, destino: ${destination.address}` : ""}`, ride_id: result.rideId });
  } else {
    if (result.rideId) await supabase.from("rides").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", result.rideId);
    await sendBotMessage(companyId, cleanPhone, connectionId, msg("ride_error", `\u274C Houve um erro ao solicitar a corrida: ${result.error ?? "erro desconhecido"}.\n\nPara tentar novamente, envie uma mensagem.`));
    await supabase.from("bot_conversas").update({ state: "menu_inicial", ride_id: null, updated_at: new Date().toISOString() }).eq("id", conv.id);
  }
}

async function proceedAfterDestination(
  companyId: string,
  cleanPhone: string,
  connectionId: string | undefined,
  convId: string,
  msg: (key: string, fallback: string) => string,
  flow: FlowSettings,
): Promise<void> {
  const categories = await getCategoriesForConnection(companyId, connectionId);

  if (flow.ask_category && categories.length > 1) {
    await supabase.from("bot_conversas")
      .update({ state: "aguardando_categoria", updated_at: new Date().toISOString() })
      .eq("id", convId);
    await sendPollMessage(companyId, cleanPhone, connectionId,
      msg("ask_category", "\u{1F3C6} Qual categoria voce deseja?"),
      categories.map((c) => ({ id: `cat_${c.id}`, label: c.label })),
    );
    return;
  }

  const category = categories[0] ?? null;

  if (!flow.ask_payment) {
    await supabase.from("bot_conversas").update({ selected_category_id: category?.id ?? null, updated_at: new Date().toISOString() }).eq("id", convId);
    const { data: freshConv } = await supabase.from("bot_conversas").select("*").eq("id", convId).maybeSingle();
    if (freshConv) await dispatchRideFromConversation(companyId, cleanPhone, connectionId, freshConv as BotConversation, msg, null);
    return;
  }

  await supabase.from("bot_conversas")
    .update({
      state: "aguardando_pagamento",
      selected_category_id: category?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", convId);
  await sendPollMessage(companyId, cleanPhone, connectionId,
    msg("ask_payment", "\u{1F4B0} Qual a forma de pagamento?"),
    [
      { id: "pay_dinheiro", label: "Dinheiro \u{1F4B5}" },
      { id: "pay_pix", label: "Pix \u{1F9EC}" },
      { id: "pay_cartao", label: "Cartao \u{1F4B3}" },
    ],
  );
}

async function handleBotMessage(
  companyId: string,
  cleanPhone: string,
  text: string | null,
  pushName: string | null,
  location: { lat: number; lng: number } | null,
  audio: { data: string; mimetype: string } | null,
  connectionId?: string,
  image?: { data: string; mimetype: string } | null,
): Promise<void> {
  companyIdForGeocoding = companyId;
  // Load custom messages for this connection
  let customMessages: Record<string, string> = {};
  let flow: FlowSettings = { ...FLOW_DEFAULTS };
  if (connectionId) {
    const { data: conn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("bot_custom_messages, bot_flow_settings")
      .eq("id", connectionId)
      .maybeSingle();
    if (conn?.bot_custom_messages) customMessages = conn.bot_custom_messages as Record<string, string>;
    if (conn?.bot_flow_settings) flow = { ...FLOW_DEFAULTS, ...(conn.bot_flow_settings as Record<string, boolean>) };
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

    if (!text && !location && !audio && !image) {
      if (flow.show_welcome_menu) {
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("welcome_menu", "\u{1F44B} Ola! Como podemos ajudar?"), [{ id: "menu_corrida", label: "Solicitar corrida \u{1F695}" }, { id: "menu_suporte", label: "Suporte \u{1F4AC}" }]);
      } else {
        await supabase.from("bot_conversas").update({ state: "aguardando_endereco", updated_at: new Date().toISOString() }).eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "\u{1F4CD} Ola! Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
      }
      return;
    }
  }

  if (!conv.passenger_name && pushName) {
    await supabase.from("bot_conversas")
      .update({ passenger_name: pushName, updated_at: new Date().toISOString() })
      .eq("id", conv.id);
    conv.passenger_name = pushName;
  }

  // Human takeover: if an attendant has taken over this conversation, the bot stays silent.
  // Incoming messages are still saved (done by the caller), but no bot replies are sent.
  if (conv.human_takeover) {
    return;
  }

  // Map poll vote labels back to button IDs so the state machine can process them.
  // Poll votes arrive as the option text (e.g. "Solicitar corrida") not the button ID.
  const pollLabelMap: Record<string, string> = {
    "solicitar corrida": "menu_corrida",
    "suporte": "menu_suporte",
    "digitar endereco": "dest_digitar",
    "nao informar": "dest_nao_informar",
    "sim, confirmar": "conf_sim",
    "nao, corrigir": "conf_nao",
    "sim": "conf_sim",
    "nao": "conf_nao",
    "sim, cancelar": "btn_cancelar_sim",
    "nao, manter": "btn_cancelar_nao",
    "dinheiro": "pay_dinheiro",
    "pix": "pay_pix",
    "cartao": "pay_cartao",
    "outro endereco": "freq_new",
  };
  const rawText = (text ?? "").trim();
  const lowerRaw = rawText.toLowerCase();

  // WhatsApp poll providers may return a number, the full option label, or its button id.
  // Resolve all cancel-confirmation variants before the global cancel shortcut runs.
  if (conv.state === "aguardando_cancelamento" && rawText) {
    const cancelReply = deaccent(rawText).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    if (cancelReply === "1" || cancelReply.startsWith("1 sim") || cancelReply.includes("sim cancelar") || cancelReply === "btn cancelar sim" || cancelReply === "conf sim" || cancelReply === "cancelar") {
      text = "btn_cancelar_sim";
    } else if (cancelReply === "2" || cancelReply.startsWith("2 nao") || cancelReply.includes("nao manter") || cancelReply === "btn cancelar nao" || cancelReply === "conf nao" || cancelReply === "manter") {
      text = "btn_cancelar_nao";
    }
  }

  if (rawText) {
    if (pollLabelMap[lowerRaw]) {
      text = pollLabelMap[lowerRaw];
    } else {
      for (const [label, id] of Object.entries(pollLabelMap)) {
        if (lowerRaw.startsWith(label)) {
          text = id;
          break;
        }
      }
    }
  }

  const normalizedText = deaccent(text ?? "");

  // Handle the cancel confirmation before the global cancel-request shortcut.
  if (conv.state === "aguardando_cancelamento" && isCancelConfirmation(text ?? "")) {
    // Confirming a cancellation must cancel the active ride instead of asking again.
    if (isCancelConfirmation(text ?? "")) {
      // Find active ride for this passenger
      const { data: activeRide } = await supabase
        .from("rides")
        .select("id, status, machine_order_id, passenger_name, company_id")
        .eq("company_id", companyId)
        .eq("passenger_phone", cleanPhone)
        .in("status", ["pending", "accepted", "en_route", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeRide) {
        // Cancel in Machine API if applicable
        if (activeRide.machine_order_id) {
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
              await fetch(`${baseUrl}/api/v2/integracao/corridas/${activeRide.machine_order_id}/cancelar`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "api-key": apiKey,
                  "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
                },
                body: JSON.stringify({ motivo_id: 1 }),
              });
            } catch { /* best-effort */ }
          }
        }

        await supabase.from("rides").update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        }).eq("id", activeRide.id);

        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_bot",
          level: "info",
          message: `Corrida ${activeRide.id.slice(0, 8)} cancelada via bot por ${activeRide.passenger_name} (${cleanPhone})`,
          ride_id: activeRide.id,
        });
      }

      // Reset bot conversation so passenger can request a new ride
      await supabase.from("bot_conversas")
        .update({ state: "menu_inicial", ride_id: null, address_text: null, address_lat: null, address_lng: null, address_formatted: null, destination_text: null, destination_lat: null, destination_lng: null, destination_formatted: null, selected_category_id: null, selected_payment_method: null, updated_at: new Date().toISOString() })
        .eq("id", conv.id);

      await sendBotMessage(companyId, cleanPhone, connectionId, "\u2705 Sua corrida foi cancelada com sucesso. Para solicitar uma nova viagem, envie uma mensagem.");
      return;
    }

    // If in confirmation state and user says no, abort cancel
    if (conv.state === "aguardando_cancelamento" && isCancelDenial(text ?? "")) {
      await supabase.from("bot_conversas")
        .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      await sendBotMessage(companyId, cleanPhone, connectionId, "\u2705 Cancelamento abortado. Sua corrida continua ativa.");
      return;
    }

    // First cancel request — check if there's an active ride for THIS passenger, then ask for confirmation
    const { data: activeRide } = await supabase
      .from("rides")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("passenger_phone", cleanPhone)
      .in("status", ["pending", "accepted", "en_route", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRide) {
      await supabase.from("bot_conversas")
        .update({ state: "aguardando_cancelamento", updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      await sendPollMessage(companyId, cleanPhone, connectionId,
        "\u26A0\uFE0F Voce realmente deseja cancelar sua corrida?",
        [{ id: "btn_cancelar_sim", label: "Sim, cancelar \u2705" }, { id: "btn_cancelar_nao", label: "Nao, manter \u{1F695}" }],
      );
      return;
    }

    // No active ride — just reset
    await supabase.from("bot_conversas")
      .update({ state: "menu_inicial", ride_id: null, address_text: null, address_lat: null, address_lng: null, address_formatted: null, destination_text: null, destination_lat: null, destination_lng: null, destination_formatted: null, selected_category_id: null, selected_payment_method: null, updated_at: new Date().toISOString() })
      .eq("id", conv.id);
    await sendBotMessage(companyId, cleanPhone, connectionId, "\u2705 Nao ha corrida ativa para cancelar. Para solicitar uma nova viagem, envie uma mensagem.");
    return;
  }

  // Global cancel handler — works in any bot state. Asks for confirmation before canceling.
  if (normalizedText.includes("cancel") || normalizedText === "cancelar" || normalizedText === "cancela" || normalizedText === "btn_cancelar" || deaccent(text ?? "").startsWith("cansel")) {
    switch (conv.state) {
      case "aguardando_cancelamento":
        if (isCancelDenial(text ?? "")) {
          await supabase.from("bot_conversas")
            .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, "✅ Cancelamento abortado. Sua corrida continua ativa.");
          return;
        }
        break;
    }

    const { data: activeRide } = await supabase
      .from("rides")
      .select("id, status")
      .eq("company_id", companyId)
      .eq("passenger_phone", cleanPhone)
      .in("status", ["pending", "accepted", "en_route", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRide) {
      await supabase.from("bot_conversas")
        .update({ state: "aguardando_cancelamento", updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      await sendPollMessage(companyId, cleanPhone, connectionId,
        "⚠️ Você realmente deseja cancelar sua corrida?",
        [{ id: "btn_cancelar_sim", label: "Sim, cancelar ✅" }, { id: "btn_cancelar_nao", label: "Não, manter 🚕" }],
      );
      return;
    }

    await supabase.from("bot_conversas")
      .update({ state: "menu_inicial", ride_id: null, address_text: null, address_lat: null, address_lng: null, address_formatted: null, destination_text: null, destination_lat: null, destination_lng: null, destination_formatted: null, selected_category_id: null, selected_payment_method: null, updated_at: new Date().toISOString() })
      .eq("id", conv.id);
    await sendBotMessage(companyId, cleanPhone, connectionId, "✅ Não há corrida ativa para cancelar. Para solicitar uma nova viagem, envie uma mensagem.");
    return;
  }

  switch (conv.state) {
    case "menu_inicial":
    case "inicio": {
      // A location sent from the menu is already the pickup point.
      if (!text && location) {
        const pickupAddress = await reverseGeocode(location.lat, location.lng) ??
          "Localizacao compartilhada pelo passageiro";
        await supabase.from("bot_conversas")
          .update({
            state: "aguardando_destino",
            address_text: pickupAddress,
            address_lat: location.lat,
            address_lng: location.lng,
            address_formatted: pickupAddress,
            origin_reference: normalizePlaceText(pickupAddress),
            address_is_fallback: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.id);
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("ask_destination", "\u{1F3AF} Para onde voce vai?"), [{ id: "dest_digitar", label: "Digitar Endereco \u{1F4DD}" }, { id: "dest_nao_informar", label: "Nao informar \u{1F6AB}" }]);
        break;
      }

      // If passenger sent an image, ask for a typed address instead (photos are not processed).
      if (image) {
        await sendBotMessage(companyId, cleanPhone, connectionId, "\u{1F4F7} Nao consigo usar fotos. Por favor, digite o endereco de embarque ou envie sua localizacao (clipe \u{1F4CE} > Localizacao).");
        break;
      }

      // If passenger sent audio without text, treat it as a ride request.
      if (!text && audio) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "\u{1F4CD} Perfeito! Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
        break;
      }
      const looksLikeRideDetails = normalizedText.length > 3 &&
        ["estou", "to ", "tô ", "vou ", "para ", "pra ", "em ", "na ", "no ", "leva", "leva ", "me pega", "me busca", "quero ir", "ir pro", "ir pra", "indo", "origem", "destino", "embarque", "rua ", "avenida ", "praca ", "travessa "].some((marker) => normalizedText.includes(marker));
      const requestedRide = ["1", "corrida", "sim", "quero", "viagem", "menu_corrida"].includes(normalizedText)
        || isAffirmative(text ?? "")
        || normalizedText.includes("corrida")
        || normalizedText.includes("viagem")
        || looksLikeRideDetails;
      if (requestedRide) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);

        // Check for frequent addresses (used 2+ times)
        if (!looksLikeRideDetails && !location && !audio && !image) {
          const { data: freqAddresses } = await supabase
            .from("passenger_frequent_addresses")
            .select("id, address_text, address_formatted, address_lat, address_lng, origin_reference, use_count")
            .eq("company_id", companyId)
            .eq("phone", cleanPhone)
            .gte("use_count", 2)
            .order("use_count", { ascending: false })
            .limit(3);

          if (freqAddresses && freqAddresses.length > 0) {
            const buttons: InteractiveButton[] = freqAddresses.map((a) => ({
              id: `freq_${a.id}`,
              label: (a.origin_reference || a.address_formatted || a.address_text).slice(0, 20),
            }));
            buttons.push({ id: "freq_new", label: "Outro endereco \u{1F4DD}" });
            await sendPollMessage(companyId, cleanPhone, connectionId,
              "\u{1F4CD} Encontrei seus enderecos salvos. Qual e o endereco de embarque?",
              buttons,
            );
            break;
          }
        }

        if (looksLikeRideDetails) {
          try {
            await handleBotMessage(companyId, cleanPhone, text, pushName, location, audio, connectionId, image);
          } catch (err) {
            const errMsg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
            await supabase.from("admin_logs").insert({
              company_id: companyId,
              source: "whatsapp_webhook",
              level: "error",
              message: `handleBotMessage recursive CRASH (menu_inicial) for ${cleanPhone}: ${errMsg.slice(0, 1000)}`,
            });
          }
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "\u{1F4CD} Perfeito! Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
        }
      } else if (["2", "suporte", "ajuda", "suport", "menu_suporte"].includes(normalizedText) || (deaccent(text ?? "").startsWith("suport") && normalizedText.length > 3)) {
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
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_forward", `\u{1F4AC} Voce sera direcionado para o suporte da ${company.name}. Envie sua mensagem e nossa equipe ira responder.`));

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
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_unavailable", "\u26A0\uFE0F O suporte nao esta disponivel no momento. Tente novamente mais tarde ou solicite uma corrida digitando 1."));
          await supabase.from("bot_conversas")
            .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
        }
      } else if (isNegative(text ?? "") || ["cancelar"].includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("decline", "\u{1F44D} Tudo bem! Quando precisar de uma corrida, e so nos mandar uma mensagem."));
      } else if (!flow.show_welcome_menu) {
        await supabase.from("bot_conversas").update({ state: "aguardando_endereco", updated_at: new Date().toISOString() }).eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "\u{1F4CD} Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
      } else {
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("welcome_repeat", "\u{1F44B} Como podemos ajudar?"), [{ id: "menu_corrida", label: "Solicitar corrida \u{1F695}" }, { id: "menu_suporte", label: "Suporte \u{1F4AC}" }]);
      }
      break;
    }

    case "aguardando_endereco": {
      // Handle frequent address button selection
      if (normalizedText.startsWith("freq_")) {
        if (normalizedText === "freq_new") {
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_address", "\u{1F4CD} Qual e o endereco de embarque? Voce pode digitar o endereco, enviar sua localizacao ou mandar um audio."));
          break;
        }
        const addrId = normalizedText.slice(5);
        const { data: freqAddr } = await supabase
          .from("passenger_frequent_addresses")
          .select("address_text, address_formatted, address_lat, address_lng, origin_reference, use_count")
          .eq("id", addrId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (freqAddr) {
          // Update use count
          await supabase.from("passenger_frequent_addresses")
            .update({ use_count: (freqAddr.use_count || 0) + 1, last_used_at: new Date().toISOString() })
            .eq("id", addrId);
          // Set as pickup and go to destination
          await supabase.from("bot_conversas")
            .update({
              state: "aguardando_destino",
              address_text: freqAddr.address_text,
              address_lat: freqAddr.address_lat,
              address_lng: freqAddr.address_lng,
              address_formatted: freqAddr.address_formatted,
              origin_reference: freqAddr.origin_reference,
              address_is_fallback: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);
          await sendPollMessage(companyId, cleanPhone, connectionId, msg("ask_destination", "\u{1F3AF} Para onde voce vai?"), [{ id: "dest_digitar", label: "Digitar Endereco \u{1F4DD}" }, { id: "dest_nao_informar", label: "Nao informar \u{1F6AB}" }]);
          break;
        }
      }

      let addressText: string | null = null;
      let lat: number | null = null;
      let lng: number | null = null;
      let combinedDest: string | null = null;
      let originReference: string | null = null;
      let destinationReference: string | null = null;
      let llmIsRuaOficial = false;

      if (image) {
        // Photos are not stored or processed — ask for a typed address or location share.
        await sendBotMessage(companyId, cleanPhone, connectionId, "\u{1F4F7} Nao consigo usar fotos. Por favor, digite o endereco de embarque ou envie sua localizacao (clipe \u{1F4CE} > Localizacao).");
        return;
      } else if (location) {
        lat = location.lat;
        lng = location.lng;
        const reversed = await reverseGeocode(lat, lng);
        // Ignore text when it's just the location placeholder set by the webhook handler
        const realText = text && !text.startsWith("[Localizacao:") ? text : null;
        addressText = normalizePlaceText(realText) ?? reversed ?? "Localizacao compartilhada pelo passageiro";
        originReference = normalizePlaceText(realText) ?? normalizePlaceText(reversed) ?? normalizePlaceText(addressText);
      } else if (audio) {
        const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
        if (transcribed) {
          const audioText = transcribed.trim();
          // Check if the transcription contains address-like content
          if (!looksLikeAddress(audioText)) {
            await sendBotMessage(companyId, cleanPhone, connectionId, `\u{1F3A4} Transcrevi: "${audioText}"\n\n\u{1F4CD} Nao consegui identificar um endereco. Por favor, digite o endereco de embarque ou envie sua localizacao.`);
            return;
          }
          const combined = parseCombinedAddress(audioText);
          const llmCtx = await getCompanyLocationInfo(companyId, connectionId);
          const llmResult = await interpretMessageWithLLM(audioText, companyId, {
            city: llmCtx.city,
            state: llmCtx.state,
            totemReference: llmCtx.pickupAddress || llmCtx.totemName,
            isTotemFixo: !!llmCtx.pickupAddress,
          });
          if (llmResult && llmResult.texto_embarque_motorista) {
            await supabase.from("admin_logs").insert({
              company_id: companyId, source: "whatsapp_webhook", level: "info",
              message: `LLM RESULT (audio): eh_rua=${llmResult.eh_rua_oficial} origem="${llmResult.geolocalizacao_origem}" embarque="${llmResult.texto_embarque_motorista}" destino="${llmResult.texto_destino_motorista}"`,
            });
            const driverText = normalizePickupForDispatch(llmResult.texto_embarque_motorista)!;
            originReference = driverText;
            const llmDest = normalizeDestinationForDispatch(llmResult.texto_destino_motorista);
            destinationReference = (llmDest && llmDest !== "DEFINIR NO CARRO") ? llmDest : null;
            combinedDest = destinationReference;
            llmIsRuaOficial = !!llmResult.eh_rua_oficial || (!!combined && looksLikeOfficialAddress(combined.pickup));
            if (llmIsRuaOficial && llmResult.geolocalizacao_origem) {
              addressText = normalizePickupForDispatch(llmResult.geolocalizacao_origem) ?? driverText;
            } else if (combined && looksLikeOfficialAddress(combined.pickup)) {
              addressText = normalizePickupForDispatch(combined.pickup) ?? driverText;
            } else {
              addressText = driverText;
            }
            await supabase.from("admin_logs").insert({
              company_id: companyId, source: "whatsapp_webhook", level: "info",
              message: `AUDIO PARSED: addressText="${addressText}" originRef="${originReference}" destRef="${destinationReference}" llmIsRuaOficial=${llmIsRuaOficial}`,
            });
          } else if (combined) {
            addressText = normalizePickupForDispatch(combined.pickup) ?? normalizePlaceText(combined.pickup);
            combinedDest = normalizeDestinationForDispatch(combined.destination) ?? normalizePlaceText(combined.destination);
            originReference = normalizePickupForDispatch(combined.pickup) ?? normalizePlaceText(combined.pickup);
            destinationReference = combinedDest;
            llmIsRuaOficial = looksLikeOfficialAddress(combined.pickup);
          } else {
            addressText = normalizePickupForDispatch(audioText) ?? normalizePlaceText(audioText);
            originReference = normalizePickupForDispatch(audioText) ?? cleanPickupReference(audioText);
          }
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de embarque ou envie sua localizacao.");
          return;
        }
      } else if (text) {
        // Try LLM-based NLU first for richest parsing, fall back to regex
        const inputText = text.trim();
        const combined = parseCombinedAddress(inputText);
        const llmCtx = await getCompanyLocationInfo(companyId, connectionId);
        const llmResult = await interpretMessageWithLLM(inputText, companyId, {
          city: llmCtx.city,
          state: llmCtx.state,
          totemReference: llmCtx.pickupAddress || llmCtx.totemName,
          isTotemFixo: !!llmCtx.pickupAddress,
        });
        if (llmResult && llmResult.texto_embarque_motorista) {
          const driverText = normalizePickupForDispatch(llmResult.texto_embarque_motorista)!;
          originReference = driverText;
          const llmDest = normalizeDestinationForDispatch(llmResult.texto_destino_motorista);
          destinationReference = (llmDest && llmDest !== "DEFINIR NO CARRO") ? llmDest : null;
          combinedDest = destinationReference;
          llmIsRuaOficial = !!llmResult.eh_rua_oficial || (!!combined && looksLikeOfficialAddress(combined.pickup));
          if (llmIsRuaOficial && llmResult.geolocalizacao_origem) {
            addressText = normalizePickupForDispatch(llmResult.geolocalizacao_origem) ?? driverText;
          } else if (combined && looksLikeOfficialAddress(combined.pickup)) {
            addressText = normalizePickupForDispatch(combined.pickup) ?? driverText;
          } else {
            addressText = driverText;
          }
        } else if (combined) {
          addressText = normalizePickupForDispatch(combined.pickup) ?? normalizePlaceText(combined.pickup);
          combinedDest = normalizeDestinationForDispatch(combined.destination) ?? normalizePlaceText(combined.destination);
          originReference = normalizePickupForDispatch(combined.pickup) ?? normalizePlaceText(combined.pickup);
          destinationReference = combinedDest;
          llmIsRuaOficial = looksLikeOfficialAddress(combined.pickup);
        } else {
          addressText = normalizePickupForDispatch(inputText) ?? normalizePlaceText(inputText);
          originReference = normalizePickupForDispatch(inputText) ?? cleanPickupReference(inputText);
        }
      }

      if (!addressText) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_retry", "\u{1F4CD} Por favor, envie o endereco de embarque. Voce pode digitar, enviar sua localizacao, mandar um audio ou enviar uma foto da fachada."));
        return;
      }

      // If the LLM identified this as an informal place (not a real street),
      // skip geocoding entirely and use the fallback address. Only attempt OSM
      // validation when the LLM says it's a structured street address.
      // Also force geocoding when the text itself looks like "street + number".
      const looksOfficial = llmIsRuaOficial || looksLikeOfficialAddress(addressText ?? "");
      let suggestionMatch: { address_text: string; lat: number | null; lng: number | null } | null = null;
      // Try nickname suggestions regardless of whether the text looks like an
      // official street — suggestions are usually informal POI names.
      if (connectionId) {
        suggestionMatch = await findAddressSuggestionFuzzy(connectionId, addressText);
      }

      let finalLat: number;
      let finalLng: number;
      let finalAddress: string;
      let isFallback = false;

      if (image) {
        // Image-based pickup: use fallback coordinates, skip geocoding
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        if (companyLoc.lat != null && companyLoc.lng != null) {
          finalLat = companyLoc.lat;
          finalLng = companyLoc.lng;
          finalAddress = addressText;
          isFallback = true;
        } else {
          finalLat = 0;
          finalLng = 0;
          finalAddress = addressText;
          isFallback = true;
        }
      } else if (suggestionMatch) {
        if (suggestionMatch.lat != null && suggestionMatch.lng != null) {
          finalLat = suggestionMatch.lat;
          finalLng = suggestionMatch.lng;
        } else {
          const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
          const geocoded = await geocodeAddress(suggestionMatch.address_text, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
          if (geocoded) {
            finalLat = geocoded.lat;
            finalLng = geocoded.lng;
          } else if (companyLoc.lat != null && companyLoc.lng != null) {
            finalLat = companyLoc.lat;
            finalLng = companyLoc.lng;
            isFallback = true;
          } else {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_not_found", "\u274C Nao encontrei esse endereco. Voce pode:\n\n1\uFE0F\u20E3 Mandar sua localizacao pelo WhatsApp (clipe \u{1F4CE} > Localizacao)\n2\uFE0F\u20E3 Enviar o endereco completo com numero e bairro\n3\uFE0F\u20E3 Seguir sem endereco confirmado — o motorista entra em contato"));
            await supabase.from("bot_conversas")
              .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
              .eq("id", conv.id);
            return;
          }
        }
        finalAddress = suggestionMatch.address_text;
      } else if (location) {
        finalLat = lat!;
        finalLng = lng!;
        finalAddress = addressText;
      } else if (looksOfficial) {
        // Official street — try OSM geocoding
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        await supabase.from("admin_logs").insert({
          company_id: companyId, source: "whatsapp_webhook", level: "info",
          message: `GEOCODE DEBUG: addressText="${addressText}" city="${companyLoc.city}" state="${companyLoc.state}" bias=(${companyLoc.lat},${companyLoc.lng})`,
        });
        const geocoded = await geocodeAddress(addressText, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        await supabase.from("admin_logs").insert({
          company_id: companyId, source: "whatsapp_webhook", level: "info",
          message: `GEOCODE RESULT: ${geocoded ? `lat=${geocoded.lat} lng=${geocoded.lng} formatted="${geocoded.formatted.slice(0, 80)}"` : "NULL (not found)"}`,
        });
        if (geocoded) {
          finalLat = geocoded.lat;
          finalLng = geocoded.lng;
          finalAddress = geocoded.formatted;
          const bairro = extractBairroFromFormatted(geocoded.formatted);
          if (bairro && originReference && !originReference.includes(bairro.toUpperCase())) {
            originReference = `${originReference}, ${bairro.toUpperCase()}`;
          }
        } else if (fuzzyMatchesForCaller.length >= 2) {
          // Multiple fuzzy street matches found — present options to the passenger
          const optionText = fuzzyMatchesForCaller.map((m, i) => `${i + 1} - ${m.streetName}`).join("\n");
          await sendBotMessage(companyId, cleanPhone, connectionId, `\u{1F50D} Encontrei varias ruas parecidas com "${addressText}":\n\n${optionText}\n\nResponda com o numero da rua correta. Se nenhuma for a certa, digite o endereco completo.`);
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_selecao_rua", address_text: addressText, pending_fuzzy_options: JSON.stringify(fuzzyMatchesForCaller), updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          return;
        } else if (companyLoc.lat != null && companyLoc.lng != null) {
          finalLat = companyLoc.lat;
          finalLng = companyLoc.lng;
          finalAddress = addressText;
          isFallback = true;
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_not_found", "\u274C Nao encontrei esse endereco. Voce pode:\n\n1\uFE0F\u20E3 Mandar sua localizacao pelo WhatsApp (clipe \u{1F4CE} > Localizacao)\n2\uFE0F\u20E3 Enviar o endereco completo com numero e bairro\n3\uFE0F\u20E3 Seguir sem endereco confirmado — o motorista entra em contato"));
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          return;
        }
      } else {
        // Informal place (POI) — try OSM geocoding with the place name + city bias.
        // If found, use the real coordinates and formatted address. If not found,
        // fall back to the bot connection's default coordinates and keep the
        // place name as the display text.
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        const poiGeocoded = await geocodePOI(addressText, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        if (poiGeocoded) {
          finalLat = poiGeocoded.lat;
          finalLng = poiGeocoded.lng;
          finalAddress = poiGeocoded.formatted;
          const bairro = extractBairroFromFormatted(poiGeocoded.formatted);
          if (bairro && originReference && !originReference.includes(bairro.toUpperCase())) {
            originReference = `${originReference}, ${bairro.toUpperCase()}`;
          }
        } else if (companyLoc.lat != null && companyLoc.lng != null) {
          finalLat = companyLoc.lat;
          finalLng = companyLoc.lng;
          finalAddress = addressText;
          isFallback = true;
        } else {
          finalLat = 0;
          finalLng = 0;
          finalAddress = addressText;
          isFallback = true;
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
          origin_reference: originReference,
          destination_reference: destinationReference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);

      // If the LLM or regex already extracted a destination, geocode it as a POI
      // so the Machine API gets real coordinates. If geocoding fails, keep text-only
      // and the Machine API calculates by KM (taximeter).
      const extractedDest = destinationReference ?? combinedDest ?? null;
      if (extractedDest) {
        let destLat: number | null = null;
        let destLng: number | null = null;
        let destFormatted: string | null = null;
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        const destGeocoded = await geocodePOI(extractedDest, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        await supabase.from("admin_logs").insert({
          company_id: companyId, source: "whatsapp_webhook", level: "info",
          message: `DEST GEOCODE: dest="${extractedDest}" result=${destGeocoded ? `lat=${destGeocoded.lat} lng=${destGeocoded.lng}` : "NULL"}`,
        });
        if (destGeocoded) {
          destLat = destGeocoded.lat;
          destLng = destGeocoded.lng;
          destFormatted = destGeocoded.formatted;
        }
        await supabase.from("bot_conversas")
          .update({
            state: "aguardando_confirmacao",
            destination_text: extractedDest,
            destination_lat: destLat,
            destination_lng: destLng,
            destination_formatted: destFormatted,
            destination_reference: extractedDest,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conv.id);
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma os dados da corrida?\n\n\u{1F4CD} Embarque: ${originReference ?? finalAddress}\n\u{1F3AF} Destino: ${extractedDest}`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
        break;
      }

      await sendPollMessage(companyId, cleanPhone, connectionId, msg("ask_destination", "\u{1F3AF} Para onde voce vai?"), [{ id: "dest_digitar", label: "Digitar Endereco \u{1F4DD}" }, { id: "dest_nao_informar", label: "Nao informar \u{1F6AB}" }]);
      break;
    }

    case "aguardando_selecao_rua": {
      // Passenger is choosing between multiple fuzzy-matched streets.
      // Options are stored in pending_fuzzy_options as JSON.
      const rawOptions = (conv as Record<string, unknown>).pending_fuzzy_options;
      const fuzzyOptions: Array<{ streetName: string; normalized: string; similarity: number; lat: number | null; lng: number | null; formatted: string | null }> =
        Array.isArray(rawOptions) ? rawOptions as Array<{ streetName: string; normalized: string; similarity: number; lat: number | null; lng: number | null; formatted: string | null }> : [];
      const choiceNum = parseInt(normalizedText, 10);
      if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= fuzzyOptions.length) {
        const m = fuzzyOptions[choiceNum - 1];
        if (m.lat != null && m.lng != null) {
          const houseNumberMatch = (conv.address_text ?? "").match(/\b(\d{1,6}(?:[A-Za-z]?)|s\/n)\b/i);
          const houseNum = houseNumberMatch ? houseNumberMatch[1] : null;
          let formatted = m.formatted ?? m.streetName;
          if (houseNum && !formatted.toLowerCase().includes(houseNum.toLowerCase())) {
            formatted = preserveHouseNumberInFormatted(formatted, houseNum);
          }
          const extractedDest = conv.destination_reference ?? conv.destination_text ?? null;
          if (extractedDest) {
            await supabase.from("bot_conversas")
              .update({
                state: "aguardando_confirmacao",
                address_lat: m.lat,
                address_lng: m.lng,
                address_formatted: formatted,
                address_is_fallback: false,
                pending_fuzzy_options: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conv.id);
            await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma os dados da corrida?\n\n\u{1F4CD} Embarque: ${formatted}\n\u{1F3AF} Destino: ${extractedDest}`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
          } else {
            await supabase.from("bot_conversas")
              .update({
                state: "aguardando_destino",
                address_lat: m.lat,
                address_lng: m.lng,
                address_formatted: formatted,
                address_is_fallback: false,
                pending_fuzzy_options: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conv.id);
            await sendPollMessage(companyId, cleanPhone, connectionId, msg("ask_destination", "\u{1F3AF} Para onde voce vai?"), [{ id: "dest_digitar", label: "Digitar Endereco \u{1F4DD}" }, { id: "dest_nao_informar", label: "Nao informar \u{1F6AB}" }]);
          }
          break;
        }
      }
      // If the passenger typed a new address instead of choosing, reset to ask for address
      if (text && !normalizedText.match(/^[1-9]$/)) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", pending_fuzzy_options: null, updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_retry", `\u{1F4CD} Por favor, envie o endereco completo do embarque (rua, numero e bairro).`));
        break;
      }
      await sendBotMessage(companyId, cleanPhone, connectionId, `\u26A0\uFE0F Opcao invalida. Responda com o numero da rua correta (1 a ${fuzzyOptions.length}).`);
      break;
    }

    case "aguardando_destino": {
      if (!flow.ask_destination) {
        if (flow.confirm_address) {
          const pickupAddr = conv.address_formatted || conv.address_text || "";
          await supabase.from("bot_conversas").update({ state: "aguardando_confirmacao", updated_at: new Date().toISOString() }).eq("id", conv.id);
          await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma o endereco de embarque?\n\n\u{1F4CD} ${pickupAddr}`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
        } else {
          await proceedAfterDestination(companyId, cleanPhone, connectionId, conv.id, msg, flow);
        }
        break;
      }
      const noDestPhrases = ["2", "nao", "nao informar", "nao informar destino", "nao quero informar", "sem destino", "dest_nao_informar"];
      const deaccented = normalizedText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (noDestPhrases.includes(deaccented) || noDestPhrases.includes(normalizedText)) {
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
        const pickupAddr = normalizePlaceText(conv.origin_reference || conv.address_formatted || conv.address_text || "Endereco nao informado");
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma os dados da corrida?\n\n\u{1F4CD} Embarque: ${pickupAddr}\n\u{1F3AF} Destino: DEFINIR NO CARRO`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
      } else if (normalizedText === "1" || normalizedText === "dest_digitar" || location || audio || (text && !["1","2","dest_digitar","dest_nao_informar"].includes(normalizedText))) {
        // Accept "1" / "dest_digitar" (menu choice), location, audio, or any typed text as a destination address
        if ((normalizedText === "1" || normalizedText === "dest_digitar") && !location && !audio) {
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_endereco_destino", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("ask_destination_address", "\u{1F4DD} Digite o endereco de destino. Voce pode digitar, enviar sua localizacao ou mandar um audio."));
        } else {
          // Process the destination directly — reuse the aguardando_endereco_destino logic
          let destText: string | null = null;
          let destLat: number | null = null;
          let destLng: number | null = null;

          if (location) {
            destLat = location.lat;
            destLng = location.lng;
            const reversed = await reverseGeocode(destLat, destLng);
            const realText = text && !text.startsWith("[Localizacao:") ? text : null;
            destText = normalizePlaceText(realText) ?? reversed ?? "Localizacao compartilhada pelo passageiro";
          } else if (audio) {
            const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
            if (transcribed) {
              if (!looksLikeAddress(transcribed)) {
                await sendBotMessage(companyId, cleanPhone, connectionId, `\u{1F3A4} Transcrevi: "${transcribed.trim()}"\n\n\u{1F4CD} Nao consegui identificar um endereco de destino. Por favor, digite o endereco ou envie sua localizacao.`);
                return;
              }
              destText = normalizePlaceText(transcribed);
            } else {
              await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de destino.");
              return;
            }
          } else if (text) {
            destText = normalizePlaceText(text);
          }

          if (!destText) {
            await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_retry", "\u{1F4CD} Por favor, envie o endereco de destino. Voce pode digitar, mandar um audio ou compartilhar a localizacao."));
            return;
          }

          // For text/audio destinations, try POI/street geocoding with city bias.
          // If found, use real coordinates + formatted address. If not, keep
          // lat/lng null so Machine API calculates by KM (taximeter).
          let finalDestLat: number | null = null;
          let finalDestLng: number | null = null;
          let finalDestAddress = destText;

          if (location) {
            finalDestLat = destLat!;
            finalDestLng = destLng!;
            finalDestAddress = destText;
          } else {
            const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
            const destGeocoded = await geocodePOI(destText, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
            if (destGeocoded) {
              finalDestLat = destGeocoded.lat;
              finalDestLng = destGeocoded.lng;
              finalDestAddress = destGeocoded.formatted;
            }
          }

          const pickupAddr = normalizePlaceText(conv.origin_reference || conv.address_formatted || conv.address_text || "Endereco nao informado");
          await supabase.from("bot_conversas")
            .update({
              state: "aguardando_confirmacao",
              destination_text: finalDestAddress,
              destination_lat: finalDestLat,
              destination_lng: finalDestLng,
              destination_formatted: finalDestAddress,
              destination_reference: finalDestAddress,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);
          await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma os dados da corrida?\n\n\u{1F4CD} Embarque: ${pickupAddr}\n\u{1F3AF} Destino: ${finalDestAddress}`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
        }
      } else {
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("destination_menu_retry", "\u26A0\uFE0F Opcao invalida. Para onde voce vai?"), [{ id: "dest_digitar", label: "Digitar Endereco \u{1F4DD}" }, { id: "dest_nao_informar", label: "Nao informar \u{1F6AB}" }]);
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
        const realText = text && !text.startsWith("[Localizacao:") ? text : null;
        destText = normalizePlaceText(realText) ?? reversed ?? "Localizacao compartilhada pelo passageiro";
      } else if (audio) {
        const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
        if (transcribed) {
          if (!looksLikeAddress(transcribed)) {
            await sendBotMessage(companyId, cleanPhone, connectionId, `\u{1F3A4} Transcrevi: "${transcribed.trim()}"\n\n\u{1F4CD} Nao consegui identificar um endereco de destino. Por favor, digite o endereco ou envie sua localizacao.`);
            return;
          }
          destText = normalizePlaceText(transcribed);
        } else {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui transcrever o audio. Por favor, digite o endereco de destino.");
          return;
        }
      } else if (text) {
        destText = normalizePlaceText(text);
      }

      if (!destText) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("destination_retry", "\u{1F4CD} Por favor, envie o endereco de destino. Voce pode digitar, mandar um audio ou compartilhar a localizacao."));
        return;
      }

      // For text/audio destinations, try POI/street geocoding with city bias.
      // If found, use real coordinates + formatted address. If not, keep
      // lat/lng null so Machine API calculates by KM (taximeter).
      let finalDestLat: number | null = null;
      let finalDestLng: number | null = null;
      let finalDestAddress = destText;

      if (location) {
        finalDestLat = destLat!;
        finalDestLng = destLng!;
        finalDestAddress = destText;
      } else {
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        const destGeocoded = await geocodePOI(destText, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        if (destGeocoded) {
          finalDestLat = destGeocoded.lat;
          finalDestLng = destGeocoded.lng;
          finalDestAddress = destGeocoded.formatted;
        }
      }

      const pickupAddr = normalizePlaceText(conv.origin_reference || conv.address_formatted || conv.address_text || "Endereco nao informado");
      await supabase.from("bot_conversas")
        .update({
          state: "aguardando_confirmacao",
          destination_text: finalDestAddress,
          destination_lat: finalDestLat,
          destination_lng: finalDestLng,
          destination_formatted: finalDestAddress,
          destination_reference: finalDestAddress,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);
      await sendPollMessage(companyId, cleanPhone, connectionId, msg("confirm_address", `\u2705 Confirma os dados da corrida?\n\n\u{1F4CD} Embarque: ${pickupAddr}\n\u{1F3AF} Destino: ${finalDestAddress}`), [{ id: "conf_sim", label: "SIM \u2705" }, { id: "conf_nao", label: "NAO \u{1F504}" }]);
      break;
    }

    case "aguardando_confirmacao": {
      // First try exact text matching, then fall back to LLM intent detection
      const isSim = isAffirmative(text ?? "") || ["conf_sim"].includes(normalizedText);
      const isNao = isNegative(text ?? "") || ["conf_nao"].includes(normalizedText);

      // If exact match failed, try LLM-based intent detection for typo tolerance
      if (!isSim && !isNao && text && text.trim().length > 0) {
        const llmCtx = await getCompanyLocationInfo(companyId, connectionId);
        const llmResult = await interpretMessageWithLLM(text.trim(), companyId, {
          city: llmCtx.city,
          state: llmCtx.state,
          totemReference: llmCtx.pickupAddress || llmCtx.totemName,
          isTotemFixo: !!llmCtx.pickupAddress,
        });
        if (llmResult?.intencao_usuario === "SIM") {
          // LLM detected confirmation intent (e.g. "si", "comcerteza", "pode mandar")
          const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
          if (!companyLoc.slug) {
            await sendBotMessage(companyId, cleanPhone, connectionId, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
            return;
          }
          await proceedAfterDestination(companyId, cleanPhone, connectionId, conv.id, msg, flow);
          break;
        } else if (llmResult?.intencao_usuario === "NAO") {
          // LLM detected rejection/correction intent (e.g. "nn", "canselar", "errado")
          await supabase.from("bot_conversas")
            .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_correction", "\u{1F504} Sem problema! Qual e o endereco correto de embarque? Voce pode digitar, enviar sua localizacao ou mandar um audio."));
          break;
        }
      }

      if (!flow.confirm_address || isSim) {
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        if (!companyLoc.slug) {
          await sendBotMessage(companyId, cleanPhone, connectionId, "Erro: empresa nao configurada corretamente. Tente novamente mais tarde.");
          return;
        }

        await proceedAfterDestination(companyId, cleanPhone, connectionId, conv.id, msg, flow);
      } else if (isNao) {
        await supabase.from("bot_conversas")
          .update({ state: "aguardando_endereco", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("address_correction", "\u{1F504} Sem problema! Qual e o endereco correto de embarque? Voce pode digitar, enviar sua localizacao ou mandar um audio."));
      } else {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("confirm_retry", "\u26A0\uFE0F Por favor, responda SIM para confirmar ou NAO para corrigir."));
      }
      break;
    }

    case "aguardando_categoria": {
      const categories = await getCategoriesForConnection(companyId, connectionId);
      if (categories.length === 0) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("ride_error", "\u274C Nenhuma categoria disponivel. Tente novamente mais tarde."));
        await supabase.from("bot_conversas").update({ state: "aguardando_endereco", updated_at: new Date().toISOString() }).eq("id", conv.id);
        return;
      }

      let chosenCat: { id: string; label: string; machine_category_id: string | null } | null = null;
      if (normalizedText.startsWith("cat_")) {
        const catId = normalizedText.slice(4);
        chosenCat = categories.find((c) => c.id === catId) ?? null;
      } else {
        const choiceNum = parseInt(normalizedText, 10);
        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= categories.length) {
          chosenCat = categories[choiceNum - 1];
        } else {
          chosenCat = categories.find((c) => c.label.toLowerCase() === normalizedText) ?? null;
        }
      }

      if (!chosenCat) {
        await sendPollMessage(companyId, cleanPhone, connectionId,
        msg("category_retry", "\u26A0\uFE0F Opcao invalida. Escolha uma categoria:"),
        categories.map((c) => ({ id: `cat_${c.id}`, label: c.label })),
      );
        return;
      }

      await supabase.from("bot_conversas").update({ selected_category_id: chosenCat.id, updated_at: new Date().toISOString() }).eq("id", conv.id);
      if (!flow.ask_payment) {
        const { data: freshConv } = await supabase.from("bot_conversas").select("*").eq("id", conv.id).maybeSingle();
        if (freshConv) await dispatchRideFromConversation(companyId, cleanPhone, connectionId, freshConv as BotConversation, msg, null);
        return;
      }

      await supabase.from("bot_conversas").update({ state: "aguardando_pagamento", updated_at: new Date().toISOString() }).eq("id", conv.id);
      await sendPollMessage(companyId, cleanPhone, connectionId,
        msg("ask_payment", "\u{1F4B0} Qual a forma de pagamento?"),
        [
          { id: "pay_dinheiro", label: "Dinheiro \u{1F4B5}" },
          { id: "pay_pix", label: "Pix \u{1F9EC}" },
          { id: "pay_cartao", label: "Cartao \u{1F4B3}" },
        ],
      );
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
        "pay_dinheiro": "Dinheiro",
        "pay_pix": "Pix",
        "pay_cartao": "Cartao",
      };
      const paymentMethod = paymentMap[normalizedText] ?? null;

      if (!paymentMethod) {
        await sendPollMessage(companyId, cleanPhone, connectionId,
          msg("payment_retry", "\u26A0\uFE0F Opcao invalida. Qual a forma de pagamento?"),
          [
            { id: "pay_dinheiro", label: "Dinheiro \u{1F4B5}" },
            { id: "pay_pix", label: "Pix \u{1F9EC}" },
            { id: "pay_cartao", label: "Cartao \u{1F4B3}" },
          ],
        );
        return;
      }

      await dispatchRideFromConversation(companyId, cleanPhone, connectionId, conv, msg, paymentMethod);
      break;
    }

    case "suporte": {
      const supportExitWords = ["sair", "voltar", "corrida", "1", "menu", "fim", "encerrar", "encerra", "finalizar", "finaliza", "terminar", "termina", "encerrar suporte", "finalizar suporte"];

      // Auto-exit after 5 minutes of inactivity
      if (conv.updated_at) {
        const lastActivity = new Date(conv.updated_at).getTime();
        const idleMs = Date.now() - lastActivity;
        if (idleMs > 5 * 60 * 1000) {
          await supabase.from("bot_conversas")
            .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          await sendPollMessage(companyId, cleanPhone, connectionId, msg("support_timeout", "\u23F1\uFE0F O atendimento de suporte foi encerrado por inatividade."), [{ id: "menu_corrida", label: "Solicitar corrida \u{1F695}" }, { id: "menu_suporte", label: "Suporte \u{1F4AC}" }]);
          break;
        }
      }

      // Check if passenger wants to exit support mode — check before forwarding
      if (text && supportExitWords.includes(normalizedText)) {
        await supabase.from("bot_conversas")
          .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("support_exit", "\u{1F44B} Suporte encerrado."), [{ id: "menu_corrida", label: "Solicitar corrida \u{1F695}" }, { id: "menu_suporte", label: "Suporte \u{1F4AC}" }]);
        break;
      }

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
      } else if (!company?.support_whatsapp && text) {
        await sendBotMessage(companyId, cleanPhone, connectionId, msg("support_unavailable", "\u26A0\uFE0F O suporte nao esta disponivel no momento. Tente novamente mais tarde ou solicite uma corrida digitando 1."));
        await supabase.from("bot_conversas")
          .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        break;
      }

      // Update activity timestamp on every support message
      await supabase.from("bot_conversas")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conv.id);
      break;
    }

    case "aguardando_cancelamento": {
      const cancelConfirm = isCancelConfirmation(text ?? "");
      const cancelDeny = isCancelDenial(text ?? "");

      if (cancelConfirm) {
        // Find and cancel the active ride for THIS passenger
        const { data: activeRide } = await supabase
          .from("rides")
          .select("id, status, machine_order_id, passenger_name, company_id")
          .eq("company_id", companyId)
          .eq("passenger_phone", cleanPhone)
          .in("status", ["pending", "accepted", "en_route", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRide) {
          if (activeRide.machine_order_id) {
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
                await fetch(`${baseUrl}/api/v2/integracao/corridas/${activeRide.machine_order_id}/cancelar`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "api-key": apiKey,
                    "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
                  },
                  body: JSON.stringify({ motivo_id: 1 }),
                });
              } catch { /* best-effort */ }
            }
          }

          await supabase.from("rides").update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          }).eq("id", activeRide.id);

          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_bot",
            level: "info",
            message: `Corrida ${activeRide.id.slice(0, 8)} cancelada via bot por ${activeRide.passenger_name} (${cleanPhone})`,
            ride_id: activeRide.id,
          });
        }

        await supabase.from("bot_conversas")
          .update({ state: "menu_inicial", ride_id: null, address_text: null, address_lat: null, address_lng: null, address_formatted: null, destination_text: null, destination_lat: null, destination_lng: null, destination_formatted: null, selected_category_id: null, selected_payment_method: null, updated_at: new Date().toISOString() })
          .eq("id", conv.id);

        await sendBotMessage(companyId, cleanPhone, connectionId, "\u2705 Sua corrida foi cancelada com sucesso. Para solicitar uma nova viagem, envie uma mensagem.");
      } else if (cancelDeny) {
        await supabase.from("bot_conversas")
          .update({ state: "corrida_solicitada", updated_at: new Date().toISOString() })
          .eq("id", conv.id);
        await sendBotMessage(companyId, cleanPhone, connectionId, "\u2705 Cancelamento abortado. Sua corrida continua ativa.");
      } else {
        await sendPollMessage(companyId, cleanPhone, connectionId,
          "\u26A0\uFE0F Voce realmente deseja cancelar sua corrida?",
          [{ id: "btn_cancelar_sim", label: "Sim, cancelar \u2705" }, { id: "btn_cancelar_nao", label: "Nao, manter \u{1F695}" }],
        );
      }
      break;
    }

    case "corrida_solicitada": {
      const hasNewRequest = Boolean(text || location || audio);
      await supabase.from("bot_conversas")
        .update({
          state: hasNewRequest ? "aguardando_endereco" : "menu_inicial",
          ride_id: null,
          address_text: null,
          address_lat: null,
          address_lng: null,
          address_formatted: null,
          destination_text: null,
          destination_lat: null,
          destination_lng: null,
          destination_formatted: null,
          origin_reference: null,
          destination_reference: null,
          selected_category_id: null,
          selected_payment_method: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);

      if (hasNewRequest) {
        try {
          await handleBotMessage(companyId, cleanPhone, text, pushName, location, audio, connectionId, image);
        } catch (err) {
          const errMsg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_webhook",
            level: "error",
            message: `handleBotMessage recursive CRASH (corrida_solicitada) for ${cleanPhone}: ${errMsg.slice(0, 1000)}`,
          });
        }
      } else {
        await sendPollMessage(companyId, cleanPhone, connectionId, msg("welcome_back", "\u{1F44B} Ola! Como podemos ajudar?"), [{ id: "menu_corrida", label: "Solicitar corrida \u{1F695}" }, { id: "menu_suporte", label: "Suporte \u{1F4AC}" }]);
      }
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

    // Diagnostic: log every non-connection event to see what Evolution sends for poll votes
    if (event && event !== "connection.update" && event !== "CONNECTION_UPDATE" && event !== "status.connect") {
      const diagKeys = data && typeof data === "object" ? Object.keys(data as Record<string, unknown>).join(",") : "none";
      const diagMsg = data?.message && typeof data.message === "object" ? Object.keys(data.message as Record<string, unknown>).join(",") : "none";
      const diagPoll = data?.message?.pollUpdateMessage ? JSON.stringify(data.message.pollUpdateMessage).slice(0, 400) : "no-poll";
      try {
        await supabase.from("admin_logs").insert({
          company_id: "00000000-0000-0000-0000-000000000000",
          source: "whatsapp_webhook",
          level: "info",
          message: `EVENT DIAG: event=${event} instance=${instance} dataKeys=[${diagKeys}] msgKeys=[${diagMsg}] poll=${diagPoll}`,
        });
      } catch { /* best-effort */ }
    }

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
            // Auto-reconfigure webhook + settings on every reconnection
            if (botConn.evolution_api_url && botConn.evolution_global_token && botConn.instance_name) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/configure-whatsapp-webhook`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    apiUrl: botConn.evolution_api_url,
                    globalToken: botConn.evolution_global_token,
                    instanceName: botConn.instance_name,
                    companyId: botConn.company_id,
                    connectionId: botConn.id,
                    isBot: true,
                  }),
                });
              } catch { /* best-effort */ }
            }
          } else if (state === "close" || state === "DISCONNECTED") {
            await supabase.from("bot_whatsapp_conexoes")
              .update({ connection_status: "disconnected", updated_at: new Date().toISOString() })
              .eq("id", botConn.id);
          }
        }

        // Handle incoming messages via bot flow
        if (event === "messages.upsert" || event === "MESSAGES_UPSERT" || event === "message.receive" || event === "poll.update" || event === "messages.update" || event === "POLL_UPDATE") {
          const key = data?.key as Record<string, unknown> | undefined;
          // Skip outgoing messages (from the bot itself)
          if (key?.fromMe === true) {
            return new Response(JSON.stringify({ success: true, bot: true, skipped: "outgoing" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Deduplicate by message ID + event type (poll votes share key.id with the original poll)
          const msgId = String(key?.id ?? data?.message_id ?? "");
          const dedupId = msgId ? `${event}:${msgId}` : "";
          if (dedupId) {
            const { error: dedupErr } = await supabase.from("whatsapp_processed_events")
              .insert({ company_id: botConn.company_id, event_id: dedupId });
            if (dedupErr && dedupErr.code === "23505") {
              return new Response(JSON.stringify({ success: true, bot: true, skipped: "duplicate" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }

          const msg = data?.message as Record<string, unknown> | undefined;
          let rawPhone: string | null = key?.remoteJid ? String(key.remoteJid).replace(/@.*$/, "") : (data?.from ? String(data.from) : null);
          let text: string | null = msg?.conversation ? String(msg.conversation) : (msg?.text ? String(msg.text) : null);
          if (typeof data?.body === "string") text = data.body;
          else if (data?.body && typeof data.body === "object") text = String((data.body as Record<string, unknown>).text ?? "");

          // Extract poll vote from top-level data (Evolution API poll.update event)
          if (!text) {
            const pollVotes = data?.votes as Array<Record<string, unknown>> | undefined;
            if (pollVotes && pollVotes.length > 0) {
              text = String(pollVotes[0]?.optionName ?? pollVotes[0]?.name ?? "");
            }
            if (!text) {
              const selectedOption = data?.selectedOption as Record<string, unknown> | undefined;
              if (selectedOption?.name) {
                text = String(selectedOption.name);
              }
            }
          }

          // Extract interactive button/list/poll replies (Evolution API format)
          if (!text) {
            const buttonsResp = msg?.buttonsResponseMessage as Record<string, unknown> | undefined;
            const resolvedButton = resolveButtonReply(buttonsResp);
            if (resolvedButton) {
              text = resolvedButton;
            } else {
              const listResp = msg?.listResponseMessage as Record<string, unknown> | undefined;
              const singleSelect = listResp?.singleSelectReply as Record<string, unknown> | undefined;
              if (singleSelect?.selectedRowId) {
                text = String(singleSelect.selectedRowId);
              }
            }
            // Poll vote extraction from nested message object
            if (!text) {
              const pollResp = msg?.pollUpdateMessage as Record<string, unknown> | undefined;
              if (pollResp) {
                const vote = pollResp.vote as Record<string, unknown> | undefined;
                const selectedOptions = vote?.selectedOptions as Array<Record<string, unknown>> | undefined;
                if (selectedOptions && selectedOptions.length > 0) {
                  text = String(selectedOptions[0]?.name ?? selectedOptions[0]?.optionName ?? "");
                }
                if (!text) {
                  const votes = pollResp.votes as Array<Record<string, unknown>> | undefined;
                  if (votes && votes.length > 0) {
                    text = String(votes[0]?.optionName ?? votes[0]?.name ?? "");
                  }
                }
                if (!text) {
                  const selectedOption = pollResp.selectedOption as Record<string, unknown> | undefined;
                  if (selectedOption?.name) text = String(selectedOption.name);
                }
              }
            }
          }

          if (!text && msg?.locationMessage) {
            const loc = msg.locationMessage as Record<string, unknown>;
            text = `[Localizacao: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
          }
          // Do NOT set text for audio messages — let handleIncomingMessage extract
          // and transcribe the audio. Setting text here would skip transcription.

          if (rawPhone && text) {
            await saveMessage(botConn.company_id, rawPhone, "incoming", text, body);
          } else if (!text && msg?.audioMessage) {
            await saveMessage(botConn.company_id, rawPhone, "incoming", "[Audio recebido]", body);
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
        // Auto-reconfigure webhook + settings on every reconnection
        const { data: waInstFull } = await supabase
          .from("whatsapp_instances")
          .select("whatsapp_provider, evolution_api_url, evolution_global_token, instance_name")
          .eq("id", waInstance.id)
          .maybeSingle();
        if (waInstFull && (waInstFull.whatsapp_provider === "evolution" || waInstFull.whatsapp_provider === "veloov") && waInstFull.evolution_api_url && waInstFull.evolution_global_token && waInstFull.instance_name) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/configure-whatsapp-webhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                apiUrl: waInstFull.evolution_api_url,
                globalToken: waInstFull.evolution_global_token,
                instanceName: waInstFull.instance_name,
                companyId: waInstance.company_id,
              }),
            });
          } catch { /* best-effort */ }
        }
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
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT" || event === "message.receive" || event === "poll.update" || event === "messages.update" || event === "POLL_UPDATE") {
      // Skip outgoing messages (from the instance itself)
      const key = data?.key as Record<string, unknown> | undefined;
      if (key?.fromMe === true) {
        return new Response(JSON.stringify({ success: true, skipped: "outgoing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduplicate by message ID + event type (poll votes share key.id with the original poll)
      const msgId = String(key?.id ?? data?.message_id ?? "");
      const dedupId = msgId ? `${event}:${msgId}` : "";
      if (dedupId) {
        const { error: dedupErr } = await supabase.from("whatsapp_processed_events")
          .insert({ company_id: waInstance.company_id, event_id: dedupId });
        if (dedupErr && dedupErr.code === "23505") {
          return new Response(JSON.stringify({ success: true, skipped: "duplicate" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Save ALL incoming messages to chat history (not just "cancelar")
      const msg = data?.message as Record<string, unknown> | undefined;
      let rawPhone: string | null = key?.remoteJid ? String(key.remoteJid).replace(/@.*$/, "") : (data?.from ? String(data.from) : null);
      let text: string | null = msg?.conversation ? String(msg.conversation) : (msg?.text ? String(msg.text) : null);
      if (typeof data?.body === "string") text = data.body;
      else if (data?.body && typeof data.body === "object") text = String((data.body as Record<string, unknown>).text ?? "");

      // Extract poll vote from top-level data (Evolution API poll.update event)
      if (!text) {
        const pollVotes = data?.votes as Array<Record<string, unknown>> | undefined;
        if (pollVotes && pollVotes.length > 0) {
          text = String(pollVotes[0]?.optionName ?? pollVotes[0]?.name ?? "");
        }
        if (!text) {
          const selectedOption = data?.selectedOption as Record<string, unknown> | undefined;
          if (selectedOption?.name) text = String(selectedOption.name);
        }
      }

      // Extract location and audio for display in chat history
      if (!text && msg?.locationMessage) {
        const loc = msg.locationMessage as Record<string, unknown>;
        text = `[Localizacao: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`;
      }
      // Do NOT set text for audio messages — let handleIncomingMessage extract
      // and transcribe the audio. Setting text here would skip transcription.

      if (rawPhone && text) {
        await saveMessage(waInstance.company_id, rawPhone, "incoming", text, body);
      }

      // For non-bot instances, find the company's active bot connection to pass connectionId
      let regularConnectionId: string | undefined;
      const { data: activeBotConn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("id")
        .eq("company_id", waInstance.company_id)
        .eq("connection_status", "connected")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeBotConn) regularConnectionId = activeBotConn.id;

      await handleIncomingMessage(waInstance.company_id, data, instance, regularConnectionId);
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
          accepted: "\u2705 Seu motorista aceitou a corrida! Esta a caminho do ponto de partida.",
          en_route: "\u{1F697} Seu motorista chegou ao local de embarque! Procure pelo veiculo.",
          in_progress: "\u{1F695} Sua viagem esta em andamento.",
          completed: "\u{1F4AF} Sua viagem foi concluida. Obrigado!",
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

async function sendAudioFailureReply(companyId: string, phone: string, message: string): Promise<void> {
  try {
    const { provider, fields } = await getCompanyWhatsAppConfig(companyId);
    const recipient = phone.replace(/\D/g, "");
    if (!recipient) return;
    await sendWhatsAppMessageWithProvider(provider, fields, recipient, message);
    await saveMessage(companyId, recipient, "outgoing", message);
  } catch (err) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "error",
      message: `Falha ao enviar retorno de audio: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function handleIncomingMessage(companyId: string, data: Record<string, unknown>, _instanceName?: string, connectionId?: string): Promise<void> {
  // Diagnostic log: dump the full pollUpdateMessage to see the exact vote structure
  const _topKeys = Object.keys(data ?? {}).join(",");
  const _msg = (data?.message ?? {}) as Record<string, unknown>;
  const _msgKeys = Object.keys(_msg).join(",");
  const _poll = _msg.pollUpdateMessage as Record<string, unknown> | undefined;
  await supabase.from("admin_logs").insert({
    company_id: companyId,
    source: "whatsapp_webhook",
    level: "info",
    message: `POLL DIAG: msgKeys=[${_msgKeys}] pollUpdateMessage=${JSON.stringify(_poll ?? "none")}`,
  });

  // Evolution API v1 sends: { key: { remoteJid: "5516999998888@s.whatsapp.net" }, message: { conversation: "cancelar" } }
  // Evolution API v2 sends: { message: { text: "cancelar" }, key: { remoteJid: "..." } }
  // Some versions: { from: "5516999998888", body: { text: "cancelar" } }

  const key = data?.key as Record<string, unknown> | undefined;

  const isOutgoing = key?.fromMe === true;

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

  // Extract poll vote from top-level data (Evolution API poll.update event format)
  if (!text) {
    const topVotes = data?.votes as Array<Record<string, unknown>> | undefined;
    if (topVotes && topVotes.length > 0) {
      text = String(topVotes[0]?.optionName ?? topVotes[0]?.name ?? "");
    }
    if (!text) {
      const topSelected = data?.selectedOption as Record<string, unknown> | undefined;
      if (topSelected?.name) text = String(topSelected.name);
    }
    if (!text && typeof data?.vote === "string") {
      text = String(data.vote);
    }
  }

  // Extract interactive button/list/poll replies (Evolution API v1/v2 format)
  if (!text && message) {
    const buttonsResp = message.buttonsResponseMessage as Record<string, unknown> | undefined;
    const resolvedButton = resolveButtonReply(buttonsResp);
    if (resolvedButton) {
      text = resolvedButton;
    } else {
      const listResp = message.listResponseMessage as Record<string, unknown> | undefined;
      const singleSelect = listResp?.singleSelectReply as Record<string, unknown> | undefined;
      if (singleSelect?.selectedRowId) {
        text = String(singleSelect.selectedRowId);
      }
    }
    // Evolution API poll vote: pollUpdateMessage.vote.selectedOptions[0].name
    if (!text) {
      const pollResp = message.pollUpdateMessage as Record<string, unknown> | undefined;
      if (pollResp) {
        const vote = pollResp.vote as Record<string, unknown> | undefined;
        const selectedOptions = vote?.selectedOptions as Array<Record<string, unknown>> | undefined;
        if (selectedOptions && selectedOptions.length > 0) {
          text = String(selectedOptions[0]?.name ?? selectedOptions[0]?.optionName ?? "");
        }
        if (!text) {
          const votes = pollResp.votes as Array<Record<string, unknown>> | undefined;
          if (votes && votes.length > 0) {
            text = String(votes[0]?.optionName ?? votes[0]?.name ?? "");
          }
        }
        if (!text) {
          const selectedOption = pollResp.selectedOption as Record<string, unknown> | undefined;
          if (selectedOption?.name) text = String(selectedOption.name);
        }
      }
    }
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
  const audioMessage = message?.audioMessage as Record<string, unknown> | undefined;
  const genericAudio = message?.audio as Record<string, unknown> | undefined;
  const audioSource = audioMessage ?? genericAudio;

  // Do NOT use url/mediaUrl from audioMessage — those are encrypted CDN URLs.
  // Only use base64/data/buffer if present (already decrypted by provider).
  let audioData = audioSource?.base64
    ?? audioSource?.data
    ?? audioSource?.buffer
    ?? null;
  let audioMimeType = String(audioSource?.mimetype ?? audioSource?.mimeType ?? data?.mimetype ?? "audio/ogg");
  const audioUrl = audioSource?.url ?? audioSource?.mediaUrl ?? null;
  const mediaKey = audioSource?.mediaKey ?? null;

  if (audioMessage && connectionId) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `AudioMessage keys: [${Object.keys(audioMessage).join(",")}], key.id=${key?.id ?? "none"}, hasMediaKey=${!!mediaKey}, hasUrl=${!!audioUrl}`,
    });

    // Strategy 1: Try Evolution getBase64FromMediaMessage (gives decrypted+converted audio)
    try {
      const botConfig = await getBotConnectionConfig(connectionId);
      if (botConfig && (botConfig.provider === "evolution" || botConfig.provider === "veloov")) {
        const evoUrl = botConfig.fields["evo_url"];
        const evoToken = botConfig.fields["evo_token"];
        const evoInstance = botConfig.fields["evo_instance"];
        if (evoUrl && evoToken && evoInstance) {
          const msgKeyId = key?.id ? String(key.id) : (data?.message_id ? String(data.message_id) : "");
          if (msgKeyId) {
            const requestBody = {
              message: {
                key: {
                  remoteJid: key?.remoteJid ? String(key.remoteJid) : undefined,
                  fromMe: false,
                  id: msgKeyId,
                },
              },
              convertToMp4: true,
            };
            const delays = [500, 1000];
            let mediaResp: Response | null = null;
            for (let attempt = 0; attempt <= delays.length; attempt++) {
              if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt - 1]));
              mediaResp = await fetch(`${evoUrl}/chat/getBase64FromMediaMessage/${evoInstance}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evoToken },
                body: JSON.stringify(requestBody),
              });
              if (mediaResp.ok) break;
            }
            if (mediaResp && mediaResp.ok) {
              const mediaData = await mediaResp.json() as Record<string, unknown>;
              const mp4Base64 = mediaData.base64 ?? mediaData.base64Media ?? null;
              if (mp4Base64) {
                audioData = mp4Base64;
                audioMimeType = "audio/mp4";
              }
            } else if (mediaResp) {
              const errBody = await mediaResp.text().catch(() => "");
              await supabase.from("admin_logs").insert({
                company_id: companyId,
                source: "whatsapp_webhook",
                level: "error",
                message: `getBase64FromMediaMessage failed after retries: HTTP ${mediaResp.status} — ${errBody.slice(0, 200)}`,
              });
            }
          }
        }
      }
    } catch (err) {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "error",
        message: `getBase64FromMediaMessage exception: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Strategy 2: If Evolution failed and we have a mediaKey + url, decrypt locally
    // WhatsApp encrypts media with AES-CBC using keys derived from mediaKey via HKDF.
    if (!audioData && audioUrl && mediaKey) {
      try {
        const decrypted = await decryptWhatsAppAudio(
          typeof audioUrl === "string" ? audioUrl : String(audioUrl),
          mediaKey,
          companyId,
        );
        if (decrypted) {
          audioData = decrypted;
          audioMimeType = "audio/ogg";
          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_webhook",
            level: "info",
            message: `Audio decifrado localmente com sucesso via HKDF+AES-CBC`,
          });
        }
      } catch (err) {
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "error",
          message: `Decrypt audio exception: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  if (audioData && (typeof audioData === "string" || audioData instanceof String)) {
    let audioDataStr = String(audioData);
    // If it's a data: URI, strip the prefix
    if (audioDataStr.startsWith("data:")) {
      audioDataStr = audioDataStr.split(",")[1] ?? audioDataStr;
    } else if (audioDataStr.startsWith("http") && !audioDataStr.startsWith("data:")) {
      // This branch should NOT be reached anymore — urls are encrypted and handled above.
      // But keep it as a safety net with a warning.
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "warn",
        message: `audioData is a URL (possibly encrypted CDN) — attempting download`,
      });
      try {
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const headers: Record<string, string> = {};
        if ((provider === "evolution" || provider === "veloov") && f["evo_token"]) {
          headers["apikey"] = f["evo_token"];
        }
        const audioResp = await fetch(audioDataStr, { headers });
        if (audioResp.ok) {
          const audioBlob = await audioResp.blob();
          const arrayBuf = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          audioDataStr = btoa(binary);
        }
      } catch (err) {
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "error",
          message: `Audio URL download exception: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
    audio = { data: audioDataStr, mimetype: audioMimeType };
  }

  // Photos are not processed or stored — we only keep the caption (if any).
  let image: { data: string; mimetype: string } | null = null;
  const imageMessage = message?.imageMessage as Record<string, unknown> | undefined;
  const genericImage = message?.image as Record<string, unknown> | undefined;
  const imageSource = imageMessage ?? genericImage;

  // Also extract caption from imageMessage (text accompanying the photo)
  if (!text && imageSource?.caption) {
    text = String(imageSource.caption);
  }

  // Mark that a photo was received so the bot can ask for a typed address.
  if (imageSource && !text) {
    image = { data: "", mimetype: "" };
  }

  if (!rawPhone) return;
  // Encrypted poll vote: pollUpdateMessage exists but we couldn't extract text.
  // Ask the passenger to type their choice so the bot can proceed.
  if (!text && !location && !audio && !image && !imageSource && message?.pollUpdateMessage) {
    await sendBotMessage(companyId, cleanPhone, connectionId, "Nao consegui ler seu voto na enquete. Por favor, digite o numero ou nome da opcao desejada.");
    return;
  }

  if (!text && !location && !audio && !image && !imageSource) {
    // Log when we receive an audioMessage but couldn't extract any audio data
    if (audioMessage && !audio) {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "warn",
        message: `Audio recebido mas sem dados extraiveis. connectionId=${connectionId ?? "none"}, keys=[${Object.keys(audioMessage).join(",")}]`,
      });
      await sendAudioFailureReply(companyId, rawPhone, "Não consegui ouvir esse áudio agora. Pode enviar novamente ou escrever sua mensagem?");
    }
    return;
  }

  const cleanPhone = rawPhone.replace(/\D/g, "");

  // Handle outgoing messages (fromMe=true) — manual dispatch via the bot's own WhatsApp number
  if (isOutgoing && text && connectionId) {
    // Check if manual dispatch is enabled for this connection
    const { data: mdConn } = await supabase
      .from("bot_whatsapp_conexoes")
      .select("manual_dispatch_enabled")
      .eq("id", connectionId)
      .maybeSingle();
    const manualDispatchEnabled = mdConn?.manual_dispatch_enabled ?? false;

    if (manualDispatchEnabled) {
      // Only treat messages starting with "/" as dispatch commands
      if (!text.trim().startsWith("/")) return;

      // Strip the leading "/" and parse the dispatch command:
      // Format: "/Nome, Telefone, Endereco vai para Destino" or "/Nome, Telefone, Endereco" (no destination)
      const dispatchBody = text.trim().slice(1).trim();
      const dispatchRegex = /^([^,]+),\s*([0-9\s()+\-]+),\s*(.+?)(?:\s+vai\s+para\s+(.+))?$/i;
      const dispatchMatch = dispatchBody.match(dispatchRegex);

      if (dispatchMatch) {
        const [, name, phoneStr, addressPart, destinationPart] = dispatchMatch;
        const passengerName = name.trim();
        const passengerPhone = toBrazilianWhatsAppNumber(phoneStr.trim());
        const pickupAddress = addressPart.trim();
        const destAddress = destinationPart?.trim() || null;

        if (!passengerName || !passengerPhone || !pickupAddress) {
          try {
            const botConfig = await getBotConnectionConfig(connectionId);
            if (botConfig) {
              await sendWhatsAppMessageWithProvider(botConfig.provider, botConfig.fields, cleanPhone, "Formato invalido. Use: /Nome, Telefone, Endereco de embarque vai para Destino");
            }
          } catch { /* best-effort */ }
          return;
        }

        // Cancel any pending ride for this passenger (no auto message to passenger)
        const { data: existingRides } = await supabase
          .from("rides")
          .select("id, status, machine_order_id")
          .eq("company_id", companyId)
          .eq("passenger_phone", passengerPhone)
          .in("status", ["pending"])
          .order("created_at", { ascending: false });

        if (existingRides && existingRides.length > 0) {
          for (const r of existingRides) {
            if (r.machine_order_id) {
              try {
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
                  (tenantRows ?? []).map((r2: { secret_name: string; secret_value: string }) => [r2.secret_name, r2.secret_value])
                );
                const baseUrl = (credentials?.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
                const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials?.machine_api_key || "";
                const user = tenantMap.get("TAXIMETRO_USER") || credentials?.taximetro_username || "";
                const pass = tenantMap.get("TAXIMETRO_PASSWORD") || credentials?.taximetro_password || "";
                if (apiKey && user && pass) {
                  await fetch(`${baseUrl}/api/v2/integracao/corridas/${r.machine_order_id}/cancelar`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "api-key": apiKey,
                      "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
                    },
                    body: JSON.stringify({ motivo_id: 1 }),
                  });
                }
              } catch { /* best-effort */ }
            }
            await supabase.from("rides").update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            }).eq("id", r.id);
          }

          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_webhook",
            level: "info",
            message: `Corrida(s) pendente(s) cancelada(s) para ${passengerName} (${passengerPhone}) via despacho manual pelo numero do bot`,
          });
        }

        // Reset the passenger's bot conversation
        await supabase.from("bot_conversas")
          .update({
            state: "corrida_solicitada",
            passenger_name: passengerName,
            address_text: pickupAddress,
            address_formatted: pickupAddress,
            destination_text: destAddress ?? null,
            destination_formatted: destAddress ?? null,
            selected_category_id: null,
            selected_payment_method: null,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId)
          .eq("phone", passengerPhone);

        // Get company slug
        const { data: companyRow } = await supabase
          .from("companies")
          .select("slug")
          .eq("id", companyId)
          .maybeSingle();

        // Geocode the pickup address
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        const pickupGeocoded = await geocodeAddress(pickupAddress, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        let originLat: number;
        let originLng: number;
        let originAddress: string;
        if (pickupGeocoded) {
          originLat = pickupGeocoded.lat;
          originLng = pickupGeocoded.lng;
          originAddress = pickupGeocoded.formatted;
        } else if (companyLoc.lat != null && companyLoc.lng != null) {
          originLat = companyLoc.lat;
          originLng = companyLoc.lng;
          originAddress = pickupAddress;
        } else {
          try {
            const botConfig = await getBotConnectionConfig(connectionId);
            if (botConfig) {
              await sendWhatsAppMessageWithProvider(botConfig.provider, botConfig.fields, cleanPhone, `Nao foi possivel geocodificar o endereco de embarque: ${pickupAddress}. Verifique se o endereco esta correto.`);
            }
          } catch { /* best-effort */ }
          return;
        }

        // Geocode destination if provided
        let destination: { lat: number; lng: number; address: string } | null = null;
        if (destAddress) {
          const destGeocoded = await geocodeAddress(destAddress, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
          if (destGeocoded) {
            destination = { lat: destGeocoded.lat, lng: destGeocoded.lng, address: destGeocoded.formatted };
          } else {
            destination = { lat: originLat, lng: originLng, address: destAddress };
          }
        }

        // Get the first available category for this connection
        const categories = await getCategoriesForConnection(companyId, connectionId);
        const category = categories[0] ?? null;
        const categoryLabel = category?.label ?? "Economico";
        const machineCategoryId = category?.machine_category_id ?? null;

        // Create and dispatch the ride
        const result = await createAndDispatchRide(
          companyId,
          companyRow?.slug ?? "",
          passengerName,
          passengerPhone,
          { lat: originLat, lng: originLng, address: originAddress },
          categoryLabel,
          machineCategoryId,
          null,
          destination,
        );

        // Update the conversation with the ride ID
        if (result.rideId) {
          await supabase.from("bot_conversas")
            .update({ ride_id: result.rideId, updated_at: new Date().toISOString() })
            .eq("company_id", companyId)
            .eq("phone", passengerPhone);
        }

        // Log the manual dispatch
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "info",
          message: `Despacho manual via numero do bot: ${passengerName} (${passengerPhone}) - Embarque: ${originAddress}${destination ? ` - Destino: ${destination.address}` : ""} - ${result.success ? "Sucesso" : "Falha: " + (result.error ?? "")}`,
          ride_id: result.rideId || undefined,
        });

        // Confirm back to the sender (the company person using the bot's WhatsApp)
        try {
          const botConfig = await getBotConnectionConfig(connectionId);
          if (botConfig) {
            const confirmMsg = result.success
              ? `\u2705 Corrida despachada para ${passengerName} (${passengerPhone}).\nEmbarque: ${originAddress}${destination ? `\nDestino: ${destination.address}` : ""}${result.machineMessage ? `\n${result.machineMessage}` : ""}`
              : `\u274C Erro ao despachar corrida para ${passengerName}: ${result.error ?? "erro desconhecido"}`;
            await sendWhatsAppMessageWithProvider(botConfig.provider, botConfig.fields, cleanPhone, confirmMsg);
          }
        } catch { /* best-effort */ }

        return;
      }

      // Not a dispatch command — ignore (do NOT forward to passenger)
      return;
    }

    // Manual dispatch not enabled — skip outgoing messages
    return;
  }

  // Skip further processing for outgoing messages when manual dispatch is not enabled
  if (isOutgoing) return;

  if (!text && audio) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `Iniciando transcricao: audio.data length=${audio.data.length}, mimetype=${audio.mimetype}`,
    });
    const transcribed = await transcribeAudio(audio.data, audio.mimetype, companyId);
    if (transcribed?.trim()) {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "info",
        message: `Transcricao OK: "${transcribed.trim().slice(0, 100)}"`,
      });
      text = transcribed.trim();
      audio = null;
    } else {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "warn",
        message: `Transcricao falhou para ${cleanPhone}. audio.data length=${audio.data.length}, mimetype=${audio.mimetype}`,
      });
      await sendAudioFailureReply(companyId, cleanPhone, "Não consegui entender esse áudio agora. Pode enviar novamente ou escrever sua mensagem?");
      return;
    }
  }

  const normalizedText = (text ?? "").trim().toLowerCase();

  // Check if sender is the support number — handles both support chat AND manual dispatch
  const supportExitWords = ["sair", "voltar", "corrida", "1", "menu", "fim", "encerrar", "encerra", "finalizar", "finaliza", "terminar", "termina", "encerrar suporte", "finalizar suporte"];
  const { data: companyForSupport } = await supabase
    .from("companies")
    .select("support_whatsapp, slug")
    .eq("id", companyId)
    .maybeSingle();
  if (companyForSupport?.support_whatsapp && text) {
    const supportPhone = toBrazilianWhatsAppNumber(companyForSupport.support_whatsapp);
    if (cleanPhone === supportPhone) {
      // Check if manual dispatch is enabled for this connection
      let manualDispatchEnabled = false;
      if (connectionId) {
        const { data: mdConn } = await supabase
          .from("bot_whatsapp_conexoes")
          .select("manual_dispatch_enabled")
          .eq("id", connectionId)
          .maybeSingle();
        manualDispatchEnabled = mdConn?.manual_dispatch_enabled ?? false;
      }

      // Only treat messages starting with "/" as dispatch commands
      if (text.trim().startsWith("/") && manualDispatchEnabled) {
        // Strip the leading "/" and parse the dispatch command:
        // Format: "/Nome, Telefone, Endereco vai para Destino" or "/Nome, Telefone, Endereco" (no destination)
        const dispatchBody = text.trim().slice(1).trim();
        const dispatchRegex = /^([^,]+),\s*([0-9\s()+\-]+),\s*(.+?)(?:\s+vai\s+para\s+(.+))?$/i;
        const dispatchMatch = dispatchBody.match(dispatchRegex);

      if (dispatchMatch) {
        const [, name, phone, addressPart, destinationPart] = dispatchMatch;
        const passengerName = name.trim();
        const passengerPhone = toBrazilianWhatsAppNumber(phone.trim());
        const pickupAddress = addressPart.trim();
        const destAddress = destinationPart?.trim() || null;

        if (!passengerName || !passengerPhone || !pickupAddress) {
          try {
            const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
            const errMsg = "Formato invalido. Use: Nome, Telefone, Endereco de embarque vai para Destino";
            await sendWhatsAppMessageWithProvider(provider, f, supportPhone, errMsg);
            await saveMessage(companyId, supportPhone, "outgoing", errMsg);
          } catch { /* best-effort */ }
          return;
        }

        // Cancel any pending ride for this passenger (no auto message to passenger)
        const { data: existingRides } = await supabase
          .from("rides")
          .select("id, status, machine_order_id")
          .eq("company_id", companyId)
          .eq("passenger_phone", passengerPhone)
          .in("status", ["pending"])
          .order("created_at", { ascending: false });

        if (existingRides && existingRides.length > 0) {
          for (const r of existingRides) {
            if (r.machine_order_id) {
              try {
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
                  (tenantRows ?? []).map((r2: { secret_name: string; secret_value: string }) => [r2.secret_name, r2.secret_value])
                );
                const baseUrl = (credentials?.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
                const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials?.machine_api_key || "";
                const user = tenantMap.get("TAXIMETRO_USER") || credentials?.taximetro_username || "";
                const pass = tenantMap.get("TAXIMETRO_PASSWORD") || credentials?.taximetro_password || "";
                if (apiKey && user && pass) {
                  await fetch(`${baseUrl}/api/v2/integracao/corridas/${r.machine_order_id}/cancelar`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "api-key": apiKey,
                      "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
                    },
                    body: JSON.stringify({ motivo_id: 1 }),
                  });
                }
              } catch { /* best-effort */ }
            }
            await supabase.from("rides").update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            }).eq("id", r.id);
          }

          await supabase.from("admin_logs").insert({
            company_id: companyId,
            source: "whatsapp_webhook",
            level: "info",
            message: `Corrida(s) pendente(s) cancelada(s) para ${passengerName} (${passengerPhone}) via despacho manual do suporte`,
          });
        }

        // Reset the passenger's bot conversation
        await supabase.from("bot_conversas")
          .update({
            state: "corrida_solicitada",
            passenger_name: passengerName,
            address_text: pickupAddress,
            address_formatted: pickupAddress,
            destination_text: destAddress ?? null,
            destination_formatted: destAddress ?? null,
            selected_category_id: null,
            selected_payment_method: null,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId)
          .eq("phone", passengerPhone);

        // Geocode the pickup address
        const companyLoc = await getCompanyLocationInfo(companyId, connectionId);
        const pickupGeocoded = await geocodeAddress(pickupAddress, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
        let originLat: number;
        let originLng: number;
        let originAddress: string;
        if (pickupGeocoded) {
          originLat = pickupGeocoded.lat;
          originLng = pickupGeocoded.lng;
          originAddress = pickupGeocoded.formatted;
        } else if (companyLoc.lat != null && companyLoc.lng != null) {
          originLat = companyLoc.lat;
          originLng = companyLoc.lng;
          originAddress = pickupAddress;
        } else {
          try {
            const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
            const errMsg = `Nao foi possivel geocodificar o endereco de embarque: ${pickupAddress}. Verifique se o endereco esta correto.`;
            await sendWhatsAppMessageWithProvider(provider, f, supportPhone, errMsg);
            await saveMessage(companyId, supportPhone, "outgoing", errMsg);
          } catch { /* best-effort */ }
          return;
        }

        // Geocode destination if provided
        let destination: { lat: number; lng: number; address: string } | null = null;
        if (destAddress) {
          const destGeocoded = await geocodeAddress(destAddress, companyLoc.city ?? undefined, companyLoc.state ?? undefined, companyLoc.lat ?? undefined, companyLoc.lng ?? undefined);
          if (destGeocoded) {
            destination = { lat: destGeocoded.lat, lng: destGeocoded.lng, address: destGeocoded.formatted };
          } else {
            destination = { lat: originLat, lng: originLng, address: destAddress };
          }
        }

        // Get the first available category for this connection
        const categories = await getCategoriesForConnection(companyId, connectionId);
        const category = categories[0] ?? null;
        const categoryLabel = category?.label ?? "Economico";
        const machineCategoryId = category?.machine_category_id ?? null;

        // Create and dispatch the ride
        const result = await createAndDispatchRide(
          companyId,
          companyForSupport.slug,
          passengerName,
          passengerPhone,
          { lat: originLat, lng: originLng, address: originAddress },
          categoryLabel,
          machineCategoryId,
          null,
          destination,
        );

        // Update the conversation with the ride ID
        if (result.rideId) {
          await supabase.from("bot_conversas")
            .update({ ride_id: result.rideId, updated_at: new Date().toISOString() })
            .eq("company_id", companyId)
            .eq("phone", passengerPhone);
        }

        // Log the manual dispatch
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "info",
          message: `Despacho manual via suporte: ${passengerName} (${passengerPhone}) - Embarque: ${originAddress}${destination ? ` - Destino: ${destination.address}` : ""} - ${result.success ? "Sucesso" : "Falha: " + (result.error ?? "")}`,
          ride_id: result.rideId || undefined,
        });

        // Confirm to the support agent (NOT to the passenger)
        try {
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          const confirmMsg = result.success
            ? `\u2705 Corrida despachada para ${passengerName} (${passengerPhone}).\nEmbarque: ${originAddress}${destination ? `\nDestino: ${destination.address}` : ""}${result.machineMessage ? `\n${result.machineMessage}` : ""}`
            : `\u274C Erro ao despachar corrida para ${passengerName}: ${result.error ?? "erro desconhecido"}`;
          await sendWhatsAppMessageWithProvider(provider, f, supportPhone, confirmMsg);
          await saveMessage(companyId, supportPhone, "outgoing", confirmMsg);
        } catch { /* best-effort */ }

        return;
      }

      // "/" message didn't match dispatch format — send error and return
      try {
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const errMsg = "Formato invalido. Use: /Nome, Telefone, Endereco de embarque vai para Destino";
        await sendWhatsAppMessageWithProvider(provider, f, supportPhone, errMsg);
        await saveMessage(companyId, supportPhone, "outgoing", errMsg);
      } catch { /* best-effort */ }
      return;
    } // end if (text.trim().startsWith("/") && manualDispatchEnabled)

      // Non-"/" messages from support number — handle as support chat
      const { data: supportConv } = await supabase
        .from("bot_conversas")
        .select("id, phone, passenger_name, updated_at")
        .eq("company_id", companyId)
        .eq("state", "suporte")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (supportConv) {
        // Check if support agent wants to end the chat
        if (supportExitWords.includes(normalizedText)) {
          await supabase.from("bot_conversas")
            .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
            .eq("id", supportConv.id);
          try {
            const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
            const closeMsg = "\u{1F44B} Suporte encerrado.\n\n1 - Solicitar corrida \u{1F695}\n2 - Suporte \u{1F4AC}\n\nResponda com o numero da opcao.";
            await sendWhatsAppMessageWithProvider(provider, f, supportConv.phone, closeMsg);
            await saveMessage(companyId, supportConv.phone, "outgoing", closeMsg);
          } catch { /* best-effort */ }
          return;
        }

        // Auto-close after 5 minutes of inactivity (from either side)
        if (supportConv.updated_at) {
          const lastActivity = new Date(supportConv.updated_at).getTime();
          const idleMs = Date.now() - lastActivity;
          if (idleMs > 5 * 60 * 1000) {
            await supabase.from("bot_conversas")
              .update({ state: "menu_inicial", updated_at: new Date().toISOString() })
              .eq("id", supportConv.id);
            try {
              const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
              const timeoutMsg = "\u23F1\uFE0F O atendimento de suporte foi encerrado por inatividade.\n\n1 - Solicitar corrida \u{1F695}\n2 - Suporte \u{1F4AC}\n\nResponda com o numero da opcao.";
              await sendWhatsAppMessageWithProvider(provider, f, supportConv.phone, timeoutMsg);
              await saveMessage(companyId, supportConv.phone, "outgoing", timeoutMsg);
            } catch { /* best-effort */ }
            return;
          }
        }

        // Forward message to passenger and refresh activity timestamp
        const replyMsg = `Mensagem do Suporte: ${text.trim()}`;
        try {
          const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
          await sendWhatsAppMessageWithProvider(provider, f, supportConv.phone, replyMsg);
          await saveMessage(companyId, supportConv.phone, "outgoing", replyMsg);
        } catch { /* best-effort */ }
        await supabase.from("bot_conversas")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", supportConv.id);
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

      // Driver cancelled — send ride back to pending so a new driver can accept
      await supabase.from("rides").update({
        status: "pending",
        driver_name: null,
        driver_phone: null,
        vehicle_plate: null,
        vehicle_model: null,
        vehicle_color: null,
        machine_driver_id: null,
        machine_order_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", driverRide.id);

      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "whatsapp_webhook",
        level: "info",
        message: `Motorista (${cleanPhone}) cancelou corrida ${driverRide.id.slice(0, 8)} — voltou para pendente`,
        ride_id: driverRide.id,
      });

      // Re-dispatch to Machine API so a new driver can accept
      try {
        const { data: rideData } = await supabase
          .from("rides")
          .select("origin_lat, origin_lng, origin_label, destination_lat, destination_lng, destination_label, passenger_name, passenger_phone, payment_method, category_label, company_id")
          .eq("id", driverRide.id)
          .maybeSingle();

        if (rideData) {
          const { data: companyRow } = await supabase
            .from("companies")
            .select("slug")
            .eq("id", companyId)
            .maybeSingle();

          const { data: settings } = await supabase
            .from("company_settings")
            .select("integration_mode")
            .eq("company_id", companyId)
            .maybeSingle();

          const integrationMode = settings?.integration_mode ?? "machine";

          // Look up the machine_category_id for the ride's category_label so the
          // re-dispatch sends the exact same category the passenger originally chose.
          let machineCategoryId: string | null = null;
          if (rideData.category_label) {
            const { data: catRow } = await supabase
              .from("vehicle_categories")
              .select("machine_category_id")
              .eq("company_id", companyId)
              .eq("label", rideData.category_label)
              .maybeSingle();
            machineCategoryId = catRow?.machine_category_id ?? null;
          }

          await fetch(`${supabaseUrl}/functions/v1/dispatch-ride`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              companySlug: companyRow?.slug,
              companyId,
              integrationMode,
              rideId: driverRide.id,
              passenger_name: rideData.passenger_name ?? "",
              passenger_phone: rideData.passenger_phone ?? "",
              origin: {
                lat: rideData.origin_lat,
                lng: rideData.origin_lng,
                address: rideData.origin_label ?? "",
              },
              ...(rideData.destination_lat != null && rideData.destination_lng != null ? {
                destination: {
                  lat: rideData.destination_lat,
                  lng: rideData.destination_lng,
                  address: rideData.destination_label ?? "",
                },
              } : {}),
              category: machineCategoryId || rideData.category_label || "",
              payment_method: rideData.payment_method ?? "",
            }),
          });
        }
      } catch { /* best-effort re-dispatch */ }

      // Notify passenger that a new driver is being sought
      try {
        const passengerPhone = toBrazilianWhatsAppNumber(driverRide.passenger_phone);
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const cancelMsg = "O motorista cancelou a corrida. Estamos procurando um novo motorista para voce. Aguarde.";
        await sendWhatsAppMessageWithProvider(provider, f, passengerPhone, cancelMsg);
        await saveMessage(companyId, passengerPhone, "outgoing", cancelMsg);
      } catch { /* best-effort */ }

      // Confirm to driver
      try {
        const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
        const driverConfirm = "Corrida cancelada com sucesso. Um novo motorista sera procurado para o passageiro.";
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
      try {
        await handleBotMessage(companyId, cleanPhone, text, pushName, location, audio, connectionId, image);
      } catch (err) {
        const errMsg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
        await supabase.from("admin_logs").insert({
          company_id: companyId,
          source: "whatsapp_webhook",
          level: "error",
          message: `handleBotMessage CRASH for ${cleanPhone}: ${errMsg.slice(0, 1000)}`,
        });
      }
    }
    return;
  }

  // Handle the cancel command and replies to the confirmation step.
  const { data: cancelConversation } = await supabase
    .from("bot_conversas")
    .select("id, state")
    .eq("company_id", companyId)
    .eq("phone", cleanPhone)
    .maybeSingle();
  const conv2 = cancelConversation;
  const convState = conv2?.state ?? "";
  const isCancelReply = convState === "aguardando_cancelamento"
    && (isCancelConfirmation(text ?? "") || isCancelDenial(text ?? ""));
  if (!normalizedText.includes("cancel") && !isCancelReply) return;

  // If this is the first cancel request (not already waiting for confirmation),
  // ask the passenger to confirm before actually canceling.
  if (convState === "aguardando_cancelamento") {
    // Check confirmation FIRST — "cancelar" is in both lists, but when the user
    // is already in the confirmation state and says "cancelar" or "1", they
    // mean "yes, cancel it", not "no, don't cancel".
    if (isCancelConfirmation(text ?? "")) {
      // Confirmed — proceed to cancel below
    } else if (isCancelDenial(text ?? "")) {
      await supabase.from("bot_conversas").update({ state: "corrida_solicitada", updated_at: new Date().toISOString() }).eq("id", conv2.data!.id);
      const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
      await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, "\u2705 Cancelamento abortado. Sua corrida continua ativa.");
      return;
    } else {
      const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
      await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, "\u26A0\uFE0F Responda 1 para CONFIRMAR o cancelamento ou 2 para MANTER a corrida.");
      return;
    }
  } else {
    // First cancel request — ask for confirmation
    if (conv2.data?.id) {
      await supabase.from("bot_conversas").update({ state: "aguardando_cancelamento", updated_at: new Date().toISOString() }).eq("id", conv2.data.id);
    }
    const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
    await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, "\u26A0\uFE0F Voce realmente deseja cancelar sua corrida?\n\n1 - Sim, cancelar\n2 - Nao, manter");
    return;
  }

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

  // Reset bot conversation so passenger can request a new ride
  await supabase.from("bot_conversas")
    .update({ state: "menu_inicial", ride_id: null, address_text: null, address_lat: null, address_lng: null, address_formatted: null, destination_text: null, destination_lat: null, destination_lng: null, destination_formatted: null, selected_category_id: null, selected_payment_method: null, updated_at: new Date().toISOString() })
    .eq("phone", cleanPhone)
    .eq("company_id", companyId);

  // Send confirmation message back to passenger via global WhatsApp provider
  try {
    const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);
    const confirmMsg = "Sua corrida foi cancelada com sucesso. Para solicitar uma nova viagem, envie uma mensagem.";
    await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, confirmMsg);
    await saveMessage(companyId, cleanPhone, "outgoing", confirmMsg);
  } catch {
    // Best-effort
  }
}


// v2-sync 1790314381
// force redeploy Fri Sep 25 13:21:45 UTC 2026
// v8.3 cancel+autocomplete fix Fri Sep 25 13:32:15 UTC 2026
// v8.4 regex fix Fri Sep 25 13:33:11 UTC 2026
// v8.5 support timeout Fri Sep 25 14:10:55 UTC 2026
// v9.0 NLU + fuzzy POI + Google geocoding + failure loop + machineMessage sanitize Fri Sep 25 17:45:00 UTC 2026
// v9.1 NLU anti-error-loop prompt with dynamic city/state/totem context Fri Sep 25 18:00:00 UTC 2026
// v9.2 NLU TOTEM_FIXO vs BOT_WHATSAPP instance type distinction Fri Sep 25 18:15:00 UTC 2026
// force redeploy
