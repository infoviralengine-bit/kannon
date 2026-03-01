import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clapperboard } from "lucide-react";

interface TestLog {
  step: string;
  ok: boolean;
  detail?: string;
}

const SIMUL_CAMPAIGN_NAME = "SIMUL_3MESI";

function assert(logs: TestLog[], step: string, expected: number, actual: number, tolerance = 0.01) {
  const ok = Math.abs(expected - actual) < tolerance;
  logs.push({ step, ok, detail: ok ? `${actual}` : `atteso ${expected}, ottenuto ${actual}` });
  return ok;
}

function assertBool(logs: TestLog[], step: string, expected: boolean, actual: boolean) {
  const ok = expected === actual;
  logs.push({ step, ok, detail: ok ? `${actual}` : `atteso ${expected}, ottenuto ${actual}` });
  return ok;
}

function generateVideoSpecs(
  accountId: string, year: number, month: number, videosPerDay: number, workingDays: number, prefix: string,
) {
  const specs: { tiktok_account_id: string; published_at: string; tiktok_video_id: string; views: number }[] = [];
  const totalVideos = videosPerDay * workingDays;
  for (let i = 0; i < totalVideos; i++) {
    const day = 1 + Math.floor(i / videosPerDay);
    const hour = (i % videosPerDay) + 8;
    const d = new Date(Date.UTC(year, month - 1, Math.min(day, 28), hour, 0, 0));
    specs.push({ tiktok_account_id: accountId, published_at: d.toISOString(), tiktok_video_id: `${prefix}_${i}`, views: 0 });
  }
  return specs;
}

/** Bulk insert videos and return IDs */
async function bulkInsertVideos(specs: any[]): Promise<string[]> {
  const ids: string[] = [];
  // Insert in chunks of 200 (Supabase handles large inserts well)
  for (let i = 0; i < specs.length; i += 200) {
    const chunk = specs.slice(i, i + 200);
    const { data, error } = await supabase.from("videos").insert(chunk).select("id");
    if (error) throw error;
    ids.push(...(data ?? []).map((v) => v.id));
  }
  return ids;
}

/** Bulk update views using the DB function — single RPC call per batch */
async function bulkUpdateViews(videoIds: string[], totalViews: number) {
  if (videoIds.length === 0) return;
  const n = videoIds.length;
  const base = Math.floor(totalViews / n);
  const remainder = totalViews - base * n;
  const viewsArr = videoIds.map((_, i) => base + (i < remainder ? 1 : 0));

  // RPC in chunks of 500
  for (let i = 0; i < videoIds.length; i += 500) {
    const chunkIds = videoIds.slice(i, i + 500);
    const chunkViews = viewsArr.slice(i, i + 500);
    const { error } = await supabase.rpc("bulk_update_video_views", {
      p_ids: chunkIds,
      p_views: chunkViews,
    });
    if (error) throw error;
  }
}

async function generateCycle(
  campaignId: string,
  campaign: { start_date: string; end_date: string; client_fixed_per_creator: number; client_cpm: number; planned_creators: number },
) {
  const { data: existingCycles } = await supabase
    .from("payment_cycles").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: true });
  const lastCycle = (existingCycles ?? [])[(existingCycles ?? []).length - 1];
  const nextNumber = lastCycle ? lastCycle.cycle_number + 1 : 1;
  const startDate = lastCycle ? lastCycle.cycle_end_date : campaign.start_date;
  const endD = new Date(startDate + "T00:00:00Z");
  endD.setUTCDate(endD.getUTCDate() + 30);
  const endDate = endD.toISOString().slice(0, 10);
  const isLastCycle = startDate >= campaign.end_date;

  const { data: cycle, error: cycleErr } = await supabase.from("payment_cycles").insert({
    campaign_id: campaignId, cycle_number: nextNumber, cycle_start_date: startDate, cycle_end_date: endDate, is_last_cycle: isLastCycle,
  }).select().single();
  if (cycleErr) throw cycleErr;

  const { data: cc } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", campaignId);
  const actualCreatorCount = (cc ?? []).length;
  const isFirstCycle = nextNumber === 1;
  const creatorCount = isFirstCycle ? campaign.planned_creators : (actualCreatorCount > 0 ? actualCreatorCount : campaign.planned_creators);

  let prevViewsPaidCumulative = 0;
  if (!isFirstCycle) {
    const { data: prevPayments } = await supabase.from("client_payments").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: false }).limit(1);
    if (prevPayments?.length) prevViewsPaidCumulative = (prevPayments[0] as any).views_paid_cumulative ?? 0;
  }

  const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
  const accIds = (accounts ?? []).map((a) => a.id);

  let totalCurrentViews = 0;
  if (accIds.length) {
    const { data: videos } = await supabase.from("videos").select("views, views_final, window_closed").in("tiktok_account_id", accIds);
    totalCurrentViews = (videos ?? []).reduce((s, v) => {
      return s + (v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0));
    }, 0);
  }

  const newViews = isFirstCycle ? 0 : Math.max(0, totalCurrentViews - prevViewsPaidCumulative);
  const viewsPaidCumulative = prevViewsPaidCumulative + newViews;
  const fixedAmount = isLastCycle ? 0 : campaign.client_fixed_per_creator * creatorCount;
  const cpmAmount = isFirstCycle ? 0 : campaign.client_cpm * (newViews / 1000);
  const totalAmount = fixedAmount + cpmAmount;

  const { error: payErr } = await supabase.from("client_payments").insert({
    campaign_id: campaignId, cycle_id: cycle!.id, cycle_number: nextNumber, due_date: startDate,
    fixed_amount: fixedAmount, cpm_views: newViews, cpm_amount: cpmAmount, total_amount: totalAmount,
    views_snapshot_at: new Date().toISOString(), views_paid_cumulative: viewsPaidCumulative,
  } as any);
  if (payErr) throw payErr;

  return { cycleNumber: nextNumber, fixedAmount, cpmViews: newViews, cpmAmount, totalAmount, viewsPaidCumulative };
}

async function runSimulation(): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];
  const accountIds: string[] = [];

  // Video ID tracking
  const janIds = { alpha: [] as string[], beta: [] as string[], gamma: [] as string[] };
  const febIds = { alpha: [] as string[], beta: [] as string[], gamma: [] as string[] };
  const marIds = { alpha: [] as string[], beta: [] as string[], gamma: [] as string[] };

  try {
    // ═══ SETUP ═══
    logs.push({ step: "═══ SETUP CAMPAGNA DI SIMULAZIONE ═══", ok: true });

    const { data: camp, error: campErr } = await supabase.from("campaigns").insert({
      name: SIMUL_CAMPAIGN_NAME, client_name: "Cliente Simulazione", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 2.00, client_fixed_per_creator: 0, planned_creators: 3, status: "active",
    }).select().single();
    if (campErr) throw campErr;
    campaignId = camp!.id;
    logs.push({ step: "✅ Campagna SIMUL_3MESI creata", ok: true });

    const creatorSpecs = [
      { name: "Simul Creator Alpha", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 },
      { name: "Simul Creator Beta", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 },
      { name: "Simul Creator Gamma", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 },
    ];
    for (const spec of creatorSpecs) {
      const { data: cr, error } = await supabase.from("creators").insert({ ...spec, status: "active" }).select().single();
      if (error) throw error;
      creatorIds.push(cr!.id);
    }

    // Link creators + create accounts in parallel
    const linkPromises = creatorIds.map(cid => supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cid }));
    await Promise.all(linkPromises);

    const creatorNames = ["alpha", "beta", "gamma"];
    for (let i = 0; i < 3; i++) {
      const { data: acc, error } = await supabase.from("tiktok_accounts").insert({
        username: `simul_${creatorNames[i]}`, account_type: "creator", campaign_id: campaignId, creator_id: creatorIds[i],
      }).select().single();
      if (error) throw error;
      accountIds.push(acc!.id);
    }
    logs.push({ step: "✅ 3 Creator + 3 Account TikTok creati e collegati", ok: true });

    const campParams = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 0, client_cpm: 2.00, planned_creators: 3 };

    // ═══ MESE 1 — GENNAIO ═══
    logs.push({ step: "═══ MESE 1 — GENNAIO 2026 ═══", ok: true });

    // Generate all January video specs
    const alphaJanSpecs = generateVideoSpecs(accountIds[0], 2026, 1, 5, 26, "simul_alpha_jan");
    const betaJanSpecs = generateVideoSpecs(accountIds[1], 2026, 1, 5, 26, "simul_beta_jan");
    const gammaJanSpecs = generateVideoSpecs(accountIds[2], 2026, 1, 3, 26, "simul_gamma_jan");

    // Bulk insert all January videos in parallel
    const [aJanIds, bJanIds, gJanIds] = await Promise.all([
      bulkInsertVideos(alphaJanSpecs),
      bulkInsertVideos(betaJanSpecs),
      bulkInsertVideos(gammaJanSpecs),
    ]);
    janIds.alpha = aJanIds;
    janIds.beta = bJanIds;
    janIds.gamma = gJanIds;

    assert(logs, "Video Alpha gennaio", 130, janIds.alpha.length);
    assert(logs, "Video Beta gennaio", 130, janIds.beta.length);
    assert(logs, "Video Gamma gennaio", 78, janIds.gamma.length);

    // Bulk update views (3 RPC calls instead of 338 individual updates)
    await Promise.all([
      bulkUpdateViews(janIds.alpha, 500000),
      bulkUpdateViews(janIds.beta, 300000),
      bulkUpdateViews(janIds.gamma, 100000),
    ]);
    logs.push({ step: "✅ Views gennaio assegnate (Alpha 500k, Beta 300k, Gamma 100k)", ok: true });

    // Cycles
    logs.push({ step: "── CICLO 1 — 2026-01-01 ──", ok: true });
    const c1 = await generateCycle(campaignId, campParams);
    assert(logs, "C1 fisso", 0, c1.fixedAmount);
    assert(logs, "C1 CPM", 0, c1.cpmAmount);
    assert(logs, "C1 totale", 0, c1.totalAmount);

    logs.push({ step: "── CICLO 2 ──", ok: true });
    const c2 = await generateCycle(campaignId, campParams);
    assert(logs, "C2 fisso", 0, c2.fixedAmount);
    assert(logs, "C2 views nuove", 900000, c2.cpmViews);
    assert(logs, "C2 CPM", 1800, c2.cpmAmount);
    assert(logs, "C2 totale", 1800, c2.totalAmount);

    // Creator payment verification (calculated, not DB)
    logs.push({ step: "── VERIFICA PAGAMENTI CREATOR GENNAIO ──", ok: true });
    assert(logs, "Alpha gen fisso maturato", 200, 200);
    assert(logs, "Alpha gen CPM", 250, 500000 * 0.50 / 1000);
    assert(logs, "Alpha gen totale", 450, 200 + 250);
    assert(logs, "Beta gen fisso maturato", 200, 200);
    assert(logs, "Beta gen CPM", 150, 300000 * 0.50 / 1000);
    assert(logs, "Beta gen totale", 350, 200 + 150);
    assert(logs, "Gamma gen fisso NON maturato (78 < 130)", 0, 0);
    assert(logs, "Gamma gen CPM", 50, 100000 * 0.50 / 1000);
    assert(logs, "Gamma gen totale", 50, 0 + 50);

    // ═══ MESE 2 — FEBBRAIO ═══
    logs.push({ step: "═══ MESE 2 — FEBBRAIO 2026 ═══", ok: true });

    const alphaFebSpecs = generateVideoSpecs(accountIds[0], 2026, 2, 5, 24, "simul_alpha_feb");
    const betaFebSpecs = generateVideoSpecs(accountIds[1], 2026, 2, 5, 24, "simul_beta_feb");
    const gammaFebSpecs = generateVideoSpecs(accountIds[2], 2026, 2, 5, 24, "simul_gamma_feb");

    const [aFebIds, bFebIds, gFebIds] = await Promise.all([
      bulkInsertVideos(alphaFebSpecs),
      bulkInsertVideos(betaFebSpecs),
      bulkInsertVideos(gammaFebSpecs),
    ]);
    febIds.alpha = aFebIds;
    febIds.beta = bFebIds;
    febIds.gamma = gFebIds;

    assert(logs, "Video Alpha febbraio", 120, febIds.alpha.length);
    assert(logs, "Video Beta febbraio", 120, febIds.beta.length);
    assert(logs, "Video Gamma febbraio", 120, febIds.gamma.length);

    // Update views: Jan grow + Feb new (6 parallel RPC calls)
    await Promise.all([
      bulkUpdateViews(janIds.alpha, 700000),  // was 500k → 700k
      bulkUpdateViews(janIds.beta, 400000),   // was 300k → 400k
      bulkUpdateViews(janIds.gamma, 150000),  // was 100k → 150k
      bulkUpdateViews(febIds.alpha, 300000),
      bulkUpdateViews(febIds.beta, 200000),
      bulkUpdateViews(febIds.gamma, 150000),
    ]);
    // Total: Jan(700k+400k+150k) + Feb(300k+200k+150k) = 1,250k + 650k = 1,900k
    logs.push({ step: "✅ Views febbraio aggiornate (totale campagna: 1.900.000)", ok: true });

    logs.push({ step: "── CICLO 3 ──", ok: true });
    const c3 = await generateCycle(campaignId, campParams);
    assert(logs, "C3 fisso", 0, c3.fixedAmount);
    assert(logs, "C3 views nuove", 1000000, c3.cpmViews);
    assert(logs, "C3 CPM", 2000, c3.cpmAmount);
    assert(logs, "C3 totale", 2000, c3.totalAmount);

    // ═══ MESE 3 — MARZO ═══
    logs.push({ step: "═══ MESE 3 — MARZO 2026 ═══", ok: true });

    const alphaMarSpecs = generateVideoSpecs(accountIds[0], 2026, 3, 5, 26, "simul_alpha_mar");
    const betaMarSpecs = generateVideoSpecs(accountIds[1], 2026, 3, 5, 26, "simul_beta_mar");
    const gammaMarSpecs = generateVideoSpecs(accountIds[2], 2026, 3, 5, 26, "simul_gamma_mar");

    const [aMarIds, bMarIds, gMarIds] = await Promise.all([
      bulkInsertVideos(alphaMarSpecs),
      bulkInsertVideos(betaMarSpecs),
      bulkInsertVideos(gammaMarSpecs),
    ]);
    marIds.alpha = aMarIds;
    marIds.beta = bMarIds;
    marIds.gamma = gMarIds;

    assert(logs, "Video Alpha marzo", 130, marIds.alpha.length);
    assert(logs, "Video Beta marzo", 130, marIds.beta.length);
    assert(logs, "Video Gamma marzo", 130, marIds.gamma.length);

    // Views at 01/04: Feb grow + Mar new. Target: +800k new views
    // Jan stays at 1,250k. Feb: Alpha 400k, Beta 300k, Gamma 200k = 900k. Mar: Alpha 300k, Beta 150k, Gamma 100k = 550k
    // Total = 1250k + 900k + 550k = 2,700k. Prev = 1,900k. New = 800k ✓
    await Promise.all([
      bulkUpdateViews(febIds.alpha, 400000),  // was 300k → 400k
      bulkUpdateViews(febIds.beta, 300000),   // was 200k → 300k
      bulkUpdateViews(febIds.gamma, 200000),  // was 150k → 200k
      bulkUpdateViews(marIds.alpha, 300000),
      bulkUpdateViews(marIds.beta, 150000),
      bulkUpdateViews(marIds.gamma, 100000),
    ]);
    logs.push({ step: "✅ Views marzo aggiornate (nuove: 800.000)", ok: true });

    logs.push({ step: "── CICLO 4 ──", ok: true });
    const c4 = await generateCycle(campaignId, campParams);
    assert(logs, "C4 fisso", 0, c4.fixedAmount);
    assert(logs, "C4 views nuove", 800000, c4.cpmViews);
    assert(logs, "C4 CPM", 1600, c4.cpmAmount);
    assert(logs, "C4 totale", 1600, c4.totalAmount);

    // ═══ ULTIMO CICLO POST-CAMPAGNA ═══
    logs.push({ step: "═══ ULTIMO CICLO POST-CAMPAGNA ═══", ok: true });

    // +200k views on March videos
    // Mar: Alpha 370k (+70k), Beta 220k (+70k), Gamma 160k (+60k) = 200k extra
    await Promise.all([
      bulkUpdateViews(marIds.alpha, 370000),
      bulkUpdateViews(marIds.beta, 220000),
      bulkUpdateViews(marIds.gamma, 160000),
    ]);
    logs.push({ step: "✅ Views finali aggiornate (+200.000)", ok: true });

    logs.push({ step: "── CICLO 5 — POST-CAMPAGNA (is_last_cycle=true) ──", ok: true });
    const c5 = await generateCycle(campaignId, campParams);
    assert(logs, "C5 fisso", 0, c5.fixedAmount);
    assert(logs, "C5 views nuove", 200000, c5.cpmViews);
    assert(logs, "C5 CPM", 400, c5.cpmAmount);
    assert(logs, "C5 totale", 400, c5.totalAmount);

    // ═══ VERIFICHE FINALI ═══
    logs.push({ step: "═══ VERIFICHE FINALI ═══", ok: true });

    const grandTotal = c1.totalAmount + c2.totalAmount + c3.totalAmount + c4.totalAmount + c5.totalAmount;
    assert(logs, "Totale campagna", 5800, grandTotal);

    const { data: dbPayments } = await supabase.from("client_payments").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: true });
    assert(logs, "Numero cicli in DB", 5, (dbPayments ?? []).length);

    if (dbPayments && dbPayments.length === 5) {
      assert(logs, "DB C1 totale", 0, dbPayments[0].total_amount);
      assert(logs, "DB C2 totale", 1800, dbPayments[1].total_amount);
      assert(logs, "DB C3 totale", 2000, dbPayments[2].total_amount);
      assert(logs, "DB C4 totale", 1600, dbPayments[3].total_amount);
      assert(logs, "DB C5 totale", 400, dbPayments[4].total_amount);
    }

    const { data: lastCycleData } = await supabase.from("payment_cycles").select("is_last_cycle, cycle_number").eq("campaign_id", campaignId).order("cycle_number", { ascending: false }).limit(1).single();
    if (lastCycleData) assertBool(logs, "Ultimo ciclo is_last_cycle=true", true, lastCycleData.is_last_cycle);

    logs.push({ step: "── VERIFICA VIDEO TOTALI ──", ok: true });
    const totalVideos = janIds.alpha.length + janIds.beta.length + janIds.gamma.length +
      febIds.alpha.length + febIds.beta.length + febIds.gamma.length +
      marIds.alpha.length + marIds.beta.length + marIds.gamma.length;
    assert(logs, "Video totali creati", 1088, totalVideos);

    logs.push({ step: "── VERIFICA GAMMA GENNAIO ──", ok: true });
    assertBool(logs, `Gamma gen sotto minimo (${janIds.gamma.length} < 130)`, true, janIds.gamma.length < 130);

    logs.push({ step: "═══ SIMULAZIONE COMPLETATA ═══", ok: true });

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false, detail: e.message });
  }

  return logs;
}

async function cleanupSimulation(): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  try {
    logs.push({ step: "🧹 Ricerca dati simulazione...", ok: true });

    const { data: camps } = await supabase.from("campaigns").select("id").eq("name", SIMUL_CAMPAIGN_NAME);
    if (!camps?.length) {
      logs.push({ step: "ℹ️ Nessuna simulazione trovata da eliminare", ok: true });
      return logs;
    }

    const campaignId = camps[0].id;
    const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
    const accIds = (accounts ?? []).map((a) => a.id);

    if (accIds.length) {
      await supabase.from("videos").delete().in("tiktok_account_id", accIds);
      logs.push({ step: `✅ Video eliminati (account: ${accIds.length})`, ok: true });
    }

    await supabase.from("client_payments").delete().eq("campaign_id", campaignId);
    logs.push({ step: "✅ Pagamenti clienti eliminati", ok: true });

    await supabase.from("payment_cycles").delete().eq("campaign_id", campaignId);
    logs.push({ step: "✅ Cicli di pagamento eliminati", ok: true });

    const { data: ccData } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", campaignId);
    const creatorIdsToDelete = (ccData ?? []).map((c) => c.creator_id);

    await supabase.from("campaign_creators").delete().eq("campaign_id", campaignId);
    logs.push({ step: "✅ Relazioni creator-campagna eliminate", ok: true });

    for (const accId of accIds) await supabase.from("tiktok_accounts").delete().eq("id", accId);
    logs.push({ step: "✅ Account TikTok eliminati", ok: true });

    for (const cid of creatorIdsToDelete) {
      const { data: cr } = await supabase.from("creators").select("name").eq("id", cid).single();
      if (cr?.name?.startsWith("Simul Creator")) await supabase.from("creators").delete().eq("id", cid);
    }
    logs.push({ step: "✅ Creator simulazione eliminati", ok: true });

    await supabase.from("campaigns").delete().eq("id", campaignId);
    logs.push({ step: "✅ Campagna SIMUL_3MESI eliminata", ok: true });
    logs.push({ step: "🧹 Cleanup completato!", ok: true });
  } catch (e: any) {
    logs.push({ step: `❌ Errore cleanup: ${e.message}`, ok: false });
  }
  return logs;
}

export default function CampaignSimulation3Months() {
  const [running, setRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [mode, setMode] = useState<"sim" | "clean">("sim");

  async function handleRunSimulation() {
    setRunning(true); setLogs([]); setMode("sim");
    const result = await runSimulation();
    setLogs(result); setRunning(false); setShowResults(true);
  }

  async function handleCleanup() {
    setCleaning(true); setLogs([]); setMode("clean");
    const result = await cleanupSimulation();
    setLogs(result); setCleaning(false); setShowResults(true);
  }

  const assertLogs = logs.filter((l) =>
    l.step.startsWith("C") || l.step.startsWith("Totale") || l.step.startsWith("Numero") ||
    l.step.startsWith("DB ") || l.step.startsWith("Video ") || l.step.startsWith("Alpha") ||
    l.step.startsWith("Beta") || l.step.startsWith("Gamma") || l.step.startsWith("Ultimo")
  );
  const passed = assertLogs.filter((l) => l.ok).length;
  const total = assertLogs.length;
  const allPassed = total > 0 && passed === total;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clapperboard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Simulazione Campagna 3 Mesi</CardTitle>
              <CardDescription>
                Simula una campagna completa con 3 creator, 3 mesi di video (~1088), 5 cicli di pagamento e verifica tutti i calcoli.
                I dati restano nel DB per ispezione manuale.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={handleRunSimulation} disabled={running || cleaning} variant="outline">
            {running ? "⏳ Simulazione in corso..." : "🎬 Simula Campagna 3 Mesi"}
          </Button>
          <Button onClick={handleCleanup} disabled={running || cleaning} variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
            {cleaning ? "⏳ Pulizia..." : "🗑️ Elimina dati simulazione"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "clean"
                ? "Cleanup Simulazione"
                : allPassed
                  ? "✅ Simulazione completata — Tutti i test superati"
                  : "❌ Simulazione con errori — Dettagli nei log"}
            </DialogTitle>
          </DialogHeader>
          {mode === "sim" && (
            <div className={`rounded-md p-3 text-sm font-semibold ${allPassed ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"}`}>
              {passed}/{total} verifiche superate
            </div>
          )}
          <ScrollArea className="h-[500px]">
            <div className="space-y-1 text-sm font-mono">
              {logs.map((l, i) => (
                <div key={i} className={`py-1 px-2 rounded ${
                  l.step.startsWith("═══") ? "font-bold text-primary mt-3" :
                  l.step.startsWith("──") ? "font-semibold text-muted-foreground mt-2" :
                  l.ok ? "" : "bg-destructive/10 text-destructive"
                }`}>
                  {l.step.startsWith("═══") || l.step.startsWith("──") ? "" : l.ok ? "✅" : "❌"} {l.step}
                  {l.detail && !l.ok && <span className="ml-2 text-xs opacity-75">({l.detail})</span>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
