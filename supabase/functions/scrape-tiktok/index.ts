import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin or service role (cron)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (token !== serviceRoleKey) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabaseAdmin.rpc("get_user_role", {
      _user_id: claimsData.user.id,
    });
    if (roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let accountsProcessed = 0;
  let logStatus = "success";
  let errorMessage: string | null = null;

  try {
    const apiToken = Deno.env.get("APIFY_API_KEY");
    if (!apiToken) {
      throw new Error("APIFY_API_KEY non configurata. Aggiungila come secret di Supabase.");
    }

    // Get active creator accounts with campaign
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("tiktok_accounts")
      .select("id, username, campaign_id, is_active")
      .eq("account_type", "creator")
      .not("campaign_id", "is", null)
      .eq("is_active", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      await supabaseAdmin.from("scraping_logs").insert({
        status: "success",
        accounts_processed: 0,
        videos_created: 0,
        videos_updated: 0,
        error_message: "Nessun account creator attivo trovato",
      });
      return new Response(
        JSON.stringify({ success: true, created: 0, updated: 0, accounts: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaigns for start_date + video_views_cap
    const campaignIds = [...new Set(accounts.map((a) => a.campaign_id!))];
    const { data: campaignsData } = await supabaseAdmin
      .from("campaigns")
      .select("id, start_date, video_views_cap")
      .in("id", campaignIds);

    const campaignMap = new Map(
      (campaignsData || []).map((c) => [c.id, c])
    );

    // Build username-to-account map and collect all usernames
    const usernameToAccounts = new Map<string, typeof accounts>();
    const allUsernames: string[] = [];
    let earliestStartDate: string | null = null;

    for (const account of accounts) {
      const cleanUsername = account.username.replace(/^@/, "").toLowerCase();
      if (!usernameToAccounts.has(cleanUsername)) {
        usernameToAccounts.set(cleanUsername, []);
      }
      usernameToAccounts.get(cleanUsername)!.push(account);
      if (!allUsernames.includes(cleanUsername)) {
        allUsernames.push(cleanUsername);
      }

      // Find earliest campaign start_date
      const campaign = campaignMap.get(account.campaign_id!);
      if (campaign?.start_date) {
        if (!earliestStartDate || campaign.start_date < earliestStartDate) {
          earliestStartDate = campaign.start_date;
        }
      }
    }

    if (allUsernames.length === 0) {
      throw new Error("Nessun username valido trovato");
    }

    // STRATEGY: fetch only 5 most recent videos per profile
    // This avoids downloading full history (date filter doesn't work)
    // 5 videos is enough since creators post max 3-5/day
    const apifyInput: Record<string, unknown> = {
      profiles: allUsernames,
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      excludePinnedPosts: false,
      resultsPerPage: 5,
    };

    console.log(`Starting single Apify run for ${allUsernames.length} profiles, earliest date: ${earliestStartDate}`);
    console.log(`Apify input: ${JSON.stringify(apifyInput)}`);

    // Log the input to scraping_logs for diagnostics
    await supabaseAdmin.from("scraping_logs").insert({
      status: "info",
      accounts_processed: 0,
      videos_created: 0,
      videos_updated: 0,
      error_message: `DIAGNOSTIC - Apify input: ${JSON.stringify(apifyInput)}`,
    });

    // Single Apify run with ALL usernames
    const runRes = await fetch(
      "https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/runs",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apifyInput),
      }
    );

    if (!runRes.ok) {
      const errText = await runRes.text();
      if (runRes.status === 401 || runRes.status === 403) {
        throw new Error("API token Apify non valido");
      }
      throw new Error(`Apify run failed: ${errText}`);
    }

    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) {
      throw new Error("No run ID returned from Apify");
    }

    // Poll for completion (timeout 15 min for batch)
    const maxWait = 15 * 60 * 1000;
    const start = Date.now();
    let runStatus = "";

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, 15000));
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      const statusData = await statusRes.json();
      runStatus = statusData.data?.status;

      if (runStatus === "SUCCEEDED") break;
      if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
        break;
      }
    }

    if (runStatus !== "SUCCEEDED") {
      throw new Error(`Apify run ended with status: ${runStatus || "TIMEOUT"}`);
    }

    // Get results
    const datasetId = runData.data?.defaultDatasetId;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const items = await itemsRes.json();
    const now = new Date().toISOString();

    console.log(`Apify returned ${items.length} items, processing...`);

    // Server-side date filtering applied per-video below

    // Process each item and associate to correct account via authorMeta.name
    const processedAccounts = new Set<string>();


    for (const item of items) {
      try {
        const tiktokVideoId = item.id || item.videoId;
        if (!tiktokVideoId) continue;

        // Match author to account
        const authorUsername = (
          item.authorMeta?.name || item.author || ""
        ).toLowerCase().replace(/^@/, "");

        if (!authorUsername) continue;

        const matchedAccounts = usernameToAccounts.get(authorUsername);
        if (!matchedAccounts || matchedAccounts.length === 0) continue;

        const playCount = item.playCount ?? item.views ?? 0;
        const diggCount = item.diggCount ?? item.likes ?? 0;
        const commentCount = item.commentCount ?? item.comments ?? 0;
        const createTime = item.createTime
          ? new Date(item.createTime * 1000).toISOString()
          : now;

        // Process for each matching account (usually one)
        for (const account of matchedAccounts) {
          const campaign = campaignMap.get(account.campaign_id!);
          if (!campaign) continue;

          // Server-side filter: skip videos before this account's campaign start
          const videoDate = new Date(createTime);
          const campaignStartDate = new Date(campaign.start_date);
          if (videoDate < campaignStartDate) continue;

          const viewsCap = campaign.video_views_cap;

          // Check if video exists
          const { data: existing } = await supabaseAdmin
            .from("videos")
            .select("id, window_expires_at, window_closed")
            .eq("tiktok_video_id", tiktokVideoId)
            .eq("tiktok_account_id", account.id)
            .maybeSingle();

          if (!existing) {
            const publishedAt = new Date(createTime);
            const windowExpires = new Date(
              publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000
            ).toISOString();

            await supabaseAdmin.from("videos").insert({
              tiktok_account_id: account.id,
              tiktok_video_id: tiktokVideoId,
              views: playCount,
              likes: diggCount,
              comments: commentCount,
              published_at: createTime,
              window_expires_at: windowExpires,
              window_closed: false,
              views_final: null,
              last_scraped_at: now,
            });
            totalCreated++;
          } else {
            const updateData: Record<string, unknown> = {
              views: playCount,
              likes: diggCount,
              comments: commentCount,
              last_scraped_at: now,
            };

            if (
              existing.window_expires_at &&
              new Date(existing.window_expires_at) <= new Date() &&
              !existing.window_closed
            ) {
              updateData.window_closed = true;
              updateData.views_final =
                viewsCap && playCount > viewsCap ? viewsCap : playCount;
            }

            await supabaseAdmin
              .from("videos")
              .update(updateData)
              .eq("id", existing.id);
            totalUpdated++;
          }

          processedAccounts.add(account.id);
        }
      } catch (itemErr: any) {
        console.error(`Error processing item:`, itemErr.message);
      }
    }

    // Update last_scraped_at for all processed accounts
    for (const accountId of processedAccounts) {
      await supabaseAdmin
        .from("tiktok_accounts")
        .update({ last_scraped_at: now })
        .eq("id", accountId);
    }
    accountsProcessed = processedAccounts.size;

    // Log
    await supabaseAdmin.from("scraping_logs").insert({
      status: logStatus,
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        updated: totalUpdated,
        accounts: accountsProcessed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Scraping error:", err.message);

    await supabaseAdmin.from("scraping_logs").insert({
      status: "error",
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: err.message,
    });

    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
