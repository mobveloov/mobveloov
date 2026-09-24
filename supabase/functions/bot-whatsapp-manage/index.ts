// Bot WhatsApp management edge function — v11: auto-configure webhook on create + reconnect action
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyCaller(req: Request, companyId: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === Deno.env.get("SUPABASE_ANON_KEY")) return false;
  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return false;
  const { data: admin } = await supabase
    .from("company_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();
  return !!admin;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, companyId, connectionId, apiUrl, globalToken, instanceName, provider, locationId, metaPhoneId, metaWabaId } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAuthorized = await verifyCaller(req, companyId);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plan allows bot
    const { data: company } = await supabase
      .from("companies")
      .select("plan_id")
      .eq("id", companyId)
      .maybeSingle();

    if (!company?.plan_id) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("bot_incluso, limite_conexoes_bot, limite_mensagens_bot, name")
      .eq("id", company.plan_id)
      .maybeSingle();

    if (!plan?.bot_incluso) {
      return new Response(JSON.stringify({ error: "Seu plano não inclui o bot de WhatsApp. Faça upgrade para o plano Black ou Diamante." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: rawConnections } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*, company_locations!bot_whatsapp_conexoes_location_id_fkey(name, slug, city, state)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });

      // Live-check Evolution connections and sync their real status
      const connections = rawConnections ?? [];
      for (const conn of connections) {
        if (conn.provider === "evolution" && conn.evolution_api_url && conn.instance_name) {
          try {
            const stateResp = await fetch(
              `${conn.evolution_api_url}/instance/connect/${encodeURIComponent(conn.instance_name)}`,
              { method: "GET", headers: { apikey: conn.evolution_global_token } },
            );
            const stateBody = await stateResp.text();
            let stateData: unknown = null;
            try { stateData = JSON.parse(stateBody); } catch { /* ignore */ }
            const liveState = getEvolutionState(stateData);
            const confirmedStatus = liveState === "OPEN" || liveState === "CONNECTED"
              ? "connected"
              : liveState === "CLOSE" || liveState === "CLOSED" || liveState === "DISCONNECTED"
                ? "disconnected"
                : null;
            if (confirmedStatus && confirmedStatus !== conn.connection_status) {
              await supabase
                .from("bot_whatsapp_conexoes")
                .update({ connection_status: confirmedStatus, updated_at: new Date().toISOString() })
                .eq("id", conn.id);
              conn.connection_status = confirmedStatus;
            }
          } catch { /* network error — keep existing status */ }
        }
      }

      // Check if company is using Veloov shared instance (not their own)
      const { data: waInstance } = await supabase
        .from("whatsapp_instances")
        .select("whatsapp_provider")
        .eq("company_id", companyId)
        .maybeSingle();
      const usingVeloovShared = waInstance?.whatsapp_provider === "veloov";

      // Check if Machine API is configured
      const { data: cred } = await supabase
        .from("company_credentials")
        .select("machine_api_url, machine_api_key, taximetro_username, taximetro_password")
        .eq("company_id", companyId)
        .maybeSingle();
      const machineConfigured = !!(cred?.machine_api_url && (cred?.machine_api_key || cred?.taximetro_username));

      // Count messages sent this month for usage display
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { count: messageCount } = await supabase
        .from("whatsapp_message_log")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("success", true)
        .eq("billing_month", currentMonth);

      return new Response(JSON.stringify({
        success: true,
        connections,
        planLimit: plan.limite_conexoes_bot ?? 0,
        planName: plan.name,
        usingVeloovShared,
        machineConfigured,
        messageLimit: plan.limite_mensagens_bot,
        messageCount: messageCount ?? 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Check connection limit
      const { count } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);

      if ((count ?? 0) >= plan.limite_conexoes_bot) {
        return new Response(JSON.stringify({
          error: `Limite de conexões do plano atingido (${count}/${plan.limite_conexoes_bot}). Faça upgrade para o plano Diamante para conectar mais números.`,
        }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const connProvider = provider || "evolution";

      if (connProvider === "evolution") {
        if (!apiUrl || !globalToken || !instanceName) {
          return new Response(JSON.stringify({ error: "URL, token e nome da instância são obrigatórios" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        if (!globalToken) {
          return new Response(JSON.stringify({ error: "Token é obrigatório" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      let qrCode: string | null = null;
      let connectionStatus = "disconnected";
      let cleanUrl: string | null = null;
      let finalInstanceName: string | null = null;

      if (connProvider === "evolution") {
        cleanUrl = (apiUrl as string).trim().replace(/\/+$/, "");
        finalInstanceName = instanceName as string;

        try {
          // Try to create the instance — if it already exists, fall through to connect
          const createResp = await fetch(`${cleanUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: globalToken },
            body: JSON.stringify({ instanceName: finalInstanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
          });
          const createBody = await createResp.text();
          let createData: unknown = null;
          try { createData = JSON.parse(createBody); } catch { /* handled below */ }

          if (createResp.ok) {
            qrCode = extractQrCode(createData);
          } else {
            // Instance likely already exists (409/400) — try connecting directly instead of failing
            const createErrMsg = evolutionError(createData, createBody, createResp.status);
            const alreadyExists = createResp.status === 409 || /already exist|ja existe|exists|duplicate/i.test(createErrMsg);

            if (!alreadyExists) {
              return new Response(JSON.stringify({ error: createErrMsg }), {
                status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            // Instance already exists on this Evolution server — proceed to connect
          }

          // Connect to the instance (works whether it was just created or already existed)
          const connectResp = await fetch(`${cleanUrl}/instance/connect/${encodeURIComponent(finalInstanceName)}`, {
            method: "GET",
            headers: { apikey: globalToken },
          });
          const connectBody = await connectResp.text();
          let connectData: unknown = null;
          try { connectData = JSON.parse(connectBody); } catch { /* handled below */ }
          if (!connectResp.ok) {
            return new Response(JSON.stringify({ error: evolutionError(connectData, connectBody, connectResp.status) }), {
              status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (!qrCode) qrCode = extractQrCode(connectData);
          const state = getEvolutionState(connectData);
          if (state === "OPEN" || state === "CONNECTED") connectionStatus = "connected";
        } catch { /* ignore — connection will be updated via webhook */ }
      } else {
        // Z-API, Z-Pro, Meta Cloud — token-based, no QR code
        connectionStatus = "connected";
      }

      const insertData: Record<string, unknown> = {
        company_id: companyId,
        instance_name: finalInstanceName || `conn-${Date.now()}`,
        connection_status: connectionStatus,
        qr_code: qrCode,
        provider: connProvider,
      };
      if (locationId) insertData.location_id = locationId;

      if (connProvider === "evolution") {
        insertData.evolution_api_url = cleanUrl;
        insertData.evolution_global_token = globalToken;
      } else if (connProvider === "zapi" || connProvider === "zpro") {
        insertData.provider_api_url = apiUrl || null;
        insertData.provider_token = globalToken;
        if (metaWabaId) insertData.provider_waba_id = metaWabaId;
      } else if (connProvider === "meta_cloud") {
        insertData.provider_token = globalToken;
        if (metaPhoneId) insertData.provider_phone_id = metaPhoneId;
        if (metaWabaId) insertData.provider_waba_id = metaWabaId;
        // Also set meta_* columns for webhook matching
        if (metaPhoneId) insertData.meta_phone_id = metaPhoneId;
        if (metaWabaId) insertData.meta_waba_id = metaWabaId;
      } else if (connProvider === "custom_webhook") {
        insertData.provider_api_url = apiUrl || null;
        insertData.provider_token = globalToken;
      }

      const { data: conn, error: connErr } = await supabase
        .from("bot_whatsapp_conexoes")
        .insert(insertData)
        .select("*")
        .single();

      if (connErr) {
        return new Response(JSON.stringify({ error: "Erro ao salvar conexão: " + connErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-configure webhook on Evolution API so incoming messages and status updates flow
      if (connProvider === "evolution" && cleanUrl && finalInstanceName) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/configure-whatsapp-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiUrl: cleanUrl,
              globalToken,
              instanceName: finalInstanceName,
              companyId,
              connectionId: conn?.id,
              isBot: true,
            }),
          });
        } catch { /* best-effort — webhook config can be retried */ }
      }

      return new Response(JSON.stringify({ success: true, connection: conn }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reconnect") {
      // Reconfigures webhook on an existing Evolution instance (after server restart, etc.)
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (conn.provider !== "evolution" || !conn.evolution_api_url) {
        return new Response(JSON.stringify({ error: "Reconexão automática disponível apenas para Evolution API" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check live status
      let liveStatus = conn.connection_status;
      let qrCode: string | null = null;
      try {
        const stateResp = await fetch(
          `${conn.evolution_api_url}/instance/connect/${encodeURIComponent(conn.instance_name)}`,
          { method: "GET", headers: { apikey: conn.evolution_global_token } },
        );
        const stateBody = await stateResp.text();
        let stateData: unknown = null;
        try { stateData = JSON.parse(stateBody); } catch { /* ignore */ }
        const liveState = getEvolutionState(stateData);
        if (liveState === "OPEN" || liveState === "CONNECTED") {
          liveStatus = "connected";
        } else if (liveState === "CLOSE" || liveState === "CLOSED" || liveState === "DISCONNECTED") {
          liveStatus = "disconnected";
        }
        qrCode = extractQrCode(stateData);
      } catch { /* network error */ }

      // Reconfigure webhook regardless of connection status
      let webhookConfigured = false;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/configure-whatsapp-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiUrl: conn.evolution_api_url,
            globalToken: conn.evolution_global_token,
            instanceName: conn.instance_name,
            companyId,
            connectionId: conn.id,
            isBot: true,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        webhookConfigured = data.success ?? false;
      } catch { /* best-effort */ }

      // Update status in DB
      await supabase
        .from("bot_whatsapp_conexoes")
        .update({
          connection_status: liveStatus,
          qr_code: qrCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      return new Response(JSON.stringify({
        success: true,
        connectionStatus: liveStatus,
        qrCode,
        webhookConfigured,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "refresh_qr") {
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!conn) {
        return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only Evolution supports QR refresh; other providers are token-based
      if (conn.provider !== "evolution") {
        return new Response(JSON.stringify({ error: "QR Code disponível apenas para Evolution API. Demais provedores usam token." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let qrCode: string | null = null;
      try {
        const resp = await fetch(`${conn.evolution_api_url}/instance/connect/${encodeURIComponent(conn.instance_name)}`, {
          method: "GET",
          headers: { apikey: conn.evolution_global_token },
        });
        const body = await resp.text();
        let data: unknown = null;
        try { data = JSON.parse(body); } catch { /* handled below */ }
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: evolutionError(data, body, resp.status) }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        qrCode = extractQrCode(data);
      } catch { /* ignore */ }

      await supabase
        .from("bot_whatsapp_conexoes")
        .update({ qr_code: qrCode, updated_at: new Date().toISOString() })
        .eq("id", connectionId);

      return new Response(JSON.stringify({ success: true, qrCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_locations") {
      if (!connectionId) return err400("connectionId required");
      const { data: locations } = await supabase
        .from("company_locations")
        .select("id, name, slug, city, state, lat, lng, is_active")
        .eq("company_id", companyId)
        .eq("bot_connection_id", connectionId)
        .eq("is_active", true)
        .order("name", { ascending: true });
      return json({ success: true, locations: locations ?? [] });
    }

    if (action === "create_location") {
      if (!connectionId) return err400("connectionId required");
      const { name, city, state, lat, lng } = body;
      if (!name || !city) return err400("Nome e cidade são obrigatórios");

      const slug = String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!slug) return err400("Informe um nome válido para a localização");

      const { data: location, error: locationError } = await supabase
        .from("company_locations")
        .insert({
          company_id: companyId,
          bot_connection_id: connectionId,
          name: String(name).trim(),
          slug,
          city: String(city).trim(),
          state: state ? String(state).trim() : null,
          lat: lat != null ? Number(lat) : null,
          lng: lng != null ? Number(lng) : null,
          is_active: true,
        })
        .select("id, name, slug, city, state, lat, lng, is_active")
        .single();

      if (locationError) {
        return err500(locationError.code === "23505" ? "Já existe uma localização com este nome nesta instância" : "Erro ao cadastrar localização");
      }

      return json({ success: true, location });
    }

    if (action === "update_connection_location") {
      if (!connectionId) return err400("connectionId required");
      const { error: locErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ location_id: locationId ?? null, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (locErr) return err500("Erro ao salvar cidade: " + locErr.message);
      return json({ success: true });
    }

    if (action === "delete_location") {
      if (!connectionId) return err400("connectionId required");
      const { locationId: locToDelete } = body;
      if (!locToDelete) return err400("locationId required");

      // Verify the location belongs to this company AND this connection
      const { data: loc } = await supabase
        .from("company_locations")
        .select("id, name")
        .eq("id", locToDelete)
        .eq("company_id", companyId)
        .eq("bot_connection_id", connectionId)
        .maybeSingle();
      if (!loc) return err400("Localização não encontrada nesta instância");

      // Clear the location_id on this connection if it was selected
      await supabase.from("bot_whatsapp_conexoes")
        .update({ location_id: null, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId).eq("location_id", locToDelete);

      // Delete the location — only affects this instance's private location
      const { error: delErr } = await supabase
        .from("company_locations")
        .delete()
        .eq("id", locToDelete)
        .eq("company_id", companyId)
        .eq("bot_connection_id", connectionId);
      if (delErr) return err500("Erro ao excluir localização: " + delErr.message);
      return json({ success: true });
    }

    if (action === "list_suggestions") {
      if (!connectionId) return err400("connectionId required");
      const { data: suggestions } = await supabase
        .from("bot_address_suggestions")
        .select("*")
        .eq("connection_id", connectionId)
        .order("created_at", { ascending: true });
      return json({ success: true, suggestions });
    }

    if (action === "add_suggestion") {
      if (!connectionId) return err400("connectionId required");
      const { nickname, addressText, lat, lng } = body;
      if (!nickname || !addressText) return err400("nickname e addressText são obrigatórios");
      // Verify connection belongs to company
      const { data: conn } = await supabase.from("bot_whatsapp_conexoes").select("id").eq("id", connectionId).eq("company_id", companyId).maybeSingle();
      if (!conn) return err400("Conexão não encontrada");
      const { data: sug, error: sugErr } = await supabase.from("bot_address_suggestions").insert({
        connection_id: connectionId, nickname, address_text: addressText, lat: lat ?? null, lng: lng ?? null,
      }).select("*").single();
      if (sugErr) return err500("Erro ao salvar sugestão: " + sugErr.message);
      return json({ success: true, suggestion: sug });
    }

    if (action === "update_suggestion") {
      if (!connectionId) return err400("connectionId required");
      const { suggestionId, nickname, addressText, lat, lng } = body;
      if (!suggestionId) return err400("suggestionId required");
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (nickname !== undefined) update.nickname = nickname;
      if (addressText !== undefined) update.address_text = addressText;
      if (lat !== undefined) update.lat = lat;
      if (lng !== undefined) update.lng = lng;
      const { data, error: upErr } = await supabase.from("bot_address_suggestions").update(update).eq("id", suggestionId).eq("connection_id", connectionId).select("*").single();
      if (upErr) return err500("Erro ao atualizar: " + upErr.message);
      return json({ success: true, suggestion: data });
    }

    if (action === "delete_suggestion") {
      const { suggestionId } = body;
      if (!suggestionId) return err400("suggestionId required");
      await supabase.from("bot_address_suggestions").delete().eq("id", suggestionId);
      return json({ success: true });
    }

    if (action === "update_messages") {
      if (!connectionId) return err400("connectionId required");
      const { customMessages } = body;
      const { error: msgErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ bot_custom_messages: customMessages ?? {}, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (msgErr) return err500("Erro ao salvar mensagens: " + msgErr.message);
      return json({ success: true });
    }

    if (action === "update_flow_settings") {
      if (!connectionId) return err400("connectionId required");
      const { flowSettings } = body;
      const defaults = { show_welcome_menu: true, ask_destination: true, ask_payment: true, ask_category: true, confirm_address: true };
      const merged = { ...defaults, ...(flowSettings ?? {}) };
      const { error: flowErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ bot_flow_settings: merged, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (flowErr) return err500("Erro ao salvar configuracoes do fluxo: " + flowErr.message);
      return json({ success: true });
    }

    if (action === "list_categories") {
      // Check integration mode — same logic as totems
      const { data: settings } = await supabase
        .from("company_settings")
        .select("integration_mode")
        .eq("company_id", companyId)
        .maybeSingle();
      const integrationMode = (settings as { integration_mode?: string } | null)?.integration_mode ?? "manual";

      // If Machine API mode, fetch categories from Machine API using the location's city/lat/lng
      if (integrationMode === "machine") {
        let locCity: string | undefined;
        let locState: string | undefined;
        let locLat: number | undefined;
        let locLng: number | undefined;

        if (locationId) {
          const { data: loc } = await supabase
            .from("company_locations")
            .select("city, state, lat, lng")
            .eq("id", locationId)
            .maybeSingle();
          if (loc) {
            locCity = loc.city ?? undefined;
            locState = loc.state ?? undefined;
            locLat = loc.lat ?? undefined;
            locLng = loc.lng ?? undefined;
          }
        }

        // Fallback to company credentials if location has no coords
        if ((locLat == null || locLng == null) && !locCity) {
          const { data: cred } = await supabase
            .from("company_credentials")
            .select("city, state, lat, lng")
            .eq("company_id", companyId)
            .maybeSingle();
          if (cred) {
            if (locLat == null) locLat = cred.lat ?? undefined;
            if (locLng == null) locLng = cred.lng ?? undefined;
            if (!locCity) locCity = cred.city ?? undefined;
            if (!locState) locState = cred.state ?? undefined;
          }
        }

        const auth = await getMachineAuth(companyId);
        if (!auth) {
          return json({ success: true, categories: [], integrationMode: "machine", error: "Credenciais da Machine API nao configuradas. Configure no painel de integracao." });
        }

        const params = new URLSearchParams();
        if (locLat != null && locLng != null) {
          params.set("lat", String(locLat));
          params.set("lng", String(locLng));
        } else if (locCity) {
          params.set("cidade", locCity);
          if (locState) params.set("estado", locState);
        }

        if (!params.toString()) {
          return json({ success: true, categories: [], integrationMode: "machine", error: "Configure a cidade ou coordenadas da localizacao para buscar categorias da Machine." });
        }

        try {
          const catUrl = `${auth.baseUrl}/api/v2/integracao/configuracoes/categorias/?${params.toString()}`;
          const resp = await fetch(catUrl, { method: "GET", headers: auth.headers });
          if (!resp.ok) {
            const errBody = await resp.text().catch(() => "");
            return json({ success: true, categories: [], integrationMode: "machine", error: `Machine API erro ${resp.status}: ${errBody.slice(0, 200)}` });
          }
          const data = await resp.json();
          const rawCats: unknown[] = data?.data ?? (Array.isArray(data) ? data : []);
          const categories = rawCats.map((c: unknown): Record<string, unknown> => {
            const cat = (c ?? {}) as Record<string, unknown>;
            const id = String(cat.id ?? cat.categoria_id ?? cat.codigo ?? cat.uuid ?? "");
            const nome = String(cat.nome ?? cat.categoria_nome ?? cat.nome_categoria ?? cat.label ?? cat.name ?? "");
            const descricao = cat.descricao ?? cat.descricao_categoria ?? cat.description ?? null;
            return { id, label: nome, machine_category_id: id, descricao: descricao != null ? String(descricao) : undefined };
          }).filter((c) => c.id);
          return json({ success: true, categories, integrationMode: "machine" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao buscar categorias";
          return json({ success: true, categories: [], integrationMode: "machine", error: msg });
        }
      }

      // Manual or webhook mode — return internal vehicle_categories (same as before)
      let catQuery = supabase
        .from("vehicle_categories")
        .select("id, label, machine_category_id, is_active, sort_order, location_id")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (locationId) catQuery = catQuery.eq("location_id", locationId);
      const { data: categories } = await catQuery.order("sort_order", { ascending: true });
      return json({ success: true, categories: categories ?? [], integrationMode });
    }

    if (action === "update_categories") {
      if (!connectionId) return err400("connectionId required");
      const { categoryIds } = body;
      if (!Array.isArray(categoryIds)) return err400("categoryIds must be an array");
      const { error: catErr } = await supabase.from("bot_whatsapp_conexoes")
        .update({ bot_category_ids: categoryIds, updated_at: new Date().toISOString() })
        .eq("id", connectionId).eq("company_id", companyId);
      if (catErr) return err500("Erro ao salvar categorias: " + catErr.message);
      return json({ success: true });
    }

    if (action === "get_transcription_config") {
      const { data: config } = await supabase
        .from("bot_transcription_config")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      return json({ success: true, config: config ?? null });
    }

    if (action === "update_transcription_config") {
      const { provider, apiKey, additionalConfig } = body;
      if (!provider || !apiKey) return err400("provider e apiKey são obrigatórios");
      const { error: upErr } = await supabase.from("bot_transcription_config")
        .upsert({
          company_id: companyId,
          provider,
          api_key: apiKey,
          additional_config: additionalConfig ?? {},
          is_valid: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id" });
      if (upErr) return err500("Erro ao salvar: " + upErr.message);
      return json({ success: true });
    }

    if (action === "test_transcription") {
      const { provider, apiKey, additionalConfig } = body;
      if (!provider || !apiKey) return err400("provider e apiKey são obrigatórios");
      const extra = (additionalConfig ?? {}) as Record<string, string>;
      const result = await testTranscriptionProvider(provider, apiKey, extra);
      await supabase.from("bot_transcription_config")
        .upsert({
          company_id: companyId,
          provider,
          api_key: apiKey,
          additional_config: extra,
          is_valid: result.valid,
          last_tested_at: new Date().toISOString(),
          last_test_result: result.message,
          updated_at: new Date().toISOString(),
        }, { onConflict: "company_id" });
      return json({ success: true, valid: result.valid, message: result.message });
    }

    if (action === "delete") {
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conn } = await supabase
        .from("bot_whatsapp_conexoes")
        .select("*")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (conn) {
        // Only Evolution API needs explicit logout; token-based providers just delete locally
        if (conn.provider === "evolution" || (!conn.provider && conn.evolution_api_url)) {
          try {
            await fetch(`${conn.evolution_api_url}/instance/logout/${conn.instance_name}`, {
              method: "DELETE",
              headers: { apikey: conn.evolution_global_token },
            });
          } catch { /* ignore */ }
        }

        await supabase.from("bot_whatsapp_conexoes").delete().eq("id", connectionId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper response builders
async function getMachineAuth(companyId: string): Promise<{ headers: Record<string, string>; baseUrl: string } | null> {
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

  const apiKey = tenantMap.get("MACHINE_API_KEY") || credentials?.machine_api_key || "";
  const user = tenantMap.get("TAXIMETRO_USER") || credentials?.taximetro_username || "";
  const pass = tenantMap.get("TAXIMETRO_PASSWORD") || credentials?.taximetro_password || "";

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

function err400(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err500(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function extractQrCode(payload: unknown): string | null {
  if (typeof payload !== "object" || !payload) return null;
  const value = payload as Record<string, unknown>;
  const candidates: unknown[] = [value.base64, value.qr, value.qrcode, value.qrCode, value.code, value.data, value.response, value.instance];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const qr = c.trim();
      if (qr.startsWith("data:image/")) return qr;
      if (qr.startsWith("http")) return qr;
      if (qr.length >= 40) return `data:image/png;base64,${qr.replace(/\s/g, "")}`;
    }
    if (typeof c === "object" && c) {
      const nested = extractQrCode(c);
      if (nested) return nested;
    }
  }
  return null;
}

function evolutionError(payload: unknown, body: string, status: number): string {
  if (typeof payload === "object" && payload) {
    const value = payload as Record<string, unknown>;
    const nested = value.response && typeof value.response === "object" ? value.response as Record<string, unknown> : null;
    const message = value.message ?? value.error ?? nested?.message ?? nested?.error;
    if (message) return String(message);
  }
  return body.trim().slice(0, 300) || `Evolution API respondeu HTTP ${status}`;
}

function getEvolutionState(payload: unknown): string {
  if (typeof payload !== "object" || !payload) return "";
  const value = payload as Record<string, unknown>;
  const nested = value.instance && typeof value.instance === "object"
    ? value.instance as Record<string, unknown>
    : null;
  return String(nested?.state ?? nested?.status ?? value.state ?? value.status ?? "").toUpperCase();
}

// --- Multi-provider transcription test ---
// Builds a minimal WAV (silence) and sends it to the chosen provider.
// OpenAI and Groq share the same Whisper-compatible API; others have their own format.
function buildSilenceWav(): Blob {
  const sampleRate = 8000;
  const numSamples = 400;
  const dataSize = numSamples * 2;
  const buf = new Uint8Array(44 + dataSize);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  return new Blob([buf], { type: "audio/wav" });
}

async function testTranscriptionProvider(
  provider: string,
  apiKey: string,
  extra: Record<string, string>,
): Promise<{ valid: boolean; message: string }> {
  const audioBlob = buildSilenceWav();
  try {
    if (provider === "openai" || provider === "groq") {
      const apiUrl = provider === "openai"
        ? "https://api.openai.com/v1/audio/transcriptions"
        : "https://api.groq.com/openai/v1/audio/transcriptions";
      const formData = new FormData();
      formData.append("file", audioBlob, "test.wav");
      formData.append("model", provider === "openai" ? "whisper-1" : "whisper-large-v3");
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (resp.ok) return { valid: true, message: "Chave valida!" };
      const errBody = await resp.text().catch(() => "");
      return { valid: false, message: parseErr(errBody, resp.status) };
    }

    if (provider === "deepgram") {
      const resp = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR", {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "audio/wav",
        },
        body: audioBlob,
      });
      if (resp.ok) return { valid: true, message: "Chave valida!" };
      const errBody = await resp.text().catch(() => "");
      return { valid: false, message: parseErr(errBody, resp.status) };
    }

    if (provider === "assemblyai") {
      const resp = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audio_url: "https://example.com/test.wav" }),
      });
      if (resp.ok) return { valid: true, message: "Chave valida!" };
      const errBody = await resp.text().catch(() => "");
      return { valid: false, message: parseErr(errBody, resp.status) };
    }

    if (provider === "google") {
      const projectId = extra.projectId || "";
      if (!projectId) return { valid: false, message: "ID do projeto Google e obrigatorio" };
      const resp = await fetch(
        `https://speech.googleapis.com/v1/projects/${projectId}/locations/global:recognize`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: { languageCode: "pt-BR" },
            audio: { content: "" },
          }),
        },
      );
      if (resp.ok) return { valid: true, message: "Chave valida!" };
      const errBody = await resp.text().catch(() => "");
      return { valid: false, message: parseErr(errBody, resp.status) };
    }

    if (provider === "azure") {
      const region = extra.region || "eastus";
      const resp = await fetch(
        `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
        {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": apiKey },
        },
      );
      if (resp.ok) return { valid: true, message: "Chave valida!" };
      const errBody = await resp.text().catch(() => "");
      return { valid: false, message: parseErr(errBody, resp.status) };
    }

    return { valid: false, message: "Provedor desconhecido" };
  } catch (err) {
    return { valid: false, message: err instanceof Error ? err.message : "Erro de conexao" };
  }
}

function parseErr(body: string, status: number): string {
  let msg = `HTTP ${status}`;
  try {
    const j = JSON.parse(body);
    msg = j?.error?.message ?? j?.message ?? j?.detail ?? msg;
  } catch { if (body) msg = body.slice(0, 300); }
  return msg;
}

// v9: add create_location action
// v10: bot_category_ids now text[]
// v11: add update_flow_settings action
// v12: handle already-existing Evolution instances on create
