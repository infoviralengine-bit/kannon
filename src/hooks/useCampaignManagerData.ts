import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Period = "7d" | "30d" | "90d";

function getPeriodDays(period: Period): number {
  return period === "7d" ? 7 : period === "30d" ? 30 : 90;
}

function dateRange(days: number, offset = 0) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - offset);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface CampaignManagerData {
  // KPI
  totalViews: number;
  prevTotalViews: number;
  activeCreators: number;
  prevActiveCreators: number;
  publishedContent: number;
  prevPublishedContent: number;
  avgCpm: number;
  prevAvgCpm: number;

  // Campaign summaries
  campaigns: CampaignSummary[];

  // Daily views per campaign
  dailyViews: DailyViewPoint[];

  // Video list
  videos: VideoItem[];

  // For insights
  creatorRanking: { creatorName: string; views: number; dailyViews: number[] }[];
}

export interface CampaignSummary {
  id: string;
  name: string;
  views: number;
  prevViews: number;
  activeCreators: number;
}

export interface DailyViewPoint {
  date: string;
  [campaignName: string]: number | string;
}

export interface VideoItem {
  videoId: string;
  tiktokVideoId: string;
  username: string;
  creatorId: string;
  creatorName: string;
  campaignId: string;
  campaignName: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
}

export function useCampaignManagerData(period: Period) {
  const days = getPeriodDays(period);

  return useQuery({
    queryKey: ["campaign-manager", period],
    queryFn: async (): Promise<CampaignManagerData> => {
      const current = dateRange(days);
      const prev = dateRange(days, days);

      // Fetch all needed data in parallel
      const [
        { data: campaigns },
        { data: accounts },
        { data: videos },
        { data: creators },
        { data: ccRows },
      ] = await Promise.all([
        supabase.from("campaigns").select("id, name, status, client_cpm").eq("status", "active"),
        supabase.from("tiktok_accounts").select("id, campaign_id, creator_id, username"),
        supabase.from("videos").select("id, tiktok_account_id, views, published_at"),
        supabase.from("creators").select("id, name, status"),
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
      ]);

      const allCampaigns = campaigns ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = videos ?? [];
      const allCreators = creators ?? [];
      const allCC = ccRows ?? [];

      // Maps
      const accountCampaignMap = new Map<string, string>();
      const accountCreatorMap = new Map<string, string>();
      const accountUsernameMap = new Map<string, string>();
      allAccounts.forEach((a) => {
        if (a.campaign_id) accountCampaignMap.set(a.id, a.campaign_id);
        if (a.creator_id) accountCreatorMap.set(a.id, a.creator_id);
        accountUsernameMap.set(a.id, a.username);
      });

      const creatorNameMap = new Map(allCreators.map((c) => [c.id, c.name]));
      const campaignNameMap = new Map(allCampaigns.map((c) => [c.id, c.name]));

      // Filter videos by period
      const inRange = (v: { published_at: string }, start: string, end: string) =>
        v.published_at >= start && v.published_at < end;

      const currentVideos = allVideos.filter((v) => inRange(v, current.start, current.end));
      const prevVideos = allVideos.filter((v) => inRange(v, prev.start, prev.end));

      // KPI - Total Views
      const totalViews = currentVideos.reduce((s, v) => s + (v.views ?? 0), 0);
      const prevTotalViews = prevVideos.reduce((s, v) => s + (v.views ?? 0), 0);

      // KPI - Active Creators (with published video in period)
      const activeCreatorIds = new Set<string>();
      currentVideos.forEach((v) => {
        const cid = accountCreatorMap.get(v.tiktok_account_id);
        if (cid) activeCreatorIds.add(cid);
      });
      const prevActiveCreatorIds = new Set<string>();
      prevVideos.forEach((v) => {
        const cid = accountCreatorMap.get(v.tiktok_account_id);
        if (cid) prevActiveCreatorIds.add(cid);
      });

      // KPI - Published Content
      const publishedContent = currentVideos.length;
      const prevPublishedContent = prevVideos.length;

      // KPI - Avg CPM
      const cpmValues = allCampaigns.map((c) => c.client_cpm ?? 0).filter((v) => v > 0);
      const avgCpm = cpmValues.length ? cpmValues.reduce((s, v) => s + v, 0) / cpmValues.length : 0;
      const prevAvgCpm = avgCpm; // CPM doesn't change per period

      // Campaign summaries
      const campaignSummaries: CampaignSummary[] = allCampaigns.map((camp) => {
        const campAccountIds = new Set(
          allAccounts.filter((a) => a.campaign_id === camp.id).map((a) => a.id)
        );
        const views = currentVideos
          .filter((v) => campAccountIds.has(v.tiktok_account_id))
          .reduce((s, v) => s + (v.views ?? 0), 0);
        const prevV = prevVideos
          .filter((v) => campAccountIds.has(v.tiktok_account_id))
          .reduce((s, v) => s + (v.views ?? 0), 0);

        const campCreatorIds = new Set(
          allCC.filter((r) => r.campaign_id === camp.id).map((r) => r.creator_id)
        );
        const activeC = [...campCreatorIds].filter((cid) => {
          const cr = allCreators.find((c) => c.id === cid);
          return cr?.status === "active";
        }).length;

        return { id: camp.id, name: camp.name, views, prevViews: prevV, activeCreators: activeC };
      });

      // Daily views per campaign
      const dailyMap = new Map<string, Map<string, number>>();
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, new Map());
      }

      currentVideos.forEach((v) => {
        const day = v.published_at.slice(0, 10);
        const campId = accountCampaignMap.get(v.tiktok_account_id);
        if (!campId || !dailyMap.has(day)) return;
        const dayData = dailyMap.get(day)!;
        const campName = campaignNameMap.get(campId) ?? campId;
        dayData.set(campName, (dayData.get(campName) ?? 0) + (v.views ?? 0));
      });

      const dailyViews: DailyViewPoint[] = [...dailyMap.entries()].map(([date, data]) => {
        const point: DailyViewPoint = { date };
        data.forEach((views, name) => {
          point[name] = views;
        });
        return point;
      });

      // Creator ranking
      const creatorCampaignMap = new Map<string, Set<string>>();
      allCC.forEach((r) => {
        const set = creatorCampaignMap.get(r.creator_id) ?? new Set();
        set.add(r.campaign_id);
        creatorCampaignMap.set(r.creator_id, set);
      });

      // Group accounts by creator
      const accountsByCreator = new Map<string, typeof allAccounts>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a);
        accountsByCreator.set(a.creator_id, list);
      });

      // 7-day range for sparklines
      const spark7 = dateRange(7);

      const creatorRanking: CreatorRank[] = [];
      allCreators.forEach((creator) => {
        const accs = accountsByCreator.get(creator.id) ?? [];
        if (!accs.length) return;

        const accIds = new Set(accs.map((a) => a.id));
        const cVideos = currentVideos.filter((v) => accIds.has(v.tiktok_account_id));
        const views = cVideos.reduce((s, v) => s + (v.views ?? 0), 0);

        // Get campaign for first account
        const campIds = creatorCampaignMap.get(creator.id);
        if (!campIds?.size) return;

        const campId = [...campIds][0];
        const campName = campaignNameMap.get(campId) ?? "";

        // Sparkline: last 7 days
        const sparkVideos = allVideos.filter(
          (v) => accIds.has(v.tiktok_account_id) && v.published_at >= spark7.start && v.published_at < spark7.end
        );
        const dailySpark: number[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const key = d.toISOString().slice(0, 10);
          const dayViews = sparkVideos
            .filter((v) => v.published_at.slice(0, 10) === key)
            .reduce((s, v) => s + (v.views ?? 0), 0);
          dailySpark.push(dayViews);
        }

        creatorRanking.push({
          creatorId: creator.id,
          creatorName: creator.name,
          campaignId: campId,
          campaignName: campName,
          accounts: accs.map((a) => a.username),
          views,
          contentCount: cVideos.length,
          dailyViews: dailySpark,
        });
      });

      creatorRanking.sort((a, b) => b.views - a.views);

      return {
        totalViews,
        prevTotalViews,
        activeCreators: activeCreatorIds.size,
        prevActiveCreators: prevActiveCreatorIds.size,
        publishedContent,
        prevPublishedContent,
        avgCpm,
        prevAvgCpm,
        campaigns: campaignSummaries,
        dailyViews,
        creatorRanking,
      };
    },
    staleTime: 60_000,
  });
}
