import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorizzato" }), { status: 401, headers: corsHeaders });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: "Non autorizzato" }), { status: 401, headers: corsHeaders });
  }
  const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).single();
  if (!callerRole || callerRole.role !== "admin") {
    return new Response(JSON.stringify({ error: "Solo gli admin possono gestire utenti" }), { status: 403, headers: corsHeaders });
  }

  const { action, ...payload } = await req.json();

  try {
    if (action === "create_user") {
      const { email, password, full_name, role, creator_id, campaign_id } = payload;

      // Create auth user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;

      const userId = newUser.user.id;

      // Update profile (auto-created by trigger)
      await supabaseAdmin.from("profiles").update({ full_name, email }).eq("id", userId);

      // Set role (replace default 'team')
      await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);

      // Link creator
      if (role === "creator" && creator_id) {
        await supabaseAdmin.from("creators").update({ profile_id: userId }).eq("id", creator_id);
      }

      // Link client to campaign
      if (role === "client" && campaign_id) {
        await supabaseAdmin.from("campaigns").update({ client_profile_id: userId }).eq("id", campaign_id);
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_role") {
      const { user_id, role, creator_id, campaign_id } = payload;
      await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", user_id);

      if (role === "creator" && creator_id) {
        await supabaseAdmin.from("creators").update({ profile_id: user_id }).eq("id", creator_id);
      }
      if (role === "client" && campaign_id) {
        await supabaseAdmin.from("campaigns").update({ client_profile_id: user_id }).eq("id", campaign_id);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disable_user") {
      const { user_id } = payload;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      const { user_id } = payload;
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Non puoi eliminare te stesso" }), { status: 400, headers: corsHeaders });
      }
      // Delete role, profile, then auth user
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("id", user_id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_users") {
      // Get all profiles + roles
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email, created_at");
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      const users = (profiles || []).map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "team",
      }));

      return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
