// create-checkout edge function — generates a PIX payment for a subscription plan upgrade (v2: no plan_id change until payment confirmed)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const cycleNames: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

const cycleDays: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

function sanitizePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let digits = String(raw).replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.length === 10 || digits.length === 11 ? digits : undefined;
}

interface CheckoutBody {
  company_id: string;
  plan_id: string;
  billing_cycle: "monthly" | "quarterly" | "semiannual" | "annual";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as CheckoutBody;
    const { company_id, plan_id, billing_cycle } = body;

    if (!company_id || !plan_id || !billing_cycle) {
      return new Response(
        JSON.stringify({ error: "company_id, plan_id e billing_cycle sao obrigatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Chave ASAAS_API_KEY nao configurada nos Secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isSandbox = apiKey.includes("hmlg");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "access_token": apiKey,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch company
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id, name, slug, cnpj, responsible_email, responsible_phone, asaas_customer_id")
      .eq("id", company_id)
      .maybeSingle();

    if (companyErr || !company) {
      return new Response(
        JSON.stringify({ error: "Empresa nao encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch plan
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, name, base_monthly_price, quarterly_price, semiannual_price, annual_price, totem_limit")
      .eq("id", plan_id)
      .maybeSingle();

    if (planErr || !plan) {
      return new Response(
        JSON.stringify({ error: "Plano nao encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine price
    const priceMap: Record<string, number> = {
      monthly: parseFloat(plan.base_monthly_price) || 0,
      quarterly: parseFloat(plan.quarterly_price) || 0,
      semiannual: parseFloat(plan.semiannual_price) || 0,
      annual: parseFloat(plan.annual_price) || 0,
    };
    const finalPrice = priceMap[billing_cycle] ?? priceMap.monthly;

    if (finalPrice <= 0) {
      return new Response(
        JSON.stringify({ error: "Preco do plano invalido ou zero." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanDoc = company.cnpj ? String(company.cnpj).replace(/\D/g, "") : "";
    const finalName = company.name || "Empresa Veloov Mob";
    const finalEmail = company.responsible_email || undefined;
    const finalPhone = sanitizePhone(company.responsible_phone);

    const customerPayload: Record<string, unknown> = {
      name: finalName,
      cpfCnpj: cleanDoc || undefined,
      email: finalEmail,
      phone: finalPhone,
      mobilePhone: finalPhone,
      externalReference: company.slug,
    };

    // 1. Search or create customer
    let customerId = company.asaas_customer_id ?? "";

    if (cleanDoc && !customerId) {
      const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cleanDoc}`, { headers });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) {
          customerId = searchData.data[0].id;
          await fetch(`${baseUrl}/customers/${customerId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(customerPayload),
          });
        }
      }
    }

    if (!customerId) {
      const customerRes = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify(customerPayload),
      });

      const customerData = await customerRes.json();
      if (!customerRes.ok) {
        const errorDetail = customerData.errors?.[0]?.description || JSON.stringify(customerData);
        return new Response(
          JSON.stringify({ error: `Erro ao cadastrar cliente no Asaas: ${errorDetail}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      customerId = customerData.id;
    }

    // Save customer ID
    await supabase
      .from("companies")
      .update({ asaas_customer_id: customerId })
      .eq("id", company_id);

    // 2. Create PIX payment
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const formattedCycle = cycleNames[billing_cycle] || billing_cycle;
    const chargeDescription = `Assinatura Veloov Mob - ${plan.name} (${formattedCycle})`;

    const paymentRes = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: finalPrice,
        dueDate: dueDateStr,
        description: chargeDescription,
        externalReference: company_id,
        postalService: false,
      }),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      const errorDetail = paymentData.errors?.[0]?.description || JSON.stringify(paymentData);
      return new Response(
        JSON.stringify({ error: `Erro ao criar cobranca no Asaas: ${errorDetail}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paymentId = paymentData.id;

    // 3. Get PIX QR code
    const pixRes = await fetch(`${baseUrl}/payments/${paymentId}/pixQrCode`, {
      method: "GET",
      headers,
    });

    let rawBase64 = "";
    let cleanBase64 = "";
    let fullBase64 = "";
    let pixPayload = "";

    if (pixRes.ok) {
      const pixData = await pixRes.json();
      rawBase64 = pixData.encodedImage || "";
      cleanBase64 = rawBase64.replace(/^data:image\/[a-z]+;base64,/, "").trim();
      fullBase64 = cleanBase64 ? `data:image/png;base64,${cleanBase64}` : "";
      pixPayload = pixData.payload || pixData.copyAndPaste || "";
    } else {
      console.error("[Pix Asaas] Falha ao obter QR code:", await pixRes.text());
    }

    // 4. Save invoice record
    await supabase.from("subscription_invoices").insert({
      company_id: company_id,
      plan_id: plan_id,
      cycle: billing_cycle,
      amount: finalPrice,
      status: "pending",
      asaas_payment_id: paymentId,
      due_date: new Date().toISOString(),
    });

    // Update company with payment info — but do NOT change plan_id yet.
    // The plan only changes when the asaas-webhook confirms payment (PAYMENT_RECEIVED/CONFIRMED).
    await supabase
      .from("companies")
      .update({
        asaas_payment_id: paymentId,
        status: "pending_pagamento",
      })
      .eq("id", company_id);

    // Log
    await supabase.from("admin_logs").insert({
      company_id: company_id,
      source: "checkout",
      level: "info",
      message: `Checkout PIX criado: ${plan.name} (${billing_cycle}) - R$ ${finalPrice.toFixed(2)}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentId,
        pixQrCodeBase64: fullBase64,
        qrCodeImage: fullBase64,
        qrCode: fullBase64,
        image: fullBase64,
        encodedImage: cleanBase64,
        pixCopiaECola: pixPayload,
        payload: pixPayload,
        copiaECola: pixPayload,
        copyAndPaste: pixPayload,
        qrCodeText: pixPayload,
        cycleDays: cycleDays[billing_cycle] || 30,
        amount: finalPrice,
        planName: plan.name,
        cycle: billing_cycle,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno do servidor.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
