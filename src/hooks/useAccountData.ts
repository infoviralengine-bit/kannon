import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth, format } from "date-fns";

export function useAccountList() {
  const accountsQuery = useQuery({
    queryKey: ["tiktok_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tiktok_accounts")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  const creatorsQuery = useQuery({
    queryKey: ["creators_for_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("id, name, min_videos_per_day, status");
      if (error) throw error;
      return data;
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns_for_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status");
      if (error) throw error;
      return data;
    },
  });

  const videosQuery = useQuery({
    queryKey: ["videos_for_accounts"],
    queryFn: async () => {
      const all: { tiktok_account_id: string; views: number | null; published_at: string | null }[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("videos")
          .select("tiktok_account_id, views, published_at")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const outreachQuery = useQuery({
    queryKey: ["outreach_for_accounts"],
    queryFn: async () => {
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("outreach_stats")
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const today = format(startOfDay(new Date()), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const getCreatorVideosToday = (accountId: string) => {
    return (videosQuery.data || []).filter(
      (v) =>
        v.tiktok_account_id === accountId &&
        v.published_at?.startsWith(today)
    ).length;
  };

  const getAccountTotalViews = (accountId: string) => {
    return (videosQuery.data || [])
      .filter((v) => v.tiktok_account_id === accountId)
      .reduce((sum, v) => sum + (v.views || 0), 0);
  };

  const getOutreachToday = (accountId: string) => {
    const stats = (outreachQuery.data || []).filter(
      (s) => s.tiktok_account_id === accountId && s.date === today
    );
    const dm = stats.reduce((s, r) => s + (r.dm_sent || 0), 0);
    const replies = stats.reduce((s, r) => s + (r.replies_received || 0), 0);
    return { dm, replies };
  };

  const getOutreachMonth = (accountId: string) => {
    const stats = (outreachQuery.data || []).filter(
      (s) => s.tiktok_account_id === accountId && s.date >= monthStart
    );
    return stats.reduce((s, r) => s + (r.dm_sent || 0), 0);
  };

  const isLoading =
    accountsQuery.isLoading ||
    creatorsQuery.isLoading ||
    campaignsQuery.isLoading ||
    videosQuery.isLoading ||
    outreachQuery.isLoading;

  return {
    accounts: accountsQuery.data || [],
    creators: creatorsQuery.data || [],
    campaigns: campaignsQuery.data || [],
    isLoading,
    getCreatorVideosToday,
    getAccountTotalViews,
    getOutreachToday,
    getOutreachMonth,
  };
}

export function useAccountDetail(id: string) {
  const accountQuery = useQuery({
    queryKey: ["tiktok_account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const creatorQuery = useQuery({
    queryKey: ["creator_for_account", accountQuery.data?.creator_id],
    queryFn: async () => {
      if (!accountQuery.data?.creator_id) return null;
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .eq("id", accountQuery.data.creator_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountQuery.data?.creator_id,
  });

  const campaignQuery = useQuery({
    queryKey: ["campaign_for_account", accountQuery.data?.campaign_id],
    queryFn: async () => {
      if (!accountQuery.data?.campaign_id) return null;
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", accountQuery.data.campaign_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!accountQuery.data?.campaign_id,
  });

  const videosQuery = useQuery({
    queryKey: ["videos_for_account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("tiktok_account_id", id)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const outreachQuery = useQuery({
    queryKey: ["outreach_for_account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_stats")
        .select("*")
        .eq("tiktok_account_id", id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const todayStr = format(startOfDay(now), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");

  const videos = videosQuery.data || [];
  const outreach = outreachQuery.data || [];

  const videosToday = videos.filter((v) => v.published_at?.startsWith(todayStr)).length;
  const videosWeek = videos.filter((v) => v.published_at >= weekStart).length;
  const videosMonth = videos.filter((v) => v.published_at >= monthStart).length;

  const viewsToday = videos
    .filter((v) => v.published_at?.startsWith(todayStr))
    .reduce((s, v) => s + (v.views || 0), 0);
  const viewsWeek = videos
    .filter((v) => v.published_at >= weekStart)
    .reduce((s, v) => s + (v.views || 0), 0);
  const viewsMonth = videos
    .filter((v) => v.published_at >= monthStart)
    .reduce((s, v) => s + (v.views || 0), 0);

  const dmToday = outreach
    .filter((o) => o.date === todayStr)
    .reduce((s, o) => s + (o.dm_sent || 0), 0);
  const dmWeek = outreach
    .filter((o) => o.date >= weekStart)
    .reduce((s, o) => s + (o.dm_sent || 0), 0);
  const dmMonth = outreach
    .filter((o) => o.date >= monthStart)
    .reduce((s, o) => s + (o.dm_sent || 0), 0);

  const repliesToday = outreach
    .filter((o) => o.date === todayStr)
    .reduce((s, o) => s + (o.replies_received || 0), 0);
  const repliesWeek = outreach
    .filter((o) => o.date >= weekStart)
    .reduce((s, o) => s + (o.replies_received || 0), 0);

  const responseRateMonth = dmMonth > 0
    ? (outreach.filter((o) => o.date >= monthStart).reduce((s, o) => s + (o.replies_received || 0), 0) / dmMonth) * 100
    : 0;

  // Chart data: views per day last 30 days
  const last30Days: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const dayViews = videos
      .filter((v) => v.published_at?.startsWith(dateStr))
      .reduce((s, v) => s + (v.views || 0), 0);
    last30Days.push({ date: format(d, "dd/MM"), views: dayViews });
  }

  return {
    account: accountQuery.data,
    creator: creatorQuery.data,
    campaign: campaignQuery.data,
    videos,
    outreach,
    isLoading: accountQuery.isLoading || videosQuery.isLoading || outreachQuery.isLoading,
    videosToday,
    videosWeek,
    videosMonth,
    viewsToday,
    viewsWeek,
    viewsMonth,
    dmToday,
    dmWeek,
    dmMonth,
    repliesToday,
    repliesWeek,
    responseRateMonth,
    last30Days,
  };
}
