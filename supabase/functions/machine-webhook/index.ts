import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";
// machine-webhook: handles Machine API status + position webhooks (v2).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifyMachineSignature(req: Request): Promise<boolean> {
  // Signature-V2 = HMAC-SHA512 over raw body, keyed by the company's API key.
  // We need the raw body to compute the hash, then we'll re-parse it.
  const rawBody = await req.clone().text();
  const signature = req.headers.get("Signature-V2");
  if (!signature) return false;

  // Try to extract company_id from the body to look up the API key
  let bodyJson: { request_id?: string; company_id?: string; data?: Array<{ company_id?: string; request_id?: string }> } = {};
  try { bodyJson = JSON.parse(rawBody); } catch { return false; }

  // Determine company_id from the payload
  let companyId: string | undefined = bodyJson.company_id;
  if (!companyId && Array.isArray(bodyJson.data) && bodyJson.data.length > 0) {
    companyId = bodyJson.data[0]?.company_id;
  }
  if (!companyId && bodyJson.request_id) {
    // Look up ride by machine_order_id to find company_id
    const { data: ride } = await supabase
      .from("rides")
      .select("company_id")
      .eq("machine_order_id", String(bodyJson.request_id))
      .maybeSingle();
    companyId = ride?.company_id;
  }
  if (!companyId) return false;

  // Fetch the company's API key
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_key")
    .eq("company_id", companyId)
    .maybeSingle();
  const { data: tenantRows } = await supabase
    .from("tenant_secrets")
    .select("secret_name, secret_value")
    .eq("tenant_id", companyId);
  const tenantMap = new Map(
    (tenantRows ?? []).map((r: { secret_name: string; secret_value: string }) => [r.secret_name, r.secret_value])
  );
  const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials?.machine_api_key || "";
  if (!apiKey) return false;

  const hmac = createHmac("sha512", apiKey);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");
  // Constant-time comparison
  const sigBytes = Buffer.from(signature);
  const expBytes = Buffer.from(expected);
  if (sigBytes.length !== expBytes.length) return false;
  return crypto.timingSafeEqual(sigBytes, expBytes);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function saveChatMessage(
  companyId: string,
  phone: string,
  direction: "incoming" | "outgoing",
  body: string,
): Promise<void> {
  if (!phone || !body) return;
  const cleanPhone = phone.replace(/\D/g, "");
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
  if (direction === "incoming") {
    await supabase.rpc("increment_chat_unread", { chat_id: chatId }).catch(() => {});
  }
  await supabase.from("whatsapp_messages").insert({
    chat_id: chatId,
    company_id: companyId,
    direction,
    phone: cleanPhone,
    body,
    message_type: "text",
    sent_at: new Date().toISOString(),
  });
}

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
  N: "canceled", // NOT_SERVED — no driver accepted
  A: "accepted",
  AP: "en_route",
  E: "in_progress",
  S: "in_progress",
  F: "completed",
  C: "canceled",
  L: "in_progress", // WAITING_RELEASE
  R: "completed", // WAITING_PAYMENT — ride finished
  U: "in_progress",
  ER: "in_progress",
  O: "in_progress", // Partida prolongada
  T: "pending", // Redistribuindo — ride went back to finding a driver
};

const STATUS_MESSAGES_PT: Record<string, string> = {
  accepted: "Seu motorista aceitou a corrida! Está a caminho do ponto de partida.",
  en_route: "Seu motorista chegou ao local de embarque! Procure pelo veículo.",
  in_progress: "Sua viagem está em andamento.",
  completed: "Sua viagem foi concluída. Obrigado pela preferência!",
  canceled: "Sua corrida foi cancelada.",
  pending: "Seu motorista cancelou. Estamos procurando um novo motorista para sua corrida. Aguarde.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify webhook signature if Signature-V2 header is present.
  // If the header is absent, process the webhook anyway — some Machine API
  // configurations don't send signatures, and blocking them silently
  // breaks all status updates (driver accept, arrival, completion, cancel).
  const sigHeader = req.headers.get("Signature-V2");
  if (sigHeader) {
    const sigValid = await verifyMachineSignature(req);
    if (!sigValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = await req.json();
    const { request_id, status_code, status_label, data: batchData, event_id } = body;

    // Deduplicate by event_id — Machine API may redeliver webhooks
    if (event_id) {
      const { data: existing } = await supabase
        .from("admin_logs")
        .select("id")
        .eq("source", "machine_webhook")
        .contains("payload", { event_id })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, note: "duplicate event" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
          const newDriverName = newDetails?.nome_condutor ?? newDetails?.driver?.nome ?? null;
          const newDriverPhone = newDetails?.telefone_condutor ?? newDetails?.driver?.telefone ?? null;
          const newVehiclePlate = newDetails?.placa_veiculo ?? newDetails?.driver?.veiculo_placa ?? null;
          if (newDriverName && newDriverName !== existingRide.driver_name) {
            driverChanged = true;
          } else if (newVehiclePlate && newVehiclePlate !== existingRide.vehicle_plate) {
            driverChanged = true;
          } else if (!newDriverName && !newDriverPhone) {
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
      let vehicleColor: string | null = null;

      if (internalStatus === "accepted" || internalStatus === "en_route" || internalStatus === "in_progress") {
        const details = await fetchRideDetails(ride.company_id, machineOrderId);
        if (details) {
          driverName = details.nome_condutor ?? details.driver?.nome ?? null;
          driverPhone = details.telefone_condutor ?? details.driver?.telefone ?? null;
          vehiclePlate = details.placa_veiculo ?? details.driver?.veiculo_placa ?? null;
          vehicleModel = details.veiculo ?? details.driver?.veiculo_modelo ?? null;
          vehicleColor = details.cor_veiculo ?? details.driver?.veiculo_cor ?? null;
        }
        // Fetch driver GPS from the dedicated position endpoint
        const driverPos = await fetchDriverPosition(ride.company_id, machineOrderId);
        if (driverPos) {
          await supabase.from("ride_driver_positions").upsert({
            ride_id: ride.id,
            lat: driverPos.lat,
            lng: driverPos.lng,
            updated_at: new Date().toISOString(),
          }).eq("ride_id", ride.id);
        }
      }

      // When ride goes back to pending (driver cancelled), clear old driver info
      if (internalStatus === "pending" && ride.status !== "pending") {
        driverName = null;
        driverPhone = null;
        vehiclePlate = null;
        vehicleModel = null;
        vehicleColor = null;
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
      if (vehicleColor !== null) updatePayload.vehicle_color = vehicleColor;
      // Explicitly clear driver info only when going back to pending
      if (internalStatus === "pending" && ride.status !== "pending") {
        updatePayload.driver_name = null;
        updatePayload.driver_phone = null;
        updatePayload.vehicle_plate = null;
        updatePayload.vehicle_model = null;
        updatePayload.vehicle_color = null;
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
        vehicleColor,
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

  if (!apiKey || !user || !pass) return null;

  try {
    // GET /corridas/{id} returns a single ride with all fields:
    // nome_condutor, telefone_condutor, veiculo, placa_veiculo, cor_veiculo, status_solicitacao, valor_corrida.
    // The response uses the "response" key (not "data").
    const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${machineOrderId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
      },
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    const ride = json?.response ?? json?.data ?? null;
    return ride;
  } catch {
    return null;
  }
}

async function fetchDriverPosition(companyId: string, machineOrderId: string): Promise<{ lat: number; lng: number } | null> {
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

  if (!apiKey || !user || !pass) return null;

  try {
    const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${machineOrderId}/condutor/posicao`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
      },
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    const data = json?.data;
    if (data?.lat_condutor != null && data?.lng_condutor != null) {
      return { lat: data.lat_condutor, lng: data.lng_condutor };
    }
    return null;
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
  vehicleColor: string | null = null,
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
      if (vehicleModel) message += `\nVeículo: ${vehicleModel}`;
      if (vehicleColor) message += `\nCor: ${vehicleColor}`;
      if (vehiclePlate) message += `\nPlaca: ${vehiclePlate}`;
    }

    if (features.send_eta && etaMinutes != null) {
      message += `\nTempo estimado de chegada: ${etaMinutes} min`;
    }

    if (features.distance_update_interval_min > 0 && driverDistanceKm != null) {
      if (driverDistanceKm >= 1) {
        message += `\nO motorista está a ${driverDistanceKm.toFixed(1)} km de distância`;
      } else {
        message += `\nO motorista está a ${Math.round(driverDistanceKm * 1000)} m de distância`;
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
    const ok = await sendWhatsAppMessage(provider, f, cleanPhone, message);
    if (ok) {
      await saveChatMessage(companyId, cleanPhone, "outgoing", message);
      await logWhatsAppMessage(companyId, rideId, cleanPhone, "status_update", message, provider, true);
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_webhook",
        level: "info",
        message: `Notificacao WhatsApp enviada para passageiro (${internalStatus}, ${features.plan_name})`,
      });
    } else {
      await logWhatsAppMessage(companyId, rideId, cleanPhone, "status_update", message, provider, false, "HTTP error response");
    }
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
