import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViewsCapped, countByWindowStatus, type VideoWithWindow } from "@/lib/videoWindow";
import { computeContractPortion, type ContractInput } from "@/lib/creatorPayable";

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

/* ═══════════════════════════════════════════════
   CPM KPI (aggregate across all campaigns)
   ═══════════════════════════════════════════════ */

export interface CpmKpi {
  totalViews: number;
  clientCpmTotal: number;
  creatorCpmTotal: number;
  marginCpm: number;
}

/* ═══════════════════════════════════════════════
   Campaign CPM Detail
   ═══════════════════════════════════════════════ */

export interface CampaignCpmRow {
  campaignId: string;
  name: string;
  clientName: string;
  clientCpm: number;
  viewsPeriod: number;
  viewsDefinitive: number;
  viewsProvvisorie: number;
  clientCpmAmount: number;
  creatorCpmAmount: number;
  marginCpm: number;
  weeklyViews: { week: string; views: number }[];
}

/* ═══════════════════════════════════════════════
   Creator CPM Detail
   ═══════════════════════════════════════════════ */

export interface CreatorCpmRow {
  creatorId: string;
  creatorName: string;
  campaignName: string;
  campaignId: string;
  viewsPeriod: number;
  viewsDefinitive: number;
  viewsProvvisorie: number;
  cpmAmount: number;
  videoDefinitivi: number;
  videoProvvisori: number;
  creatorCpm: number;
}

/* ═══════════════════════════════════════════════
   Daily views for line chart (last 30 days from period)
   ═══════════════════════════════════════════════ */

export interface DailyViews {
  date: string;
  views: number;
}

/* ═══════════════════════════════════════════════
   Main hook
   ═══════════════════════════════════════════════ */

export function useCpmPayoffData(year: number, month: number) {
  const { start: mStart, end: mEnd } = monthRange(year, month);

  return useQuery({
    queryKey: ["cpm-payoff", year, month],
    queryFn: async () => {
      const [
        { data: campaigns },
        { data: creators },
        { data: ccRows },
        { data: accounts },
        { data: videos },
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
      ] = await Promise.all([
        supabase.from("campaigns").select("*").eq("status", "active"),
        supabase.from("creators").select("*").eq("status", "active"),
        supabase.from("campaign_creators").select("*"),
        supabase.from("tiktok_accounts").select("*"),
        supabase
          .from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", mStart)
          .lt("published_at", mEnd),
        supabase.from("contracts" as any).select("id, name, creator_cpm, creator_fixed, min_videos_per_day").eq("is_active", true),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
      ]);

      const allCampaigns = campaigns ?? [];
      const allCreators = creators ?? [];
      const allCC = ccRows ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = (videos ?? []) as VideoWithWindow[];
      const allContracts = ((contracts ?? []) as any[]) as ContractInput[];
      const allContractCamp = (contractCampaigns ?? []) as any[];
      const allContractCr = (contractCreators ?? []) as any[];

      // contractId → campaignIds
      const contractCampMap = new Map<string, string[]>();
      allContractCamp.forEach((r: any) => {
        const l = contractCampMap.get(r.contract_id) ?? [];
        l.push(r.campaign_id);
        contractCampMap.set(r.contract_id, l);
      });
      // campaignId → contractId (campagne non si sovrappongono)
      const contractByCampaign = new Map<string, string>();
      allContractCamp.forEach((r: any) => contractByCampaign.set(r.campaign_id, r.contract_id));
      // creatorId → contractIds (only contracts the creator belongs to)
      const contractsByCreator = new Map<string, string[]>();
      allContractCr.forEach((r: any) => {
        const l = contractsByCreator.get(r.creator_id) ?? [];
        l.push(r.contract_id);
        contractsByCreator.set(r.creator_id, l);
      });
      const contractById = new Map(allContracts.map((c) => [c.id, c]));

      // Maps
      const accountsByCampaign = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.campaign_id) return;
        const list = accountsByCampaign.get(a.campaign_id) ?? [];
        list.push(a.id);
        accountsByCampaign.set(a.campaign_id, list);
      });

      const accountsByCreator = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      // ── Campaign CPM Rows ──
      const campaignRows: CampaignCpmRow[] = allCampaigns.map((camp) => {
        const campAccIds = new Set(accountsByCampaign.get(camp.id) ?? []);
        const campVideos = allVideos.filter((v) => campAccIds.has(v.tiktok_account_id));
        const cap = (camp as any).video_views_cap as number | null;
        const viewsPeriod = sumEffectiveViewsCapped(campVideos, cap);
        const windowStats = countByWindowStatus(campVideos);

        const clientCpmRate = camp.client_cpm ?? 0; // client rates: separate refactor
        const clientCpmAmount = clientCpmRate * (viewsPeriod / 1000);

        // Creator CPM for this campaign — read from the contract that covers it
        const contractId = contractByCampaign.get(camp.id);
        const contract = contractId ? contractById.get(contractId) : undefined;
        const cpmRate = contract ? Number(contract.creator_cpm ?? 0) : 0;
        const creatorIds = allCC.filter((r) => r.campaign_id === camp.id).map((r) => r.creator_id);
        let creatorCpmAmount = 0;
        creatorIds.forEach((cid) => {
          // Only count creators actually attached to the covering contract
          if (contractId) {
            const crContracts = contractsByCreator.get(cid) ?? [];
            if (!crContracts.includes(contractId)) return;
          }
          const crAccIds = allAccounts
            .filter((a) => a.creator_id === cid && a.campaign_id === camp.id)
            .map((a) => a.id);
          const crAccSet = new Set(crAccIds);
          const crViews = sumEffectiveViewsCapped(campVideos.filter((v) => crAccSet.has(v.tiktok_account_id)), cap);
          creatorCpmAmount += cpmRate * (crViews / 1000);
        });

        // Weekly views breakdown
        const weeklyViews = getWeeklyViews(campVideos, year, month, cap);

        return {
          campaignId: camp.id,
          name: camp.name,
          clientName: camp.client_name,
          clientCpm: clientCpmRate,
          viewsPeriod,
          viewsDefinitive: windowStats.closed > 0
            ? sumEffectiveViewsCapped(campVideos.filter((v) => v.window_closed), cap)
            : 0,
          viewsProvvisorie: windowStats.open > 0
            ? sumEffectiveViewsCapped(campVideos.filter((v) => !v.window_closed), cap)
            : 0,
          clientCpmAmount,
          creatorCpmAmount,
          marginCpm: clientCpmAmount - creatorCpmAmount,
          weeklyViews,
        };
      });

      // ── Creator CPM Rows ──
      const creatorRows: CreatorCpmRow[] = [];
      allCreators.forEach((cr) => {
        const crCampaignIds = allCC
          .filter((r) => r.creator_id === cr.id)
          .map((r) => r.campaign_id);

        crCampaignIds.forEach((campId) => {
          const camp = allCampaigns.find((c) => c.id === campId);
          if (!camp) return;
          // tariff from contract covering THIS campaign
          const ctId = contractByCampaign.get(campId);
          const ctr = ctId ? contractById.get(ctId) : undefined;
          // Only if creator actually belongs to that contract
          if (!ctId || !(contractsByCreator.get(cr.id) ?? []).includes(ctId)) return;
          const cpmRate = ctr ? Number(ctr.creator_cpm ?? 0) : 0;

          const cap = (camp as any).video_views_cap as number | null;
          const crAccIds = allAccounts
            .filter((a) => a.creator_id === cr.id && a.campaign_id === campId)
            .map((a) => a.id);
          const crAccSet = new Set(crAccIds);
          const crVideos = allVideos.filter((v) => crAccSet.has(v.tiktok_account_id));
          const viewsPeriod = sumEffectiveViewsCapped(crVideos, cap);
          const windowStats = countByWindowStatus(crVideos);

          creatorRows.push({
            creatorId: cr.id,
            creatorName: cr.name,
            campaignName: camp.name,
            campaignId: campId,
            viewsPeriod,
            viewsDefinitive: sumEffectiveViewsCapped(crVideos.filter((v) => v.window_closed), cap),
            viewsProvvisorie: sumEffectiveViewsCapped(crVideos.filter((v) => !v.window_closed), cap),
            cpmAmount: cpmRate * (viewsPeriod / 1000),
            videoDefinitivi: windowStats.closed,
            videoProvvisori: windowStats.open,
            creatorCpm: cpmRate,
          });
        });
      });

      // ── KPI Totals ──
      const totalViews = campaignRows.reduce((s, r) => s + r.viewsPeriod, 0);
      const clientCpmTotal = campaignRows.reduce((s, r) => s + r.clientCpmAmount, 0);
      const creatorCpmTotal = campaignRows.reduce((s, r) => s + r.creatorCpmAmount, 0);
      const marginCpm = clientCpmTotal - creatorCpmTotal;

      // ── Daily views (for line chart) ──
      const dailyViews = getDailyViews(allVideos, year, month);

      const kpi: CpmKpi = { totalViews, clientCpmTotal, creatorCpmTotal, marginCpm };

      return { kpi, campaignRows, creatorRows, dailyViews };
    },
  });
}

/* ── Helpers ── */

function getDailyViews(videos: VideoWithWindow[], year: number, month: number): DailyViews[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyMap = new Map<string, number>();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dailyMap.set(dateStr, 0);
  }

  videos.forEach((v) => {
    const date = v.published_at.slice(0, 10);
    if (dailyMap.has(date)) {
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + (v.views ?? 0));
    }
  });

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }));
}

function getWeeklyViews(
  videos: VideoWithWindow[],
  year: number,
  month: number,
  cap?: number | null,
): { week: string; views: number }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: { week: string; views: number }[] = [];
  let weekStart = 1;

  while (weekStart <= daysInMonth) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    const label = `${weekStart}-${weekEnd}`;
    const wStart = new Date(year, month, weekStart).toISOString();
    const wEnd = new Date(year, month, weekEnd + 1).toISOString();

    const weekVids = videos.filter((v) => v.published_at >= wStart && v.published_at < wEnd);
    const weekViews = sumEffectiveViewsCapped(weekVids, cap);

    weeks.push({ week: label, views: weekViews });
    weekStart = weekEnd + 1;
  }

  return weeks;
}
