import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// machine-webhook: handles Machine API status + position webhooks.
// The Machine API only sends push/in-app notifications to passengers who have
// the app installed. Since totem passengers don't have the app, we send WhatsApp
// notifications via Evolution API (our own WhatsApp instance) instead.

const STATUS_MAP: Record<string, string> = {
  D: "pending",
  G: "pending",
  P: "pending",
  N: "pending",
  A: "accepted",
  AP: "en_route",
  E: "in_progress",
  S: "in_progress",
  F: "completed",
  C: "canceled",
  L: "in_progress",
  R: "in_progress",
  U: "in_progress",
  ER: "in_progress",
};

const STATUS_MESSAGES_PT: Record<string, string> = {
  accepted: "Seu motorista aceitou a corrida! Esta a caminho do ponto de partida.",
  en_route: "Seu motorista chegou ao local de embarque! Procure pelo veiculo.",
  in_progress: "Sua viagem esta em andamento.",
  completed: "Sua viagem foi concluida. Obrigado pela preferencia!",
  canceled: "Sua corrida foi cancelada.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { request_id, status_code, status_label, data: batchData } = body;

    if (batchData && Array.isArray(batchData)) {
      for (const pos of batchData) {
        if (pos.request_id && pos.coordinates) {
          await updateDriverPosition(pos.request_id, pos.coordinates.latitude, pos.coordinates.longitude);
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request_id && status_code) {
      const internalStatus = STATUS_MAP[status_code] ?? "pending";
      const machineOrderId = String(request_id);

      const { data: ride } = await supabase
        .from("rides")
        .select("id, company_id, passenger_name, passenger_phone, status")
        .eq("machine_order_id", machineOrderId)
        .maybeSingle();

      if (!ride) {
        return new Response(JSON.stringify({ success: true, note: "ride not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ride.status === internalStatus) {
        return new Response(JSON.stringify({ success: true, note: "no change" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let driverName: string | null = null;
      let driverPhone: string | null = null;
      let vehiclePlate: string | null = null;
      let vehicleModel: string | null = null;

      if (internalStatus === "accepted" || internalStatus === "en_route" || internalStatus === "in_progress") {
        const details = await fetchRideDetails(ride.company_id, machineOrderId);
        if (details?.driver) {
          driverName = details.driver.nome ?? null;
          driverPhone = details.driver.telefone ?? null;
          vehiclePlate = details.driver.veiculo_placa ?? null;
          vehicleModel = details.driver.veiculo_modelo ?? null;
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: internalStatus,
        updated_at: new Date().toISOString(),
      };

      if (driverName) updatePayload.driver_name = driverName;
      if (driverPhone) updatePayload.driver_phone = driverPhone;
      if (vehiclePlate) updatePayload.vehicle_plate = vehiclePlate;
      if (vehicleModel) updatePayload.vehicle_model = vehicleModel;

      await supabase.from("rides").update(updatePayload).eq("id", ride.id);

      await supabase.from("admin_logs").insert({
        company_id: ride.company_id,
        source: "machine_webhook",
        level: "info",
        message: `Corrida ${machineOrderId} -> ${status_label} (${status_code}) -> ${internalStatus}`,
        ride_id: ride.id,
        payload: body,
      });

      // Send WhatsApp notification to passenger via Evolution API
      // (passengers don't have the Machine app, so push notifications won't reach them)
      await sendWhatsAppNotification(
        ride.company_id,
        ride.passenger_phone,
        internalStatus,
        driverName,
        vehicleModel,
        vehiclePlate,
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, note: "unhandled event" }), {
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

async function updateDriverPosition(requestId: string, lat: number, lng: number): Promise<void> {
  const { data: ride } = await supabase
    .from("rides")
    .select("id, company_id")
    .eq("machine_order_id", String(requestId))
    .maybeSingle();

  if (!ride) return;

  await supabase.from("ride_driver_positions").upsert({
    ride_id: ride.id,
    lat,
    lng,
    updated_at: new Date().toISOString(),
  }).eq("ride_id", ride.id);
}

async function fetchRideDetails(companyId: string, machineOrderId: string): Promise<Record<string, unknown> | null> {
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
    .eq("company_id", companyId)
    .single();

  if (!credentials) return null;

  const baseUrl = (credentials.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
  const apiKey = credentials.machine_api_key || "";
  const user = credentials.taximetro_username || "";
  const pass = credentials.taximetro_password || "";

  if (!apiKey || !user || !pass) return null;

  try {
    const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${machineOrderId}/detalhes`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
      },
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

async function sendWhatsAppNotification(
  companyId: string,
  passengerPhone: string,
  internalStatus: string,
  driverName: string | null,
  vehicleModel: string | null,
  vehiclePlate: string | null,
): Promise<void> {
  let message = STATUS_MESSAGES_PT[internalStatus];
  if (!message) return;

  if (internalStatus === "accepted" && driverName) {
    message += `\n\nMotorista: ${driverName}`;
    if (vehicleModel) message += `\nVeiculo: ${vehicleModel}`;
    if (vehiclePlate) message += `\nPlaca: ${vehiclePlate}`;
    message += `\n\nPara cancelar, responda "cancelar".`;
  }

  const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);

  const isConfigured = (provider === "evolution" || provider === "veloov")
    ? !!(f["evo_url"] && f["evo_token"])
    : provider === "zapi"
    ? !!(f["zapi_url"] && f["zapi_instance_id"] && f["zapi_instance_token"])
    : provider === "zpro"
    ? !!(f["zpro_url"] && f["zpro_instance_id"] && f["zpro_instance_token"])
    : provider === "meta_cloud"
    ? !!(f["meta_token"] && f["meta_phone_id"])
    : provider === "custom_webhook"
    ? !!f["custom_url"]
    : false;

  if (!isConfigured) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_webhook",
      level: "warning",
      message: `WhatsApp provider "${provider}" not configured — passenger notification skipped for status ${internalStatus}`,
    });
    return;
  }

  const cleanPhone = passengerPhone.replace(/\D/g, "");
  if (!cleanPhone) return;

  try {
    await sendWhatsAppMessage(provider, f, cleanPhone, message);

    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_webhook",
      level: "info",
      message: `Notificacao WhatsApp enviada para passageiro (${internalStatus})`,
    });
  } catch {
    // Best-effort
  }
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
    if (instance.provider_token) fields["meta_token"] = instance.provider_token;
    if (instance.provider_phone_id) fields["meta_phone_id"] = instance.provider_phone_id;
    if (instance.provider_waba_id) fields["meta_waba_id"] = instance.provider_waba_id;
    return { provider: instance.whatsapp_provider, fields };
  }

  return await getWhatsAppConfig();
}

async function sendWhatsAppMessage(
  provider: string,
  f: Record<string, string>,
  cleanPhone: string,
  message: string,
): Promise<void> {
  if (provider === "evolution" || provider === "veloov") {
    const url = f["evo_url"] ?? "";
    const token = f["evo_token"] ?? "";
    if (!url || !token) return;
    const instance = f["evo_instance"] || "veloov";
    await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
    return;
  }

  if (provider === "zapi") {
    const url = f["zapi_url"] ?? "";
    const instanceId = f["zapi_instance_id"] ?? "";
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceId || !instanceToken) return;
    await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return;
  }

  if (provider === "zpro") {
    const url = f["zpro_url"] ?? "";
    const instanceId = f["zpro_instance_id"] ?? "";
    const instanceToken = f["zpro_instance_token"] ?? "";
    const clientToken = f["zpro_client_token"] ?? "";
    if (!url || !instanceId || !instanceToken) return;
    await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return;
  }

  if (provider === "meta_cloud") {
    const token = f["meta_token"] ?? "";
    const phoneId = f["meta_phone_id"] ?? "";
    if (!token || !phoneId) return;
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    });
    return;
  }

  if (provider === "custom_webhook") {
    const url = f["custom_url"] ?? "";
    const token = f["custom_token"] ?? "";
    const headersJson = f["custom_headers"] ?? "{}";
    if (!url) return;
    let extraHeaders: Record<string, string> = {};
    try { extraHeaders = JSON.parse(headersJson); } catch { /* ignore */ }
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        ...extraHeaders,
      },
      body: JSON.stringify({ phone: cleanPhone, message, text: message, number: cleanPhone }),
    });
    return;
  }
}
