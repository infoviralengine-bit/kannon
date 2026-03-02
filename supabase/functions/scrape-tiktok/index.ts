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

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // If token is anon key (cron call) or service role, skip user check
    if (token !== anonKey && token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
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
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let accountsProcessed = 0;
  let logStatus = "success";
  let errorMessage: string | null = null;

  try {
    // Read API token from Supabase secrets (environment variable)
    const apiToken = Deno.env.get("APIFY_API_KEY");
    if (!apiToken) {
      throw new Error("APIFY_API_KEY non configurata. Aggiungila come secret di Supabase.");
    }

    // 2. Get active creator accounts with campaign
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("tiktok_accounts")
      .select("id, username, campaign_id, is_active")
      .eq("account_type", "creator")
      .not("campaign_id", "is", null)
      .eq("is_active", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      // No accounts to process
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

    // 3. Get campaigns for start_date + video_views_cap
    const campaignIds = [...new Set(accounts.map((a) => a.campaign_id!))];
    const { data: campaignsData } = await supabaseAdmin
      .from("campaigns")
      .select("id, start_date, video_views_cap")
      .in("id", campaignIds);

    const campaignMap = new Map(
      (campaignsData || []).map((c) => [c.id, c])
    );

    // Process each account
    for (const account of accounts) {
      try {
        const campaign = campaignMap.get(account.campaign_id!);
        if (!campaign) continue;

        const cleanUsername = account.username.replace(/^@/, "");

        // 4. Start Apify run
        const runRes = await fetch(
          "https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/runs",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              profiles: [cleanUsername],
              profileScrapeSections: ["videos"],
              profileSorting: "latest",
              scrapeProfileVideosPostedAfter: campaign.start_date,
              excludePinnedPosts: false,
              resultsPerPage: 200,
            }),
          }
        );

        if (!runRes.ok) {
          const errText = await runRes.text();
          if (runRes.status === 401 || runRes.status === 403) {
            throw new Error("API token Apify non valido");
          }
          console.error(`Apify run failed for ${cleanUsername}: ${errText}`);
          continue;
        }

        const runData = await runRes.json();
        const runId = runData.data?.id;
        if (!runId) {
          console.error(`No run ID for ${cleanUsername}`);
          continue;
        }

        // 5. Poll for completion (timeout 10 min)
        const maxWait = 10 * 60 * 1000;
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
          console.error(`Apify run ${runId} for @${cleanUsername} ended with status: ${runStatus || "TIMEOUT"}`);
          logStatus = "partial";
          errorMessage = `Timeout o errore per @${cleanUsername}`;
          // Update account status on error
          if (runStatus === "FAILED") {
            await supabaseAdmin
              .from("tiktok_accounts")
              .update({ is_active: false })
              .eq("id", account.id);
          }
          continue;
        }

        // 6. Get results
        const datasetId = runData.data?.defaultDatasetId;
        const itemsRes = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const items = await itemsRes.json();

        // 7. Upsert videos
        const now = new Date().toISOString();
        const viewsCap = campaign.video_views_cap;

        for (const item of items) {
          const tiktokVideoId = item.id || item.videoId;
          if (!tiktokVideoId) continue;

          const playCount = item.playCount ?? item.views ?? 0;
          const diggCount = item.diggCount ?? item.likes ?? 0;
          const commentCount = item.commentCount ?? item.comments ?? 0;
          const createTime = item.createTime
            ? new Date(item.createTime * 1000).toISOString()
            : now;

          // Check if video exists
          const { data: existing } = await supabaseAdmin
            .from("videos")
            .select("id, window_expires_at, window_closed")
            .eq("tiktok_video_id", tiktokVideoId)
            .eq("tiktok_account_id", account.id)
            .maybeSingle();

          if (!existing) {
            // INSERT
            const publishedAt = new Date(createTime);
            const windowExpires = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
            // UPDATE
            const updateData: Record<string, unknown> = {
              views: playCount,
              likes: diggCount,
              comments: commentCount,
              last_scraped_at: now,
            };

            // Check window expiry
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
        }

        // 9. Update account last_scraped_at
        await supabaseAdmin
          .from("tiktok_accounts")
          .update({ last_scraped_at: now })
          .eq("id", account.id);

        accountsProcessed++;
      } catch (accountErr: any) {
        console.error(`Error processing @${account.username}:`, accountErr.message);
        logStatus = "partial";
        errorMessage = accountErr.message;
      }
    }

    // 8. Insert log
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
