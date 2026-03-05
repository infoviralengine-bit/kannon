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

  // Return immediately, process in background
  EdgeRuntime.waitUntil(runScraping(supabaseAdmin));

  return new Response(
    JSON.stringify({ success: true, message: "Scraping started in background. Check scraping_logs for results." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

async function runScraping(supabaseAdmin: ReturnType<typeof createClient>) {
  let totalCreated = 0;
  let totalUpdated = 0;
  let accountsProcessed = 0;

  try {
    // Get API token
    let apiToken: string | null = null;
    const { data: settingsRow } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "apify_api_key")
      .maybeSingle();
    if (settingsRow?.value) {
      apiToken = settingsRow.value;
    } else {
      apiToken = Deno.env.get("APIFY_API_KEY") || null;
    }
    if (!apiToken) {
      throw new Error("APIFY_API_KEY non configurata né in settings né come secret.");
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
      return;
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

    // Build username-to-account map
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

    const apifyInput = {
      profiles: allUsernames,
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      excludePinnedPosts: false,
      resultsPerPage: 5,
    };

    console.log(`Starting Apify run for ${allUsernames.length} profiles`);

    // Start Apify run
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
    if (!runId) throw new Error("No run ID returned from Apify");

    // Poll for completion (timeout 15 min)
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
      if (runStatus === "SUCCEEDED" || runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") break;
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

    console.log(`Apify returned ${items.length} items`);

    const processedAccounts = new Set<string>();

    for (const item of items) {
      try {
        const tiktokVideoId = item.id || item.videoId;
        if (!tiktokVideoId) continue;

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

        for (const account of matchedAccounts) {
          const campaign = campaignMap.get(account.campaign_id!);
          if (!campaign) continue;

          const videoDate = new Date(createTime);
          const campaignStartDate = new Date(campaign.start_date);
          if (videoDate < campaignStartDate) continue;

          const viewsCap = campaign.video_views_cap;

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

    // Update last_scraped_at for processed accounts
    for (const accountId of processedAccounts) {
      await supabaseAdmin
        .from("tiktok_accounts")
        .update({ last_scraped_at: now })
        .eq("id", accountId);
    }
    accountsProcessed = processedAccounts.size;

    await supabaseAdmin.from("scraping_logs").insert({
      status: "success",
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: null,
    });

    console.log(`Scraping complete: ${totalCreated} created, ${totalUpdated} updated, ${accountsProcessed} accounts`);
  } catch (err: any) {
    console.error("Scraping error:", err.message);
    await supabaseAdmin.from("scraping_logs").insert({
      status: "error",
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: err.message,
    });
  }
}
