import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifyMachineSignature(req: Request): Promise<boolean> {
  const secret = Deno.env.get("MACHINE_WEBHOOK_SECRET");
  if (!secret) return true; // If no secret configured, skip verification (backwards compat)
  const signature = req.headers.get("x-machine-signature");
  if (!signature) return false;
  const rawBody = await req.clone().text();
  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");
  return signature === expected;
}

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
  pending: "Seu motorista cancelou. Estamos procurando um novo motorista para sua corrida. Aguarde.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify webhook signature if secret is configured
  if (!(await verifyMachineSignature(req))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

      if (ride.status === internalStatus && internalStatus !== "accepted") {
        return new Response(JSON.stringify({ success: true, note: "no change" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Detect driver change: if status is accepted and the ride was already accepted,
      // check if the driver is different — if so, re-send notification with new driver info
      let driverChanged = false;
      if (internalStatus === "accepted" && ride.status === "accepted") {
        const { data: existingRide } = await supabase
          .from("rides")
          .select("driver_name, driver_phone, vehicle_plate")
          .eq("id", ride.id)
          .maybeSingle();
        if (existingRide) {
          const newDetails = await fetchRideDetails(ride.company_id, machineOrderId);
          const newDriverName = newDetails?.driver?.nome ?? null;
          const newDriverPhone = newDetails?.driver?.telefone ?? null;
          const newVehiclePlate = newDetails?.driver?.veiculo_placa ?? null;
          if (newDriverName && newDriverName !== existingRide.driver_name) {
            driverChanged = true;
          } else if (newVehiclePlate && newVehiclePlate !== existingRide.vehicle_plate) {
            driverChanged = true;
          } else if (!newDriverName && !newDriverPhone) {
            // Same status, same driver — skip
            return new Response(JSON.stringify({ success: true, note: "no change" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
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

      // When ride goes back to pending (driver cancelled), clear old driver info
      if (internalStatus === "pending" && ride.status !== "pending") {
        driverName = null;
        driverPhone = null;
        vehiclePlate = null;
        vehicleModel = null;
      }

      const updatePayload: Record<string, unknown> = {
        status: internalStatus,
        updated_at: new Date().toISOString(),
      };

      // Only overwrite driver info if we have new values, or if the ride is going back to pending
      // (driver cancelled). For completed/canceled, preserve existing driver info for history.
      if (driverName !== null) updatePayload.driver_name = driverName;
      if (driverPhone !== null) updatePayload.driver_phone = driverPhone;
      if (vehiclePlate !== null) updatePayload.vehicle_plate = vehiclePlate;
      if (vehicleModel !== null) updatePayload.vehicle_model = vehicleModel;
      // Explicitly clear driver info only when going back to pending
      if (internalStatus === "pending" && ride.status !== "pending") {
        updatePayload.driver_name = null;
        updatePayload.driver_phone = null;
        updatePayload.vehicle_plate = null;
        updatePayload.vehicle_model = null;
      }

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

      // Fetch driver position for distance/ETA calculation
      let driverDistanceKm: number | null = null;
      let etaMinutes: number | null = null;
      try {
        const { data: pos } = await supabase
          .from("ride_driver_positions")
          .select("lat, lng")
          .eq("ride_id", ride.id)
          .maybeSingle();
        if (pos) {
          const { data: rideCoords } = await supabase
            .from("rides")
            .select("origin_lat, origin_lng")
            .eq("id", ride.id)
            .single();
          if (rideCoords) {
            const R = 6371;
            const dLat = ((pos.lat - rideCoords.origin_lat) * Math.PI) / 180;
            const dLng = ((pos.lng - rideCoords.origin_lng) * Math.PI) / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(rideCoords.origin_lat * Math.PI/180) * Math.cos(pos.lat * Math.PI/180) * Math.sin(dLng/2)**2;
            driverDistanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            etaMinutes = Math.max(1, Math.round(driverDistanceKm * 2.5));
          }
        }
      } catch { /* best-effort */ }

      await sendWhatsAppNotification(
        ride.company_id,
        ride.id,
        ride.passenger_phone,
        internalStatus,
        driverName,
        vehicleModel,
        vehiclePlate,
        etaMinutes,
        driverDistanceKm,
        ride.status,
        driverChanged,
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
  rideId: string,
  passengerPhone: string,
  internalStatus: string,
  driverName: string | null,
  vehicleModel: string | null,
  vehiclePlate: string | null,
  etaMinutes: number | null = null,
  driverDistanceKm: number | null = null,
  previousStatus: string | null = null,
  driverChanged: boolean = false,
): Promise<void> {
  let message = STATUS_MESSAGES_PT[internalStatus];
  if (!message) return;

  const features = await getPlanNotificationFeatures(companyId);

  if (internalStatus === "accepted" && driverName) {
    if (features.send_driver_info) {
      const isDriverChange = previousStatus === "accepted" && driverChanged;
      if (isDriverChange) {
        message = "Seu motorista foi trocado! Um novo motorista aceitou sua corrida.";
      }
      message += `\n\nMotorista: ${driverName}`;
      if (vehicleModel) message += `\nVeiculo: ${vehicleModel}`;
      if (vehiclePlate) message += `\nPlaca: ${vehiclePlate}`;
    }

    if (features.send_eta && etaMinutes != null) {
      message += `\nTempo estimado de chegada: ${etaMinutes} min`;
    }

    if (features.distance_update_interval_min > 0 && driverDistanceKm != null) {
      if (driverDistanceKm >= 1) {
        message += `\nO motorista esta a ${driverDistanceKm.toFixed(1)} km de distancia`;
      } else {
        message += `\nO motorista esta a ${Math.round(driverDistanceKm * 1000)} m de distancia`;
      }
    }

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

  const cleanPhone = toBrazilianWhatsAppNumber(passengerPhone);
  if (!cleanPhone) return;

  try {
    await sendWhatsAppMessage(provider, f, cleanPhone, message);
    await logWhatsAppMessage(companyId, rideId, cleanPhone, "status_update", message, provider, true);

    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_webhook",
      level: "info",
      message: `Notificacao WhatsApp enviada para passageiro (${internalStatus}, ${features.plan_name})`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown error";
    await logWhatsAppMessage(companyId, rideId, cleanPhone, "status_update", message, provider, false, errMsg);
  }
}

async function getPlanNotificationFeatures(
  companyId: string,
): Promise<{ send_driver_info: boolean; send_eta: boolean; distance_update_interval_min: number; plan_name: string }> {
  const { data: company } = await supabase
    .from("companies")
    .select("plan_id")
    .eq("id", companyId)
    .maybeSingle();

  const defaults = { send_driver_info: true, send_eta: false, distance_update_interval_min: 0, plan_name: "Plano" };
  if (!company?.plan_id) return defaults;

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("name")
    .eq("id", company.plan_id)
    .maybeSingle();

  const { data: features } = await supabase
    .from("plan_notification_features")
    .select("send_driver_info, send_eta, distance_update_interval_min")
    .eq("plan_id", company.plan_id)
    .maybeSingle();

  if (!features) return { ...defaults, plan_name: plan?.name ?? "Plano" };
  return {
    send_driver_info: features.send_driver_info,
    send_eta: features.send_eta,
    distance_update_interval_min: features.distance_update_interval_min,
    plan_name: plan?.name ?? "Plano",
  };
}

async function logWhatsAppMessage(
  companyId: string,
  rideId: string | null,
  phone: string,
  messageType: string,
  messageBody: string,
  provider: string,
  success: boolean,
  error: string | null = null,
): Promise<void> {
  try {
    await supabase.from("whatsapp_message_log").insert({
      company_id: companyId,
      ride_id: rideId,
      phone,
      message_type: messageType,
      message_body: messageBody,
      provider,
      success,
      error,
      billing_month: new Date().toISOString().slice(0, 7),
    });
  } catch { /* best-effort */ }
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
