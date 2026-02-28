import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { email, password, full_name, role, creator_id } = await req.json();

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400 });

  const userId = authData.user.id;

  // Set role (profile is auto-created by trigger)
  await supabaseAdmin.from("user_roles").update({ role }).eq("user_id", userId);

  // Link creator if provided
  if (creator_id) {
    await supabaseAdmin.from("creators").update({ profile_id: userId }).eq("id", creator_id);
  }

  return new Response(JSON.stringify({ userId, email, role }), {
    headers: { "Content-Type": "application/json" },
  });
});
