import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function weekRange() {
  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function monthRangeFor(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

function currentMonthRange() {
  const now = new Date();
  return monthRangeFor(now.getFullYear(), now.getMonth());
}

/* ── Creator Table (list page) ── */

export interface CreatorTableRow {
  id: string;
  name: string;
  status: string;
  activeCampaigns: number;
  totalViews: number;
  todayVideos: number;
  minVideos: number;
  isOnTrack: boolean;
}

export function useCreatorTable() {
  const { start: tStart, end: tEnd } = todayRange();

  return useQuery({
    queryKey: ["creator-table"],
    queryFn: async () => {
      const { data: creators } = await supabase.from("creators").select("*");
      if (!creators?.length) return [] as CreatorTableRow[];

      const { data: ccRows } = await supabase.from("campaign_creators").select("campaign_id, creator_id");
      const { data: campaigns } = await supabase.from("campaigns").select("id, status");
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, creator_id");
      const { data: allVideos } = await supabase.from("videos").select("tiktok_account_id, views, published_at");

      const activeCampaignIds = new Set((campaigns ?? []).filter(c => c.status === "active").map(c => c.id));

      const accountsByCreator = new Map<string, string[]>();
      (accounts ?? []).forEach(a => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      return creators.map((c): CreatorTableRow => {
        const accIds = new Set(accountsByCreator.get(c.id) ?? []);
        const vids = (allVideos ?? []).filter(v => accIds.has(v.tiktok_account_id));
        const todayVideos = vids.filter(v => v.published_at >= tStart && v.published_at < tEnd).length;
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
        const activeCampaigns = (ccRows ?? []).filter(r => r.creator_id === c.id && activeCampaignIds.has(r.campaign_id)).length;
        const min = c.min_videos_per_day ?? 5;

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          activeCampaigns,
          totalViews,
          todayVideos,
          minVideos: min,
          isOnTrack: todayVideos >= min,
        };
      });
    },
  });
}

/* ── Creator Detail ── */

export function useCreatorDetail(creatorId: string) {
  return useQuery({
    queryKey: ["creator-detail", creatorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("creators").select("*").eq("id", creatorId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!creatorId,
  });
}

/* ── Creator KPIs ── */

export function useCreatorKpi(creatorId: string) {
  const { start: tStart, end: tEnd } = todayRange();
  const { start: wStart, end: wEnd } = weekRange();
  const { start: mStart, end: mEnd } = currentMonthRange();

  return useQuery({
    queryKey: ["creator-kpi", creatorId],
    queryFn: async () => {
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("creator_id", creatorId);
      const accIds = (accounts ?? []).map(a => a.id);

      if (!accIds.length) return { todayVideos: 0, weekVideos: 0, monthVideos: 0, totalViews: 0, monthViews: 0, activeCampaigns: 0 };

      const { data: allVideos } = await supabase.from("videos").select("views, published_at").in("tiktok_account_id", accIds);
      const vids = allVideos ?? [];

      const todayVideos = vids.filter(v => v.published_at >= tStart && v.published_at < tEnd).length;
      const weekVideos = vids.filter(v => v.published_at >= wStart && v.published_at < wEnd).length;
      const monthVideos = vids.filter(v => v.published_at >= mStart && v.published_at < mEnd).length;
      const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
      const monthViews = vids.filter(v => v.published_at >= mStart && v.published_at < mEnd).reduce((s, v) => s + (v.views ?? 0), 0);

      const { data: cc } = await supabase.from("campaign_creators").select("campaign_id").eq("creator_id", creatorId);
      const campIds = (cc ?? []).map(r => r.campaign_id);
      let activeCampaigns = 0;
      if (campIds.length) {
        const { count } = await supabase.from("campaigns").select("*", { count: "exact", head: true }).in("id", campIds).eq("status", "active");
        activeCampaigns = count ?? 0;
      }

      return { todayVideos, weekVideos, monthVideos, totalViews, monthViews, activeCampaigns };
    },
    enabled: !!creatorId,
  });
}

/* ── Payoff for a given month ── */

export function useCreatorPayoff(creatorId: string, year: number, month: number) {
  const { start: mStart, end: mEnd } = monthRangeFor(year, month);

  return useQuery({
    queryKey: ["creator-payoff", creatorId, year, month],
    queryFn: async () => {
      const { data: creator } = await supabase.from("creators").select("creator_cpm, creator_fixed, min_videos_per_day").eq("id", creatorId).single();
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("creator_id", creatorId);
      const accIds = (accounts ?? []).map(a => a.id);

      let monthViews = 0;
      let daysUnderMin: { date: string; count: number; min: number }[] = [];
      const min = creator?.min_videos_per_day ?? 5;

      if (accIds.length) {
        const { data: vids } = await supabase.from("videos").select("views, published_at").in("tiktok_account_id", accIds).gte("published_at", mStart).lt("published_at", mEnd);
        monthViews = (vids ?? []).reduce((s, v) => s + (v.views ?? 0), 0);

        // Group by day
        const byDay = new Map<string, number>();
        (vids ?? []).forEach(v => {
          const day = v.published_at.slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + 1);
        });

        // Check each day of the month up to today
        const start = new Date(year, month, 1);
        const now = new Date();
        const endDay = year === now.getFullYear() && month === now.getMonth() ? now.getDate() : new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= endDay; d++) {
          const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = byDay.get(dayStr) ?? 0;
          if (count < min) {
            daysUnderMin.push({ date: dayStr, count, min });
          }
        }
      }

      const creatorFixed = creator?.creator_fixed ?? 200;
      const creatorCpm = creator?.creator_cpm ?? 0.5;
      const cpmAmount = creatorCpm * (monthViews / 1000);
      const fixedAtRisk = daysUnderMin.length > 0;

      return {
        monthViews,
        creatorFixed,
        creatorCpm,
        cpmAmount,
        total: creatorFixed + cpmAmount,
        fixedAtRisk,
        daysUnderMin,
        min,
      };
    },
    enabled: !!creatorId,
  });
}

/* ── Creator Accounts ── */

export interface CreatorAccountRow {
  accountId: string;
  username: string;
  accountType: string;
  campaignName: string | null;
  todayVideos: number;
  totalViews: number;
  minVideos: number;
  isOnTrack: boolean;
}

export function useCreatorAccounts(creatorId: string) {
  const { start: tStart, end: tEnd } = todayRange();

  return useQuery({
    queryKey: ["creator-accounts", creatorId],
    queryFn: async () => {
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, username, account_type, campaign_id").eq("creator_id", creatorId);
      if (!accounts?.length) return [] as CreatorAccountRow[];

      const { data: creator } = await supabase.from("creators").select("min_videos_per_day").eq("id", creatorId).single();
      const min = creator?.min_videos_per_day ?? 5;

      const campIds = [...new Set(accounts.map(a => a.campaign_id).filter(Boolean))] as string[];
      let campMap = new Map<string, string>();
      if (campIds.length) {
        const { data: camps } = await supabase.from("campaigns").select("id, name").in("id", campIds);
        (camps ?? []).forEach(c => campMap.set(c.id, c.name));
      }

      const accIds = accounts.map(a => a.id);
      const { data: allVids } = await supabase.from("videos").select("tiktok_account_id, views, published_at").in("tiktok_account_id", accIds);

      return accounts.map((a): CreatorAccountRow => {
        const vids = (allVids ?? []).filter(v => v.tiktok_account_id === a.id);
        const todayVideos = vids.filter(v => v.published_at >= tStart && v.published_at < tEnd).length;
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);

        return {
          accountId: a.id,
          username: a.username,
          accountType: a.account_type,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          todayVideos,
          totalViews,
          minVideos: min,
          isOnTrack: todayVideos >= min,
        };
      });
    },
    enabled: !!creatorId,
  });
}

/* ── Creator Campaigns ── */

export interface CreatorCampaignRow {
  campaignId: string;
  name: string;
  clientName: string;
  startDate: string;
  views: number;
}

export function useCreatorCampaigns(creatorId: string) {
  return useQuery({
    queryKey: ["creator-campaigns", creatorId],
    queryFn: async () => {
      const { data: cc } = await supabase.from("campaign_creators").select("campaign_id").eq("creator_id", creatorId);
      const campIds = (cc ?? []).map(r => r.campaign_id);
      if (!campIds.length) return [] as CreatorCampaignRow[];

      const { data: campaigns } = await supabase.from("campaigns").select("id, name, client_name, start_date").in("id", campIds);
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, campaign_id").eq("creator_id", creatorId);
      const { data: allVids } = await supabase.from("videos").select("tiktok_account_id, views");

      return (campaigns ?? []).map((c): CreatorCampaignRow => {
        const accIds = new Set((accounts ?? []).filter(a => a.campaign_id === c.id).map(a => a.id));
        const views = (allVids ?? []).filter(v => accIds.has(v.tiktok_account_id)).reduce((s, v) => s + (v.views ?? 0), 0);
        return { campaignId: c.id, name: c.name, clientName: c.client_name, startDate: c.start_date, views };
      });
    },
    enabled: !!creatorId,
  });
}
