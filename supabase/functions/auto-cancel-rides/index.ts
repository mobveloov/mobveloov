// auto-cancel-rides edge function — cancels rides pending >10 minutes (v2)
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

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Find all rides still pending/searching for more than 10 minutes
    const { data: staleRides, error: fetchErr } = await supabase
      .from("rides")
      .select("id, company_id, passenger_name, passenger_phone, machine_order_id, integration_mode")
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

        if (creds?.machine_api_url && creds?.machine_api_key && creds?.taximetro_username && creds?.taximetro_password) {
          try {
            const baseUrl = creds.machine_api_url.replace(/\/+$/, "");
            await fetch(`${baseUrl}/api/v2/integracao/corridas/${ride.machine_order_id}/cancelar`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "api-key": creds.machine_api_key,
                "Authorization": `Basic ${btoa(`${creds.taximetro_username}:${creds.taximetro_password}`)}`,
              },
              body: JSON.stringify({ motivo_id: 3 }),
            });
          } catch {
            // Best-effort cancel; DB update proceeds regardless
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
