import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { personal_access_token } = await req.json();
    if (!personal_access_token || typeof personal_access_token !== "string" || personal_access_token.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Token non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pat = personal_access_token.trim();

    // Step 1: Get current user to obtain organization URI
    const meRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    });

    if (!meRes.ok) {
      const errBody = await meRes.text();
      console.error("Calendly /users/me failed:", meRes.status, errBody);
      return new Response(JSON.stringify({ error: `Errore Calendly: ${meRes.status}. Verifica il token.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meData = await meRes.json();
    const organizationUri = meData.resource?.current_organization;
    const userUri = meData.resource?.uri;

    if (!organizationUri) {
      return new Response(JSON.stringify({ error: "Impossibile ottenere l'organizzazione Calendly" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Create webhook subscription
    const webhookUrl = `${supabaseUrl}/functions/v1/calendly-webhook`;

    const webhookRes = await fetch("https://api.calendly.com/webhook_subscriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["invitee.created"],
        organization: organizationUri,
        user: userUri,
        scope: "organization",
      }),
    });

    const webhookData = await webhookRes.json();

    if (!webhookRes.ok) {
      console.error("Calendly webhook creation failed:", webhookRes.status, JSON.stringify(webhookData));
      // If already exists, that's ok
      if (webhookRes.status === 409) {
        return new Response(JSON.stringify({ ok: true, message: "Webhook già esistente. Calendly connesso ✅" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Errore creazione webhook: ${webhookData?.message || webhookRes.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Save signing_key to settings table
    const signingKey = webhookData.resource?.creator_signing_key;
    if (signingKey) {
      await supabase.from("settings").upsert(
        { key: "calendly_webhook_secret", value: signingKey, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: "Calendly connesso ✅" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("connect-calendly error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
