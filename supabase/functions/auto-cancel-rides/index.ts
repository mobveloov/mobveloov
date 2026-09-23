// auto-cancel-rides edge function — cancels rides pending >10 minutes (v2)
// Updated: tenant_secrets fallback for Machine API credentials.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Find all rides still pending/searching for more than 10 minutes
    const { data: staleRides, error: fetchErr } = await supabase
      .from("rides")
      .select("id, company_id, passenger_phone, machine_order_id, integration_mode")
      .in("status", ["pending", "searching"])
      .lt("created_at", tenMinutesAgo);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!staleRides || staleRides.length === 0) {
      return new Response(JSON.stringify({ success: true, canceled: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let canceled = 0;
    for (const ride of staleRides) {
      // Cancel on Machine API if applicable
      if (ride.machine_order_id) {
        const { data: creds } = await supabase
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

        const baseUrl = (creds?.machine_api_url || "https://api.taximachine.com.br").replace(/\/+$/, "");
        const apiKey = tenantMap.get("MACHINE_API_KEY") || creds?.machine_api_key || "";
        const user = tenantMap.get("TAXIMETRO_USER") || creds?.taximetro_username || "";
        const pass = tenantMap.get("TAXIMETRO_PASSWORD") || creds?.taximetro_password || "";

        if (apiKey && user && pass) {
          try {
            const cancelResp = await fetch(`${baseUrl}/api/v2/integracao/corridas/${ride.machine_order_id}/cancelar`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": apiKey,
                "Authorization": `Basic ${btoa(`${user}:${pass}`)}`,
              },
              body: JSON.stringify({ motivo_id: 3 }),
            });
            if (!cancelResp.ok) {
              const errBody = await cancelResp.text().catch(() => "");
              await supabase.from("admin_logs").insert({
                company_id: ride.company_id,
                source: "auto_cancel",
                level: "error",
                message: `Machine API cancel failed (${cancelResp.status}): ${errBody.slice(0, 200)}`,
                ride_id: ride.id,
              });
            }
          } catch (cancelErr) {
            const errMsg = cancelErr instanceof Error ? cancelErr.message : "unknown";
            await supabase.from("admin_logs").insert({
              company_id: ride.company_id,
              source: "auto_cancel",
              level: "error",
              message: `Machine API cancel exception: ${errMsg}`,
              ride_id: ride.id,
            });
          }
        }
      }

      // Update DB status
      await supabase
        .from("rides")
        .update({
          status: "canceled_timeout",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ride.id);

      // Log
      await supabase.from("admin_logs").insert({
        company_id: ride.company_id,
        source: "auto_cancel",
        level: "warning",
        message: `Corrida #${ride.id.slice(0, 8)} cancelada automaticamente (timeout de 10 minutos sem aceitação)`,
        ride_id: ride.id,
      });

      canceled++;
    }

    return new Response(JSON.stringify({ success: true, canceled }), {
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
