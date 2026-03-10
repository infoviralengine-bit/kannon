import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      token,
      first_name,
      last_name,
      date_of_birth,
      fiscal_code,
      address_street,
      address_city,
      address_zip,
      address_province,
      iban,
      iban_holder_name,
      tiktok_usernames, // Record<contract_id, username>
      email,
      password,
    } = body;

    if (!token || !email || !password || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: "Campi obbligatori mancanti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate token
    const { data: link, error: linkErr } = await admin
      .from("onboarding_links")
      .select("*, closer_leads(*)")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ error: "Link non valido o già utilizzato" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create Supabase auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${first_name} ${last_name}` },
    });

    if (authErr) {
      const msg = authErr.message.includes("already been registered")
        ? "Questa email è già registrata"
        : authErr.message;
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 3. Set role to creator (trigger creates profile + team role, so update)
    await admin.from("user_roles").update({ role: "creator" }).eq("user_id", userId);

    // 4. Create creator record
    const { data: creator, error: creatorErr } = await admin
      .from("creators")
      .insert({
        name: `${first_name} ${last_name}`,
        email,
        phone: link.closer_leads?.phone || null,
        profile_id: userId,
        status: "active",
        date_of_birth,
        fiscal_code,
        address_street,
        address_city,
        address_zip,
        address_province,
        iban,
        iban_holder_name,
      })
      .select("id")
      .single();

    if (creatorErr) {
      console.error("Creator insert error:", creatorErr);
      return new Response(
        JSON.stringify({ error: "Errore nella creazione del profilo creator" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creatorId = creator.id;
    const contractIds: string[] = link.contract_ids;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // 5. Create TikTok accounts & contract_creators
    for (const contractId of contractIds) {
      const username = tiktok_usernames?.[contractId];
      if (username) {
        // Find which campaigns this contract is linked to
        const { data: ccLinks } = await admin
          .from("contract_campaigns")
          .select("campaign_id")
          .eq("contract_id", contractId);

        const campaignId = ccLinks?.[0]?.campaign_id || null;

        await admin.from("tiktok_accounts").insert({
          username: username.replace(/^@/, ""),
          account_type: "creator",
          creator_id: creatorId,
          owner_profile_id: userId,
          campaign_id: campaignId,
        });
      }

      // Link creator to contract
      await admin.from("contract_creators").insert({
        contract_id: contractId,
        creator_id: creatorId,
      });

      // Save signature
      await admin.from("contract_signatures").insert({
        contract_id: contractId,
        creator_id: creatorId,
        onboarding_link_id: link.id,
        ip_address: ip,
      });
    }

    // 6. Update onboarding link
    await admin.from("onboarding_links").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      creator_id: creatorId,
    }).eq("id", link.id);

    // 7. Send notification to admins
    const { data: adminUsers } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "team"]);

    if (adminUsers) {
      const notifications = adminUsers.map((u: { user_id: string }) => ({
        user_id: u.user_id,
        type: "creator_onboarded",
        message: `${first_name} ${last_name} ha completato l'onboarding e firmato ${contractIds.length} contratt${contractIds.length === 1 ? "o" : "i"}.`,
      }));
      await admin.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, creator_id: creatorId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Onboarding error:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
