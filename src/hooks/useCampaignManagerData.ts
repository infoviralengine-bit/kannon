import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Period = "7d" | "30d" | "90d";

export function useVideoFormats() {
  return useQuery({
    queryKey: ["video-formats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_formats" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string }[];
    },
    staleTime: 60_000,
  });
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
  // All videos (no period filter) — used by the KPI explorer
  allVideos: VideoItem[];

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

export function useCampaignManagerData(period: Period) {
  return useQuery({
    queryKey: ["campaign-manager", period],
    queryFn: async (): Promise<CampaignManagerData> => {
      // Server-side aggregation via SECURITY DEFINER RPC.
      const { data, error } = await supabase.rpc("get_campaign_manager_data", {
        p_period: period,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<CampaignManagerData>;
      // Coerce numeric defaults so downstream UI never sees undefined.
      return {
        totalViews: Number(d.totalViews ?? 0),
        prevTotalViews: Number(d.prevTotalViews ?? 0),
        activeCreators: Number(d.activeCreators ?? 0),
        prevActiveCreators: Number(d.prevActiveCreators ?? 0),
        publishedContent: Number(d.publishedContent ?? 0),
        prevPublishedContent: Number(d.prevPublishedContent ?? 0),
        avgCpm: Number(d.avgCpm ?? 0),
        prevAvgCpm: Number(d.prevAvgCpm ?? d.avgCpm ?? 0),
        campaigns: (d.campaigns ?? []) as CampaignSummary[],
        dailyViews: (d.dailyViews ?? []) as DailyViewPoint[],
        videos: (d.videos ?? []) as VideoItem[],
        allVideos: (d.allVideos ?? []) as VideoItem[],
        creatorRanking: (d.creatorRanking ?? []) as CampaignManagerData["creatorRanking"],
        creatorRankingDetailed: (d.creatorRankingDetailed ?? []) as CreatorRankingItem[],
        formatStats: (d.formatStats ?? []) as FormatStat[],
        viralVideos: (d.viralVideos ?? []) as VideoItem[],
        avgEngagementRate: Number(d.avgEngagementRate ?? 0),
        avgQualityScore: Number(d.avgQualityScore ?? 0),
      };
    },
    staleTime: 60_000,
  });
}
