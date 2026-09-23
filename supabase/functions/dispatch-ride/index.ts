// dispatch-ride edge function — Veloov Mobilidade dispatch engine with simulation interceptor v2
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DispatchBody {
  companySlug: string;
  integrationMode: string;
  rideId: string;
  action?: string;
  simulation_mode?: boolean;
  passenger_name?: string;
  passenger_phone?: string;
  origin?: { lat: number; lng: number; address: string };
  destination?: { lat: number; lng: number; address: string };
  category?: string;
  price?: number;
  distance?: number;
  driverPhone?: string;
  driverName?: string;
  machineOrderId?: string;
  passenger_phone?: string;
  city?: string;
  state?: string;
  address?: string;
  bairro?: string;
  lat?: number;
  lng?: number;
}

const SECRET_NAMES = {
  MACHINE_API_KEY: "MACHINE_API_KEY",
  TAXIMETRO_USER: "TAXIMETRO_USER",
  TAXIMETRO_PASSWORD: "TAXIMETRO_PASSWORD",
} as const;

interface ResolvedSecrets {
  machineApiKey: string;
  taximetroUser: string;
  taximetroPassword: string;
}

async function resolveSecrets(companyId: string): Promise<ResolvedSecrets> {
  const { data: tenantRows } = await supabase
    .from("tenant_secrets")
    .select("secret_name, secret_value")
    .eq("tenant_id", companyId);

  const tenantMap = new Map(
    (tenantRows ?? []).map((r: { secret_name: string; secret_value: string }) => [r.secret_name, r.secret_value])
  );

  return {
    machineApiKey: tenantMap.get(SECRET_NAMES.MACHINE_API_KEY) ?? "",
    taximetroUser: tenantMap.get(SECRET_NAMES.TAXIMETRO_USER) ?? "",
    taximetroPassword: tenantMap.get(SECRET_NAMES.TAXIMETRO_PASSWORD) ?? "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as DispatchBody;
    const {
      companySlug,
      integrationMode,
      rideId,
      action,
      passenger_name,
      passenger_phone,
      origin,
      destination,
      category,
      price,
      distance,
      driverPhone,
      driverName,
    } = body;

    if (!companySlug || !rideId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up company
    const { data: company } = await supabase
      .from("companies")
      .select("id, slug, status")
      .eq("slug", companySlug)
      .eq("status", "active")
      .single();

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simulation interceptor — short-circuit before any network call
    const simulationMode = (body as Record<string, unknown>).simulation_mode === true ||
      String(companySlug).includes("sandbox_test") ||
      String(body.category ?? "").includes("sandbox_test");

    if (simulationMode) {
      return new Response(JSON.stringify({
        success: true,
        ride_id: "mock_v2_7719",
        status: "SEARCHING_DRIVER",
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract machineOrderId from body for cancel/poll actions
    const machineOrderId = body.machineOrderId;

    // Handle cancel ride action (cancel on Machine API)
    if (action === "cancel_ride") {
      return await cancelRideOnMachine(company.id, rideId, machineOrderId);
    }

    // Handle cancel by phone action (find active ride by phone, cancel on Machine API)
    if (action === "cancel_by_phone" && passenger_phone) {
      return await cancelRideByPhone(company.id, passenger_phone);
    }

    // Handle poll status action (fetch current status from Machine API)
    if (action === "poll_status") {
      return await pollRideStatus(company.id, rideId, machineOrderId);
    }

    // Handle estimates action (fetch multicategoria price estimates from Machine API)
    if (action === "estimates" && origin && destination) {
      return await fetchEstimates(company.id, origin, destination);
    }

    // Handle list categories action (fetch available categories from Machine API)
    if (action === "list_categories") {
      return await listMachineCategories(company.id, {
        city: body.city,
        state: body.state,
        address: body.address,
        bairro: body.bairro,
        lat: body.lat,
        lng: body.lng,
      });
    }

    // Handle manual mode driver notification
    if (action === "notify_driver" && driverPhone) {
      return await handleDriverNotification(
        company.id,
        rideId,
        driverPhone,
        driverName ?? "Motorista",
        passenger_name ?? "",
        passenger_phone ?? "",
        origin?.address ?? "",
        destination?.address ?? "",
        price ?? 0
      );
    }

    // Machine API mode
    if (integrationMode === "machine") {
      return await dispatchToMachine(company.id, rideId, {
        passenger_name: passenger_name ?? "",
        passenger_phone: passenger_phone ?? "",
        origin,
        destination,
        category: category ?? "",
        price: price ?? 0,
        distance: distance ?? 0,
      });
    }

    // Webhook mode
    if (integrationMode === "webhook") {
      return await dispatchToWebhook(company.id, rideId, {
        passenger_name: passenger_name ?? "",
        passenger_phone: passenger_phone ?? "",
        origin,
        destination,
        category: category ?? "",
        price: price ?? 0,
        distance: distance ?? 0,
        rideId,
      });
    }

    // Manual mode — no external dispatch needed
    return new Response(JSON.stringify({ success: true, mode: "manual" }), {
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

async function dispatchToMachine(
  companyId: string,
  rideId: string,
  data: {
    passenger_name: string;
    passenger_phone: string;
    origin?: { lat: number; lng: number; address: string };
    destination?: { lat: number; lng: number; address: string };
    category: string;
    price: number;
    distance: number;
  },
): Promise<Response> {
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
    .eq("company_id", companyId)
    .single();

  // Resolve secrets from tenant_secrets table (tenant-level overrides master/global)
  const secrets = await resolveSecrets(companyId);

  // Priority: tenant_secrets → company_credentials → env fallback
  const machineApiKey = secrets.machineApiKey || credentials?.machine_api_key || "";
  const taximetroUser = secrets.taximetroUser || credentials?.taximetro_username || "";
  const taximetroPassword = secrets.taximetroPassword || credentials?.taximetro_password || "";

  if (!machineApiKey) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: "Machine API key not configured (tenant_secrets, company_credentials, and env all empty)",
      ride_id: rideId,
    });

    return new Response(JSON.stringify({
      success: false,
      error: "API key not configured",
      fallback: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawUrl = credentials?.machine_api_url || "https://api.taximachine.com.br";
  const baseUrl = rawUrl.replace(/\/+$/, "");

  // Parse passenger phone into area code and number
  // Expected formats: (16) 99999-8888 or 16999998888
  const cleanPhone = (data.passenger_phone || "").replace(/\D/g, "");
  const codigoPais = 55;
  const codigoArea = cleanPhone.length >= 10 ? parseInt(cleanPhone.slice(0, 2)) : 16;
  const telefone = cleanPhone.length >= 10 ? cleanPhone.slice(2) : cleanPhone;

  // Build the v2 API payload per docs.machine.global spec
  const v2Payload: Record<string, unknown> = {
    id_externo: rideId,
    dados_cadastro: {
      codigo_pais: codigoPais,
      codigo_area: codigoArea,
      telefone: telefone,
    },
    dados_passageiro: {
      codigo_pais: codigoPais,
      codigo_area: codigoArea,
      telefone: telefone,
      nome: data.passenger_name || "Passageiro",
    },
    forma_pagamento: "D",
    partida: {
      endereco: data.origin?.address || "Endereço não informado",
      bairro: "Centro",
      ...(data.origin?.lat != null ? { lat: data.origin.lat } : {}),
      ...(data.origin?.lng != null ? { lng: data.origin.lng } : {}),
    },
  };

  if (data.destination?.address) {
    v2Payload.desejado = {
      endereco: data.destination.address,
      bairro: "Centro",
      ...(data.destination.lat != null ? { lat: data.destination.lat } : {}),
      ...(data.destination.lng != null ? { lng: data.destination.lng } : {}),
    };
  }

  if (data.category) {
    // If category looks like a Machine API ID (numeric), use categoria_id
    // Otherwise map our internal category names to Machine API category names
    if (/^\d+$/.test(data.category)) {
      v2Payload.categoria_id = parseInt(data.category);
    } else {
      const categoryMap: Record<string, string> = {
        "Econômico": "UP Econômico",
        "Conforto": "UP COMFORT",
        "Executivo": "UP EXECUTIVO",
      };
      v2Payload.categoria_nome = categoryMap[data.category] || data.category;
    }
  }

  // Auth: v2 API requires BOTH api-key (bandeira) AND Authorization: Basic (gestor login)
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "api-key": machineApiKey,
  };

  if (taximetroUser && taximetroPassword) {
    const basicAuth = btoa(`${taximetroUser}:${taximetroPassword}`);
    requestHeaders["Authorization"] = `Basic ${basicAuth}`;
  }

  const apiResponse = await fetch(`${baseUrl}/api/v2/integracao/corridas/`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(v2Payload),
  });

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text();
    let errorDetail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      errorDetail = parsed?.message ?? parsed?.error ?? parsed?.data?.message ?? errorBody;
    } catch { /* not JSON, keep raw */ }

    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: `Machine API error ${apiResponse.status}: ${errorDetail}`,
      ride_id: rideId,
      payload: { status: apiResponse.status, body: errorBody, sentPayload: v2Payload },
    });

    return new Response(JSON.stringify({
      success: false,
      error: `Dispatch failed (${apiResponse.status}): ${errorDetail}`,
      fallback: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dispatchData = await apiResponse.json().catch(() => ({}));

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (dispatchData?.data?.id_mch) {
    updatePayload.machine_order_id = String(dispatchData.data.id_mch);
  } else if (dispatchData?.id) {
    updatePayload.machine_order_id = dispatchData.id;
  } else if (dispatchData?.data?.id) {
    updatePayload.machine_order_id = String(dispatchData.data.id);
  }

  // On successful dispatch (200/201), keep status as pending — the Machine API
  // will notify us via webhook (or the client polls) when a driver accepts.
  if (apiResponse.status === 200 || apiResponse.status === 201) {
    updatePayload.status = "pending";

    const d = dispatchData?.data ?? dispatchData;
    if (d?.driver_name) updatePayload.driver_name = d.driver_name;
    if (d?.driver_phone) updatePayload.driver_phone = d.driver_phone;
    if (d?.vehicle_plate) updatePayload.vehicle_plate = d.vehicle_plate;
    if (d?.vehicle_model) updatePayload.vehicle_model = d.vehicle_model;
  }

  await supabase
    .from("rides")
    .update(updatePayload)
    .eq("id", rideId);

  return new Response(JSON.stringify({ success: true, data: dispatchData }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function dispatchToWebhook(
  companyId: string,
  rideId: string,
  data: {
    passenger_name: string;
    passenger_phone: string;
    origin?: { lat: number; lng: number; address: string };
    destination?: { lat: number; lng: number; address: string };
    category: string;
    price: number;
    distance: number;
    rideId: string;
  }
): Promise<Response> {
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("webhook_url, webhook_headers, webhook_payload_template")
    .eq("company_id", companyId)
    .single();

  if (!credentials?.webhook_url) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "webhook",
      level: "error",
      message: "Webhook URL not configured for this company",
      ride_id: rideId,
    });

    return new Response(JSON.stringify({
      success: false,
      error: "Webhook URL not configured",
      fallback: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build payload from template or use default
  const template = credentials.webhook_payload_template || JSON.stringify({
    passenger: { name: "{{passenger_name}}", phone: "{{passenger_phone}}" },
    origin: "{{origin}}",
    destination: "{{destination}}",
    category: "{{category}}",
    price: "{{price}}",
    distance: "{{distance}}",
    ride_id: "{{ride_id}}",
  });

  const payloadStr = template
    .replace(/\{\{passenger_name\}\}/g, data.passenger_name)
    .replace(/\{\{passenger_phone\}\}/g, data.passenger_phone)
    .replace(/\{\{origin\}\}/g, data.origin?.address ?? "")
    .replace(/\{\{destination\}\}/g, data.destination?.address ?? "")
    .replace(/\{\{category\}\}/g, data.category)
    .replace(/\{\{price\}\}/g, String(data.price))
    .replace(/\{\{distance\}\}/g, String(data.distance))
    .replace(/\{\{ride_id\}\}/g, data.rideId);

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(credentials.webhook_headers as Record<string, string> ?? {}),
  };

  const webhookResponse = await fetch(credentials.webhook_url, {
    method: "POST",
    headers,
    body: payloadStr,
  });

  if (!webhookResponse.ok) {
    const errorBody = await webhookResponse.text();
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "webhook",
      level: "error",
      message: `Webhook error ${webhookResponse.status}: ${errorBody}`,
      ride_id: rideId,
      payload: { status: webhookResponse.status, body: errorBody },
    });

    return new Response(JSON.stringify({
      success: false,
      error: `Webhook failed (${webhookResponse.status})`,
      fallback: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookData = await webhookResponse.json().catch(() => ({}));

  return new Response(JSON.stringify({ success: true, data: webhookData }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleDriverNotification(
  companyId: string,
  rideId: string,
  driverPhone: string,
  driverName: string,
  passengerName: string,
  passengerPhone: string,
  origin: string,
  destination: string,
  price: number
): Promise<Response> {
  // Check if WhatsApp is connected via global provider
  const { provider, fields: f } = await getWhatsAppConfig();
  const isConfigured = provider === "evolution"
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
      source: "whatsapp",
      level: "warning",
      message: `WhatsApp provider "${provider}" not configured — driver ${driverName} not notified for ride ${rideId.slice(0, 8)}`,
      ride_id: rideId,
    });

    return new Response(JSON.stringify({
      success: true,
      mode: "manual",
      notification: "skipped",
      reason: "whatsapp_not_configured",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = `Nova corrida!\n\nPassageiro: ${passengerName}\nTelefone: ${passengerPhone}\nOrigem: ${origin}\nDestino: ${destination}\nValor: R$ ${price.toFixed(2).replace(".", ",")}\n\nAceite a corrida respondendo SIM.`;

  try {
    const ok = await sendWhatsAppMessage({}, driverPhone.replace(/\D/g, ""), message);

    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp",
      level: "info",
      message: `Driver ${driverName} notified via WhatsApp for ride ${rideId.slice(0, 8)}`,
      ride_id: rideId,
    });

    return new Response(JSON.stringify({ success: true, mode: "manual", notification: "sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send WhatsApp";
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "whatsapp",
      level: "error",
      message: `Failed to notify driver: ${msg}`,
      ride_id: rideId,
    });

    return new Response(JSON.stringify({ success: true, mode: "manual", notification: "failed", error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ── Machine API status code → internal status ──
const MACHINE_STATUS_MAP: Record<string, string> = {
  D: "pending", G: "pending", P: "pending", N: "pending",
  A: "accepted", AP: "en_route", E: "in_progress", S: "in_progress",
  F: "completed", C: "canceled", L: "in_progress", R: "in_progress",
  U: "in_progress", ER: "in_progress",
};

async function getMachineAuthHeaders(companyId: string): Promise<{ headers: Record<string, string>; baseUrl: string } | null> {
  const { data: credentials } = await supabase
    .from("company_credentials")
    .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
    .eq("company_id", companyId)
    .single();

  const secrets = await resolveSecrets(companyId);
  const apiKey = secrets.machineApiKey || credentials?.machine_api_key || "";
  const user = secrets.taximetroUser || credentials?.taximetro_username || "";
  const pass = secrets.taximetroPassword || credentials?.taximetro_password || "";

  if (!apiKey || !user || !pass) return null;

  const baseUrl = (credentials?.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");

  return {
    baseUrl,
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
    },
  };
}

async function cancelRideOnMachine(companyId: string, rideId: string, machineOrderId?: string): Promise<Response> {
  // If no machineOrderId provided, look it up from the ride
  let mchId = machineOrderId;
  if (!mchId) {
    const { data: ride } = await supabase
      .from("rides")
      .select("machine_order_id")
      .eq("id", rideId)
      .single();
    mchId = ride?.machine_order_id ?? undefined;
  }

  if (!mchId) {
    // No Machine API order — just update local status
    await supabase.from("rides").update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    }).eq("id", rideId);

    return new Response(JSON.stringify({ success: true, canceled: true, note: "no machine order" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await getMachineAuthHeaders(companyId);
  if (!auth) {
    await supabase.from("rides").update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    }).eq("id", rideId);
    return new Response(JSON.stringify({ success: true, canceled: true, note: "no credentials" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resp = await fetch(`${auth.baseUrl}/api/v2/integracao/corridas/${mchId}/cancelar`, {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({ motivo_id: 3 }),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_api",
        level: "error",
        message: `Machine API cancel error ${resp.status}: ${errorBody}`,
        ride_id: rideId,
      });
      // Still cancel locally
      await supabase.from("rides").update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      }).eq("id", rideId);

      return new Response(JSON.stringify({ success: true, canceled: true, note: "machine cancel failed, canceled locally" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("rides").update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    }).eq("id", rideId);

    return new Response(JSON.stringify({ success: true, canceled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cancel failed";
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: `Cancel exception: ${msg}`,
      ride_id: rideId,
    });
    // Cancel locally anyway
    await supabase.from("rides").update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    }).eq("id", rideId);

    return new Response(JSON.stringify({ success: true, canceled: true, note: "exception, canceled locally" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function cancelRideByPhone(companyId: string, phone: string): Promise<Response> {
  const cleanPhone = phone.replace(/\D/g, "");
  const phoneVariants = [
    cleanPhone,
    cleanPhone.replace(/^55/, ""),
    `55${cleanPhone.replace(/^55/, "")}`,
  ];

  let ride: { id: string; machine_order_id: string | null } | null = null;

  for (const p of phoneVariants) {
    const { data: found } = await supabase
      .from("rides")
      .select("id, machine_order_id")
      .eq("company_id", companyId)
      .eq("passenger_phone", p)
      .in("status", ["pending", "accepted", "en_route"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (found) {
      ride = found;
      break;
    }
  }

  if (!ride) {
    return new Response(JSON.stringify({ success: false, error: "Nenhuma corrida ativa encontrada para este telefone" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return await cancelRideOnMachine(companyId, ride.id, ride.machine_order_id ?? undefined);
}

const STATUS_MESSAGES_PT: Record<string, string> = {
  accepted: "Seu motorista aceitou a corrida! Esta a caminho do ponto de partida.",
  en_route: "Seu motorista chegou ao local de embarque!",
  in_progress: "Sua viagem esta em andamento.",
  completed: "Sua viagem foi concluida. Obrigado pela preferencia!",
  canceled: "Sua corrida foi cancelada.",
};

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

async function sendWhatsAppMessage(
  _wa: Record<string, unknown>,
  cleanPhone: string,
  message: string,
): Promise<boolean> {
  const { provider, fields: f } = await getWhatsAppConfig();

  if (provider === "evolution") {
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

async function sendPassengerWhatsAppNotification(
  companyId: string,
  rideId: string,
  passengerPhone: string,
  internalStatus: string,
  driverName: string | null,
  vehicleModel: string | null,
  vehiclePlate: string | null,
  etaMinutes: number | null = null,
  driverDistanceKm: number | null = null,
): Promise<void> {
  let message = STATUS_MESSAGES_PT[internalStatus];
  if (!message) return;

  const features = await getPlanNotificationFeatures(companyId);

  if (internalStatus === "accepted" && driverName) {
    if (features.send_driver_info) {
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

  const cleanPhone = passengerPhone.replace(/\D/g, "");
  if (!cleanPhone) return;

  const { provider } = await getWhatsAppConfig();
  try {
    const ok = await sendWhatsAppMessage({}, cleanPhone, message);
    await logWhatsAppMessage(companyId, rideId, cleanPhone, "driver_assigned", message, provider, ok);

    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "poll_notification",
      level: ok ? "info" : "error",
      message: `Notificacao WhatsApp ${ok ? "enviada" : "falhou"} (${internalStatus}, ${features.plan_name})`,
    });
  } catch {
    // Best-effort
  }
}

async function pollRideStatus(companyId: string, rideId: string, machineOrderId?: string): Promise<Response> {
  let mchId = machineOrderId;
  let prevStatus: string | null = null;
  let passengerPhone = "";

  {
    const { data: ride } = await supabase
      .from("rides")
      .select("machine_order_id, passenger_phone, status")
      .eq("id", rideId)
      .single();
    mchId = ride?.machine_order_id ?? undefined;
    passengerPhone = ride?.passenger_phone ?? "";
    prevStatus = ride?.status ?? null;
  }

  if (!mchId) {
    return new Response(JSON.stringify({ success: false, error: "No machine order ID" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await getMachineAuthHeaders(companyId);
  if (!auth) {
    return new Response(JSON.stringify({ success: false, error: "No credentials" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch status
  let statusCode: string | null = null;
  try {
    const statusResp = await fetch(`${auth.baseUrl}/api/v2/integracao/corridas/${mchId}/status`, {
      method: "GET",
      headers: auth.headers,
    });

    if (statusResp.ok) {
      const statusJson = await statusResp.json();
      statusCode = statusJson?.data?.status_solicitacao ?? null;
    }
  } catch {
    // continue to details
  }

  // Fetch details (driver info)
  let driverName: string | null = null;
  let driverPhone: string | null = null;
  let vehiclePlate: string | null = null;
  let vehicleModel: string | null = null;

  try {
    const detailsResp = await fetch(`${auth.baseUrl}/api/v2/integracao/corridas/${mchId}/detalhes`, {
      method: "GET",
      headers: auth.headers,
    });

    if (detailsResp.ok) {
      const detailsJson = await detailsResp.json();
      const d = detailsJson?.data;
      if (d?.driver) {
        driverName = d.driver.nome ?? null;
        driverPhone = d.driver.telefone ?? null;
        vehiclePlate = d.driver.veiculo_placa ?? null;
        vehicleModel = d.driver.veiculo_modelo ?? null;
      }
    }
  } catch {
    // best-effort
  }

  const internalStatus = statusCode ? (MACHINE_STATUS_MAP[statusCode] ?? "pending") : null;

  if (internalStatus) {
    const updatePayload: Record<string, unknown> = {
      status: internalStatus,
      updated_at: new Date().toISOString(),
    };
    if (driverName) updatePayload.driver_name = driverName;
    if (driverPhone) updatePayload.driver_phone = driverPhone;
    if (vehiclePlate) updatePayload.vehicle_plate = vehiclePlate;
    if (vehicleModel) updatePayload.vehicle_model = vehicleModel;

    await supabase.from("rides").update(updatePayload).eq("id", rideId);

    // Fetch driver position for distance calculation (Tier C)
    let driverDistanceKm: number | null = null;
    let etaMinutes: number | null = null;
    try {
      const { data: pos } = await supabase
        .from("ride_driver_positions")
        .select("lat, lng")
        .eq("ride_id", rideId)
        .maybeSingle();
      if (pos) {
        const { data: ride } = await supabase
          .from("rides")
          .select("origin_lat, origin_lng")
          .eq("id", rideId)
          .single();
        if (ride) {
          const R = 6371;
          const dLat = ((pos.lat - ride.origin_lat) * Math.PI) / 180;
          const dLng = ((pos.lng - ride.origin_lng) * Math.PI) / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(ride.origin_lat * Math.PI/180) * Math.cos(pos.lat * Math.PI/180) * Math.sin(dLng/2)**2;
          driverDistanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          etaMinutes = Math.max(1, Math.round(driverDistanceKm * 2.5));
        }
      }
    } catch { /* best-effort */ }

    // Status changed — send WhatsApp notification to passenger via Evolution API
    if (prevStatus && prevStatus !== internalStatus && passengerPhone) {
      await sendPassengerWhatsAppNotification(
        companyId,
        rideId,
        passengerPhone,
        internalStatus,
        driverName,
        vehicleModel,
        vehiclePlate,
        etaMinutes,
        driverDistanceKm,
      );
    }

    // Configurable periodic distance updates while en_route
    if (internalStatus === "en_route" && passengerPhone && driverDistanceKm != null) {
      const features = await getPlanNotificationFeatures(companyId);
      if (features.distance_update_interval_min > 0) {
        // Check when the last distance_update was sent for this ride
        const { data: lastMsg } = await supabase
          .from("whatsapp_message_log")
          .select("sent_at")
          .eq("ride_id", rideId)
          .eq("message_type", "distance_update")
          .eq("success", true)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const shouldSend = !lastMsg ||
          (Date.now() - new Date(lastMsg.sent_at).getTime()) >= features.distance_update_interval_min * 60 * 1000;

        if (shouldSend) {
          const updateMsg = driverDistanceKm >= 1
            ? `Atualizacao: O motorista esta a ${driverDistanceKm.toFixed(1)} km de distancia. Tempo estimado: ${etaMinutes ?? "?"} min.`
            : `Atualizacao: O motorista esta a ${Math.round(driverDistanceKm * 1000)} m de distancia. Quase no local!`;
          const { provider } = await getWhatsAppConfig();
          const ok = await sendWhatsAppMessage({}, passengerPhone.replace(/\D/g, ""), updateMsg);
          await logWhatsAppMessage(companyId, rideId, passengerPhone.replace(/\D/g, ""), "distance_update", updateMsg, provider, ok);
        }
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    status: internalStatus,
    status_code: statusCode,
    driver_name: driverName,
    driver_phone: driverPhone,
    vehicle_plate: vehiclePlate,
    vehicle_model: vehicleModel,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchEstimates(
  companyId: string,
  origin: { lat: number; lng: number; address: string },
  destination: { lat: number; lng: number; address: string }
): Promise<Response> {
  const auth = await getMachineAuthHeaders(companyId);
  if (!auth) {
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: "Estimates failed: credentials not configured (api-key, taximetro user/pass)",
    });
    return new Response(JSON.stringify({ success: false, error: "Credenciais não configuradas" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload: Record<string, unknown> = {
    lat_partida: origin.lat,
    lng_partida: origin.lng,
    endereco_partida: origin.address || undefined,
    lat_desejado: destination.lat,
    lng_desejado: destination.lng,
    endereco_desejado: destination.address || undefined,
    multicategorias: true,
  };

  try {
    const resp = await fetch(`${auth.baseUrl}/api/v2/integracao/corridas/estimativas`, {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_api",
        level: "error",
        message: `Estimates API error ${resp.status}: ${errorBody.slice(0, 500)}`,
        payload: { status: resp.status, body: errorBody.slice(0, 500) },
      });
      return new Response(JSON.stringify({ success: false, error: `Estimates failed (${resp.status})` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await resp.json();
    const inner = raw?.data ?? raw;
    return new Response(JSON.stringify({ success: true, ...inner }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Estimates request failed";
    await supabase.from("admin_logs").insert({
      company_id: companyId,
      source: "machine_api",
      level: "error",
      message: `Estimates exception: ${msg}`,
    });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function listMachineCategories(
  companyId: string,
  location: { city?: string; state?: string; address?: string; bairro?: string; lat?: number; lng?: number }
): Promise<Response> {
  const auth = await getMachineAuthHeaders(companyId);
  if (!auth) {
    return new Response(JSON.stringify({ success: false, error: "Credenciais da Machine API não configuradas. Configure a chave API, usuário e senha do Taxímetro no painel de integração." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let lat = location.lat;
  let lng = location.lng;
  let city = location.city;
  let state = location.state;

  if ((lat == null || lng == null) && !location.address) {
    const { data: cred } = await supabase
      .from("company_credentials")
      .select("city, state, lat, lng")
      .eq("company_id", companyId)
      .maybeSingle();

    if (cred) {
      if (lat == null) lat = cred.lat;
      if (lng == null) lng = cred.lng;
      if (!city) city = cred.city;
      if (!state) state = cred.state;
    }
  }

  const params = new URLSearchParams();
  if (lat != null && lng != null) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  } else if (location.address) {
    params.set("endereco", location.address);
    if (location.bairro) params.set("bairro", location.bairro);
    if (city) params.set("cidade", city);
    if (state) params.set("estado", state);
  } else if (city) {
    params.set("cidade", city);
    if (state) params.set("estado", state);
  }

  const queryString = params.toString();
  if (!queryString) {
    return new Response(JSON.stringify({
      success: false,
      error: "Configure a localização da empresa (cidade e coordenadas) no painel de integração para buscar categorias.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 1: List categories (only returns id + nome per v2 docs)
  const catUrl = `${auth.baseUrl}/api/v2/integracao/configuracoes/categorias/?${queryString}`;

  try {
    const resp = await fetch(catUrl, {
      method: "GET",
      headers: auth.headers,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      await supabase.from("admin_logs").insert({
        company_id: companyId,
        source: "machine_api",
        level: "error",
        message: `Categories API error ${resp.status}: ${errorBody.slice(0, 500)}`,
      });
      return new Response(JSON.stringify({ success: false, error: `Categorias falhou (${resp.status}): ${errorBody.slice(0, 200)}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    console.log("[listMachineCategories] raw categories response:", JSON.stringify(data).slice(0, 2000));
    const rawCats: unknown[] = data?.data ?? (Array.isArray(data) ? data : []);

    // Return only id + nome + descricao — the Machine API categorias endpoint
    // does NOT expose tariff details (base fee, per-km, per-min). Real pricing
    // is fetched per-ride via the estimates endpoint at ride time.
    const categories = rawCats.map((c: unknown): Record<string, unknown> => {
      const cat = (c ?? {}) as Record<string, unknown>;
      const id = String(cat.id ?? cat.categoria_id ?? cat.codigo ?? cat.uuid ?? "");
      const nome = String(cat.nome ?? cat.categoria_nome ?? cat.nome_categoria ?? cat.label ?? cat.name ?? "");
      const descricao = cat.descricao ?? cat.descricao_categoria ?? cat.description ?? cat.detalhe ?? cat.detalhes ?? null;
      return {
        id,
        nome,
        descricao: descricao != null ? String(descricao) : undefined,
        raw: cat,
      };
    }).filter((c) => c.id);

    return new Response(JSON.stringify({ success: true, categories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Categories request failed";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}