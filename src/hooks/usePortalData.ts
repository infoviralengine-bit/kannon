import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sumEffectiveViews, sumEffectiveViewsCapped } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget } from "@/lib/fixedEarned";

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

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

export function useCreatorAreaData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["creator-area", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: creator, error: crErr } = await supabase
        .from("creators")
        .select("*")
        .eq("profile_id", user.id)
        .single();
      if (crErr || !creator) return null;

      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("creator_id", creator.id);
      const accs = accounts ?? [];
      const accIds = accs.map((a) => a.id);

      let allVideos: any[] = [];
      if (accIds.length) {
        const { data } = await supabase
          .from("videos")
          .select("*")
          .in("tiktok_account_id", accIds)
          .order("published_at", { ascending: false });
        allVideos = data ?? [];
      }

      const campIds = [...new Set(accs.map((a) => a.campaign_id).filter(Boolean))] as string[];
      let campaigns: { id: string; name: string; video_views_cap: number | null }[] = [];
      if (campIds.length) {
        const { data } = await supabase.from("campaigns").select("id, name, video_views_cap").in("id", campIds);
        campaigns = data ?? [];
      }

      // Fetch contracts for this creator
      const { data: contractCreators } = await supabase
        .from("contract_creators" as any)
        .select("contract_id, creator_id")
        .eq("creator_id", creator.id);
      const ccRows = (contractCreators ?? []) as any[];
      const contractIds = ccRows.map((r: any) => r.contract_id);

      let allContracts: any[] = [];
      let allContractCampaigns: any[] = [];
      if (contractIds.length) {
        const [{ data: cData }, { data: ccData }] = await Promise.all([
          supabase.from("contracts" as any).select("*").in("id", contractIds).eq("is_active", true),
          supabase.from("contract_campaigns" as any).select("contract_id, campaign_id").in("contract_id", contractIds),
        ]);
        allContracts = (cData ?? []) as any[];
        allContractCampaigns = (ccData ?? []) as any[];
      }

      const { start: tStart, end: tEnd } = todayRange();
      const { start: wStart, end: wEnd } = weekRange();
      const { start: mStart, end: mEnd } = monthRange();

      const todayVideos = allVideos.filter((v) => v.published_at >= tStart && v.published_at < tEnd).length;
      const weekVideos = allVideos.filter((v) => v.published_at >= wStart && v.published_at < wEnd).length;
      const monthVideosList = allVideos.filter((v) => v.published_at >= mStart && v.published_at < mEnd);
      const monthVideosCount = monthVideosList.length;
      const totalViews = allVideos.reduce((s, v) => s + (v.views ?? 0), 0);
      const monthViews = sumEffectiveViews(monthVideosList);

      // Build per-contract payoff breakdown
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      const capByCampaign = new Map<string, number | null>();
      campaigns.forEach((c) => capByCampaign.set(c.id, c.video_views_cap));

      const contractCampMap = new Map<string, string[]>();
      allContractCampaigns.forEach((r: any) => {
        const list = contractCampMap.get(r.contract_id) ?? [];
        list.push(r.campaign_id);
        contractCampMap.set(r.contract_id, list);
      });

      const contractBreakdowns = allContracts.map((contract: any) => {
        const cCampIds = contractCampMap.get(contract.id) ?? [];
        const campIdSet = new Set(cCampIds);
        const contractAccounts = accs.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
        const contractAccIds = new Set(contractAccounts.map((a) => a.id));
        const contractMonthVideos = monthVideosList.filter((v) => contractAccIds.has(v.tiktok_account_id));
        const videoCount = contractMonthVideos.length;

        const cpmRate = contract.creator_cpm == null ? 0 : Number(contract.creator_cpm);
        const fixedAmt = contract.creator_fixed == null ? 0 : Number(contract.creator_fixed);
        const minVpd = contract.min_videos_per_day ?? 5;
        const target = getMonthlyTarget(minVpd, year, month);

        let totalContractViews = 0;
        cCampIds.forEach((campId) => {
          const cap = capByCampaign.get(campId) ?? null;
          const campAccIds = contractAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
          const campAccSet = new Set(campAccIds);
          const campVideos = contractMonthVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
          totalContractViews += sumEffectiveViewsCapped(campVideos, cap);
        });

        const fixedEarned = minVpd === 0 || isFixedEarnedMonthly(videoCount, minVpd, year, month);
        const cpmAmount = cpmRate * (totalContractViews / 1000);
        const subtotal = (fixedEarned ? fixedAmt : 0) + cpmAmount;

        return {
          contractId: contract.id,
          contractName: contract.name,
          videoCount,
          monthlyTarget: target,
          fixedAmount: fixedAmt,
          fixedEarned,
          cpmRate,
          cpmAmount,
          totalViews: totalContractViews,
          subtotal,
        };
      });

      const totalPayoff = contractBreakdowns.reduce((s, b) => s + b.subtotal, 0);

      const campMap = new Map(campaigns.map((c) => [c.id, c.name]));
      const accountRows = accs.map((a) => {
        const accVids = allVideos.filter((v) => v.tiktok_account_id === a.id);
        const accTodayVideos = accVids.filter((v) => v.published_at >= tStart && v.published_at < tEnd).length;
        const accTotalViews = accVids.reduce((s, v) => s + (v.views ?? 0), 0);
        return {
          id: a.id,
          username: a.username,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          todayVideos: accTodayVideos,
          totalViews: accTotalViews,
        };
      });

      const recentVideos = allVideos.slice(0, 30).map((v) => ({
        ...v,
        accountUsername: accs.find((a) => a.id === v.tiktok_account_id)?.username ?? "—",
      }));

      return {
        creator,
        todayVideos,
        weekVideos,
        monthVideos: monthVideosCount,
        totalViews,
        monthViews,
        contractBreakdowns,
        totalPayoff,
        accountRows,
        recentVideos,
      };
    },
    enabled: !!user,
  });
}

export function useClientAreaData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-area", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("get_client_campaign_data" as any, {
        p_user_id: user.id,
      } as any);
      if (error) throw error;
      return data as {
        campaign: {
          id: string;
          name: string;
          client_name: string;
          status: string;
          start_date: string;
          end_date: string | null;
          client_cpm: number | null;
          client_fixed: number | null;
          min_monthly_videos: number | null;
          video_views_cap: number | null;
          monthly_spend_cap: number | null;
        };
        accounts: {
          username: string;
          total_views: number;
          total_videos: number;
          videos_today: number;
          views_7d: number;
          views_30d: number;
        }[];
        active_creators: number;
        total_creators: number;
        views_1d: number;
        views_7d: number;
        views_30d: number;
        views_90d: number;
        likes_1d: number;
        likes_7d: number;
        likes_30d: number;
        likes_90d: number;
        comments_1d: number;
        comments_7d: number;
        comments_30d: number;
        comments_90d: number;
        videos_today: number;
        avg_videos_per_day_30d: number;
        total_videos: number;
      } | null;
    },
    enabled: !!user,
  });
}

export function useClientDailyViews(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-daily-views", user?.id, days],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("get_client_daily_views" as any, {
        p_user_id: user.id,
        p_days: days,
      } as any);
      if (error) throw error;
      return (data as { day: string; views: number; videos_published: number }[]) ?? [];
    },
    enabled: !!user,
  });
}

export type ClientTopVideo = {
  id: string;
  tiktok_video_id: string;
  published_at: string;
  likes: number | null;
  comments: number;
  username: string;
  effective_views: number;
};

export function useClientTopVideos(limit: number = 5) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-top-videos", user?.id, limit],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.rpc("get_client_top_videos" as any, {
        p_user_id: user.id,
        p_limit: limit,
      } as any);
      if (error) throw error;
      return (data as { top_views: ClientTopVideo[]; top_comments: ClientTopVideo[] } | null) ?? null;
    },
    enabled: !!user,
  });
}
