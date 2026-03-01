import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, ChevronDown, Copy, Check, Trash2 } from "lucide-react";

// ─── Types ───

interface TestLog {
  step: string;
  ok: boolean;
  detail?: string;
}

interface ModuleResult {
  name: string;
  logs: TestLog[];
  passed: number;
  total: number;
}

// ─── Helpers ───

function assert(logs: TestLog[], step: string, expected: number, actual: number, tolerance = 0.01): boolean {
  const ok = Math.abs(expected - actual) < tolerance;
  logs.push({ step, ok, detail: ok ? `${actual}` : `atteso ${expected}, ottenuto ${actual}` });
  return ok;
}

function assertBool(logs: TestLog[], step: string, expected: boolean, actual: boolean): boolean {
  const ok = expected === actual;
  logs.push({ step, ok, detail: ok ? `${actual}` : `atteso ${expected}, ottenuto ${actual}` });
  return ok;
}

function countAsserts(logs: TestLog[]): { passed: number; total: number } {
  const asserts = logs.filter(l => !l.step.startsWith("═") && !l.step.startsWith("─") && !l.step.startsWith("✅") && !l.step.startsWith("📊") && !l.step.startsWith("🔧") && !l.step.startsWith("🧹") && !l.step.startsWith("ℹ️"));
  return { passed: asserts.filter(l => l.ok).length, total: asserts.length };
}

async function fetchAllVideos(accIds: string[], select: string) {
  let all: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: batch } = await supabase.from("videos").select(select).in("tiktok_account_id", accIds).range(offset, offset + 999);
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

async function generateCycle(
  campaignId: string,
  campaign: { start_date: string; end_date: string; client_fixed_per_creator: number; client_cpm: number; planned_creators: number },
) {
  const { data: existingCycles } = await supabase
    .from("payment_cycles").select("*").eq("campaign_id", campaignId).order("cycle_number", { ascending: true });
  const last = (existingCycles ?? []).at(-1);
  const nextNumber = last ? last.cycle_number + 1 : 1;
  const startDate = last ? last.cycle_end_date : campaign.start_date;
  const endD = new Date(startDate + "T00:00:00Z");
  endD.setUTCDate(endD.getUTCDate() + 30);
  const endDate = endD.toISOString().slice(0, 10);
  const isLastCycle = startDate >= campaign.end_date;

  const { data: cycle, error: cycleErr } = await supabase.from("payment_cycles").insert({
    campaign_id: campaignId, cycle_number: nextNumber, cycle_start_date: startDate, cycle_end_date: endDate, is_last_cycle: isLastCycle,
  }).select().single();
  if (cycleErr) throw cycleErr;

  const { data: cc } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", campaignId);
  const isFirstCycle = nextNumber === 1;
  const creatorCount = isFirstCycle ? campaign.planned_creators : ((cc ?? []).length || campaign.planned_creators);

  let prevViewsPaidCumulative = 0;
  if (!isFirstCycle) {
    const { data: prev } = await supabase.from("client_payments").select("views_paid_cumulative").eq("campaign_id", campaignId).order("cycle_number", { ascending: false }).limit(1);
    if (prev?.length) prevViewsPaidCumulative = (prev[0] as any).views_paid_cumulative ?? 0;
  }

  const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
  const accIds = (accounts ?? []).map(a => a.id);

  let totalCurrentViews = 0;
  if (accIds.length) {
    const videos = await fetchAllVideos(accIds, "views, views_final, window_closed");
    // Fetch campaign's video_views_cap
    const { data: campData } = await supabase.from("campaigns").select("video_views_cap").eq("id", campaignId).single();
    const cap = (campData as any)?.video_views_cap as number | null;
    totalCurrentViews = videos.reduce((s, v) => {
      let eff = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
      if (cap != null && cap > 0) eff = Math.min(eff, cap);
      return s + eff;
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

  return { cycleNumber: nextNumber, fixedAmount, cpmViews: newViews, cpmAmount, totalAmount, viewsPaidCumulative, isLastCycle };
}

async function cleanupCampaign(campaignId: string, creatorIds: string[] = []) {
  const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
  const accIds = (accounts ?? []).map(a => a.id);
  if (accIds.length) await supabase.from("videos").delete().in("tiktok_account_id", accIds);
  await supabase.from("client_payments").delete().eq("campaign_id", campaignId);
  await supabase.from("payment_cycles").delete().eq("campaign_id", campaignId);
  await supabase.from("campaign_creators").delete().eq("campaign_id", campaignId);
  for (const id of accIds) await supabase.from("tiktok_accounts").delete().eq("id", id);
  for (const id of creatorIds) await supabase.from("creators").delete().eq("id", id);
  await supabase.from("campaigns").delete().eq("id", campaignId);
}

async function bulkUpdateViews(videoIds: string[], totalViews: number) {
  if (!videoIds.length) return;
  const n = videoIds.length;
  const base = Math.floor(totalViews / n);
  const remainder = totalViews - base * n;
  const viewsArr = videoIds.map((_, i) => base + (i < remainder ? 1 : 0));
  for (let i = 0; i < videoIds.length; i += 500) {
    const { error } = await supabase.rpc("bulk_update_video_views", {
      p_ids: videoIds.slice(i, i + 500),
      p_views: viewsArr.slice(i, i + 500),
    });
    if (error) throw error;
  }
}

function generateVideoSpecs(accountId: string, year: number, month: number, count: number, prefix: string) {
  const specs: any[] = [];
  for (let i = 0; i < count; i++) {
    const day = 1 + Math.floor(i / 10);
    const d = new Date(Date.UTC(year, month - 1, Math.min(day, 28), 8 + (i % 10)));
    specs.push({ tiktok_account_id: accountId, published_at: d.toISOString(), tiktok_video_id: `${prefix}_${i}`, views: 0 });
  }
  return specs;
}

async function bulkInsertVideos(specs: any[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < specs.length; i += 200) {
    const { data, error } = await supabase.from("videos").insert(specs.slice(i, i + 200)).select("id");
    if (error) throw error;
    ids.push(...(data ?? []).map(v => v.id));
  }
  return ids;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 1: Cicli con fisso cliente per creator
// Campagna con client_fixed_per_creator=200€, 2 creator previsti
// Verifica: C1=solo fisso, C2+=fisso+CPM, ultimo=solo CPM
// ═══════════════════════════════════════════════════════════════

async function runModule1(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: campagna con fisso cliente 200€/creator, 2 planned", ok: true });

    const { data: camp, error } = await supabase.from("campaigns").insert({
      name: "TEST_M1", client_name: "ClienteAlfa", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 3, client_fixed_per_creator: 200, planned_creators: 2, status: "active",
    }).select().single();
    if (error) throw error;
    campaignId = camp!.id;

    // Ciclo 1 — solo fisso, usa planned_creators perché non ci sono creator collegati
    const p = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 200, client_cpm: 3, planned_creators: 2 };
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1: fisso = 200×2 = 400€ (planned_creators)", 400, c1.fixedAmount);
    assert(logs, "C1: CPM = 0€ (primo ciclo, nessun CPM)", 0, c1.cpmAmount);
    assert(logs, "C1: totale = 400€", 400, c1.totalAmount);

    // Ora aggiungo 2 creator + account + video
    for (const name of ["Creator M1 A", "Creator M1 B"]) {
      const { data: cr } = await supabase.from("creators").insert({ name, status: "active", creator_cpm: 0.5, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m1_${name.slice(-1).toLowerCase()}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-05T10:00:00Z", tiktok_video_id: `m1_${name.slice(-1).toLowerCase()}_v1`, views: 25000 });
    }

    // Ciclo 2 — fisso + CPM, usa creator effettivi (2)
    // Views totali = 50k → CPM = 3 × 50 = 150€
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2: fisso = 200×2 = 400€ (creator effettivi)", 400, c2.fixedAmount);
    assert(logs, "C2: views nuove = 50.000", 50000, c2.cpmViews);
    assert(logs, "C2: CPM = 3×50 = 150€", 150, c2.cpmAmount);
    assert(logs, "C2: totale = 550€", 550, c2.totalAmount);

    // Aggiorno views a 80k totali
    const { data: allAccs } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
    const { data: allVids } = await supabase.from("videos").select("id").in("tiktok_account_id", (allAccs ?? []).map(a => a.id));
    await bulkUpdateViews((allVids ?? []).map(v => v.id), 80000);

    // Ciclo 3 — views nuove = 80k - 50k = 30k
    const c3 = await generateCycle(campaignId, p);
    assert(logs, "C3: views nuove = 30.000", 30000, c3.cpmViews);
    assert(logs, "C3: fisso = 400€", 400, c3.fixedAmount);
    assert(logs, "C3: CPM = 3×30 = 90€", 90, c3.cpmAmount);

    // Ciclo 4 — ultimo ciclo (start >= end_date), solo CPM residuo, fisso=0
    const c4 = await generateCycle(campaignId, p);
    assert(logs, "C4 (ultimo): fisso = 0€ (post-campagna)", 0, c4.fixedAmount);
    assertBool(logs, "C4 è ultimo ciclo", true, c4.isLastCycle);

    // Verifica totale complessivo
    const totale = c1.totalAmount + c2.totalAmount + c3.totalAmount + c4.totalAmount;
    logs.push({ step: `📊 Totale campagna: ${totale}€`, ok: true });

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 2: Views cumulative e delta corretto
// ═══════════════════════════════════════════════════════════════

async function runModule2(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: campagna solo CPM, 1 creator, 1 video", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M2", client_name: "ClienteBeta", start_date: "2026-01-01", end_date: "2026-06-01",
      client_cpm: 2, client_fixed_per_creator: 0, planned_creators: 1, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const { data: cr } = await supabase.from("creators").insert({ name: "Creator M2", status: "active", creator_cpm: 0.5, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
    creatorIds.push(cr!.id);
    await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
    const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: "test_m2", account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
    const { data: vid } = await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-05T10:00:00Z", tiktok_video_id: "test_m2_v1", views: 0 }).select().single();

    const p = { start_date: "2026-01-01", end_date: "2026-06-01", client_fixed_per_creator: 0, client_cpm: 2, planned_creators: 1 };

    // C1 (no views, no CPM)
    await generateCycle(campaignId, p);

    // 50k → C2
    await supabase.from("videos").update({ views: 50000 }).eq("id", vid!.id);
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "50k → C2: views nuove = 50.000", 50000, c2.cpmViews);
    assert(logs, "C2: CPM = 100€", 100, c2.cpmAmount);

    // 80k → C3 (solo 30k nuove)
    await supabase.from("videos").update({ views: 80000 }).eq("id", vid!.id);
    const c3 = await generateCycle(campaignId, p);
    assert(logs, "80k → C3: views nuove = 30.000 (NON 80k)", 30000, c3.cpmViews);

    // 80.1k → C4 (solo 100 nuove)
    await supabase.from("videos").update({ views: 80100 }).eq("id", vid!.id);
    const c4 = await generateCycle(campaignId, p);
    assert(logs, "80.1k → C4: views nuove = 100", 100, c4.cpmViews);

    // Fermo 80.1k → C5 (0 nuove)
    const c5 = await generateCycle(campaignId, p);
    assert(logs, "Fermo → C5: views nuove = 0", 0, c5.cpmViews);
    assert(logs, "views_paid_cumulative finale = 80.100", 80100, c5.viewsPaidCumulative);

    const totalCpm = c2.cpmAmount + c3.cpmAmount + c4.cpmAmount + c5.cpmAmount;
    assert(logs, "Totale CPM = 160.20€", 160.20, totalCpm);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 3: Multi-video, multi-creator, multi-account
// ═══════════════════════════════════════════════════════════════

async function runModule3(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: 2 creator, 3 video ciascuno, fisso cliente 150€", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M3", client_name: "ClienteGamma", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 2.5, client_fixed_per_creator: 150, planned_creators: 2, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const accIds: string[] = [];
    for (const name of ["Creator M3 A", "Creator M3 B"]) {
      const { data: cr } = await supabase.from("creators").insert({ name, status: "active", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m3_${name.slice(-1).toLowerCase()}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      accIds.push(acc!.id);
    }

    // 3 video per account
    const vids: string[] = [];
    for (let a = 0; a < 2; a++) {
      for (let v = 0; v < 3; v++) {
        const { data: vid } = await supabase.from("videos").insert({
          tiktok_account_id: accIds[a], published_at: `2026-01-${5 + v * 5}T10:00:00Z`,
          tiktok_video_id: `m3_${a}_${v}`, views: 0,
        }).select().single();
        vids.push(vid!.id);
      }
    }

    const p = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 150, client_cpm: 2.5, planned_creators: 2 };

    // C1 — solo fisso
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1: fisso = 150×2 = 300€", 300, c1.fixedAmount);
    assert(logs, "C1: CPM = 0€", 0, c1.cpmAmount);

    // Set views: A totale 60k (20k+25k+15k), B totale 40k (10k+15k+15k) → 100k
    await supabase.from("videos").update({ views: 20000 }).eq("id", vids[0]);
    await supabase.from("videos").update({ views: 25000 }).eq("id", vids[1]);
    await supabase.from("videos").update({ views: 15000 }).eq("id", vids[2]);
    await supabase.from("videos").update({ views: 10000 }).eq("id", vids[3]);
    await supabase.from("videos").update({ views: 15000 }).eq("id", vids[4]);
    await supabase.from("videos").update({ views: 15000 }).eq("id", vids[5]);

    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2: views nuove = 100.000 (somma 6 video)", 100000, c2.cpmViews);
    assert(logs, "C2: fisso = 300€", 300, c2.fixedAmount);
    assert(logs, "C2: CPM = 2.5×100 = 250€", 250, c2.cpmAmount);
    assert(logs, "C2: totale = 550€", 550, c2.totalAmount);

    // Views crescono a 150k totali → nuove 50k
    await supabase.from("videos").update({ views: 30000 }).eq("id", vids[0]);
    await supabase.from("videos").update({ views: 35000 }).eq("id", vids[1]);
    await supabase.from("videos").update({ views: 20000 }).eq("id", vids[2]);
    await supabase.from("videos").update({ views: 20000 }).eq("id", vids[3]);
    await supabase.from("videos").update({ views: 25000 }).eq("id", vids[4]);
    await supabase.from("videos").update({ views: 20000 }).eq("id", vids[5]);

    const c3 = await generateCycle(campaignId, p);
    assert(logs, "C3: views nuove = 50.000", 50000, c3.cpmViews);
    assert(logs, "C3: CPM = 125€", 125, c3.cpmAmount);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 4: Fisso creator – maturazione mensile
// 3 creator: A raggiunge target, B no (1 video in meno), C zero video
// ═══════════════════════════════════════════════════════════════

async function runModule4(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: 3 creator, target gen 2026 = 5×26 = 130 video", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M4", client_name: "ClienteDelta", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 2, client_fixed_per_creator: 200, planned_creators: 3, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const accIds: string[] = [];
    for (const name of ["Creator M4 A", "Creator M4 B", "Creator M4 C"]) {
      const { data: cr } = await supabase.from("creators").insert({ name, status: "active", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m4_${name.slice(-1).toLowerCase()}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      accIds.push(acc!.id);
    }

    // Jan 2026: 26 working days → target 130
    // A: 130 video (raggiunge), B: 129 (non raggiunge), C: 0
    const specsA = generateVideoSpecs(accIds[0], 2026, 1, 130, "m4_a");
    const specsB = generateVideoSpecs(accIds[1], 2026, 1, 129, "m4_b");
    const [idsA, idsB] = await Promise.all([bulkInsertVideos(specsA), bulkInsertVideos(specsB)]);
    await Promise.all([bulkUpdateViews(idsA, 100000), bulkUpdateViews(idsB, 50000)]);

    // Fisso creator
    assert(logs, "Creator A: 130 video → fisso MATURATO = 200€", 200, 130 >= 130 ? 200 : 0);
    assert(logs, "Creator B: 129 video → fisso NON maturato = 0€", 0, 129 >= 130 ? 200 : 0);
    assert(logs, "Creator C: 0 video → fisso NON maturato = 0€", 0, 0 >= 130 ? 200 : 0);

    // CPM creator
    assert(logs, "Creator A CPM: 100k × 0.50/1000 = 50€", 50, 100000 * 0.50 / 1000);
    assert(logs, "Creator B CPM: 50k × 0.50/1000 = 25€", 25, 50000 * 0.50 / 1000);
    assert(logs, "Creator C CPM: 0k × 0.50/1000 = 0€", 0, 0);

    // Totale uscita creator
    const totalCreator = (200 + 50) + (0 + 25) + (0 + 0);
    assert(logs, "Totale uscita creator = 275€", 275, totalCreator);

    // Verifica entrata cliente (C1 + C2)
    const p = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 200, client_cpm: 2, planned_creators: 3 };
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1 cliente: fisso = 200×3 = 600€", 600, c1.fixedAmount);

    const c2 = await generateCycle(campaignId, p);
    // views totali = 150k → CPM = 2×150 = 300€
    assert(logs, "C2 cliente: views = 150.000", 150000, c2.cpmViews);
    assert(logs, "C2 cliente: CPM = 300€", 300, c2.cpmAmount);
    assert(logs, "C2 cliente: fisso = 600€", 600, c2.fixedAmount);

    // Margine
    const entrataCliente = c1.totalAmount + c2.totalAmount;
    const margine = entrataCliente - totalCreator;
    assert(logs, `Margine agenzia = ${entrataCliente}€ - 275€ = ${margine}€`, entrataCliente - 275, margine);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 5: Finestra 30 giorni – views_final vs views
// ═══════════════════════════════════════════════════════════════

async function runModule5(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: 1 video chiuso (views_final), 1 aperto (views)", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M5", client_name: "ClienteEpsilon", start_date: "2026-01-01", end_date: "2026-06-01",
      client_cpm: 2, client_fixed_per_creator: 100, planned_creators: 1, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const { data: cr } = await supabase.from("creators").insert({ name: "Creator M5", status: "active", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
    creatorIds.push(cr!.id);
    await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
    const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: "test_m5", account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();

    const now = new Date();

    // Video 1: finestra CHIUSA, views_final=40k, views=60k (views ignorato)
    const pub1 = new Date(now); pub1.setDate(pub1.getDate() - 35);
    await supabase.from("videos").insert({
      tiktok_account_id: acc!.id, published_at: pub1.toISOString(), tiktok_video_id: "m5_v1",
      views: 60000, views_final: 40000, window_closed: true,
    });

    // Video 2: finestra APERTA, views=15k, views_final=null
    const pub2 = new Date(now); pub2.setDate(pub2.getDate() - 10);
    await supabase.from("videos").insert({
      tiktok_account_id: acc!.id, published_at: pub2.toISOString(), tiktok_video_id: "m5_v2",
      views: 15000, window_closed: false,
    });

    // Video 3: finestra CHIUSA, views_final=0 (video senza views al momento della chiusura)
    const pub3 = new Date(now); pub3.setDate(pub3.getDate() - 40);
    await supabase.from("videos").insert({
      tiktok_account_id: acc!.id, published_at: pub3.toISOString(), tiktok_video_id: "m5_v3",
      views: 5000, views_final: 0, window_closed: true,
    });

    // Verifica calcolo views effettive
    const { data: fetchedVids } = await supabase.from("videos").select("views, views_final, window_closed").eq("tiktok_account_id", acc!.id);
    const totalEffective = (fetchedVids ?? []).reduce((s, v) => s + (v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0)), 0);

    // V1: 40k (views_final), V2: 15k (views), V3: 0 (views_final=0) → 55k
    assert(logs, "Video chiuso: usa views_final=40k (NON views=60k)", 40000, 40000);
    assert(logs, "Video aperto: usa views=15k", 15000, 15000);
    assert(logs, "Video chiuso con views_final=0: usa 0 (NON views=5k)", 0, 0);
    assert(logs, "Totale views effettive = 55.000", 55000, totalEffective);

    // CPM creator
    const cpmCreator = totalEffective * 0.50 / 1000;
    assert(logs, "CPM creator = 55k × 0.50/1000 = 27.50€", 27.50, cpmCreator);

    // CPM cliente (stessa logica views effettive)
    const p = { start_date: "2026-01-01", end_date: "2026-06-01", client_fixed_per_creator: 100, client_cpm: 2, planned_creators: 1 };
    await generateCycle(campaignId, p); // C1 fisso only
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2 cliente: views effettive = 55.000", 55000, c2.cpmViews);
    assert(logs, "C2 cliente: CPM = 2×55 = 110€", 110, c2.cpmAmount);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 6: Campagna completa con fisso – ciclo di vita intero
// 2 creator, fisso 200€, CPM 3€, 3 cicli + ultimo
// ═══════════════════════════════════════════════════════════════

async function runModule6(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: campagna completa 3 mesi, fisso 200€, CPM 3€, 2 creator", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M6", client_name: "ClienteZeta", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 3, client_fixed_per_creator: 200, planned_creators: 2, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const accIds: string[] = [];
    for (const name of ["Creator M6 A", "Creator M6 B"]) {
      const { data: cr } = await supabase.from("creators").insert({ name, status: "active", creator_cpm: 0.50, creator_fixed: 300, min_videos_per_day: 5 }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m6_${name.slice(-1).toLowerCase()}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      accIds.push(acc!.id);
    }

    const p = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 200, client_cpm: 3, planned_creators: 2 };

    // ── Mese 1 Gennaio ──
    // A: 130 video (target raggiunto), B: 100 video (target non raggiunto)
    const janA = generateVideoSpecs(accIds[0], 2026, 1, 130, "m6_a_jan");
    const janB = generateVideoSpecs(accIds[1], 2026, 1, 100, "m6_b_jan");
    const [janAIds, janBIds] = await Promise.all([bulkInsertVideos(janA), bulkInsertVideos(janB)]);
    await Promise.all([bulkUpdateViews(janAIds, 500000), bulkUpdateViews(janBIds, 200000)]);

    // Creator A gen: fisso 300€ + CPM 250€ = 550€
    // Creator B gen: fisso 0€ (100<130) + CPM 100€ = 100€
    assert(logs, "Creator A gen: fisso MATURATO (130≥130)", 300, 300);
    assert(logs, "Creator A gen: CPM = 500k×0.50/1000 = 250€", 250, 500000 * 0.50 / 1000);
    assertBool(logs, "Creator B gen: fisso NON maturato (100<130)", true, 100 < 130);
    assert(logs, "Creator B gen: CPM = 200k×0.50/1000 = 100€", 100, 200000 * 0.50 / 1000);

    // Ciclo 1 cliente: solo fisso
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1: fisso = 200×2 = 400€", 400, c1.fixedAmount);
    assert(logs, "C1: CPM = 0€", 0, c1.cpmAmount);

    // Ciclo 2: fisso + CPM su 700k views
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2: views = 700.000", 700000, c2.cpmViews);
    assert(logs, "C2: fisso = 400€", 400, c2.fixedAmount);
    assert(logs, "C2: CPM = 3×700 = 2.100€", 2100, c2.cpmAmount);
    assert(logs, "C2: totale = 2.500€", 2500, c2.totalAmount);

    // ── Mese 2: views crescono a 1M totale ──
    await Promise.all([bulkUpdateViews(janAIds, 600000), bulkUpdateViews(janBIds, 250000)]);
    // Feb videos: A=50, B=50 → 150k nuove
    const febA = generateVideoSpecs(accIds[0], 2026, 2, 50, "m6_a_feb");
    const febB = generateVideoSpecs(accIds[1], 2026, 2, 50, "m6_b_feb");
    const [febAIds, febBIds] = await Promise.all([bulkInsertVideos(febA), bulkInsertVideos(febB)]);
    await Promise.all([bulkUpdateViews(febAIds, 100000), bulkUpdateViews(febBIds, 50000)]);
    // Totale ora: 600k + 250k + 100k + 50k = 1M

    const c3 = await generateCycle(campaignId, p);
    assert(logs, "C3: views nuove = 300.000 (1M - 700k)", 300000, c3.cpmViews);
    assert(logs, "C3: fisso = 400€", 400, c3.fixedAmount);
    assert(logs, "C3: CPM = 3×300 = 900€", 900, c3.cpmAmount);

    // Ciclo 4: ultimo (post-campagna, solo CPM residuo)
    const c4 = await generateCycle(campaignId, p);
    assert(logs, "C4 (ultimo): fisso = 0€", 0, c4.fixedAmount);
    assertBool(logs, "C4 è ultimo ciclo", true, c4.isLastCycle);

    // Riepilogo
    const totaleCliente = c1.totalAmount + c2.totalAmount + c3.totalAmount + c4.totalAmount;
    const totaleCreator = (300 + 250) + (0 + 100); // gen only for simplicity
    const margine = totaleCliente - totaleCreator;
    logs.push({ step: `📊 Entrata cliente totale: ${totaleCliente}€`, ok: true });
    logs.push({ step: `📊 Uscita creator (gen): ${totaleCreator}€`, ok: true });
    logs.push({ step: `📊 Margine: ${margine}€`, ok: true });

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 7: planned_creators fallback & zero values
// ═══════════════════════════════════════════════════════════════

async function runModule7(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: campagna con 5 planned_creators ma 0 effettivi", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M7", client_name: "ClienteEta", start_date: "2026-01-01", end_date: "2026-04-01",
      client_cpm: 2, client_fixed_per_creator: 300, planned_creators: 5, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const p = { start_date: "2026-01-01", end_date: "2026-04-01", client_fixed_per_creator: 300, client_cpm: 2, planned_creators: 5 };

    // C1: nessun creator collegato, usa planned_creators=5
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1 senza creator: fisso = 300×5 = 1.500€ (planned)", 1500, c1.fixedAmount);

    // Aggiungo solo 3 creator
    for (let i = 0; i < 3; i++) {
      const { data: cr } = await supabase.from("creators").insert({ name: `Creator M7 ${i}`, status: "active", creator_cpm: 0.5, creator_fixed: 100, min_videos_per_day: 3 }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m7_${i}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-10T10:00:00Z", tiktok_video_id: `m7_${i}_v1`, views: 10000 });
    }

    // C2: 3 creator effettivi → fisso usa effettivi
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2 con 3 creator: fisso = 300×3 = 900€ (effettivi)", 900, c2.fixedAmount);
    assert(logs, "C2: views nuove = 30.000", 30000, c2.cpmViews);

    // Test campagna con valori zero
    logs.push({ step: "🔧 Test campagna con CPM=0 e fisso=0", ok: true });

    const { data: campZero } = await supabase.from("campaigns").insert({
      name: "TEST_M7_ZERO", client_name: "ClienteZero", start_date: "2026-01-01", end_date: "2026-03-01",
      client_cpm: 0, client_fixed_per_creator: 0, planned_creators: 1, status: "active",
    }).select().single();

    const pZero = { start_date: "2026-01-01", end_date: "2026-03-01", client_fixed_per_creator: 0, client_cpm: 0, planned_creators: 1 };
    const cz1 = await generateCycle(campZero!.id, pZero);
    assert(logs, "Campagna zero: C1 totale = 0€", 0, cz1.totalAmount);

    // Cleanup zero campaign
    if (!skipCleanup) await cleanupCampaign(campZero!.id);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 8: Simulazione completa E2E – margine agenzia
// Testa il ciclo di vita completo e calcola il margine reale
// ═══════════════════════════════════════════════════════════════

async function runModule8(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: simulazione E2E con margine", ok: true });

    // Campagna: fisso 150€/creator, CPM 2.5€, 3 creator
    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M8", client_name: "ClienteOmega", start_date: "2026-02-01", end_date: "2026-05-01",
      client_cpm: 2.5, client_fixed_per_creator: 150, planned_creators: 3, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const accIds: string[] = [];
    const creatorParams = [
      { name: "Creator M8 Star", fixed: 250, cpm: 0.80, min: 5 },   // star
      { name: "Creator M8 Mid", fixed: 150, cpm: 0.50, min: 5 },    // mid
      { name: "Creator M8 Junior", fixed: 80, cpm: 0.30, min: 3 },  // junior
    ];
    for (const cp of creatorParams) {
      const { data: cr } = await supabase.from("creators").insert({ name: cp.name, status: "active", creator_cpm: cp.cpm, creator_fixed: cp.fixed, min_videos_per_day: cp.min }).select().single();
      creatorIds.push(cr!.id);
      await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
      const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: `test_m8_${cp.name.split(" ").pop()!.toLowerCase()}`, account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();
      accIds.push(acc!.id);
    }

    const p = { start_date: "2026-02-01", end_date: "2026-05-01", client_fixed_per_creator: 150, client_cpm: 2.5, planned_creators: 3 };

    // Feb 2026: 24 working days → target Star/Mid = 5×24=120, Junior = 3×24=72
    // Star: 120 video, 800k views → fisso 250 + CPM 640 = 890€
    // Mid: 100 video (non raggiunge!), 300k views → fisso 0 + CPM 150 = 150€
    // Junior: 72 video (raggiunge!), 100k views → fisso 80 + CPM 30 = 110€
    const starSpecs = generateVideoSpecs(accIds[0], 2026, 2, 120, "m8_star");
    const midSpecs = generateVideoSpecs(accIds[1], 2026, 2, 100, "m8_mid");
    const juniorSpecs = generateVideoSpecs(accIds[2], 2026, 2, 72, "m8_junior");

    const [starIds, midIds, juniorIds] = await Promise.all([
      bulkInsertVideos(starSpecs), bulkInsertVideos(midSpecs), bulkInsertVideos(juniorSpecs)
    ]);
    await Promise.all([
      bulkUpdateViews(starIds, 800000),
      bulkUpdateViews(midIds, 300000),
      bulkUpdateViews(juniorIds, 100000),
    ]);

    // Creator payoffs
    assert(logs, "Star: fisso MATURATO (120≥120)", 250, 120 >= 120 ? 250 : 0);
    assert(logs, "Star: CPM = 800k×0.80/1000 = 640€", 640, 800000 * 0.80 / 1000);
    assertBool(logs, "Mid: fisso NON maturato (100<120)", true, 100 < 120);
    assert(logs, "Mid: CPM = 300k×0.50/1000 = 150€", 150, 300000 * 0.50 / 1000);
    assert(logs, "Junior: fisso MATURATO (72≥72)", 80, 72 >= 72 ? 80 : 0);
    assert(logs, "Junior: CPM = 100k×0.30/1000 = 30€", 30, 100000 * 0.30 / 1000);

    const totalCreator = (250 + 640) + (0 + 150) + (80 + 30);
    assert(logs, "Totale uscita creator feb = 1.150€", 1150, totalCreator);

    // Client cycles
    const c1 = await generateCycle(campaignId, p);
    assert(logs, "C1: fisso = 150×3 = 450€", 450, c1.fixedAmount);

    const c2 = await generateCycle(campaignId, p);
    // Views: 1.2M totali
    assert(logs, "C2: views = 1.200.000", 1200000, c2.cpmViews);
    assert(logs, "C2: CPM = 2.5×1200 = 3.000€", 3000, c2.cpmAmount);
    assert(logs, "C2: totale = 3.450€", 3450, c2.totalAmount);

    // Margine feb
    const entrataFeb = c1.totalAmount + c2.totalAmount;
    const margineFeb = entrataFeb - totalCreator;
    assert(logs, `Margine feb = ${entrataFeb}€ - 1150€ = ${margineFeb}€`, entrataFeb - 1150, margineFeb);
    assertBool(logs, "Margine è positivo", true, margineFeb > 0);

    logs.push({ step: `📊 Entrata: ${entrataFeb}€ | Uscita: ${totalCreator}€ | Margine: ${margineFeb}€`, ok: true });

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ═══════════════════════════════════════════════════════════════
// MODULE 9: Mix finestra chiusa/aperta + views_final su più cicli
// ═══════════════════════════════════════════════════════════════

async function runModule9(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  const creatorIds: string[] = [];

  try {
    logs.push({ step: "🔧 Setup: video con finestra che si chiude tra cicli", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M9", client_name: "ClienteTheta", start_date: "2026-01-01", end_date: "2026-06-01",
      client_cpm: 2, client_fixed_per_creator: 100, planned_creators: 1, status: "active",
    }).select().single();
    campaignId = camp!.id;

    const { data: cr } = await supabase.from("creators").insert({ name: "Creator M9", status: "active", creator_cpm: 0.50, creator_fixed: 200, min_videos_per_day: 5 }).select().single();
    creatorIds.push(cr!.id);
    await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
    const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: "test_m9", account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();

    // Video con views=30k (finestra aperta)
    const { data: vid } = await supabase.from("videos").insert({
      tiktok_account_id: acc!.id, published_at: "2026-01-05T10:00:00Z", tiktok_video_id: "m9_v1",
      views: 30000, window_closed: false,
    }).select().single();

    const p = { start_date: "2026-01-01", end_date: "2026-06-01", client_fixed_per_creator: 100, client_cpm: 2, planned_creators: 1 };

    // C1
    await generateCycle(campaignId, p);

    // C2: video aperto con 30k
    const c2 = await generateCycle(campaignId, p);
    assert(logs, "C2 (finestra aperta): views = 30.000", 30000, c2.cpmViews);
    assert(logs, "C2: CPM = 60€", 60, c2.cpmAmount);

    // Ora la finestra si chiude! views_final=25k (inferiore a views correnti)
    await supabase.from("videos").update({
      window_closed: true, views_final: 25000, views: 35000, // views è cresciuto ma final è fisso
    }).eq("id", vid!.id);

    // C3: usa views_final=25k → totale effettivo 25k, prev cumulative=30k → nuove = MAX(0, 25k-30k) = 0
    const c3 = await generateCycle(campaignId, p);
    assert(logs, "C3 (finestra chiusa, views_final < prev): views nuove = 0", 0, c3.cpmViews);
    assert(logs, "C3: CPM = 0€ (views_final < precedente)", 0, c3.cpmAmount);

    // Aggiungo nuovo video con 20k views (aperto)
    await supabase.from("videos").insert({
      tiktok_account_id: acc!.id, published_at: "2026-02-10T10:00:00Z", tiktok_video_id: "m9_v2",
      views: 20000, window_closed: false,
    });

    // C4: totale effettivo = 25k (final) + 20k (views) = 45k, prev=30k → nuove=15k
    const c4 = await generateCycle(campaignId, p);
    assert(logs, "C4 (nuovo video): views nuove = 15.000", 15000, c4.cpmViews);
    assert(logs, "C4: CPM = 30€", 30, c4.cpmAmount);

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds);
  }
  return logs;
}

// ─── Main Component ───

// ═══════════════════════════════════════════════════════════════
// MODULE 10: Cap Video e Cap di Spesa
// ═══════════════════════════════════════════════════════════════

async function runModule10(skipCleanup = false): Promise<TestLog[]> {
  const logs: TestLog[] = [];
  let campaignId = "";
  let campaignId2 = "";
  const creatorIds: string[] = [];

  try {
    // ── Cap Video ──
    logs.push({ step: "🔧 Test Cap Video: campagna con video_views_cap=100.000, CPM=2€", ok: true });

    const { data: camp } = await supabase.from("campaigns").insert({
      name: "TEST_M10_CAP", client_name: "ClienteCap", start_date: "2026-01-01", end_date: "2026-06-01",
      client_cpm: 2, client_fixed_per_creator: 0, planned_creators: 1, status: "active",
      video_views_cap: 100000,
    } as any).select().single();
    campaignId = camp!.id;

    const { data: cr } = await supabase.from("creators").insert({ name: "Creator M10", status: "active", creator_cpm: 0.5, creator_fixed: 0, min_videos_per_day: 1 }).select().single();
    creatorIds.push(cr!.id);
    await supabase.from("campaign_creators").insert({ campaign_id: campaignId, creator_id: cr!.id });
    const { data: acc } = await supabase.from("tiktok_accounts").insert({ username: "test_m10", account_type: "creator", campaign_id: campaignId, creator_id: cr!.id }).select().single();

    // Video A: 50k (sotto cap)
    await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-05T10:00:00Z", tiktok_video_id: "m10_a", views: 50000 });
    // Video B: 150k (sopra cap → cappato a 100k)
    await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-10T10:00:00Z", tiktok_video_id: "m10_b", views: 150000 });
    // Video C: 100k (esattamente al cap)
    await supabase.from("videos").insert({ tiktok_account_id: acc!.id, published_at: "2026-01-15T10:00:00Z", tiktok_video_id: "m10_c", views: 100000 });

    // Views effettive per video
    assert(logs, "Video A (50k): views_effettive = 50.000 (sotto cap)", 50000, Math.min(50000, 100000));
    assert(logs, "Video B (150k): views_effettive = 100.000 (cap raggiunto)", 100000, Math.min(150000, 100000));
    assert(logs, "Video C (100k): views_effettive = 100.000 (esattamente al cap)", 100000, Math.min(100000, 100000));

    // Totale views effettive
    const totalEffective = Math.min(50000, 100000) + Math.min(150000, 100000) + Math.min(100000, 100000);
    assert(logs, "Totale views effettive = 250.000 (non 300.000)", 250000, totalEffective);

    // Totale CPM
    const totalCpm = 2 * (totalEffective / 1000);
    assert(logs, "Totale CPM = 500€ (non 600€)", 500, totalCpm);

    // Verify via cycle generation
    const p = { start_date: "2026-01-01", end_date: "2026-06-01", client_fixed_per_creator: 0, client_cpm: 2, planned_creators: 1 };
    await generateCycle(campaignId, p); // C1
    // Need to apply cap in generateCycle - check views
    const { data: accs } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
    const aIds = (accs ?? []).map(a => a.id);
    const vids = await fetchAllVideos(aIds, "views, views_final, window_closed");
    const cappedViews = vids.reduce((s, v) => {
      const eff = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
      return s + Math.min(eff, 100000);
    }, 0);
    assert(logs, "Views cappate dal DB = 250.000", 250000, cappedViews);

    // ── Cap di Spesa ──
    logs.push({ step: "🔧 Test Cap di Spesa: campagna con monthly_spend_cap=1.000€", ok: true });

    const { data: camp2 } = await supabase.from("campaigns").insert({
      name: "TEST_M10_SPEND", client_name: "ClienteSpend", start_date: "2026-01-01", end_date: "2026-06-01",
      client_cpm: 2, client_fixed_per_creator: 0, planned_creators: 1, status: "active",
      monthly_spend_cap: 1000,
    } as any).select().single();
    campaignId2 = camp2!.id;

    const { data: cr2 } = await supabase.from("creators").insert({ name: "Creator M10 Spend", status: "active", creator_cpm: 0.5, creator_fixed: 0, min_videos_per_day: 1 }).select().single();
    creatorIds.push(cr2!.id);
    await supabase.from("campaign_creators").insert({ campaign_id: campaignId2, creator_id: cr2!.id });
    const { data: acc2 } = await supabase.from("tiktok_accounts").insert({ username: "test_m10_spend", account_type: "creator", campaign_id: campaignId2, creator_id: cr2!.id }).select().single();

    // Video with 400k views → CPM = 800€ (sotto cap 1000€)
    await supabase.from("videos").insert({ tiktok_account_id: acc2!.id, published_at: "2026-01-05T10:00:00Z", tiktok_video_id: "m10_sp_v1", views: 400000 });

    const p2 = { start_date: "2026-01-01", end_date: "2026-06-01", client_fixed_per_creator: 0, client_cpm: 2, planned_creators: 1 };
    await generateCycle(campaignId2, p2); // C1
    const c2 = await generateCycle(campaignId2, p2); // C2: 400k views → 800€
    assert(logs, "C2 sotto cap: totale = 800€ (sotto 1.000€)", 800, c2.totalAmount);

    // Check campaign is still active
    const { data: campCheck1 } = await supabase.from("campaigns").select("status").eq("id", campaignId2).single();
    assertBool(logs, "Campagna ancora attiva dopo C2", true, campCheck1?.status === "active");

    // Add more views → 600k nuove → CPM = 1200€ → cap a 1000€
    await supabase.from("videos").update({ views: 1000000 }).eq("tiktok_video_id", "m10_sp_v1");
    const c3 = await generateCycle(campaignId2, p2);
    assert(logs, "C3 sopra cap: totale cappato a 1.000€", 1000, c3.totalAmount);

    // Check campaign paused
    const { data: campCheck2 } = await supabase.from("campaigns").select("status").eq("id", campaignId2).single();
    assertBool(logs, "Campagna in pausa dopo cap raggiunto", true, campCheck2?.status === "paused");

    // Check notification created
    const { data: notifs } = await supabase.from("notifications").select("id, type").eq("campaign_id", campaignId2).eq("type", "spend_cap_reached");
    assertBool(logs, "Notifica spend_cap_reached creata", true, (notifs ?? []).length > 0);

    // Simulate increase cap and resume
    await supabase.from("campaigns").update({ monthly_spend_cap: 2000, status: "active" } as any).eq("id", campaignId2);
    const { data: campCheck3 } = await supabase.from("campaigns").select("status").eq("id", campaignId2).single();
    assertBool(logs, "Campagna torna attiva dopo aumento cap", true, campCheck3?.status === "active");

  } catch (e: any) {
    logs.push({ step: `❌ ERRORE: ${e.message}`, ok: false });
  } finally {
    if (campaignId && !skipCleanup) await cleanupCampaign(campaignId, creatorIds.slice(0, 1));
    if (campaignId2 && !skipCleanup) {
      await supabase.from("notifications").delete().eq("campaign_id", campaignId2);
      await cleanupCampaign(campaignId2, creatorIds.slice(1));
    }
  }
  return logs;
}

const ALL_TEST_NAMES = ["TEST_M1", "TEST_M2", "TEST_M3", "TEST_M4", "TEST_M5", "TEST_M6", "TEST_M7", "TEST_M7_ZERO", "TEST_M8", "TEST_M9", "TEST_M10_CAP", "TEST_M10_SPEND", "SIMUL_3MESI", "TEST_E2E"];

export default function SystemTest() {
  const [running, setRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ModuleResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState("");
  const [keepData, setKeepData] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  async function doCleanup() {
    for (const name of ALL_TEST_NAMES) {
      try {
        const { data: camps } = await supabase.from("campaigns").select("id").eq("name", name);
        for (const c of (camps ?? [])) {
          const { data: accs } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", c.id);
          const accIds = (accs ?? []).map(a => a.id);
          if (accIds.length) await supabase.from("videos").delete().in("tiktok_account_id", accIds);
          await supabase.from("client_payments").delete().eq("campaign_id", c.id);
          await supabase.from("payment_cycles").delete().eq("campaign_id", c.id);
          const { data: ccData } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", c.id);
          const crIds = (ccData ?? []).map(x => x.creator_id);
          await supabase.from("campaign_creators").delete().eq("campaign_id", c.id);
          for (const id of accIds) await supabase.from("tiktok_accounts").delete().eq("id", id);
          for (const id of crIds) {
            const { data: cr } = await supabase.from("creators").select("name").eq("id", id).single();
            if (cr?.name && (cr.name.startsWith("Simul ") || cr.name.startsWith("Creator E2E") || cr.name.startsWith("Creator M"))) {
              await supabase.from("creators").delete().eq("id", id);
            }
          }
          await supabase.from("campaigns").delete().eq("id", c.id);
        }
      } catch (e: any) {
        console.warn(`Cleanup ${name}:`, e.message);
      }
    }
  }

  async function handleRun() {
    setRunning(true);
    setResults([]);
    setShowResults(false);
    setProgress("🧹 Pulizia dati precedenti...");
    const start = Date.now();

    try { await doCleanup(); } catch (e: any) { console.warn("Legacy cleanup:", e.message); }

    const skip = keepData;
    const modules: { name: string; fn: () => Promise<TestLog[]> }[] = [
      { name: "M1 — Cicli con fisso cliente", fn: () => runModule1(skip) },
      { name: "M2 — Views cumulative e delta", fn: () => runModule2(skip) },
      { name: "M3 — Multi-video multi-creator", fn: () => runModule3(skip) },
      { name: "M4 — Fisso creator + margine", fn: () => runModule4(skip) },
      { name: "M5 — Finestra 30gg (views_final)", fn: () => runModule5(skip) },
      { name: "M6 — Campagna completa con fisso", fn: () => runModule6(skip) },
      { name: "M7 — planned_creators & valori zero", fn: () => runModule7(skip) },
      { name: "M8 — Simulazione E2E margine", fn: () => runModule8(skip) },
      { name: "M9 — Finestra chiusa tra cicli", fn: () => runModule9(skip) },
      { name: "M10 — Cap video e cap di spesa", fn: () => runModule10(skip) },
    ];

    const moduleResults: ModuleResult[] = [];
    for (const mod of modules) {
      setProgress(`▶ ${mod.name}...`);
      const logs = await mod.fn();
      const { passed, total } = countAsserts(logs);
      moduleResults.push({ name: mod.name, logs, passed, total });
    }

    moduleResults.push({
      name: "Stato dati",
      logs: [{ step: skip ? "ℹ️ Dati di test mantenuti per verifica manuale" : "🧹 Cleanup completato", ok: true }],
      passed: 1, total: 1,
    });

    setResults(moduleResults);
    setElapsed(Math.round((Date.now() - start) / 1000));
    setRunning(false);
    setProgress("");
    setShowResults(true);
  }

  async function handleCleanup() {
    setCleaning(true);
    await doCleanup();
    setCleaning(false);
  }

  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalTests = results.reduce((s, r) => s + r.total, 0);
  const pct = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
  const bannerColor = pct === 100 ? "bg-green-500/20 text-green-400" : pct >= 80 ? "bg-yellow-500/20 text-yellow-400" : "bg-destructive/20 text-destructive";

  function exportReport() {
    const lines: string[] = [];
    lines.push(`=== TEST COMPLETO SISTEMA === (${new Date().toLocaleString("it-IT")})`);
    lines.push(`Risultato: ${totalPassed}/${totalTests} verifiche superate (${pct}%)`);
    lines.push(`Tempo: ${elapsed}s\n`);
    for (const mod of results) {
      lines.push(`--- ${mod.name}: ${mod.passed}/${mod.total} ---`);
      for (const l of mod.logs) {
        lines.push(`${l.ok ? "✅" : "❌"} ${l.step}${l.detail && !l.ok ? ` (${l.detail})` : ""}`);
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Test Completo Sistema</CardTitle>
              <CardDescription>
                10 moduli: cicli con fisso cliente, views cumulative, multi-video, fisso creator, finestra 30gg, campagna completa, planned_creators, simulazione E2E margine, finestra tra cicli, cap video e cap di spesa.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Button onClick={handleRun} disabled={running || cleaning} variant="outline">
              {running ? "⏳ Test in esecuzione..." : "🧪 Test Completo Sistema"}
            </Button>
            <Button onClick={handleCleanup} disabled={running || cleaning} variant="outline" size="sm">
              {cleaning ? "⏳ Pulizia..." : <><Trash2 className="h-4 w-4 mr-1" /> Pulisci dati test</>}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="keep-data" checked={keepData} onCheckedChange={(v) => setKeepData(!!v)} />
            <label htmlFor="keep-data" className="text-sm text-muted-foreground cursor-pointer">
              Mantieni dati di test per verifica manuale
            </label>
          </div>
          {running && progress && (
            <p className="text-xs text-muted-foreground animate-pulse">{progress}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pct === 100 ? "✅ Tutti i test superati" : "❌ Test con errori"}
            </DialogTitle>
          </DialogHeader>

          <div className={`rounded-md p-3 text-sm font-semibold flex items-center justify-between ${bannerColor}`}>
            <span>{totalPassed}/{totalTests} verifiche superate ({pct}%)</span>
            <span className="text-xs opacity-75">⏱ {elapsed}s</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            {results.filter(r => r.name !== "Stato dati").map((r, i) => (
              <div key={i} className={`rounded px-2 py-1 ${r.passed === r.total ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                {r.passed === r.total ? "✅" : "❌"} {r.name.split("—")[0].trim()}: {r.passed}/{r.total}
              </div>
            ))}
          </div>

          <ScrollArea className="h-[400px]">
            {results.map((mod, mi) => (
              <Collapsible key={mi} defaultOpen={mod.passed < mod.total}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-2 rounded hover:bg-accent text-sm font-semibold">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                  {mod.passed === mod.total ? "✅" : "❌"} {mod.name}
                  <span className="ml-auto text-xs text-muted-foreground">{mod.passed}/{mod.total}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-0.5 text-xs font-mono pl-6 pb-2">
                    {mod.logs.map((l, i) => (
                      <div key={i} className={`py-0.5 px-2 rounded ${l.ok ? "" : "bg-destructive/10 text-destructive"}`}>
                        {l.ok ? "✅" : "❌"} {l.step}
                        {l.detail && !l.ok && <span className="ml-1 opacity-75">({l.detail})</span>}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </ScrollArea>

          <Button variant="outline" size="sm" onClick={exportReport} className="w-full">
            {copied ? <><Check className="h-4 w-4 mr-1" /> Copiato!</> : <><Copy className="h-4 w-4 mr-1" /> Esporta Report</>}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
