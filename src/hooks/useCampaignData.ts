import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews, sumEffectiveViewsCapped } from "@/lib/videoWindow";
import { isFixedEarnedMonthly } from "@/lib/fixedEarned";

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function weekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

export function useCampaignDetail(campaignId: string) {
  return useQuery({
    queryKey: ["campaign-detail", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useCampaignKpi(campaignId: string) {
  const { start: tStart, end: tEnd } = todayRange();
  const { start: mStart, end: mEnd } = monthRange();

  return useQuery({
    queryKey: ["campaign-kpi", campaignId],
    queryFn: async () => {
      // Fetch campaign for cap
      const { data: campData } = await supabase
        .from("campaigns")
        .select("video_views_cap")
        .eq("id", campaignId)
        .single();
      const cap = (campData as any)?.video_views_cap as number | null;

      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("id")
        .eq("campaign_id", campaignId);
      const accIds = (accounts ?? []).map((a) => a.id);

      if (!accIds.length) {
        return { totalViews: 0, monthViews: 0, todayVideos: 0, creatorCount: 0 };
      }

      const { data: allVideos } = await supabase
        .from("videos")
        .select("views, views_final, window_closed, published_at")
        .in("tiktok_account_id", accIds);

      const videos = allVideos ?? [];
      
      // Apply cap per video
      const totalViews = videos.reduce((s, v) => {
        const raw = v.views ?? 0;
        return s + (cap != null && cap > 0 ? Math.min(raw, cap) : raw);
      }, 0);
      const monthVideos = videos.filter((v) => v.published_at >= mStart && v.published_at < mEnd);
      const monthViews = monthVideos.reduce((s, v) => {
        const raw = v.views ?? 0;
        return s + (cap != null && cap > 0 ? Math.min(raw, cap) : raw);
      }, 0);
      const todayVideos = videos.filter((v) => v.published_at >= tStart && v.published_at < tEnd).length;

      const { data: cc } = await supabase
        .from("campaign_creators")
        .select("creator_id")
        .eq("campaign_id", campaignId);

      const { data: creators } = await supabase
        .from("creators")
        .select("id, status");

      const activeCreatorIds = new Set(
        (creators ?? []).filter((c) => c.status === "active").map((c) => c.id)
      );
      const creatorCount = (cc ?? []).filter((r) => activeCreatorIds.has(r.creator_id)).length;

      return { totalViews, monthViews, todayVideos, creatorCount };
    },
    enabled: !!campaignId,
  });
}

export function useCampaignMargin(campaignId: string) {
  const { start: mStart, end: mEnd } = monthRange();
  const now = new Date();
  const year = now.getFullYear();
  const month0 = now.getMonth();

  return useQuery({
    queryKey: ["campaign-margin", campaignId],
    queryFn: async () => {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("client_cpm, client_fixed_per_creator, video_views_cap")
        .eq("id", campaignId)
        .single();

      const cap = (campaign as any)?.video_views_cap as number | null;

      const { data: cc } = await supabase
        .from("campaign_creators")
        .select("creator_id")
        .eq("campaign_id", campaignId);

      const creatorIds = (cc ?? []).map((r) => r.creator_id);
      if (!creatorIds.length) return { revenue: 0, cost: 0, margin: 0 };

      const { data: creators } = await supabase
        .from("creators")
        .select("id, creator_cpm, creator_fixed, min_videos_per_day, status")
        .in("id", creatorIds)
        .eq("status", "active");

      const activeCreators = creators ?? [];

      const { data: allAccounts } = await supabase
        .from("tiktok_accounts")
        .select("id, creator_id, campaign_id");

      const { data: campAccounts } = await supabase
        .from("tiktok_accounts")
        .select("id")
        .eq("campaign_id", campaignId);
      const campAccIds = (campAccounts ?? []).map((a) => a.id);

      const { data: monthVideosAll } = await supabase
        .from("videos")
        .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
        .gte("published_at", mStart)
        .lt("published_at", mEnd);
      const monthVids = monthVideosAll ?? [];

      const monthViews = campAccIds.length
        ? sumEffectiveViewsCapped(monthVids.filter((v) => campAccIds.includes(v.tiktok_account_id)), cap)
        : 0;

      // Build per-creator month video count
      const accountsByCreator = new Map<string, string[]>();
      (allAccounts ?? []).forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      const monthVideoCountByCreator = new Map<string, number>();
      monthVids.forEach((v) => {
        (allAccounts ?? [])
          .filter((a) => a.id === v.tiktok_account_id && a.creator_id)
          .forEach((a) => {
            monthVideoCountByCreator.set(
              a.creator_id!,
              (monthVideoCountByCreator.get(a.creator_id!) ?? 0) + 1
            );
          });
      });

      const clientFixed = (campaign?.client_fixed_per_creator ?? 0) * activeCreators.length;
      const clientCpm = (campaign?.client_cpm ?? 0) * (monthViews / 1000);
      const revenue = clientFixed + clientCpm;

      let cost = 0;
      activeCreators.forEach((cr) => {
        const min = cr.min_videos_per_day ?? 5;
        const videoCount = monthVideoCountByCreator.get(cr.id) ?? 0;
        const earned = isFixedEarnedMonthly(videoCount, min, year, month0);
        if (earned) {
          cost += cr.creator_fixed ?? 0;
        }
        const crCampAccIds = (allAccounts ?? [])
          .filter((a) => a.creator_id === cr.id && a.campaign_id === campaignId)
          .map((a) => a.id);
        const crViews = sumEffectiveViewsCapped(
          monthVids.filter((v) => crCampAccIds.includes(v.tiktok_account_id)),
          cap
        );
        cost += (cr.creator_cpm ?? 0) * (crViews / 1000);
      });

      return { revenue, cost, margin: revenue - cost };
    },
    enabled: !!campaignId,
  });
}

export interface CampaignCreatorRow {
  creatorId: string;
  name: string;
  accountUsername: string;
  todayVideos: number;
  weekVideos: number;
  monthVideos: number;
  totalViews: number;
}

export function useCampaignCreators(campaignId: string) {
  const { start: tStart, end: tEnd } = todayRange();
  const { start: wStart, end: wEnd } = weekRange();
  const { start: mStart, end: mEnd } = monthRange();

  return useQuery({
    queryKey: ["campaign-creators", campaignId],
    queryFn: async () => {
      const { data: cc } = await supabase
        .from("campaign_creators")
        .select("creator_id")
        .eq("campaign_id", campaignId);
      const creatorIds = (cc ?? []).map((r) => r.creator_id);
      if (!creatorIds.length) return [] as CampaignCreatorRow[];

      const { data: creators } = await supabase
        .from("creators")
        .select("id, name, status")
        .in("id", creatorIds);

      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("id, creator_id, username")
        .eq("campaign_id", campaignId);

      const { data: allVideos } = await supabase
        .from("videos")
        .select("tiktok_account_id, views, published_at");

      const accountsByCreator = new Map<string, typeof accounts>();
      (accounts ?? []).forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a);
        accountsByCreator.set(a.creator_id, list);
      });

      return (creators ?? []).map((c): CampaignCreatorRow => {
        const accs = accountsByCreator.get(c.id) ?? [];
        const accIds = new Set(accs.map((a) => a.id));
        const vids = (allVideos ?? []).filter((v) => accIds.has(v.tiktok_account_id));

        const todayVideos = vids.filter((v) => v.published_at >= tStart && v.published_at < tEnd).length;
        const weekVideos = vids.filter((v) => v.published_at >= wStart && v.published_at < wEnd).length;
        const monthVideos = vids.filter((v) => v.published_at >= mStart && v.published_at < mEnd).length;
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);

        return {
          creatorId: c.id,
          name: c.name,
          accountUsername: accs.map((a) => a.username).join(", ") || "—",
          todayVideos,
          weekVideos,
          monthVideos,
          totalViews,
        };
      });
    },
    enabled: !!campaignId,
  });
}

export interface CampaignAccountRow {
  accountId: string;
  username: string;
  creatorName: string;
  todayVideos: number;
  totalViews: number;
}

export function useCampaignAccounts(campaignId: string) {
  const { start: tStart, end: tEnd } = todayRange();

  return useQuery({
    queryKey: ["campaign-accounts", campaignId],
    queryFn: async () => {
      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("id, username, creator_id")
        .eq("campaign_id", campaignId)
        .eq("account_type", "creator");

      if (!accounts?.length) return [] as CampaignAccountRow[];

      const creatorIds = [...new Set(accounts.map((a) => a.creator_id).filter(Boolean))] as string[];
      const { data: creators } = await supabase
        .from("creators")
        .select("id, name")
        .in("id", creatorIds);

      const accIds = accounts.map((a) => a.id);
      const { data: allVideos } = await supabase
        .from("videos")
        .select("tiktok_account_id, views, published_at")
        .in("tiktok_account_id", accIds);

      return accounts.map((a): CampaignAccountRow => {
        const vids = (allVideos ?? []).filter((v) => v.tiktok_account_id === a.id);
        const todayVids = vids.filter((v) => v.published_at >= tStart && v.published_at < tEnd);
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
        const cr = a.creator_id ? creatorMap.get(a.creator_id) : undefined;
        const min = cr?.min_videos_per_day ?? 5;

        return {
          accountId: a.id,
          username: a.username,
          creatorName: cr?.name ?? "—",
          todayVideos: todayVids.length,
          totalViews,
          minVideos: min,
          isOnTrack: todayVids.length >= min,
        };
      });
    },
    enabled: !!campaignId,
  });
}


export function useAllCreatorsForSelect() {
  return useQuery({
    queryKey: ["all-creators-select"],
    queryFn: async () => {
      const { data } = await supabase.from("creators").select("id, name").eq("status", "active");
      return data ?? [];
    },
  });
}
