import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VideoAnalyticsFilters {
  from: string;
  to: string;
  campaignIds?: string[];
  creatorIds?: string[];
}

export interface VideoAnalyticsKPI {
  total_videos: number;
  total_views: number;
  total_raw_views: number;
  total_likes: number;
  total_comments: number;
  avg_views_per_video: number;
  avg_engagement_pct: number;
}

export interface WindowStats {
  open_count: number;
  closing_count: number;
  closed_count: number;
}

export interface CampaignBreakdown {
  campaign_id: string;
  campaign_name: string;
  client_name: string | null;
  video_count: number;
  total_views: number;
  total_engagements: number;
  avg_views_per_video: number;
}

export interface CreatorBreakdown {
  creator_id: string;
  creator_name: string;
  video_count: number;
  total_views: number;
  total_engagements: number;
  avg_views_per_video: number;
}

export interface DayBreakdown {
  day: string;
  video_count: number;
  total_views: number;
  total_engagements: number;
}

export interface TopVideoSummary {
  id: string;
  tiktok_video_id: string;
  account_username: string;
  creator_name: string | null;
  campaign_name: string | null;
  effective_views: number;
  likes: number;
  comments: number;
  published_at: string;
  tiktok_url: string;
  window_status: "open" | "closing" | "closed";
}

export interface VideoAnalyticsData {
  kpi: VideoAnalyticsKPI;
  window_stats: WindowStats;
  by_campaign: CampaignBreakdown[];
  by_creator: CreatorBreakdown[];
  by_day: DayBreakdown[];
  top_video: TopVideoSummary | null;
}

export function useVideoAnalytics(filters: VideoAnalyticsFilters) {
  return useQuery({
    queryKey: ["video-analytics", filters],
    queryFn: async (): Promise<VideoAnalyticsData> => {
      const { data, error } = await (supabase.rpc as any)("get_video_analytics", {
        p_from: filters.from,
        p_to: filters.to,
        p_campaign_ids: filters.campaignIds && filters.campaignIds.length > 0 ? filters.campaignIds : null,
        p_creator_ids: filters.creatorIds && filters.creatorIds.length > 0 ? filters.creatorIds : null,
      });
      if (error) throw error;
      return data as VideoAnalyticsData;
    },
  });
}

export interface TopVideoRow {
  id: string;
  tiktok_video_id: string;
  account_username: string;
  creator_id: string | null;
  creator_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  client_name: string | null;
  published_at: string;
  effective_views: number;
  raw_views: number;
  likes: number;
  comments: number;
  engagement_pct: number;
  window_status: "open" | "closing" | "closed";
  tiktok_url: string;
  total_count: number;
}

export type TopVideosSortBy = "views" | "likes" | "comments" | "published" | "engagement";

export function useTopVideos(
  filters: VideoAnalyticsFilters,
  sortBy: TopVideosSortBy = "views",
  sortDir: "asc" | "desc" = "desc",
  page: number = 0,
  pageSize: number = 25,
) {
  return useQuery({
    queryKey: ["top-videos", filters, sortBy, sortDir, page, pageSize],
    queryFn: async (): Promise<{ rows: TopVideoRow[]; totalCount: number }> => {
      const { data, error } = await (supabase.rpc as any)("get_top_videos", {
        p_from: filters.from,
        p_to: filters.to,
        p_campaign_ids: filters.campaignIds && filters.campaignIds.length > 0 ? filters.campaignIds : null,
        p_creator_ids: filters.creatorIds && filters.creatorIds.length > 0 ? filters.creatorIds : null,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw error;
      const rows = (data ?? []) as TopVideoRow[];
      return { rows, totalCount: Number(rows[0]?.total_count ?? 0) };
    },
  });
}

export function useRefreshTikTokScraping() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-tiktok", { body: {} });
      if (error) throw error;
      return data;
    },
  });
}

export function useLastScrapeLog() {
  return useQuery({
    queryKey: ["last-scrape-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraping_logs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { run_at: string; status: string; accounts_processed: number | null; videos_updated: number | null; videos_created: number | null } | null;
    },
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// SP#5 Part A: resilient scraping status (background polling)
// ---------------------------------------------------------------------------
export interface ScrapingLog {
  id: string;
  run_at: string;
  status: "running" | "success" | "error";
  accounts_processed: number;
  videos_created: number;
  videos_updated: number;
  error_message: string | null;
  run_id: string | null;
  dataset_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  progress_note: string | null;
}

/** Current scraping log. Polls every 3s while running, 30s otherwise. */
export function useScrapingStatus() {
  return useQuery({
    queryKey: ["scraping-status-current"],
    queryFn: async (): Promise<ScrapingLog | null> => {
      const { data, error } = await supabase
        .from("scraping_logs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ScrapingLog | null;
    },
    refetchInterval: (q) => {
      const d = q.state.data as ScrapingLog | null;
      return d?.status === "running" ? 3_000 : 30_000;
    },
  });
}

export function useStartScraping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("scrape-tiktok", { body: {} });
      if (error) throw error;
      return data as { ok: boolean; log_id: string; run_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scraping-status-current"] });
    },
  });
}

export function useImportDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datasetId: string) => {
      const { data, error } = await supabase.functions.invoke("scrape-tiktok", { body: { datasetId } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scraping-status-current"] });
    },
  });
}