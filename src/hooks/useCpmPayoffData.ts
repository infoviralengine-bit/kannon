import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews, countByWindowStatus, type VideoWithWindow } from "@/lib/videoWindow";

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
      ]);

      const allCampaigns = campaigns ?? [];
      const allCreators = creators ?? [];
      const allCC = ccRows ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = (videos ?? []) as VideoWithWindow[];

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
        const viewsPeriod = sumEffectiveViews(campVideos);
        const windowStats = countByWindowStatus(campVideos);

        const clientCpmRate = camp.client_cpm ?? 2;
        const clientCpmAmount = clientCpmRate * (viewsPeriod / 1000);

        // Creator CPM for this campaign
        const creatorIds = allCC.filter((r) => r.campaign_id === camp.id).map((r) => r.creator_id);
        let creatorCpmAmount = 0;
        creatorIds.forEach((cid) => {
          const cr = allCreators.find((c) => c.id === cid);
          if (!cr) return;
          const crAccIds = allAccounts
            .filter((a) => a.creator_id === cid && a.campaign_id === camp.id)
            .map((a) => a.id);
          const crAccSet = new Set(crAccIds);
          const crViews = sumEffectiveViews(campVideos.filter((v) => crAccSet.has(v.tiktok_account_id)));
          creatorCpmAmount += (cr.creator_cpm ?? 0.5) * (crViews / 1000);
        });

        // Weekly views breakdown
        const weeklyViews = getWeeklyViews(campVideos, year, month);

        return {
          campaignId: camp.id,
          name: camp.name,
          clientName: camp.client_name,
          clientCpm: clientCpmRate,
          viewsPeriod,
          viewsDefinitive: windowStats.closed > 0
            ? sumEffectiveViews(campVideos.filter((v) => v.window_closed))
            : 0,
          viewsProvvisorie: windowStats.open > 0
            ? sumEffectiveViews(campVideos.filter((v) => !v.window_closed))
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

          const crAccIds = allAccounts
            .filter((a) => a.creator_id === cr.id && a.campaign_id === campId)
            .map((a) => a.id);
          const crAccSet = new Set(crAccIds);
          const crVideos = allVideos.filter((v) => crAccSet.has(v.tiktok_account_id));
          const viewsPeriod = sumEffectiveViews(crVideos);
          const windowStats = countByWindowStatus(crVideos);
          const cpmRate = cr.creator_cpm ?? 0.5;

          creatorRows.push({
            creatorId: cr.id,
            creatorName: cr.name,
            campaignName: camp.name,
            campaignId: campId,
            viewsPeriod,
            viewsDefinitive: sumEffectiveViews(crVideos.filter((v) => v.window_closed)),
            viewsProvvisorie: sumEffectiveViews(crVideos.filter((v) => !v.window_closed)),
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
): { week: string; views: number }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: { week: string; views: number }[] = [];
  let weekStart = 1;

  while (weekStart <= daysInMonth) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    const label = `${weekStart}-${weekEnd}`;
    const wStart = new Date(year, month, weekStart).toISOString();
    const wEnd = new Date(year, month, weekEnd + 1).toISOString();

    const weekViews = videos
      .filter((v) => v.published_at >= wStart && v.published_at < wEnd)
      .reduce((s, v) => s + (v.views ?? 0), 0);

    weeks.push({ week: label, views: weekViews });
    weekStart = weekEnd + 1;
  }

  return weeks;
}
