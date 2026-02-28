import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  status: string;
  client_cpm: number | null;
  client_fixed_per_creator: number | null;
  totalViews: number;
  monthViews: number;
  creatorCount: number;
  margin: number;
}

export function useCampaignTable() {
  const { start: mStart, end: mEnd } = monthRange();

  return useQuery({
    queryKey: ["campaign-table"],
    queryFn: async () => {
      // Fetch campaigns
      const { data: campaigns } = await supabase.from("campaigns").select("*");
      if (!campaigns?.length) return [] as CampaignRow[];

      // Fetch campaign_creators
      const { data: ccRows } = await supabase.from("campaign_creators").select("campaign_id, creator_id");

      // Fetch creators for cost info
      const { data: creators } = await supabase.from("creators").select("id, creator_cpm, creator_fixed, status");

      // Fetch tiktok accounts with campaign_id
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, campaign_id");

      // Fetch all videos
      const { data: allVideos } = await supabase.from("videos").select("tiktok_account_id, views, published_at");

      const accountsByCampaign = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.campaign_id) return;
        const list = accountsByCampaign.get(a.campaign_id) ?? [];
        list.push(a.id);
        accountsByCampaign.set(a.campaign_id, list);
      });

      const creatorMap = new Map((creators ?? []).map((c) => [c.id, c]));

      return campaigns.map((c): CampaignRow => {
        const accIds = new Set(accountsByCampaign.get(c.id) ?? []);
        const campVideos = (allVideos ?? []).filter((v) => accIds.has(v.tiktok_account_id));

        const totalViews = campVideos.reduce((s, v) => s + (v.views ?? 0), 0);
        const monthVideos = campVideos.filter(
          (v) => v.published_at >= mStart && v.published_at < mEnd
        );
        const monthViews = monthVideos.reduce((s, v) => s + (v.views ?? 0), 0);

        // Creators in this campaign
        const campaignCreatorIds = (ccRows ?? [])
          .filter((r) => r.campaign_id === c.id)
          .map((r) => r.creator_id);
        const activeCreators = campaignCreatorIds.filter(
          (id) => creatorMap.get(id)?.status === "active"
        );

        // Revenue
        const clientFixed = (c.client_fixed_per_creator ?? 0) * activeCreators.length;
        const clientCpm = (c.client_cpm ?? 0) * (monthViews / 1000);
        const revenue = clientFixed + clientCpm;

        // Cost
        let cost = 0;
        activeCreators.forEach((id) => {
          const cr = creatorMap.get(id);
          if (cr) {
            cost += cr.creator_fixed ?? 0;
            cost += (cr.creator_cpm ?? 0) * (monthViews / 1000);
          }
        });

        return {
          id: c.id,
          name: c.name,
          client_name: c.client_name,
          status: c.status,
          client_cpm: c.client_cpm,
          client_fixed_per_creator: c.client_fixed_per_creator,
          totalViews,
          monthViews,
          creatorCount: activeCreators.length,
          margin: revenue - cost,
        };
      });
    },
  });
}

export interface CreatorAlert {
  creatorName: string;
  published: number;
  minimum: number;
}

export function useCreatorAlerts() {
  const { start, end } = todayRange();

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
        .gte("published_at", start)
        .lt("published_at", end);

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
        const count = (videos ?? []).filter((v) => accIds.has(v.tiktok_account_id)).length;
        const min = c.min_videos_per_day ?? 5;
        if (count < min) {
          alerts.push({ creatorName: c.name, published: count, minimum: min });
        }
      });

      return alerts;
    },
  });
}
