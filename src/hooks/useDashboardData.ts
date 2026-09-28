import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyTarget } from "@/lib/fixedEarned";

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

function yesterdayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return { start, end };
}

async function fetchVideosViewsInRange(start: string, end: string) {
  const { data } = await supabase
    .from("videos")
    .select("views")
    .gte("published_at", start)
    .lt("published_at", end);
  return (data ?? []).reduce((sum, v) => sum + (v.views ?? 0), 0);
}

export function useViewsToday() {
  const { start, end } = todayRange();
  return useQuery({
    queryKey: ["views-today"],
    queryFn: () => fetchVideosViewsInRange(start, end),
  });
}

export function useViewsYesterday() {
  const { start, end } = yesterdayRange();
  return useQuery({
    queryKey: ["views-yesterday"],
    queryFn: () => fetchVideosViewsInRange(start, end),
  });
}

export function useViewsMonth() {
  const { start, end } = monthRange();
  return useQuery({
    queryKey: ["views-month"],
    queryFn: () => fetchVideosViewsInRange(start, end),
  });
}

export function useActiveCampaigns() {
  return useQuery({
    queryKey: ["active-campaigns-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
  });
}

export function useActiveCreators() {
  return useQuery({
    queryKey: ["active-creators-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("creators")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
  });
}

export interface CampaignRow {
  id: string;
  name: string;
  client_name: string;
  companyLogoUrl: string | null;
  companyName: string | null;
  status: string;
  totalViews: number;
  minMonthlyVideos: number | null;
  creatorCount: number;
}

export function useCampaignTable() {
  return useQuery({
    queryKey: ["campaign-table"],
    queryFn: async () => {
      const { data: campaigns } = await supabase.from("campaigns").select("*");
      if (!campaigns?.length) return [] as CampaignRow[];

      const campaignIds = campaigns.map((c) => c.id);

      const [
        { data: ccRows },
        { data: creators },
        { data: accounts },
        { data: totalViewsData },
        { data: companyRows },
      ] = await Promise.all([
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
        supabase.from("creators").select("id, status"),
        supabase.from("tiktok_accounts").select("id, campaign_id, creator_id"),
        supabase.rpc("get_campaign_total_views", { p_campaign_ids: campaignIds }),
        supabase.from("companies").select("id, name, logo_url"),
      ]);
      const companyNameMap = new Map((companyRows ?? []).map((company) => [company.id, company.name]));
      const companyLogoMap = new Map((companyRows ?? []).map((company) => [company.id, company.logo_url]));

      // Build a map of campaign_id -> total views from server-side RPC (no 1000-row limit)
      const totalViewsMap = new Map<string, number>();
      (totalViewsData ?? []).forEach((r: { campaign_id: string; total_views: number }) => {
        totalViewsMap.set(r.campaign_id, r.total_views);
      });

      const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]));

      return campaigns.map((c): CampaignRow => {
        const totalViews = totalViewsMap.get(c.id) ?? 0;

        // Creators = explicit assignments UNION creators owning an account linked to the campaign
        const campaignCreatorIds = new Set<string>(
          (ccRows ?? []).filter((r) => r.campaign_id === c.id).map((r) => r.creator_id)
        );
        (accounts ?? []).forEach((a) => {
          if (a.campaign_id === c.id && a.creator_id) campaignCreatorIds.add(a.creator_id);
        });
        const activeCreators = [...campaignCreatorIds].filter(
          (id) => creatorMap.get(id)?.status === "active"
        );

        return {
          id: c.id,
          name: c.name,
          client_name: c.client_name,
          companyName: c.company_id ? companyNameMap.get(c.company_id) ?? null : null,
          companyLogoUrl: c.company_id ? companyLogoMap.get(c.company_id) ?? null : null,
          status: c.status,
          totalViews,
          minMonthlyVideos: c.min_monthly_videos,
          creatorCount: activeCreators.length,
        };
      });
    },
  });
}

export interface CreatorAlert {
  creatorName: string;
  videosSoFar: number;
  totalRequired: number;
}

export function useCreatorAlerts() {
  const { start: mStart, end: mEnd } = monthRange();
  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();

  return useQuery({
    queryKey: ["creator-alerts"],
    queryFn: async () => {
      const { data: creators } = await supabase
        .from("creators")
        .select("id, name, min_videos_per_day")
        .eq("status", "active");
      if (!creators?.length) return [] as CreatorAlert[];

      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("id, creator_id")
        .eq("account_type", "creator");

      const { data: videos } = await supabase
        .from("videos")
        .select("tiktok_account_id, published_at")
        .gte("published_at", mStart)
        .lt("published_at", mEnd);

      const accountsByCreator = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      const alerts: CreatorAlert[] = [];
      creators.forEach((c) => {
        const accIds = new Set(accountsByCreator.get(c.id) ?? []);
        const videosSoFar = (videos ?? []).filter((v) => accIds.has(v.tiktok_account_id)).length;
        const min = c.min_videos_per_day ?? 5;
        const totalRequired = getMonthlyTarget(min, year, month0);
      });

      return alerts;
    },
  });
}
