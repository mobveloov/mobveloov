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
// Updated: fix token check + replace rpc with direct query for Evolution API v2.3.7. v2
// Also routes passenger messages to ride_messages table for driver chat.
// v3: forwards passenger messages to Machine API (POST /mensagens/condutor/{id}) when ride has machine_driver_id.

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

  if (!rawPhone || !text) return;

  const cleanPhone = rawPhone.replace(/\D/g, "");
  const normalizedText = text.trim().toLowerCase();

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
    await supabase.from("ride_messages").insert({
      ride_id: ride.id,
      company_id: companyId,
      sender: "passageiro",
      content: text.trim(),
      status: "entregue",
    });

    // If the ride has a Machine driver ID, forward the message to the driver via Machine API
    if (ride.machine_driver_id) {
      try {
        await forwardMessageToMachineDriver(companyId, ride.machine_driver_id, text.trim(), ride.machine_order_id);
      } catch {
        // best-effort — message is saved in ride_messages regardless
      }
    }
  }

  // If no active ride found, log the unmatched message
  if (!ride) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `Mensagem recebida de ${cleanPhone}: "${text.trim().slice(0, 100)}" — nenhuma corrida ativa vinculada a este número`,
    });
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
