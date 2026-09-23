import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// whatsapp-webhook: handles Evolution API events + incoming "cancelar" messages from passengers (v2)

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
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
    return resp.ok;
  }

  if (provider === "zapi") {
    const url = f["zapi_url"] ?? "";
    const instanceId = f["zapi_instance_id"] ?? "";
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceId || !instanceToken) return false;
    const resp = await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return resp.ok;
  }

  if (provider === "zpro") {
    const url = f["zpro_url"] ?? "";
    const instanceId = f["zpro_instance_id"] ?? "";
    const instanceToken = f["zpro_instance_token"] ?? "";
    const clientToken = f["zpro_client_token"] ?? "";
    if (!url || !instanceId || !instanceToken) return false;
    const resp = await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
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
    if (event === "connection.update" || event === "status.connect") {
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
    if (event === "messages.upsert" || event === "message.receive") {
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
          accepted: "Seu motorista aceitou a corrida! A caminho do ponto de partida.",
          en_route: "Seu motorista chegou ao local de embarque! Procure pelo veiculo.",
          in_progress: "Sua viagem está em andamento.",
          completed: "Sua viagem foi concluída. Obrigado!",
        };

        const message = statusMessages[newStatus];
        if (message) {
          const cleanPhone = String(data.passenger_phone).replace(/\D/g, "");
          try {
            const { provider, fields: f } = await getWhatsAppConfig();
            await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, message);
          } catch {
            // Silent — notification is best-effort
          }
        }
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

  // Only handle "cancelar" (and variations like "cancelar corrida", "cancela")
  if (!normalizedText.includes("cancel")) return;

  // Find the passenger's active ride by phone number across ALL companies
  // (the global Veloov instance serves all companies)
  const phoneVariants = [
    cleanPhone,
    cleanPhone.replace(/^55/, ""),
    `55${cleanPhone.replace(/^55/, "")}`,
  ];

  let ride: { id: string; machine_order_id: string | null; company_id: string; passenger_name: string } | null = null;

  for (const phone of phoneVariants) {
    const { data: found } = await supabase
      .from("rides")
      .select("id, machine_order_id, company_id, passenger_name")
      .eq("passenger_phone", phone)
      .in("status", ["pending", "accepted", "en_route"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (found) {
      ride = found;
      break;
    }
  }

  if (!ride) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp_webhook",
      level: "info",
      message: `Mensagem "cancelar" recebida de ${cleanPhone} mas nenhuma corrida ativa encontrada`,
    });
    return;
  }

  // Cancel the ride: call the dispatch-ride edge function's cancel action
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
    .eq("company_id", ride.company_id)
    .single();

  let machineCanceled = false;

  if (ride.machine_order_id && credentials) {
    const baseUrl = (credentials.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
    const apiKey = credentials.machine_api_key || "";
    const user = credentials.taximetro_username || "";
    const pass = credentials.taximetro_password || "";

    if (apiKey && user && pass) {
      try {
        const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${ride.machine_order_id}/cancelar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
            "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
          },
          body: JSON.stringify({ motivo_id: 3 }),
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
    const { provider, fields: f } = await getWhatsAppConfig();
    await sendWhatsAppMessageWithProvider(provider, f, cleanPhone, "Sua corrida foi cancelada com sucesso. Para solicitar uma nova viagem, use o totem.");
  } catch {
    // Best-effort
  }
}
