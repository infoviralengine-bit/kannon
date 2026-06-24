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

// ---------------------------------------------------------------------------
// Apify token
// ---------------------------------------------------------------------------
async function getApifyApiToken(supabaseAdmin: any) {
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
  return apiToken;
}

// ---------------------------------------------------------------------------
// scraping_logs helpers
// ---------------------------------------------------------------------------
async function createLog(
  supabaseAdmin: any,
  { runId, datasetId, triggeredBy }: { runId: string | null; datasetId: string | null; triggeredBy: string | null }
) {
  const { data, error } = await supabaseAdmin
    .from("scraping_logs")
    .insert({
      run_id: runId,
      dataset_id: datasetId,
      status: "running",
      started_at: new Date().toISOString(),
      progress_note: "Run Apify avviato",
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Log creation failed: ${error.message}`);
  return data.id as string;
}

async function updateLog(supabaseAdmin: any, logId: string, patch: Record<string, unknown>) {
  await supabaseAdmin.from("scraping_logs").update(patch).eq("id", logId);
}

async function finalizeLog(
  supabaseAdmin: any,
  logId: string,
  result: {
    status: "success" | "error";
    accounts_processed?: number;
    videos_created?: number;
    videos_updated?: number;
    error_message?: string | null;
    progress_note?: string | null;
    dataset_id?: string | null;
  }
) {
  await supabaseAdmin
    .from("scraping_logs")
    .update({
      status: result.status,
      completed_at: new Date().toISOString(),
      accounts_processed: result.accounts_processed ?? 0,
      videos_created: result.videos_created ?? 0,
      videos_updated: result.videos_updated ?? 0,
      error_message: result.error_message ?? null,
      progress_note: result.progress_note ?? null,
      dataset_id: result.dataset_id ?? null,
    })
    .eq("id", logId);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function verifyAdminCaller(req: Request, supabaseAdmin: any): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (token === serviceRoleKey) {
    return null; // service role / cron
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: claimsData, error: claimsErr } = await userClient.auth.getUser();
  if (claimsErr || !claimsData?.user) {
    throw new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roleData } = await supabaseAdmin.rpc("get_user_role", { _user_id: claimsData.user.id });
  if (roleData !== "admin" && roleData !== "team" && roleData !== "campaign_manager") {
    throw new Response(JSON.stringify({ ok: false, error: "Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return claimsData.user.id;
}

// ---------------------------------------------------------------------------
// Start an Apify run WITHOUT webhook (polling handles completion).
// ---------------------------------------------------------------------------
async function startApifyRun(supabaseAdmin: any) {
  const apiToken = await getApifyApiToken(supabaseAdmin);
  const { data: accounts } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("username, campaign_id")
    .eq("account_type", "creator")
    .not("campaign_id", "is", null)
    .eq("is_active", true);

  const profiles = [
    ...new Set((accounts ?? []).map((a: any) => normalizeTikTokUsername(a.username)).filter(Boolean)),
  ];
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

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${apiToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apifyInput),
    }
  );
  if (!runRes.ok) {
    const errText = await runRes.text();
    throw new Error(`Apify run failed (${runRes.status}): ${errText}`);
  }
  const runData = await runRes.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("No run ID returned from Apify");

  return {
    runId: runId as string,
    datasetId: (runData.data?.defaultDatasetId ?? null) as string | null,
    profilesCount: profiles.length,
  };
}

// ---------------------------------------------------------------------------
// Path C: "Scrapa ora" -> background polling
// ---------------------------------------------------------------------------
async function handleStartWithPolling(supabaseAdmin: any, req: Request) {
  const callerId = await verifyAdminCaller(req, supabaseAdmin);
  const started = await startApifyRun(supabaseAdmin);
  const logId = await createLog(supabaseAdmin, {
    runId: started.runId,
    datasetId: started.datasetId,
    triggeredBy: callerId,
  });
  EdgeRuntime.waitUntil(pollAndProcess(supabaseAdmin, logId, started.runId));
  return new Response(
    JSON.stringify({
      ok: true,
      log_id: logId,
      run_id: started.runId,
      message: `Scraping avviato. Run ${started.runId}. Polling in corso.`,
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function pollAndProcess(supabaseAdmin: any, logId: string, runId: string) {
  const apiToken = await getApifyApiToken(supabaseAdmin);
  const maxWait = 15 * 60 * 1000;
  const start = Date.now();
  let iter = 0;
  let datasetId: string | null = null;

  try {
    while (Date.now() - start < maxWait) {
      iter++;
      await new Promise((r) => setTimeout(r, 10_000));

      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
      if (!statusRes.ok) {
        await updateLog(supabaseAdmin, logId, {
          progress_note: `Polling iter ${iter}: HTTP ${statusRes.status}, retry...`,
        });
        continue;
      }
      const statusData = await statusRes.json();
      const runStatus = statusData.data?.status as string;
      datasetId = statusData.data?.defaultDatasetId || datasetId;

      await updateLog(supabaseAdmin, logId, {
        progress_note: `Polling iter ${iter}: Apify status=${runStatus}`,
        dataset_id: datasetId,
      });

      if (runStatus === "SUCCEEDED") {
        await updateLog(supabaseAdmin, logId, { progress_note: `Processing dataset ${datasetId}...` });
        const result = await runScraping(supabaseAdmin, datasetId!);
        await finalizeLog(supabaseAdmin, logId, {
          status: "success",
          accounts_processed: result.accounts_processed,
          videos_created: result.videos_created,
          videos_updated: result.videos_updated,
          dataset_id: datasetId,
          progress_note: `Completato. ${result.accounts_processed} account, ${result.videos_created} nuovi, ${result.videos_updated} aggiornati.`,
        });
        return;
      }

      if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
        await finalizeLog(supabaseAdmin, logId, {
          status: "error",
          dataset_id: datasetId,
          error_message: `Apify run ended with status: ${runStatus}`,
          progress_note: `Run terminato con stato ${runStatus} dopo ${iter} iterazioni.`,
        });
        return;
      }
      // else READY/RUNNING -> continue
    }

    await finalizeLog(supabaseAdmin, logId, {
      status: "error",
      dataset_id: datasetId,
      error_message: `Timeout polling dopo ${iter} iterazioni`,
      progress_note: `Polling abortito dopo ${maxWait / 1000}s. Usa "Importa dataset" con id=${datasetId ?? "unknown"} se il run completa più tardi.`,
    });
  } catch (err: any) {
    await finalizeLog(supabaseAdmin, logId, {
      status: "error",
      dataset_id: datasetId,
      error_message: `Polling exception: ${err.message}`,
      progress_note: "Exception durante polling, vedi error_message",
    });
  }
}

// ---------------------------------------------------------------------------
// Path B: manual dataset import
// ---------------------------------------------------------------------------
async function handleManualImport(supabaseAdmin: any, datasetId: string, req: Request) {
  const callerId = await verifyAdminCaller(req, supabaseAdmin);
  const logId = await createLog(supabaseAdmin, { runId: null, datasetId, triggeredBy: callerId });
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await updateLog(supabaseAdmin, logId, { progress_note: `Import dataset ${datasetId}...` });
        const result = await runScraping(supabaseAdmin, datasetId);
        await finalizeLog(supabaseAdmin, logId, {
          status: "success",
          accounts_processed: result.accounts_processed,
          videos_created: result.videos_created,
          videos_updated: result.videos_updated,
          dataset_id: datasetId,
          progress_note: `Import completato. ${result.accounts_processed} account, ${result.videos_created} nuovi, ${result.videos_updated} aggiornati.`,
        });
      } catch (err: any) {
        await finalizeLog(supabaseAdmin, logId, {
          status: "error",
          dataset_id: datasetId,
          error_message: err.message,
          progress_note: "Import fallito, vedi error_message",
        });
      }
    })()
  );
  return new Response(
    JSON.stringify({ ok: true, log_id: logId, message: `Import dataset ${datasetId} avviato.` }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Path A: Apify webhook fallback (idempotent secondary)
// ---------------------------------------------------------------------------
async function handleWebhookFallback(supabaseAdmin: any, body: any) {
  const webhookSecret = Deno.env.get("APIFY_WEBHOOK_SECRET");
  if (webhookSecret && body?.webhookToken && body.webhookToken !== webhookSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized webhook" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = (body?.runId || body?.eventData?.actorRunId || body?.resource?.id || null) as string | null;
  const datasetId = (body?.defaultDatasetId ||
    body?.resource?.defaultDatasetId ||
    body?.resource?.storageIds?.datasets?.default ||
    null) as string | null;

  // If a log already exists for this run and is still running, the poller owns it.
  if (runId) {
    const { data: existing } = await supabaseAdmin
      .from("scraping_logs")
      .select("id, status")
      .eq("run_id", runId)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && (existing.status === "running" || existing.status === "success")) {
      return new Response(
        JSON.stringify({ ok: true, message: "Run già gestito dal polling, webhook ignorato (idempotente)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  if (!datasetId) {
    return new Response(JSON.stringify({ ok: false, error: "Dataset Apify non trovato nel webhook" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const logId = await createLog(supabaseAdmin, { runId, datasetId, triggeredBy: null });
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        const result = await runScraping(supabaseAdmin, datasetId);
        await finalizeLog(supabaseAdmin, logId, {
          status: "success",
          accounts_processed: result.accounts_processed,
          videos_created: result.videos_created,
          videos_updated: result.videos_updated,
          dataset_id: datasetId,
          progress_note: `Webhook fallback completato. ${result.videos_created} nuovi, ${result.videos_updated} aggiornati.`,
        });
      } catch (err: any) {
        await finalizeLog(supabaseAdmin, logId, {
          status: "error",
          dataset_id: datasetId,
          error_message: err.message,
        });
      }
    })()
  );
  return new Response(JSON.stringify({ ok: true, message: `Webhook fallback: import dataset ${datasetId} avviato.` }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  try {
    if (body?.source === "apify-webhook" || body?.eventType === "ACTOR.RUN.SUCCEEDED") {
      return await handleWebhookFallback(supabaseAdmin, body);
    }
    if (body?.datasetId) {
      return await handleManualImport(supabaseAdmin, body.datasetId, req);
    }
    return await handleStartWithPolling(supabaseAdmin, req);
  } catch (err) {
    // verifyAdminCaller throws a Response for auth failures.
    if (err instanceof Response) return err;
    return new Response(JSON.stringify({ ok: false, error: (err as any)?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------------
// Dataset processing: fetch items, normalize, upsert. Returns counts.
// Does NOT write scraping_logs (the orchestrator owns that).
// ---------------------------------------------------------------------------
async function runScraping(
  supabaseAdmin: any,
  datasetId: string
): Promise<{ accounts_processed: number; videos_created: number; videos_updated: number }> {
  let totalCreated = 0;
  let totalUpdated = 0;
  const apiToken = await getApifyApiToken(supabaseAdmin);

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, username, campaign_id, is_active")
    .eq("account_type", "creator")
    .not("campaign_id", "is", null)
    .eq("is_active", true);
  if (accErr) throw new Error(`Errore query account: ${accErr.message}`);
  if (!accounts || accounts.length === 0) {
    return { accounts_processed: 0, videos_created: 0, videos_updated: 0 };
  }

  const campaignIds = [...new Set(accounts.map((a: any) => a.campaign_id))];
  const { data: campaignsData } = await supabaseAdmin
    .from("campaigns")
    .select("id, start_date, video_views_cap")
    .in("id", campaignIds);
  const campaignMap = new Map((campaignsData || []).map((c: any) => [c.id, c]));

  const usernameToAccounts = new Map<string, any[]>();
  for (const account of accounts) {
    const cleanUsername = normalizeTikTokUsername(account.username);
    if (!usernameToAccounts.has(cleanUsername)) usernameToAccounts.set(cleanUsername, []);
    usernameToAccounts.get(cleanUsername)!.push(account);
  }

  // Fetch dataset items (paginated)
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
      throw new Error(`Apify items page non è un array. Tipo: ${typeof pageData}.`);
    }
    items.push(...pageData);
    if (pageData.length < PAGE) break;
    offset += PAGE;
    if (offset > 50000) break;
  }
  const now = new Date().toISOString();

  if (items.length > 0 && items.every((item) => item?.noResults === true)) {
    throw new Error("Apify ha restituito solo record { noResults: true } (actor in modalità DEMO/API-disabled).");
  }

  type PendingRow = {
    tiktok_account_id: string;
    tiktok_video_id: string;
    views: number;
    likes: number;
    comments: number;
    published_at: string;
    views_cap: number | null;
    audio_id: string | null;
    audio_name: string | null;
    caption: string | null;
    hashtags: string[] | null;
  };
  const pending: PendingRow[] = [];

  for (const item of items) {
    const tiktokVideoId = item?.id;
    if (!tiktokVideoId) continue;
    const authorUsername = (item.authorMeta?.name || item.authorMeta?.nickName || "")
      .toLowerCase()
      .replace(/^@/, "");
    if (!authorUsername) continue;
    const matchedAccounts = usernameToAccounts.get(authorUsername);
    if (!matchedAccounts || matchedAccounts.length === 0) continue;

    const playCount = item.playCount ?? 0;
    const diggCount = item.diggCount ?? 0;
    const commentCount = item.commentCount ?? 0;
    const createTime = item.createTime ? new Date(item.createTime * 1000).toISOString() : now;
    const videoDate = new Date(createTime);

    const audioId = item.musicMeta?.musicId ? String(item.musicMeta.musicId) : null;
    const audioName = item.musicMeta?.musicName ? String(item.musicMeta.musicName) : null;
    const caption = typeof item.text === "string" ? item.text : null;
    const hashtags = Array.isArray(item.hashtags)
      ? item.hashtags
          .map((h: any) => (typeof h?.name === "string" ? h.name : null))
          .filter((h: string | null): h is string => !!h)
      : null;

    for (const account of matchedAccounts) {
      const campaign = campaignMap.get(account.campaign_id) as any;
      if (!campaign) continue;
      if (videoDate < new Date(campaign.start_date)) continue;
      pending.push({
        tiktok_account_id: account.id,
        tiktok_video_id: String(tiktokVideoId),
        views: playCount,
        likes: diggCount,
        comments: commentCount,
        published_at: createTime,
        views_cap: campaign.video_views_cap ?? null,
        audio_id: audioId,
        audio_name: audioName,
        caption,
        hashtags: hashtags && hashtags.length > 0 ? hashtags : null,
      });
    }
  }

  // Dedupe by tiktok_video_id (UNIQUE constraint is global)
  const dedupedPending: PendingRow[] = [];
  const seenVideoIds = new Set<string>();
  for (const p of pending) {
    if (seenVideoIds.has(p.tiktok_video_id)) continue;
    seenVideoIds.add(p.tiktok_video_id);
    dedupedPending.push(p);
  }

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

  const nowDate = new Date();
  const toInsert: any[] = [];
  type Upd = { id: string; payload: Record<string, unknown> };
  const toUpdate: Upd[] = [];
  const processedAccounts = new Set<string>();

  for (const p of dedupedPending) {
    const existing = existingMap.get(p.tiktok_video_id);
    if (!existing) {
      const windowExpires = new Date(new Date(p.published_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
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
        audio_id: p.audio_id,
        audio_name: p.audio_name,
        caption: p.caption,
        hashtags: p.hashtags,
      });
    } else {
      const payload: Record<string, unknown> = {
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        last_scraped_at: now,
      };
      if (p.audio_id !== null) payload.audio_id = p.audio_id;
      if (p.audio_name !== null) payload.audio_name = p.audio_name;
      if (p.caption !== null) payload.caption = p.caption;
      if (p.hashtags !== null) payload.hashtags = p.hashtags;
      if (
        existing.window_expires_at &&
        new Date(existing.window_expires_at) <= nowDate &&
        !existing.window_closed
      ) {
        payload.window_closed = true;
        payload.views_final = p.views_cap && p.views > p.views_cap ? p.views_cap : p.views;
      }
      toUpdate.push({ id: existing.id, payload });
    }
    processedAccounts.add(p.tiktok_account_id);
  }

  const INSERT_BATCH = 200;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const batch = toInsert.slice(i, i + INSERT_BATCH);
    const { error: insErr } = await supabaseAdmin
      .from("videos")
      .upsert(batch, { onConflict: "tiktok_video_id", ignoreDuplicates: true });
    if (!insErr) totalCreated += batch.length;
    else console.error(`Batch UPSERT error: ${insErr.message}`);
  }

  const UPDATE_CONCURRENCY = 50;
  for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
    const chunk = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((u) => supabaseAdmin.from("videos").update(u.payload).eq("id", u.id))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && !(r.value as any).error) totalUpdated++;
    }
  }

  if (processedAccounts.size > 0) {
    const accIds = [...processedAccounts];
    for (let i = 0; i < accIds.length; i += 500) {
      const chunk = accIds.slice(i, i + 500);
      await supabaseAdmin.from("tiktok_accounts").update({ last_scraped_at: now }).in("id", chunk);
    }
  }

  return {
    accounts_processed: processedAccounts.size,
    videos_created: totalCreated,
    videos_updated: totalUpdated,
  };
}
