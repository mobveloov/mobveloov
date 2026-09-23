// ride-distance-updates — periodic WhatsApp distance/ETA updates for accepted/en_route rides.
// Triggered by pg_cron every minute. Finds all accepted+en_route rides whose plan
// has distance_update_interval_min > 0, fetches driver position (from local table
// or Machine API), sends a WhatsApp message with current distance/ETA, and logs it.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function toBrazilianWhatsAppNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits;
  return `55${digits}`;
}

async function getWhatsAppConfig(supabase: ReturnType<typeof createClient>): Promise<{ provider: string; fields: Record<string, string> }> {
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

async function getCompanyWhatsAppConfig(supabase: ReturnType<typeof createClient>, companyId: string): Promise<{ provider: string; fields: Record<string, string> }> {
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

  return await getWhatsAppConfig(supabase);
}

async function sendWhatsAppMessage(
  supabase: ReturnType<typeof createClient>,
  cleanPhone: string,
  message: string,
  companyId: string,
): Promise<{ ok: boolean; provider: string }> {
  const { provider, fields: f } = await getCompanyWhatsAppConfig(supabase, companyId);

  if (provider === "evolution" || provider === "veloov") {
    const url = f["evo_url"] ?? "";
    const token = f["evo_token"] ?? "";
    if (!url || !token) return { ok: false, provider };
    const instance = f["evo_instance"] || "veloov";
    const resp = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ number: cleanPhone, text: message, delay: 1200, presence: "available" }),
    });
    return { ok: resp.ok, provider };
  }

  if (provider === "zapi") {
    const url = (f["zapi_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceToken) return { ok: false, provider };
    const resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return { ok: resp.ok, provider };
  }

  if (provider === "zpro") {
    const url = (f["zpro_url"] ?? "").replace(/\/+$/, "");
    const instanceToken = f["zpro_instance_token"] ?? "";
    const clientToken = f["zpro_client_token"] ?? "";
    if (!url || !instanceToken) return { ok: false, provider };
    const resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
      body: JSON.stringify({ phone: cleanPhone, message }),
    });
    return { ok: resp.ok, provider };
  }

  if (provider === "meta_cloud") {
    const token = f["meta_token"] ?? "";
    const phoneId = f["meta_phone_id"] ?? "";
    if (!token || !phoneId) return { ok: false, provider };
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
    return { ok: resp.ok, provider };
  }

  if (provider === "custom_webhook") {
    const url = f["custom_url"] ?? "";
    const token = f["custom_token"] ?? "";
    if (!url) return { ok: false, provider };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      body: JSON.stringify({ phone: cleanPhone, message, text: message, number: cleanPhone }),
    });
    return { ok: resp.ok, provider };
  }

  return { ok: false, provider };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function saveChatMessage(
  supabase: ReturnType<typeof createClient>,
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
        unread_count: 0,
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

async function fetchDriverPositionFromMachine(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  machineOrderId: string,
  rideId: string,
): Promise<{ lat: number; lng: number } | null> {
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
    const d = json?.data;

    const driverLat = d?.lat_condutor ? parseFloat(d.lat_condutor) : (d?.lat ?? d?.latitude ?? null);
    const driverLng = d?.lng_condutor ? parseFloat(d.lng_condutor) : (d?.lng ?? d?.longitude ?? null);

    if (driverLat != null && driverLng != null) {
      await supabase.from("ride_driver_positions").upsert({
        ride_id: rideId,
        lat: driverLat,
        lng: driverLng,
        updated_at: new Date().toISOString(),
      }).eq("ride_id", rideId);
      return { lat: driverLat, lng: driverLng };
    }
  } catch { /* best-effort */ }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify cron auth token
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all accepted + en_route rides with passenger phone
    const { data: rides } = await supabase
      .from("rides")
      .select("id, company_id, passenger_phone, origin_lat, origin_lng, machine_order_id, status")
      .in("status", ["accepted", "en_route"])
      .not("passenger_phone", "is", null);

    if (!rides || rides.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const ride of rides) {
      // Get company's plan notification features
      const { data: company } = await supabase
        .from("companies")
        .select("plan_id")
        .eq("id", ride.company_id)
        .maybeSingle();

      if (!company?.plan_id) { skippedCount++; continue; }

      const { data: features } = await supabase
        .from("plan_notification_features")
        .select("distance_update_interval_min")
        .eq("plan_id", company.plan_id)
        .maybeSingle();

      if (!features || features.distance_update_interval_min <= 0) { skippedCount++; continue; }

      // Check last distance_update message for this ride
      const { data: lastMsg } = await supabase
        .from("whatsapp_message_log")
        .select("sent_at")
        .eq("ride_id", ride.id)
        .eq("message_type", "distance_update")
        .eq("success", true)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const intervalMs = features.distance_update_interval_min * 60 * 1000;
      const shouldSend = !lastMsg ||
        (Date.now() - new Date(lastMsg.sent_at).getTime()) >= intervalMs;

      if (!shouldSend) { skippedCount++; continue; }

      // Try to get driver position from local table first
      let pos: { lat: number; lng: number } | null = null;
      const { data: localPos } = await supabase
        .from("ride_driver_positions")
        .select("lat, lng, updated_at")
        .eq("ride_id", ride.id)
        .maybeSingle();

      if (localPos) {
        // If position is stale (>2 min old), try refreshing from Machine API
        const posAge = Date.now() - new Date(localPos.updated_at).getTime();
        if (posAge > 2 * 60 * 1000 && ride.machine_order_id) {
          pos = await fetchDriverPositionFromMachine(supabase, ride.company_id, ride.machine_order_id, ride.id);
          if (!pos) pos = { lat: localPos.lat, lng: localPos.lng };
        } else {
          pos = { lat: localPos.lat, lng: localPos.lng };
        }
      } else if (ride.machine_order_id) {
        // No local position — fetch from Machine API
        pos = await fetchDriverPositionFromMachine(supabase, ride.company_id, ride.machine_order_id, ride.id);
      }

      if (!pos) { skippedCount++; continue; }

      const distanceKm = haversineKm(pos.lat, pos.lng, ride.origin_lat, ride.origin_lng);
      const etaMin = Math.max(1, Math.round(distanceKm * 2.5));

      const updateMsg = distanceKm >= 1
        ? `Atualização: O motorista está a ${distanceKm.toFixed(1)} km de distância. Tempo estimado: ${etaMin} min.`
        : `Atualização: O motorista está a ${Math.round(distanceKm * 1000)} m de distância. Quase no local!`;

      const cleanPhone = toBrazilianWhatsAppNumber(ride.passenger_phone);
      if (!cleanPhone) { skippedCount++; continue; }

      const { ok, provider } = await sendWhatsAppMessage(supabase, cleanPhone, updateMsg, ride.company_id);

      // Log the message
      try {
        await supabase.from("whatsapp_message_log").insert({
          company_id: ride.company_id,
          ride_id: ride.id,
          phone: cleanPhone,
          message_type: "distance_update",
          message_body: updateMsg,
          provider,
          success: ok,
          billing_month: new Date().toISOString().slice(0, 7),
        });
      } catch { /* best-effort */ }

      if (ok) {
        sentCount++;
        await saveChatMessage(supabase, ride.company_id, cleanPhone, "outgoing", updateMsg);
        await supabase.from("admin_logs").insert({
          company_id: ride.company_id,
          source: "distance_update",
          level: "info",
          message: `Atualização de distância enviada (ride ${ride.id}): ${distanceKm.toFixed(1)} km, ETA ${etaMin} min`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: rides.length, sent: sentCount, skipped: skippedCount }), {
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
