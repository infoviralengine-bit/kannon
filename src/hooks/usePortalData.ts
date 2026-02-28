import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sumEffectiveViews } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget, getProgressData } from "@/lib/fixedEarned";

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
      let campaigns: { id: string; name: string }[] = [];
      if (campIds.length) {
        const { data } = await supabase.from("campaigns").select("id, name").in("id", campIds);
        campaigns = data ?? [];
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

      const min = creator.min_videos_per_day ?? 5;
      const now = new Date();
      const year = now.getFullYear();
      const month0 = now.getMonth();

      const fixedEarned = isFixedEarnedMonthly(monthVideosCount, min, year, month0);
      const monthlyTarget = getMonthlyTarget(min, year, month0);
      const progress = getProgressData(monthVideosCount, min, year, month0);

      const creatorFixed = creator.creator_fixed ?? 200;
      const creatorCpm = creator.creator_cpm ?? 0.5;
      const cpmAmount = creatorCpm * (monthViews / 1000);

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
          isOnTrack: accTodayVideos >= min,
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
        min,
        isOnTrack: progress.alertLevel === "green",
        fixedEarned,
        creatorFixed,
        creatorCpm,
        cpmAmount,
        total: (fixedEarned ? creatorFixed : 0) + cpmAmount,
        monthlyTarget,
        progress,
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

      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select("*")
        .filter("client_profile_id", "eq", user.id);
      if (error) throw error;
      if (!campaigns?.length) return null;

      const camp = campaigns[0];

      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("id")
        .eq("campaign_id", camp.id);
      const accIds = (accounts ?? []).map((a) => a.id);

      let totalViews = 0;
      if (accIds.length) {
        const { data: videos } = await supabase
          .from("videos")
          .select("views")
          .in("tiktok_account_id", accIds);
        totalViews = (videos ?? []).reduce((s, v) => s + (v.views ?? 0), 0);
      }

      const { data: cc } = await supabase
        .from("campaign_creators")
        .select("creator_id")
        .eq("campaign_id", camp.id);
      const creatorIds = (cc ?? []).map((r) => r.creator_id);
      let activeCreators = 0;
      if (creatorIds.length) {
        const { count } = await supabase
          .from("creators")
          .select("*", { count: "exact", head: true })
          .in("id", creatorIds)
          .eq("status", "active");
        activeCreators = count ?? 0;
      }

      return {
        campaign: camp,
        totalViews,
        activeCreators,
      };
    },
    enabled: !!user,
  });
}
