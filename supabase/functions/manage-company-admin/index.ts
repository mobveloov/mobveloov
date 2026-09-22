import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RequestBody {
  action: "create_admin" | "reset_password";
  company_id: string;
  email?: string;
  password?: string;
  force_password_change?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as RequestBody;
    const { action, company_id } = body;

    if (!action || !company_id) {
      return new Response(JSON.stringify({ error: "action e company_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is superadmin via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = (userData.user.app_metadata as { role?: string })?.role;
    if (role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Acesso restrito ao SuperAdmin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up existing company_admins record
    const { data: existingAdmin } = await supabase
      .from("company_admins")
      .select("user_id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (action === "create_admin") {
      const email = body.email;
      const password = body.password;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "email e password são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user already exists in auth.users
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      let userId: string;

      if (existingUser) {
        // User exists — update password
        const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
        });
        if (updateErr) {
          return new Response(JSON.stringify({ error: "Erro ao atualizar senha: " + updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr || !newUser?.user) {
          return new Response(JSON.stringify({ error: "Erro ao criar usuário: " + (createErr?.message ?? "desconhecido") }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
      }

      // Link user to company if not already linked
      if (!existingAdmin) {
        const { error: linkErr } = await supabase.from("company_admins").insert({
          company_id,
          user_id: userId,
          role: "admin",
          force_password_change: body.force_password_change ?? true,
        });
        if (linkErr) {
          return new Response(JSON.stringify({ error: "Erro ao vincular admin à empresa: " + linkErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Update force_password_change flag
        await supabase.from("company_admins").update({
          force_password_change: body.force_password_change ?? true,
        }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const password = body.password;
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter ao menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let userId = existingAdmin?.user_id ?? null;

      if (!userId) {
        // Older companies may not have an auth user linked yet. Use the
        // responsible email to repair the account during the password reset.
        const { data: company, error: companyErr } = await supabase
          .from("companies")
          .select("responsible_email")
          .eq("id", company_id)
          .maybeSingle();

        if (companyErr || !company?.responsible_email) {
          return new Response(JSON.stringify({ error: "E-mail do responsável não encontrado para esta empresa" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === company.responsible_email.toLowerCase());

        if (existingUser) {
          userId = existingUser.id;
        } else {
          const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email: company.responsible_email,
            password,
            email_confirm: true,
          });
          if (createErr || !newUser?.user) {
            return new Response(JSON.stringify({ error: "Erro ao criar usuário: " + (createErr?.message ?? "desconhecido") }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          userId = newUser.user.id;
        }

        const { error: linkErr } = await supabase.from("company_admins").insert({
          company_id,
          user_id: userId,
          role: "admin",
          force_password_change: body.force_password_change ?? true,
        });
        if (linkErr) {
          return new Response(JSON.stringify({ error: "Erro ao vincular usuário à empresa: " + linkErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password });
        if (updateErr) {
          return new Response(JSON.stringify({ error: "Erro ao resetar senha: " + updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.from("company_admins").update({
          force_password_change: body.force_password_change ?? true,
        }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
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
