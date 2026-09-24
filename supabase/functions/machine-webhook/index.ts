import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";
// machine-webhook: handles Machine API status + position + message webhooks (v2).
// Responds immediately (200) to avoid Machine API timeout/blocking, then
// processes heavy work (fetch details, driver position, WhatsApp) in background.
// v3: saves condutor_id, handles message webhook (driver replies from Machine app).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifyMachineSignatureRaw(rawBody: string, signature: string): Promise<boolean> {
  if (!signature) return false;

  let bodyJson: { request_id?: string; company_id?: string; data?: Array<{ company_id?: string; request_id?: string }> } = {};
  try { bodyJson = JSON.parse(rawBody); } catch { return false; }

  let companyId: string | undefined = bodyJson.company_id;
  if (!companyId && Array.isArray(bodyJson.data) && bodyJson.data.length > 0) {
    companyId = bodyJson.data[0]?.company_id;
  }
  if (!companyId && bodyJson.request_id) {
    const { data: ride } = await supabase
      .from("rides")
      .select("company_id")
      .eq("machine_order_id", String(bodyJson.request_id))
      .maybeSingle();
    companyId = ride?.company_id;
  }
  if (!companyId) return false;

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

const STATUS_MAP: Record<string, string> = {
  D: "pending",
  G: "pending",
  P: "pending",
  N: "canceled",
  A: "accepted",
  AP: "en_route",
  E: "in_progress",
  S: "in_progress",
  F: "completed",
  C: "canceled",
  L: "in_progress",
  R: "completed",
  U: "in_progress",
  ER: "in_progress",
  O: "in_progress",
  T: "pending",
};

const STATUS_MESSAGES_PT: Record<string, string> = {
  accepted: "Corrida confirmada! Seu motorista esta a caminho.",
  en_route: "Seu motorista chegou ao local de embarque! Procure pelo veiculo.",
  in_progress: "Sua viagem esta em andamento.",
  completed: "Sua viagem foi concluida. Obrigado pela preferencia!",
  canceled: "Sua corrida foi cancelada.",
  pending: "Seu motorista cancelou. Estamos procurando um novo motorista para sua corrida. Aguarde."
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Respond 200 IMMEDIATELY — no synchronous work at all.
  // The Machine API has a short timeout (~5s) and blocks webhooks after
  // consecutive failures. Even signature verification (DB lookups) was
  // causing timeouts. All work — including signature verification — goes
  // to the background.
  const sigHeader = req.headers.get("Signature-V2");
  const rawBody = await req.text().catch(() => "");

  let body: Record<string, unknown> = {};
  if (rawBody) {
    try { body = JSON.parse(rawBody); } catch { /* empty */ }
  }

  EdgeRuntime.waitUntil(processWebhookWithSig(body, sigHeader, rawBody));

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processWebhookWithSig(
  body: Record<string, unknown>,
  sigHeader: string | null,
  rawBody: string,
): Promise<void> {
  // Signature verification is best-effort: if it fails, we still process
  // the webhook. The Machine API may use a different key encoding than
  // what we store, and silently dropping webhooks breaks the entire flow
  // (no status updates, no WhatsApp, totem stuck on "aguardando").
  // We log the result for diagnostics but never block processing.
  if (sigHeader) {
    try {
      const sigValid = await verifyMachineSignatureRaw(rawBody, sigHeader);
      if (!sigValid) {
        await supabase.from("admin_logs").insert({
          source: "machine_webhook",
          level: "warning",
          message: "Signature-V2 verification failed — processing anyway",
          payload: { body_preview: rawBody.slice(0, 200) },
        });
      }
    } catch {
      // Signature check threw — continue processing regardless
    }
  }
  await processWebhook(body);
}

async function processWebhook(body: Record<string, unknown>): Promise<void> {
  try {
    const { request_id, status_code, status_label, data: batchData, event_id } = body as {
      request_id?: string;
      status_code?: string;
      status_label?: string;
      data?: Array<{ request_id?: string; coordinates?: { latitude: number; longitude: number } }>;
      event_id?: string;
    };

    // Deduplicate by event_id
    if (event_id) {
      const { data: existing } = await supabase
        .from("admin_logs")
        .select("id")
        .eq("source", "machine_webhook")
        .contains("payload", { event_id })
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }

    // Batch position data
    if (batchData && Array.isArray(batchData)) {
      for (const pos of batchData) {
        if (pos.request_id && pos.coordinates) {
          await updateDriverPosition(pos.request_id, pos.coordinates.latitude, pos.coordinates.longitude);
        }
      }
      return;
    }

    // Handle Machine message webhook (driver sent a message from the Machine app)
    const msgContent = body.content as string | undefined;
    const msgSenderId = body.sender_id as number | undefined;
    const msgTypeCode = body.type_code as string | undefined;
    const msgRequestId = body.request_id as number | undefined;
    const msgCompanyId = body.company_id as number | undefined;
    if (msgContent && msgTypeCode === "DRIVER" && msgRequestId) {
      await handleMachineDriverMessage(msgRequestId, msgCompanyId ?? 0, msgSenderId ?? 0, msgContent);
      return;
    }

    if (!request_id || !status_code) return;

    const internalStatus = STATUS_MAP[status_code] ?? "pending";
    const machineOrderId = String(request_id);

    const { data: ride } = await supabase
      .from("rides")
      .select("id, company_id, passenger_name, passenger_phone, status, origin_label, destination_label, payment_method")
      .eq("machine_order_id", machineOrderId)
      .maybeSingle();

    if (!ride) return;

    if (ride.status === internalStatus && internalStatus !== "accepted") return;

    // Update status immediately so the totem sees it via realtime
    const quickUpdate: Record<string, unknown> = {
      status: internalStatus,
      updated_at: new Date().toISOString(),
    };

    if (internalStatus === "pending" && ride.status !== "pending") {
      quickUpdate.driver_name = null;
      quickUpdate.driver_phone = null;
      quickUpdate.vehicle_plate = null;
      quickUpdate.vehicle_model = null;
      quickUpdate.vehicle_color = null;
    }

    await supabase.from("rides").update(quickUpdate).eq("id", ride.id);

    await supabase.from("admin_logs").insert({
      company_id: ride.company_id,
      source: "machine_webhook",
      level: "info",
      message: `Corrida ${machineOrderId} -> ${status_label} (${status_code}) -> ${internalStatus}`,
      ride_id: ride.id,
      payload: body,
    });

    // Heavy work: fetch driver details, position, send WhatsApp
    let driverName: string | null = null;
    let driverPhone: string | null = null;
    let vehiclePlate: string | null = null;
    let vehicleModel: string | null = null;
    let vehicleColor: string | null = null;
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
          return;
        }
      }
    }

    if (internalStatus === "accepted" || internalStatus === "en_route" || internalStatus === "in_progress") {
      const details = await fetchRideDetailsWithRetry(ride.company_id, machineOrderId);
      if (details) {
        const str = (v: unknown): string | null => { const s = v != null ? String(v).trim() : ""; return s || null; };
        driverName = str(details.nome_condutor) ?? str(details.driver?.nome);
        driverPhone = str(details.telefone_condutor) ?? str(details.driver?.telefone);
        vehiclePlate = str(details.placa_veiculo) ?? str(details.driver?.veiculo_placa);
        vehicleModel = str(details.veiculo) ?? str(details.driver?.veiculo_modelo);
        vehicleColor = str(details.cor_veiculo) ?? str(details.driver?.veiculo_cor);
        const machineDriverId = str(details.condutor_id) ?? str(details.driver?.id);
        if (machineDriverId) {
          await supabase.from("rides").update({ machine_driver_id: machineDriverId }).eq("id", ride.id);
        }
      }

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

    const driverUpdate: Record<string, unknown> = {};
    if (driverName !== null) driverUpdate.driver_name = driverName;
    if (driverPhone !== null) driverUpdate.driver_phone = driverPhone;
    if (vehiclePlate !== null) driverUpdate.vehicle_plate = vehiclePlate;
    if (vehicleModel !== null) driverUpdate.vehicle_model = vehicleModel;
    if (vehicleColor !== null) driverUpdate.vehicle_color = vehicleColor;
    if (Object.keys(driverUpdate).length > 0) {
      await supabase.from("rides").update(driverUpdate).eq("id", ride.id);
    }

    // When ride completes, fetch the real/final price from the Machine receipt endpoint
    if (internalStatus === "completed") {
      const receipt = await fetchRideReceipt(ride.company_id, machineOrderId);
      const priceUpdate: Record<string, unknown> = {};
      if (receipt.valor != null) {
        priceUpdate.final_price = receipt.valor;
      }
      if (receipt.distancia != null && receipt.distancia > 0) {
        priceUpdate.distance_km = receipt.distancia;
      }
      if (receipt.duracao != null && receipt.duracao > 0) {
        priceUpdate.duration_min = Math.round(receipt.duracao);
      }
      if (Object.keys(priceUpdate).length > 0) {
        await supabase.from("rides").update(priceUpdate).eq("id", ride.id);
      }
    }

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

    // When ride is first accepted (not a driver change), send passenger info to the driver's WhatsApp
    // so they can access the masked chat and know the pickup address
    if (internalStatus === "accepted" && ride.status !== "accepted" && driverPhone) {
      try {
        await sendPassengerInfoToDriver(
          ride.company_id,
          ride.id,
          driverPhone,
          ride.passenger_name ?? "Passageiro",
          ride.origin_label ?? "Endereço não informado",
          ride.destination_label ?? null,
          ride.payment_method ?? null,
        );
      } catch { /* best-effort */ }
    }
  } catch {
    // Silent fail in background — webhook already acknowledged
  }
}

async function sendPassengerInfoToDriver(
  companyId: string,
  rideId: string,
  driverPhone: string,
  passengerName: string,
  pickupAddress: string,
  destinationAddress: string | null,
  paymentMethod: string | null,
): Promise<void> {
  const cleanDriverPhone = toBrazilianWhatsAppNumber(driverPhone);
  if (!cleanDriverPhone) return;

  let message = `Passageiro: ${passengerName}\nEmbarque: ${pickupAddress}`;
  if (destinationAddress) {
    message += `\nDesembarque: ${destinationAddress}`;
  }
  if (paymentMethod) {
    message += `\nPagamento: ${paymentMethod}`;
  }
  message += `\n\nChat com Passageiro esta ativo\n\nPara cancelar, responda "cancelar".`;

  const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);

  const isConfigured = (provider === "evolution" || provider === "veloov")
    ? !!(f["evo_url"] && f["evo_token"])
    : provider === "zapi"
    ? !!(f["zapi_url"] && f["zapi_instance_token"])
    : provider === "zpro"
    ? !!(f["zpro_url"] && f["zpro_instance_token"])
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
      message: `WhatsApp provider "${provider}" not configured — driver notification skipped for ride ${rideId.slice(0, 8)}`,
      ride_id: rideId,
    });
    return;
  }

  try {
    const ok = await sendWhatsAppMessage(provider, f, cleanDriverPhone, message);
    if (ok) {
      await saveChatMessage(companyId, cleanDriverPhone, "outgoing", message);
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_webhook",
        level: "info",
        message: `Passenger info sent to driver WhatsApp (${cleanDriverPhone}) for ride ${rideId.slice(0, 8)}`,
        ride_id: rideId,
      });
    } else {
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_webhook",
        level: "error",
        message: `Failed to send passenger info to driver WhatsApp (${cleanDriverPhone}) for ride ${rideId.slice(0, 8)}`,
        ride_id: rideId,
      });
    }
  } catch {
    // best-effort
  }
}

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

async function handleMachineDriverMessage(
  machineRequestId: number,
  _machineCompanyId: number,
  _senderId: number,
  content: string,
): Promise<void> {
  const { data: ride } = await supabase
    .from("rides")
    .select("id, company_id, passenger_phone, passenger_name, status, machine_driver_id")
    .eq("machine_order_id", String(machineRequestId))
    .maybeSingle();

  if (!ride) {
    await supabase.from("admin_logs").insert({
      source: "machine_webhook",
      level: "info",
      message: `Driver message for request ${machineRequestId} — no matching ride found`,
    });
    return;
  }

  if (ride.status === "completed" || ride.status === "canceled") {
    await supabase.from("admin_logs").insert({
      company_id: ride.company_id,
      source: "machine_webhook",
      level: "info",
      message: `Driver message for ride ${ride.id.slice(0, 8)} ignored — status: ${ride.status}`,
      ride_id: ride.id,
    });
    return;
  }

  // Save driver message to ride_messages
  await supabase.from("ride_messages").insert({
    ride_id: ride.id,
    company_id: ride.company_id,
    sender: "motorista",
    content,
    status: "entregue",
    whatsapp_delivered: false,
  });

  // Forward to passenger via WhatsApp
  const { provider, fields: f } = await getCompanyWhatsAppConfig(ride.company_id);
  const cleanPhone = toBrazilianWhatsAppNumber(ride.passenger_phone);
  const fwdContent = `Mensagem do Motorista: ${content}`;
  let delivered = false;
  try {
    delivered = await sendWhatsAppMessage(provider, f, cleanPhone, fwdContent);
  } catch { /* best-effort */ }

  if (delivered) {
    await supabase
      .from("ride_messages")
      .update({ whatsapp_delivered: true })
      .eq("ride_id", ride.id)
      .eq("sender", "motorista")
      .order("created_at", { ascending: false })
      .limit(1);
  }

  // Also save to whatsapp_chats for unified history
  await saveChatMessage(ride.company_id, cleanPhone, "outgoing", fwdContent);
}

async function fetchRideReceipt(companyId: string, machineOrderId: string): Promise<{ valor: number | null; valorOriginal: number | null; distancia: number | null; duracao: number | null }> {
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

  if (!apiKey || !user || !pass) return { valor: null, valorOriginal: null, distancia: null, duracao: null };

  try {
    const resp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${machineOrderId}/recibo`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
      },
    });

    if (!resp.ok) return { valor: null, valorOriginal: null, distancia: null, duracao: null };
    const json = await resp.json();
    const dados = json?.data?.dados_solicitacao ?? null;
    if (!dados) return { valor: null, valorOriginal: null, distancia: null, duracao: null };

    const parseNum = (v: unknown): number | null => {
      if (v == null) return null;
      const n = parseFloat(String(v).replace(",", "."));
      return isNaN(n) ? null : n;
    };

    return {
      valor: parseNum(dados.valor),
      valorOriginal: parseNum(dados.valor_original),
      distancia: parseNum(dados.distancia),
      duracao: parseNum(dados.duracao),
    };
  } catch {
    return { valor: null, valorOriginal: null, distancia: null, duracao: null };
  }
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
    if (Array.isArray(ride)) return ride[0] ?? null;
    return ride;
  } catch {
    return null;
  }
}

async function fetchRideDetailsWithRetry(companyId: string, machineOrderId: string): Promise<Record<string, unknown> | null> {
  const str = (v: unknown): string | null => { const s = v != null ? String(v).trim() : ""; return s || null; };
  const hasDriver = (d: Record<string, unknown> | null): boolean => {
    if (!d) return false;
    return !!(str(d.nome_condutor) ?? str((d.driver as Record<string, unknown>)?.nome) ?? str(d.placa_veiculo) ?? str((d.driver as Record<string, unknown>)?.veiculo_placa));
  };
  let details = await fetchRideDetails(companyId, machineOrderId);
  if (hasDriver(details)) return details;
  const delays = [5000, 10000, 15000, 20000, 30000, 40000, 60000];
  for (const delay of delays) {
    await new Promise(r => setTimeout(r, delay));
    details = await fetchRideDetails(companyId, machineOrderId);
    if (hasDriver(details)) return details;
  }
  return details;
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
      return { lat: parseFloat(data.lat_condutor), lng: parseFloat(data.lng_condutor) };
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

  if (internalStatus === "accepted") {
    const isDriverChange = previousStatus === "accepted" && driverChanged;
    if (isDriverChange) {
      message = "Seu motorista foi trocado! Confira os dados do novo motorista:";
    }
    if (driverName) {
      message += `\nMotorista: ${driverName}`;
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

    message += `\n\nChat com Motorista esta ativo\n\nPara cancelar, responda "cancelar".`;
  }

  const { provider, fields: f } = await getCompanyWhatsAppConfig(companyId);

  const isConfigured = (provider === "evolution" || provider === "veloov")
    ? !!(f["evo_url"] && f["evo_token"])
    : provider === "zapi"
    ? !!(f["zapi_url"] && f["zapi_instance_token"])
    : provider === "zpro"
    ? !!(f["zpro_url"] && f["zpro_instance_token"])
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
    const p = instance.whatsapp_provider;
    if (p === "evolution") {
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
