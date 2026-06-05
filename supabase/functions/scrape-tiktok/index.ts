import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_ACTOR = "clockworks~free-tiktok-scraper";

function normalizeTikTokUsername(value: unknown) {
  return String(value ?? "").trim().replace(/^@+/, "").toLowerCase();
}

async function getApifyApiToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  log: (msg: string) => void = () => {}
) {
  let apiToken: string | null = null;
  const { data: settingsRow } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "apify_api_key")
    .maybeSingle();

  if (settingsRow?.value) {
    apiToken = settingsRow.value;
    log("API token caricato da settings");
  } else {
    apiToken = Deno.env.get("APIFY_API_KEY") || null;
    if (apiToken) log("API token caricato da secret");
  }

  if (!apiToken) {
    throw new Error("APIFY_API_KEY non configurata né in settings né come secret.");
  }

  return apiToken;
}

async function resolveDatasetIdFromWebhook(body: any, apiToken: string) {
  const directDatasetId =
    body?.defaultDatasetId ||
    body?.resource?.defaultDatasetId ||
    body?.resource?.storageIds?.datasets?.default;
  if (directDatasetId) return String(directDatasetId);

  const runId = body?.runId || body?.eventData?.actorRunId || body?.resource?.id;
  if (!runId) return null;

  const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
  if (!statusRes.ok) return null;
  const statusData = await statusRes.json();
  return statusData.data?.defaultDatasetId || statusData.data?.storageIds?.datasets?.default || null;
}

async function startApifyScrapeRun(supabaseAdmin: ReturnType<typeof createClient>) {
  const apiToken = await getApifyApiToken(supabaseAdmin);
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("username, campaign_id")
    .eq("account_type", "creator")
    .not("campaign_id", "is", null)
    .eq("is_active", true);

  if (accErr) throw new Error(`Errore query account: ${accErr.message}`);

  const profiles = [...new Set((accounts || []).map((a) => normalizeTikTokUsername(a.username)).filter(Boolean))];
  if (profiles.length === 0) throw new Error("Nessun username valido trovato");

  const apifyInput = {
    profiles,
    resultsPerPage: 100,
    profileScrapeSections: ["videos"],
    profileSorting: "latest",
    excludePinnedPosts: false,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  };

  const requestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-tiktok`;
  const webhooks = btoa(JSON.stringify([{ 
    eventTypes: ["ACTOR.RUN.SUCCEEDED"],
    requestUrl,
    payloadTemplate: JSON.stringify({
      source: "apify-webhook",
      eventType: "{{eventType}}",
      runId: "{{resource.id}}",
      defaultDatasetId: "{{resource.defaultDatasetId}}",
      actorId: "{{resource.actId}}",
      webhookToken: apiToken.slice(-16),
    }),
  }]));

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?webhooks=${encodeURIComponent(webhooks)}&token=${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyInput),
    }
  );

  if (!runRes.ok) {
    const errText = await runRes.text();
    throw new Error(`Apify run failed (status ${runRes.status}): ${errText}`);
  }

  const runData = await runRes.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error(`No run ID returned from Apify. Response: ${JSON.stringify(runData)}`);

  return {
    runId,
    datasetId: runData.data?.defaultDatasetId || null,
    profilesCount: profiles.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parse optional datasetId from request body, or Apify webhook payload
  let body: any = {};
  let datasetId: string | null = null;
  try {
    body = await req.json();
    datasetId = body?.datasetId || null;
  } catch {
    // No body or invalid JSON — that's fine, run normally
  }

  const isApifyWebhook = body?.source === "apify-webhook" || body?.eventType === "ACTOR.RUN.SUCCEEDED";
  if (isApifyWebhook) {
    const apiToken = await getApifyApiToken(supabaseAdmin);
    if (body?.webhookToken !== apiToken.slice(-16)) {
      return new Response(JSON.stringify({ error: "Unauthorized webhook" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    datasetId = await resolveDatasetIdFromWebhook(body, apiToken);
    if (!datasetId) {
      return new Response(JSON.stringify({ error: "Dataset Apify non trovato nel webhook" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    EdgeRuntime.waitUntil(runScraping(supabaseAdmin, datasetId));
    return new Response(JSON.stringify({ success: true, message: `Import automatico dataset ${datasetId} avviato.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  if (!datasetId) {
    const started = await startApifyScrapeRun(supabaseAdmin);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Run Apify ${started.runId} avviata: l'import partirà automaticamente a run completata.`,
        runId: started.runId,
        datasetId: started.datasetId,
        profilesCount: started.profilesCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Dataset import: return immediately, process in background
  EdgeRuntime.waitUntil(runScraping(supabaseAdmin, datasetId));

  const message = datasetId
    ? `Import da dataset ${datasetId} avviato in background.`
    : "Scraping avviato in background. Controlla i log per i risultati.";

  return new Response(
    JSON.stringify({ success: true, message }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

async function runScraping(supabaseAdmin: ReturnType<typeof createClient>, existingDatasetId: string | null = null) {
  let totalCreated = 0;
  let totalUpdated = 0;
  let accountsProcessed = 0;
  const logMessages: string[] = [];

  function log(msg: string) {
    console.log(msg);
    logMessages.push(`[${new Date().toISOString()}] ${msg}`);
  }

  function logError(msg: string) {
    console.error(msg);
    logMessages.push(`[${new Date().toISOString()}] ERROR: ${msg}`);
  }

  try {
    // Step 1: Get API token
    const apiToken = await getApifyApiToken(supabaseAdmin, log);

    // Step 2: Get active creator accounts
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("tiktok_accounts")
      .select("id, username, campaign_id, is_active")
      .eq("account_type", "creator")
      .not("campaign_id", "is", null)
      .eq("is_active", true);

    if (accErr) throw new Error(`Errore query account: ${accErr.message}`);
    
    log(`Step 2: Recuperati ${accounts?.length ?? 0} account creator attivi dal DB`);
    
    if (!accounts || accounts.length === 0) {
      await supabaseAdmin.from("scraping_logs").insert({
        status: "success",
        accounts_processed: 0,
        videos_created: 0,
        videos_updated: 0,
        error_message: logMessages.join("\n") + "\nNessun account creator attivo trovato",
      });
      return;
    }

    // Log each account
    for (const acc of accounts) {
      log(`  - Account: @${acc.username} (id: ${acc.id}, campaign: ${acc.campaign_id})`);
    }

    // Step 3: Get campaigns
    const campaignIds = [...new Set(accounts.map((a) => a.campaign_id!))];
    const { data: campaignsData } = await supabaseAdmin
      .from("campaigns")
      .select("id, start_date, video_views_cap")
      .in("id", campaignIds);

    const campaignMap = new Map(
      (campaignsData || []).map((c) => [c.id, c])
    );
    log(`Step 3: Recuperate ${campaignsData?.length ?? 0} campagne`);

    // Step 4: Build username list
    const usernameToAccounts = new Map<string, typeof accounts>();
    const allUsernames: string[] = [];
    let earliestStartDate: string | null = null;

    for (const account of accounts) {
      const cleanUsername = normalizeTikTokUsername(account.username);
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

    log(`Step 4: Username da scrapare: [${allUsernames.join(", ")}]`);

    let datasetId: string;

    if (existingDatasetId) {
      // Use existing dataset from a manual Apify run
      datasetId = existingDatasetId;
      log(`Step 5: Uso dataset esistente: ${datasetId} (skip lancio run)`);
    } else {
      const apifyInput = {
        profiles: allUsernames,
        resultsPerPage: 100,
        profileScrapeSections: ["videos"],
        profileSorting: "latest",
        excludePinnedPosts: false,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
      };

      log(`Step 5: Avvio run Apify con input: ${JSON.stringify(apifyInput)}`);

      // Step 5: Start Apify run (clockworks/free-tiktok-scraper)
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/runs?token=${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apifyInput),
        }
      );

      if (!runRes.ok) {
        const errText = await runRes.text();
        if (runRes.status === 401 || runRes.status === 403) {
          throw new Error(`API token Apify non valido o actor non accessibile via API (status ${runRes.status}): ${errText}`);
        }
        throw new Error(`Apify run failed (status ${runRes.status}): ${errText}`);
      }

      const runData = await runRes.json();
      log(`Step 5: Run response: ${JSON.stringify(runData).substring(0, 500)}`);
      const runId = runData.data?.id;
      if (!runId) throw new Error(`No run ID returned from Apify. Response: ${JSON.stringify(runData)}`);

      log(`Step 5: Run Apify avviato con ID: ${runId}`);

      // Step 6: Poll for completion
      const maxWait = 15 * 60 * 1000;
      const start = Date.now();
      let runStatus = "";
      let pollCount = 0;

      while (Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, 15000));
        pollCount++;
        const statusRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
        );
        if (!statusRes.ok) {
          const errText = await statusRes.text();
          throw new Error(`Apify status check failed (status ${statusRes.status}): ${errText}`);
        }
        const statusData = await statusRes.json();
        runStatus = statusData.data?.status;
        log(`Step 6: Poll #${pollCount} - Status: ${runStatus}`);
        if (runStatus === "SUCCEEDED" || runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") break;
      }

      if (runStatus !== "SUCCEEDED") {
        throw new Error(`Apify run ended with status: ${runStatus || "TIMEOUT"}`);
      }

      datasetId = runData.data?.defaultDatasetId;
    }

    // Step 7: Get results
    log(`Step 7: Recupero risultati dal dataset: ${datasetId} (paginato)`);

    const items: any[] = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const pageRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=true&limit=${PAGE}&offset=${offset}&token=${apiToken}`
      );
      if (!pageRes.ok) {
        const errText = await pageRes.text();
        throw new Error(`Apify dataset fetch failed (status ${pageRes.status}, offset ${offset}): ${errText}`);
      }
      const pageData = await pageRes.json();
      if (!Array.isArray(pageData)) {
        throw new Error(`Apify items page non è un array. Tipo: ${typeof pageData}. Dump: ${JSON.stringify(pageData).substring(0, 500)}`);
      }
      items.push(...pageData);
      log(`  Pagina offset=${offset}: ${pageData.length} item (totale finora: ${items.length})`);
      if (pageData.length < PAGE) break;
      offset += PAGE;
      if (offset > 50000) {
        log(`  Safety break: raggiunto limite paginazione (50k)`);
        break;
      }
    }
    const now = new Date().toISOString();

    log(`Step 7: Apify ha restituito ${items.length} items totali`);

    if (items.length > 0 && items.every((item) => item?.noResults === true)) {
      throw new Error("Apify ha restituito solo record { noResults: true }. Questo indica che l'actor non sta realmente eseguendo lo scraping via API (tipicamente DEMO/API-disabled mode lato vendor) oppure che il run API non equivale al run manuale in console.");
    }

    // Log first item structure for debugging
    if (items.length > 0) {
      const sample = items[0];
      log(`Step 7: Struttura primo item - keys: [${Object.keys(sample).join(", ")}]`);
      log(`Step 7: Primo item DUMP: ${JSON.stringify(sample).substring(0, 1000)}`);
    }

    // Step 8: Normalize items into per-(account, tiktok_video_id) records
    type PendingRow = {
      tiktok_account_id: string;
      tiktok_video_id: string;
      views: number;
      likes: number;
      comments: number;
      published_at: string;
      account_username: string;
      views_cap: number | null;
    };
    const pending: PendingRow[] = [];
    const processedAccounts = new Set<string>();
    let skipped = 0;
    let detailLogBudget = 200;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const tiktokVideoId = item?.id;
      if (!tiktokVideoId) { skipped++; continue; }

      const authorUsername = (item.authorMeta?.name || item.authorMeta?.nickName || "")
        .toLowerCase().replace(/^@/, "");
      if (!authorUsername) { skipped++; continue; }

      const matchedAccounts = usernameToAccounts.get(authorUsername);
      if (!matchedAccounts || matchedAccounts.length === 0) { skipped++; continue; }

      const playCount = item.playCount ?? 0;
      const diggCount = item.diggCount ?? 0;
      const commentCount = item.commentCount ?? 0;
      const createTime = item.createTime ? new Date(item.createTime * 1000).toISOString() : now;
      const videoDate = new Date(createTime);

      for (const account of matchedAccounts) {
        const campaign = campaignMap.get(account.campaign_id!);
        if (!campaign) { skipped++; continue; }
        if (videoDate < new Date(campaign.start_date)) { skipped++; continue; }
        pending.push({
          tiktok_account_id: account.id,
          tiktok_video_id: String(tiktokVideoId),
          views: playCount,
          likes: diggCount,
          comments: commentCount,
          published_at: createTime,
          account_username: account.username,
          views_cap: campaign.video_views_cap ?? null,
        });
      }
    }

    log(`Step 8: ${pending.length} record da processare (${skipped} skip)`);

    // Step 9: Bulk lookup esistenti (chunk da 500 sui tiktok_video_id)
    // NOTE: the UNIQUE constraint on videos is on tiktok_video_id alone,
    // so a single video can only exist once globally. Dedupe pending by video_id
    // before lookup/insert to avoid batch failures.
    const dedupedPending: PendingRow[] = [];
    const seenVideoIds = new Set<string>();
    for (const p of pending) {
      if (seenVideoIds.has(p.tiktok_video_id)) continue;
      seenVideoIds.add(p.tiktok_video_id);
      dedupedPending.push(p);
    }
    log(`Step 9a: deduped pending ${pending.length} -> ${dedupedPending.length} (per UNIQUE tiktok_video_id)`);

    const existingMap = new Map<string, { id: string; window_expires_at: string | null; window_closed: boolean }>();
    const allVideoIds = [...seenVideoIds];
    const CHUNK = 500;
    for (let i = 0; i < allVideoIds.length; i += CHUNK) {
      const chunk = allVideoIds.slice(i, i + CHUNK);
      const { data: rows, error: selErr } = await supabaseAdmin
        .from("videos")
        .select("id, tiktok_video_id, window_expires_at, window_closed")
        .in("tiktok_video_id", chunk);
      if (selErr) throw new Error(`Errore SELECT esistenti: ${selErr.message}`);
      for (const r of rows || []) {
        existingMap.set(r.tiktok_video_id, {
          id: r.id,
          window_expires_at: r.window_expires_at,
          window_closed: r.window_closed,
        });
      }
    }
    log(`Step 9: ${existingMap.size} video esistenti trovati in DB`);

    // Step 10: split inserts vs updates
    const nowDate = new Date();
    const toInsert: any[] = [];
    type Upd = { id: string; payload: Record<string, unknown>; row: PendingRow };
    const toUpdate: Upd[] = [];

    for (const p of dedupedPending) {
      const existing = existingMap.get(p.tiktok_video_id);
      if (!existing) {
        const windowExpires = new Date(
          new Date(p.published_at).getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();
        toInsert.push({
          tiktok_account_id: p.tiktok_account_id,
          tiktok_video_id: p.tiktok_video_id,
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          published_at: p.published_at,
          window_expires_at: windowExpires,
          window_closed: false,
          views_final: null,
          last_scraped_at: now,
        });
      } else {
        const payload: Record<string, unknown> = {
          views: p.views,
          likes: p.likes,
          comments: p.comments,
          last_scraped_at: now,
        };
        if (
          existing.window_expires_at &&
          new Date(existing.window_expires_at) <= nowDate &&
          !existing.window_closed
        ) {
          payload.window_closed = true;
          payload.views_final = p.views_cap && p.views > p.views_cap ? p.views_cap : p.views;
        }
        toUpdate.push({ id: existing.id, payload, row: p });
      }
      processedAccounts.add(p.tiktok_account_id);
    }

    log(`Step 10: ${toInsert.length} INSERT, ${toUpdate.length} UPDATE`);

    // Step 11: Bulk UPSERT in batch da 200 (onConflict tiktok_video_id, ignora duplicati)
    const INSERT_BATCH = 200;
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const batch = toInsert.slice(i, i + INSERT_BATCH);
      const { error: insErr } = await supabaseAdmin
        .from("videos")
        .upsert(batch, { onConflict: "tiktok_video_id", ignoreDuplicates: true });
      if (insErr) {
        logError(`Batch UPSERT [${i}-${i + batch.length}]: ${insErr.message}`);
      } else {
        totalCreated += batch.length;
        if (detailLogBudget > 0) {
          log(`  Upsert batch ${i}-${i + batch.length}: OK`);
          detailLogBudget--;
        }
      }
    }

    // Step 12: UPDATE paralleli (chunk da 50) — Supabase non supporta bulk update con valori diversi
    const UPDATE_CONCURRENCY = 50;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
      const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((u) =>
          supabaseAdmin.from("videos").update(u.payload).eq("id", u.id)
        )
      );
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "rejected") {
          logError(`UPDATE id=${chunk[j].id}: ${String(r.reason)}`);
        } else if ((r.value as any).error) {
          logError(`UPDATE id=${chunk[j].id}: ${(r.value as any).error.message}`);
        } else {
          totalUpdated++;
        }
      }
    }

    // Step 13: Bulk update last_scraped_at sui tiktok_accounts processati
    if (processedAccounts.size > 0) {
      const accIds = [...processedAccounts];
      for (let i = 0; i < accIds.length; i += 500) {
        const chunk = accIds.slice(i, i + 500);
        const { error: accErr } = await supabaseAdmin
          .from("tiktok_accounts")
          .update({ last_scraped_at: now })
          .in("id", chunk);
        if (accErr) logError(`UPDATE tiktok_accounts.last_scraped_at: ${accErr.message}`);
      }
    }
    accountsProcessed = processedAccounts.size;

    log(`Step 9: COMPLETATO - created: ${totalCreated}, updated: ${totalUpdated}, accounts: ${accountsProcessed}`);

    await supabaseAdmin.from("scraping_logs").insert({
      status: "success",
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: logMessages.join("\n"),
    });

  } catch (err: any) {
    logError(`FATAL: ${err.message}`);
    await supabaseAdmin.from("scraping_logs").insert({
      status: "error",
      accounts_processed: accountsProcessed,
      videos_created: totalCreated,
      videos_updated: totalUpdated,
      error_message: logMessages.join("\n"),
    });
  }
}
