import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sumEffectiveViews } from "@/lib/videoWindow";

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
        creatorFixed,
        creatorCpm,
        cpmAmount,
        total: creatorFixed + cpmAmount,
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
          planned_creators: number;
          client_cpm: number | null;
          client_fixed_per_creator: number | null;
          video_views_cap: number | null;
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
