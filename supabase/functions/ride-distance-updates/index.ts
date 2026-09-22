// ride-distance-updates — periodic WhatsApp distance/ETA updates for en_route rides.
// Triggered by a cron or external scheduler. Finds all en_route rides whose plan
// has distance_update_interval_min > 0, checks elapsed time since last update,
// sends a WhatsApp message with current distance/ETA, and logs it.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ASAAS_API_URL = ""; // not used here

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

async function sendWhatsAppMessage(
  supabase: ReturnType<typeof createClient>,
  cleanPhone: string,
  message: string,
): Promise<{ ok: boolean; provider: string }> {
  const { provider, fields: f } = await getWhatsAppConfig(supabase);

  if (provider === "evolution") {
    const url = f["evo_url"] ?? "";
    const token = f["evo_token"] ?? "";
    if (!url || !token) return { ok: false, provider };
    const instance = f["evo_instance"] || "veloov";
    const resp = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
    return { ok: resp.ok, provider };
  }

  if (provider === "zapi") {
    const url = f["zapi_url"] ?? "";
    const instanceId = f["zapi_instance_id"] ?? "";
    const instanceToken = f["zapi_instance_token"] ?? "";
    const clientToken = f["zapi_client_token"] ?? "";
    if (!url || !instanceId || !instanceToken) return { ok: false, provider };
    const resp = await fetch(`${url}/instances/${instanceId}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all en_route rides with passenger phone
    const { data: rides } = await supabase
      .from("rides")
      .select("id, company_id, passenger_phone, origin_lat, origin_lng")
      .eq("status", "en_route")
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

      // Calculate current distance from driver position
      const { data: pos } = await supabase
        .from("ride_driver_positions")
        .select("lat, lng")
        .eq("ride_id", ride.id)
        .maybeSingle();

      if (!pos) { skippedCount++; continue; }

      const distanceKm = haversineKm(pos.lat, pos.lng, ride.origin_lat, ride.origin_lng);
      const etaMin = Math.max(1, Math.round(distanceKm * 2.5));

      const updateMsg = distanceKm >= 1
        ? `Atualizacao: O motorista esta a ${distanceKm.toFixed(1)} km de distancia. Tempo estimado: ${etaMin} min.`
        : `Atualizacao: O motorista esta a ${Math.round(distanceKm * 1000)} m de distancia. Quase no local!`;

      const cleanPhone = ride.passenger_phone.replace(/\D/g, "");
      if (!cleanPhone) { skippedCount++; continue; }

      const { ok, provider } = await sendWhatsAppMessage(supabase, cleanPhone, updateMsg);

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
        await supabase.from("admin_logs").insert({
          company_id: ride.company_id,
          source: "distance_update",
          level: "info",
          message: `Atualizacao de distancia enviada (ride ${ride.id}): ${distanceKm.toFixed(1)} km, ETA ${etaMin} min`,
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
