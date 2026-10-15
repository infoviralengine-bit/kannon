import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Operator RPCs never return financial fields; views are real TikTok views.
const rpc = async (fn: string, args?: Record<string, unknown>) => {
  const res = await (supabase.rpc as any)(fn, args);
  if (res.error) { console.error(fn, res.error); toast.error(`${fn}: ${res.error.message}`); }
  return res;
};

export interface OperatorCampaign {
  id: string;
  name: string;
  client_name: string;
  logo_url: string | null;
  start_date: string;
  end_date: string | null;
  creator_count: number;
  account_count: number;
  video_count: number;
  total_views: number;
}

export function useOperatorCampaigns() {
  return useQuery({
    queryKey: ["operator-campaigns"],
    queryFn: async (): Promise<OperatorCampaign[]> => {
      const { data, error } = await rpc("get_operator_campaigns");
      if (error) throw error;
      return (data ?? []) as OperatorCampaign[];
    },
  });
}

export interface OperatorAccount {
  id: string;
  username: string;
  is_active: boolean | null;
  video_count: number;
  total_views: number;
  last_video_at: string | null;
}

export interface OperatorCampaignDetail {
  campaign: { id: string; name: string; client_name: string; start_date: string; end_date: string | null; logo_url: string | null };
  creators: { id: string; name: string; status: string; accounts: OperatorAccount[] }[];
  unassigned_accounts: OperatorAccount[];
}

export function useOperatorCampaignDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["operator-campaign", id],
    enabled: !!id,
    queryFn: async (): Promise<OperatorCampaignDetail | null> => {
      const { data, error } = await rpc("get_operator_campaign_detail", { p_campaign_id: id });
      if (error) throw error;
      return (data ?? null) as OperatorCampaignDetail | null;
    },
  });
}

export interface OperatorFilters {
  from: string | null;
  to: string | null;
  campaignIds: string[];
  creatorIds: string[];
  accountIds: string[];
  format: string | null;
  window: "open" | "closing" | "closed" | null;
  minViews: number | null;
}

function toParams(f: OperatorFilters) {
  return {
    p_from: f.from,
    p_to: f.to,
    p_campaign_ids: f.campaignIds.length ? f.campaignIds : null,
    p_creator_ids: f.creatorIds.length ? f.creatorIds : null,
    p_account_ids: f.accountIds.length ? f.accountIds : null,
    p_format: f.format,
    p_window: f.window,
    p_min_views: f.minViews,
  };
}

export interface Breakdown { id?: string; name: string; videos: number; views: number; avg_views: number }

export interface OperatorAnalytics {
  kpis: {
    videos: number; views: number; likes: number; comments: number; shares: number;
    avg_views: number; engagement_pct: number; creators: number; accounts: number;
  };
  daily: { date: string; videos: number; views: number }[];
  by_campaign: Breakdown[];
  by_creator: Breakdown[];
  by_account: Breakdown[];
  by_format: Breakdown[];
}

export function useOperatorAnalytics(f: OperatorFilters) {
  return useQuery({
    queryKey: ["operator-analytics", f],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<OperatorAnalytics> => {
      const { data, error } = await rpc("get_operator_analytics", toParams(f));
      if (error) throw error;
      return data as OperatorAnalytics;
    },
  });
}

export type OperatorSort = "views" | "likes" | "comments" | "shares" | "engagement" | "published";

export interface OperatorVideo {
  id: string;
  tiktok_video_id: string;
  username: string;
  creator_name: string | null;
  campaign_name: string;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_pct: number;
  content_tag: string | null;
  caption: string | null;
  window_status: "open" | "closing" | "closed";
}

export function useOperatorVideoList(f: OperatorFilters, sort: OperatorSort, dir: "asc" | "desc", page: number, size: number) {
  return useQuery({
    queryKey: ["operator-videos", f, sort, dir, page, size],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ total: number; rows: OperatorVideo[] }> => {
      const { data, error } = await rpc("get_operator_video_list", {
        ...toParams(f), p_sort: sort, p_dir: dir, p_limit: size, p_offset: page * size,
      });
      if (error) throw error;
      return { total: Number(data?.total ?? 0), rows: (data?.rows ?? []) as OperatorVideo[] };
    },
  });
}

/** Filter option lists (creator and account names only, no sensitive fields). */
export function useOperatorFilterOptions() {
  return useQuery({
    queryKey: ["operator-filter-options"],
    queryFn: async () => {
      const [creators, accounts, formats] = await Promise.all([
        supabase.from("creators").select("id, name").eq("status", "active").order("name"),
        supabase.from("tiktok_accounts").select("id, username, campaign_id, creator_id").order("username"),
        supabase.from("video_formats").select("id, name").eq("is_active", true).order("name"),
      ]);
      return {
        creators: (creators.data ?? []) as { id: string; name: string }[],
        accounts: (accounts.data ?? []) as { id: string; username: string; campaign_id: string | null; creator_id: string | null }[],
        formats: (formats.data ?? []) as { id: string; name: string }[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
