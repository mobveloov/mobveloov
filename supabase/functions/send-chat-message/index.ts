// send-chat-message edge function — sends driver chat message to passenger via WhatsApp

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function getCompanyWhatsAppConfig(
  companyId: string,
): Promise<{ provider: string; fields: Record<string, string> }> {
  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select(
      "whatsapp_provider, evolution_api_url, evolution_global_token, instance_name, provider_token, provider_phone_id, provider_waba_id, provider_api_url, connection_status",
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (
    instance && instance.connection_status === "connected" &&
    instance.whatsapp_provider && instance.whatsapp_provider !== "veloov"
  ) {
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

  const { data: globalConfig } = await supabase
    .from("system_settings")
    .select("key_value")
    .eq("key_name", "GLOBAL_WHATSAPP_CONFIG")
    .maybeSingle();
  if (globalConfig?.key_value) {
    try {
      const config = JSON.parse(globalConfig.key_value);
      return {
        provider: config.provider || "evolution",
        fields: config.fields || {},
      };
    } catch { /* ignore */ }
  }
  return { provider: "evolution", fields: {} };
}

async function sendWhatsAppMessageWithProvider(
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

  if (provider === "zapi" || provider === "zpro") {
    const prefix = provider === "zpro" ? "zpro" : "zapi";
    const url = (f[`${prefix}_url`] ?? "").replace(/\/+$/, "");
    const instanceToken = f[`${prefix}_instance_token`] ?? "";
    const clientToken = f[`${prefix}_client_token`] ?? "";
    if (!url || !instanceToken) return false;
    const resp = await fetch(`${url}/token/${instanceToken}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken ? { "Client-Token": clientToken } : {}),
      },
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

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { rideId, message } = await req.json();

    if (!rideId || !message) {
      return new Response(
        JSON.stringify({ error: "rideId e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: ride } = await supabase
      .from("rides")
      .select("id, company_id, passenger_phone, passenger_name, status")
      .eq("id", rideId)
      .maybeSingle();

    if (!ride) {
      return new Response(
        JSON.stringify({ error: "Corrida não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (ride.status === "completed" || ride.status === "canceled") {
      return new Response(
        JSON.stringify({ error: "Esta corrida já foi finalizada. Não é possível enviar mensagens." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: savedMsg } = await supabase
      .from("ride_messages")
      .insert({
        ride_id: ride.id,
        company_id: ride.company_id,
        sender: "motorista",
        content: message,
        status: "enviada",
      })
      .select("id, created_at")
      .single();

    const cleanPhone = toBrazilianWhatsAppNumber(ride.passenger_phone);
    let delivered = false;
    try {
      const { provider, fields } = await getCompanyWhatsAppConfig(ride.company_id);
      delivered = await sendWhatsAppMessageWithProvider(provider, fields, cleanPhone, message);
    } catch {
      // best-effort
    }

    if (delivered && savedMsg) {
      await supabase
        .from("ride_messages")
        .update({ whatsapp_delivered: true, status: "entregue" })
        .eq("id", savedMsg.id);
    }

    // Also save to whatsapp_chats / whatsapp_messages for unified chat history
    const { data: chat } = await supabase
      .from("whatsapp_chats")
      .upsert(
        {
          company_id: ride.company_id,
          phone: cleanPhone,
          last_message_preview: message.slice(0, 200),
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
        .eq("company_id", ride.company_id)
        .eq("phone", cleanPhone)
        .maybeSingle();
      chatId = existing?.id;
    }
    if (chatId) {
      await supabase.from("whatsapp_messages").insert({
        chat_id: chatId,
        company_id: ride.company_id,
        direction: "outgoing",
        phone: cleanPhone,
        body: message,
        message_type: "text",
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: savedMsg?.id,
        delivered,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
