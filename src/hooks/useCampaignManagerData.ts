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

  // Enriched analytics
  creatorRankingDetailed: CreatorRankingItem[];
  formatStats: FormatStat[];
  viralVideos: VideoItem[];
  avgEngagementRate: number;
  avgQualityScore: number;
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
  shares: number | null;
  saves: number | null;
  durationSec: number | null;
  contentTag: string | null;
  publishedAt: string;
  viralVelocity: number;
  engagementRate: number;
  qualityScore: number;
}

export interface CreatorRankingItem {
  creatorId: string;
  creatorName: string;
  views: number;
  prevViews: number;
  videoCount: number;
  avgViewsPerVideo: number;
  engagementRate: number;
  qualityScore: number;
  topVideoViews: number;
}

export interface FormatStat {
  tag: string;
  videoCount: number;
  avgViews: number;
  avgEngagement: number;
  avgQualityScore: number;
}

function calcViralVelocity(views: number, publishedAt: string): number {
  const daysSince = Math.max(
    0.5,
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return views / daysSince;
}

function calcEngagementRate(likes: number, comments: number, views: number): number {
  if (views === 0) return 0;
  return ((likes + comments) / views) * 100;
}

function calcQualityScore(
  saves: number | null,
  shares: number | null,
  comments: number,
  views: number
): number {
  if (views === 0) return 0;
  const weighted = (saves ?? 0) * 3 + (shares ?? 0) * 2 + comments;
  return (weighted / views) * 1000;
}

function durationCategory(sec: number | null): "short" | "medium" | "long" | null {
  if (sec === null) return null;
  if (sec <= 15) return "short";
  if (sec <= 30) return "medium";
  return "long";
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
        supabase.from("videos").select("id, tiktok_video_id, tiktok_account_id, views, likes, comments, published_at"),
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

      // Video list from current period
      const videoItems: VideoItem[] = currentVideos.map((v) => {
        const accountId = v.tiktok_account_id;
        const username = accountUsernameMap.get(accountId) ?? "";
        const creatorId = accountCreatorMap.get(accountId) ?? "";
        const creatorName = creatorNameMap.get(creatorId) ?? "Sconosciuto";
        const campaignId = accountCampaignMap.get(accountId) ?? "";
        const campaignName = campaignNameMap.get(campaignId) ?? "";
        return {
          videoId: v.id,
          tiktokVideoId: v.tiktok_video_id,
          username,
          creatorId,
          creatorName,
          campaignId,
          campaignName,
          views: v.views ?? 0,
          likes: v.likes ?? 0,
          comments: v.comments ?? 0,
          publishedAt: v.published_at,
        };
      }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

      // Simplified creator ranking for insights
      const accountsByCreator = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      const spark7 = dateRange(7);
      const creatorRanking = allCreators.map((creator) => {
        const accIds = new Set(accountsByCreator.get(creator.id) ?? []);
        const views = currentVideos
          .filter((v) => accIds.has(v.tiktok_account_id))
          .reduce((s, v) => s + (v.views ?? 0), 0);
        const sparkVideos = allVideos.filter(
          (v) => accIds.has(v.tiktok_account_id) && v.published_at >= spark7.start && v.published_at < spark7.end
        );
        const dailySpark: number[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const key = d.toISOString().slice(0, 10);
          dailySpark.push(sparkVideos.filter((v) => v.published_at.slice(0, 10) === key).reduce((s, v) => s + (v.views ?? 0), 0));
        }
        return { creatorName: creator.name, views, dailyViews: dailySpark };
      }).filter((c) => c.views > 0).sort((a, b) => b.views - a.views);

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
        videos: videoItems,
        creatorRanking,
      };
    },
    staleTime: 60_000,
  });
}
