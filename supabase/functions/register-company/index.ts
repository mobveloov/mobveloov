// register-company edge function — B2B onboarding + Asaas billing integration
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_API_URL = "https://asaas.com";

interface RegisterBody {
  company_name: string;
  cnpj: string;
  responsible_name: string;
  responsible_phone: string;
  responsible_email: string;
  slug: string;
  totem_tier: string;
  totem_limit: number;
  message_tier: string;
  billing_cycle: string;
  billing_months: number;
  billing_discount: number;
  final_price: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as RegisterBody;
    const {
      company_name,
      cnpj,
      responsible_name,
      responsible_phone,
      responsible_email,
      slug,
      totem_tier,
      totem_limit,
      message_tier,
      billing_cycle,
      billing_months,
      billing_discount,
      final_price,
    } = body;

    if (!company_name || !cnpj || !responsible_name || !responsible_email || !slug || !totem_tier || !billing_cycle) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios não preenchidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Este subdomínio já está em uso. Escolha outro." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the matching subscription plan by tier name and billing period
    const tierNameMap: Record<string, string> = {
      bronze: "Plano Bronze",
      prata: "Plano Prata",
      ouro: "Plano Ouro",
      black: "Plano Black",
    };
    const planName = tierNameMap[totem_tier] ?? `Plano ${totem_tier}`;

    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("id, name, price, billing_period, totem_limit, base_monthly_price")
      .ilike("name", planName)
      .maybeSingle();

    // Server-side price recomputation (trust but verify)
    const TOTEM_BASE_PRICES: Record<string, number> = {
      bronze: 99,
      prata: 267,
      ouro: 435,
      black: 690,
    };
    const basePrice = TOTEM_BASE_PRICES[totem_tier] ?? 99;
    const grossPrice = basePrice * billing_months;
    const periodDiscountAmount = grossPrice * billing_discount;
    const computedFinalPrice = grossPrice - periodDiscountAmount;

    // Use the client-sent final_price if it matches within 1 cent, otherwise use server-computed
    const safeFinalPrice = Math.abs(computedFinalPrice - final_price) < 0.02 ? final_price : computedFinalPrice;

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado para o tier selecionado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine billing cycle for Asaas
    const cycleMap: Record<string, string> = {
      monthly: "MONTHLY",
      quarterly: "QUARTERLY",
      semiannual: "SEMIANNUALLY",
      annual: "YEARLY",
    };
    const billingType = cycleMap[plan.billing_period] ?? "MONTHLY";

    let asaasCustomerId: string | null = null;
    let asaasPaymentId: string | null = null;
    let checkoutUrl: string | null = null;
    let asaasError: string | null = null;

    // Create customer + payment on Asaas if API key is configured
    if (ASAAS_API_KEY) {
      try {
        // Step 1: Create customer
        const customerRes = await fetch(`${ASAAS_API_URL}/v3/customers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY,
          },
          body: JSON.stringify({
            name: company_name,
            email: responsible_email,
            phone: responsible_phone,
            cpfCnpj: cnpj.replace(/\D/g, ""),
            notificationDisabled: false,
            externalReference: slug,
          }),
        });

        if (!customerRes.ok) {
          const errBody = await customerRes.text();
          asaasError = `Asaas customer creation failed: ${errBody}`;
        } else {
          const customerData = await customerRes.json();
          asaasCustomerId = customerData.id;

          // Step 2: Create subscription/payment link
          const paymentRes = await fetch(`${ASAAS_API_URL}/v3/payments`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "access_token": ASAAS_API_KEY,
            },
            body: JSON.stringify({
              customer: asaasCustomerId,
              billingType: "UNDEFINED",
              value: safeFinalPrice,
              cycle: billingType,
              description: `Assinatura Veloov Mobilidade — ${planName} (${totem_limit} totens, ${billing_cycle})`,
              externalReference: slug,
              callbackUrl: `${supabaseUrl}/functions/v1/asaas-webhook`,
            }),
          });

          if (paymentRes.ok) {
            const paymentData = await paymentRes.json();
            asaasPaymentId = paymentData.id;
            checkoutUrl = paymentData.invoiceUrl ?? `${ASAAS_API_URL}/payment/${paymentData.id}`;
          } else {
            const errBody = await paymentRes.text();
            asaasError = `Asaas payment creation failed: ${errBody}`;
          }
        }
      } catch (err) {
        asaasError = err instanceof Error ? err.message : "Asaas connection error";
      }
    } else {
      asaasError = "ASAAS_API_KEY not configured — company created without billing";
    }

    // Insert company regardless (even if Asaas fails, the tenant is registered)
    // If payment is not configured or failed, mark as pending_pagamento so SuperAdmin can follow up
    const companyStatus = checkoutUrl ? "active" : "pending_pagamento";
    const { data: company, error: insertErr } = await supabase
      .from("companies")
      .insert({
        name: company_name,
        slug,
        status: companyStatus,
        brand_color: "#D4AF37",
        plan_id: plan.id,
        cnpj: cnpj.replace(/\D/g, ""),
        responsible_name,
        responsible_phone,
        responsible_email,
        asaas_customer_id: asaasCustomerId,
        asaas_payment_id: asaasPaymentId,
        asaas_checkout_url: checkoutUrl,
        custom_discount: 0,
      })
      .select("id, slug")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Erro ao criar empresa no banco de dados", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the registration
    await supabase.from("admin_logs").insert({
      company_id: company.id,
      source: "registration",
      level: asaasError ? "warning" : "info",
      message: `Empresa "${company_name}" cadastrada (status: ${companyStatus}). Tier: ${totem_tier} (${totem_limit} totens), Ciclo: ${billing_cycle}, Preço: R$ ${safeFinalPrice.toFixed(2)}. Asaas: ${asaasCustomerId ? "OK" : "FALHOU"}`,
      payload: { totem_tier, totem_limit, billing_cycle, final_price: safeFinalPrice, asaas_customer_id: asaasCustomerId, asaas_error: asaasError, status: companyStatus },
    });

    // Create superadmin notification
    if (companyStatus === "pending_pagamento") {
      await supabase.from("superadmin_notifications").insert({
        title: "Novo cadastro pendente",
        message: `Empresa "${company_name}" (${cnpj}) foi cadastrada e aguarda pagamento. Responsável: ${responsible_name}.`,
        type: "new_pending_company",
        related_id: company.id,
      });
    } else {
      await supabase.from("superadmin_notifications").insert({
        title: "Nova empresa criada",
        message: `Empresa "${company_name}" foi cadastrada e ativada com sucesso. Plano: ${totem_tier}, ${totem_limit} totens.`,
        type: "company_created",
        related_id: company.id,
      });
    }

    // Create auth user for the company admin and link to company
    let adminUserId: string | null = null;
    let adminError: string | null = null;
    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === responsible_email);

      if (existingUser) {
        adminUserId = existingUser.id;
      } else {
        // Generate a temporary password — admin will reset via SuperAdmin panel
        const tempPassword = Math.random().toString(36).slice(2, 12) + "A1!";
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email: responsible_email,
          password: tempPassword,
          email_confirm: true,
        });
        if (createErr || !newUser?.user) {
          adminError = createErr?.message ?? "Falha ao criar usuário";
        } else {
          adminUserId = newUser.user.id;
        }
      }

      if (adminUserId) {
        // Link user to company if not already linked
        const { data: existingLink } = await supabase
          .from("company_admins")
          .select("id")
          .eq("company_id", company.id)
          .eq("user_id", adminUserId)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from("company_admins").insert({
            company_id: company.id,
            user_id: adminUserId,
            role: "admin",
            force_password_change: true,
          });
        }
      }
    } catch (err) {
      adminError = err instanceof Error ? err.message : "Erro ao criar admin";
    }

    return new Response(JSON.stringify({
      success: true,
      company_id: company.id,
      slug: company.slug,
      checkout_url: checkoutUrl,
      asaas_error: asaasError,
      admin_error: adminError,
      status: companyStatus,
    }), {
      status: 201,
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
