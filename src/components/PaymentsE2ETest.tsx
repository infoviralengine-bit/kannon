import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlaskConical } from "lucide-react";

interface TestLog {
  step: string;
  ok: boolean;
  detail?: string;
}

function assert(logs: TestLog[], step: string, expected: number, actual: number) {
  const ok = Math.abs(expected - actual) < 0.01;
  logs.push({
    step,
    ok,
    detail: ok ? `${actual}` : `atteso ${expected}, ottenuto ${actual}`,
  });
  return ok;
}

async function generateCycle(campaignId: string, campaign: { start_date: string; end_date: string; client_fixed_per_creator: number; client_cpm: number; planned_creators: number }) {
  // Replicate the exact logic from CampaignDetailPage
  const { data: existingCycles } = await supabase.from("payment_cycles").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: true });
  const lastCycle = (existingCycles ?? [])[(existingCycles ?? []).length - 1];
  const nextNumber = lastCycle ? lastCycle.cycle_number + 1 : 1;

  let startDate: string;
  if (lastCycle) {
    startDate = lastCycle.cycle_end_date;
  } else {
    startDate = campaign.start_date;
  }

  const endD = new Date(startDate);
  endD.setDate(endD.getDate() + 30);
  const endDate = endD.toISOString().slice(0, 10);

  const isLastCycle = startDate >= campaign.end_date;

  const { data: cycle, error: cycleErr } = await supabase.from("payment_cycles").insert({
    campaign_id: campaignId,
    cycle_number: nextNumber,
    cycle_start_date: startDate,
    cycle_end_date: endDate,
    is_last_cycle: isLastCycle,
  }).select().single();
  if (cycleErr) throw cycleErr;

  const { data: cc } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", campaignId);
  const actualCreatorCount = (cc ?? []).length;
  const isFirstCycle = nextNumber === 1;
  const creatorCount = isFirstCycle ? campaign.planned_creators : (actualCreatorCount > 0 ? actualCreatorCount : campaign.planned_creators);

  // Get views_paid_cumulative from previous payment
  let prevViewsPaidCumulative = 0;
  if (!isFirstCycle) {
    const { data: prevPayments } = await supabase.from("client_payments").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: false }).limit(1);
    if (prevPayments?.length) {
      prevViewsPaidCumulative = (prevPayments[0] as any).views_paid_cumulative ?? 0;
    }
  }

  const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
  const accIds = (accounts ?? []).map((a) => a.id);

  let totalCurrentViews = 0;
  if (accIds.length) {
    const { data: videos } = await supabase.from("videos").select("views, views_final, window_closed").in("tiktok_account_id", accIds);
    totalCurrentViews = (videos ?? []).reduce((s, v) => {
      const effectiveViews = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
      return s + effectiveViews;
    }, 0);
  }

  const newViews = isFirstCycle ? 0 : Math.max(0, totalCurrentViews - prevViewsPaidCumulative);
  const viewsPaidCumulative = prevViewsPaidCumulative + newViews;
  const fixedAmount = isLastCycle ? 0 : campaign.client_fixed_per_creator * creatorCount;
  const cpmAmount = isFirstCycle ? 0 : campaign.client_cpm * (newViews / 1000);
  const totalAmount = fixedAmount + cpmAmount;

  const { error: payErr } = await supabase.from("client_payments").insert({
    campaign_id: campaignId,
    cycle_id: cycle!.id,
    cycle_number: nextNumber,
    due_date: startDate,
    fixed_amount: fixedAmount,
    cpm_views: newViews,
    cpm_amount: cpmAmount,
    total_amount: totalAmount,
    views_snapshot_at: new Date().toISOString(),
    views_paid_cumulative: viewsPaidCumulative,
  } as any);
  if (payErr) throw payErr;

  return { cycleNumber: nextNumber, fixedAmount, cpmViews: newViews, cpmAmount, totalAmount, viewsPaidCumulative };
}

async function runE2ETest(): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];
  const accountIds: string[] = [];
  const videoIds: string[] = [];

  try {
    // ── SETUP ──
    logs.push({ step: "🔧 Setup dati di test...", ok: true });

    const { data: camp, error: campErr } = await supabase.from("campaigns").insert({
      name: "TEST_E2E",
      client_name: "Test Client E2E",
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      client_cpm: 2.00,
      client_fixed_per_creator: 100.00,
      planned_creators: 2,
      status: "active",
    }).select().single();
    if (campErr) throw campErr;
    campaignId = camp!.id;

    // Create 2 creators
    for (const name of ["Creator E2E Alpha", "Creator E2E Beta"]) {
      const { data: cr, error } = await supabase.from("creators").insert({
        name, status: "active", creator_fixed: 200, creator_cpm: 0.5, min_videos_per_day: 5,
      }).select().single();
      if (error) throw error;
      creatorIds.push(cr!.id);
    }

    // Link creators to campaign
    for (const cid of creatorIds) {
      const { error } = await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cid });
      if (error) throw error;
    }

    // Create TikTok accounts
    for (let i = 0; i < 2; i++) {
      const { data: acc, error } = await supabase.from("tiktok_accounts").insert({
        username: `test_e2e_${i}`,
        account_type: "creator",
        campaign_id: campaignId,
        creator_id: creatorIds[i],
      }).select().single();
      if (error) throw error;
      accountIds.push(acc!.id);
    }

    // Create videos
    const videoSpecs = [
      { tiktok_account_id: accountIds[0], published_at: "2026-01-01T00:00:00Z", tiktok_video_id: "test_e2e_vid_a", views: 0 },
      { tiktok_account_id: accountIds[1], published_at: "2026-01-15T00:00:00Z", tiktok_video_id: "test_e2e_vid_b", views: 0 },
      { tiktok_account_id: accountIds[0], published_at: "2026-02-01T00:00:00Z", tiktok_video_id: "test_e2e_vid_c", views: 0 },
    ];
    for (const spec of videoSpecs) {
      const { data: vid, error } = await supabase.from("videos").insert(spec).select().single();
      if (error) throw error;
      videoIds.push(vid!.id);
    }

    logs.push({ step: "✅ Setup completato: campagna, 2 creator, 2 account, 3 video", ok: true });

    const campParams = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 100, client_cpm: 2, planned_creators: 2 };

    // ── CICLO 1 ──
    logs.push({ step: "── CICLO 1 — 2026-01-01 ──", ok: true });
    const c1 = await generateCycle(campaignId, campParams);
    assert(logs, "C1 fisso", 200, c1.fixedAmount);
    assert(logs, "C1 CPM", 0, c1.cpmAmount);
    assert(logs, "C1 totale", 200, c1.totalAmount);

    // ── SIMULA VIEWS FINE GENNAIO ──
    logs.push({ step: "📊 Simulazione views fine gennaio...", ok: true });
    await supabase.from("videos").update({ views: 20000 }).eq("id", videoIds[0]);
    await supabase.from("videos").update({ views: 5000 }).eq("id", videoIds[1]);
    await supabase.from("videos").update({ views: 0 }).eq("id", videoIds[2]);

    // ── CICLO 2 ──
    logs.push({ step: "── CICLO 2 — 2026-02-01 ──", ok: true });
    const c2 = await generateCycle(campaignId, campParams);
    assert(logs, "C2 fisso", 200, c2.fixedAmount);
    assert(logs, "C2 views nuove", 25000, c2.cpmViews);
    assert(logs, "C2 CPM", 50, c2.cpmAmount);
    assert(logs, "C2 totale", 250, c2.totalAmount);
    assert(logs, "C2 views_paid_cumulative", 25000, c2.viewsPaidCumulative);

    // ── SIMULA VIEWS FINE FEBBRAIO ──
    logs.push({ step: "📊 Simulazione views fine febbraio...", ok: true });
    await supabase.from("videos").update({ views: 80000 }).eq("id", videoIds[0]);
    await supabase.from("videos").update({ views: 10000 }).eq("id", videoIds[1]);
    await supabase.from("videos").update({ views: 15000 }).eq("id", videoIds[2]);

    // ── CICLO 3 ──
    logs.push({ step: "── CICLO 3 — 2026-03-01 ──", ok: true });
    const c3 = await generateCycle(campaignId, campParams);
    assert(logs, "C3 fisso", 200, c3.fixedAmount);
    assert(logs, "C3 views nuove", 80000, c3.cpmViews);
    assert(logs, "C3 CPM", 160, c3.cpmAmount);
    assert(logs, "C3 totale", 360, c3.totalAmount);
    assert(logs, "C3 views_paid_cumulative", 105000, c3.viewsPaidCumulative);

    // ── SIMULA VIEWS FINE MARZO ──
    logs.push({ step: "📊 Simulazione views fine marzo...", ok: true });
    await supabase.from("videos").update({ views: 100000 }).eq("id", videoIds[0]);
    await supabase.from("videos").update({ views: 12000 }).eq("id", videoIds[1]);
    await supabase.from("videos").update({ views: 20000 }).eq("id", videoIds[2]);

    // ── CICLO 4 (ultimo) ──
    logs.push({ step: "── CICLO 4 — 2026-04-01 (post-campagna) ──", ok: true });
    const c4 = await generateCycle(campaignId, campParams);
    assert(logs, "C4 fisso", 0, c4.fixedAmount);
    assert(logs, "C4 views nuove", 27000, c4.cpmViews);
    assert(logs, "C4 CPM", 54, c4.cpmAmount);
    assert(logs, "C4 totale", 54, c4.totalAmount);
    assert(logs, "C4 views_paid_cumulative", 132000, c4.viewsPaidCumulative);

    // ── VERIFICA TOTALE ──
    logs.push({ step: "── VERIFICA TOTALE ──", ok: true });
    const grandTotal = c1.totalAmount + c2.totalAmount + c3.totalAmount + c4.totalAmount;
    assert(logs, "Totale campagna TEST_E2E", 864, grandTotal);

    // ── VERIFICA PAGAMENTI IN DB ──
    const { data: dbPayments } = await supabase.from("client_payments").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: true });
    assert(logs, "Numero cicli in DB", 4, (dbPayments ?? []).length);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    // ── CLEANUP ──
    logs.push({ step: "🧹 Cleanup...", ok: true });
    try {
      if (campaignId) {
        await supabase.from("client_payments").delete().eq("campaign_id", campaignId);
        await supabase.from("payment_cycles").delete().eq("campaign_id", campaignId);
        await supabase.from("campaign_creators").delete().eq("campaign_id", campaignId);
      }
      for (const vid of videoIds) {
        await supabase.from("videos").delete().eq("id", vid);
      }
      for (const accId of accountIds) {
        await supabase.from("tiktok_accounts").delete().eq("id", accId);
      }
      for (const cid of creatorIds) {
        await supabase.from("creators").delete().eq("id", cid);
      }
      if (campaignId) {
        await supabase.from("campaigns").delete().eq("id", campaignId);
      }
      logs.push({ step: "✅ Cleanup completato", ok: true });
    } catch (e: any) {
      logs.push({ step: `⚠️ Cleanup parziale: ${e.message}`, ok: false });
    }
  }

  return logs;
}

export default function PaymentsE2ETest() {
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);

  async function handleRun() {
    setRunning(true);
    setLogs([]);
    const result = await runE2ETest();
    setLogs(result);
    setRunning(false);
    setShowResults(true);
  }

  const assertLogs = logs.filter((l) => l.step.startsWith("C") || l.step.startsWith("Totale") || l.step.startsWith("Numero"));
  const passed = assertLogs.filter((l) => l.ok).length;
  const total = assertLogs.length;
  const allPassed = total > 0 && passed === total;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Test End-to-End Pagamenti</CardTitle>
              <CardDescription>Crea dati di test, genera 4 cicli di pagamento e verifica la logica di calcolo. I dati vengono eliminati al termine.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRun} disabled={running} variant="outline">
            {running ? "⏳ Test in esecuzione..." : "🧪 Test Pagamenti End-to-End"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {allPassed ? "✅ Logica pagamenti verificata correttamente" : "❌ Test falliti — dettagli nei log"}
            </DialogTitle>
          </DialogHeader>
          <div className={`rounded-md p-3 text-sm font-semibold ${allPassed ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {passed}/{total} test superati
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 text-sm font-mono">
              {logs.map((l, i) => (
                <div key={i} className={`py-1 px-2 rounded ${l.ok ? "" : "bg-destructive/10 text-destructive"}`}>
                  {l.ok ? "✅" : "❌"} {l.step}
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
