import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCreatorAlertLevel, getMonthlyTarget, getProgressData, isFixedEarnedMonthly, type AlertLevel } from "@/lib/fixedEarned";

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
      const { data: campaigns } = await supabase.from("campaigns").select("*");
      if (!campaigns?.length) return [] as CampaignRow[];

      const [
        { data: ccRows },
        { data: creators },
        { data: accounts },
        { data: allVideos },
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
      ] = await Promise.all([
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
        supabase.from("creators").select("id, creator_cpm, creator_fixed, min_videos_per_day, status"),
        supabase.from("tiktok_accounts").select("id, campaign_id, creator_id"),
        supabase.from("videos").select("tiktok_account_id, views, published_at"),
        supabase.from("contracts" as any).select("id, creator_fixed, creator_cpm, min_videos_per_day, is_active"),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
      ]);

      // Build contract lookup: for a given campaign+creator, find the contract terms
      const contractMap = new Map(((contracts ?? []) as any[]).map((c) => [c.id, c]));
      const campToContracts = new Map<string, string[]>();
      ((contractCampaigns ?? []) as any[]).forEach((cc) => {
        const list = campToContracts.get(cc.campaign_id) ?? [];
        list.push(cc.contract_id);
        campToContracts.set(cc.campaign_id, list);
      });
      const creatorToContracts = new Map<string, Set<string>>();
      ((contractCreators ?? []) as any[]).forEach((cc) => {
        const set = creatorToContracts.get(cc.creator_id) ?? new Set();
        set.add(cc.contract_id);
        creatorToContracts.set(cc.creator_id, set);
      });
      // Find contract for a campaign+creator pair
      const findContract = (campaignId: string, creatorId: string) => {
        const campContracts = campToContracts.get(campaignId) ?? [];
        const creatorContracts = creatorToContracts.get(creatorId);
        if (!creatorContracts) return null;
        const contractId = campContracts.find((cid) => creatorContracts.has(cid));
        return contractId ? contractMap.get(contractId) : null;
      };

      const now = new Date();
      const year = now.getFullYear();
      const month0 = now.getMonth();

      const accountsByCampaign = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.campaign_id) return;
        const list = accountsByCampaign.get(a.campaign_id) ?? [];
        list.push(a.id);
        accountsByCampaign.set(a.campaign_id, list);
      });

      // Build per-creator account mapping (all accounts, not just campaign-specific)
      const allAccountsByCreator = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.creator_id) return;
        const list = allAccountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        allAccountsByCreator.set(a.creator_id, list);
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

        const campaignCreatorIds = (ccRows ?? [])
          .filter((r) => r.campaign_id === c.id)
          .map((r) => r.creator_id);
        const activeCreators = campaignCreatorIds.filter(
          (id) => creatorMap.get(id)?.status === "active"
        );

        const clientFixed = (c.client_fixed_per_creator ?? 0) * activeCreators.length;
        const clientCpm = (c.client_cpm ?? 0) * (monthViews / 1000);
        const revenue = clientFixed + clientCpm;

        let cost = 0;
        activeCreators.forEach((id) => {
          const cr = creatorMap.get(id);
          if (cr) {
            // Use contract terms if available, otherwise fall back to creator-level rates
            const contract = findContract(c.id, id);
            const fixedAmt = contract ? Number(contract.creator_fixed ?? 0) : (cr.creator_fixed ?? 0);
            const cpmRate = contract ? Number(contract.creator_cpm ?? 0) : (cr.creator_cpm ?? 0);
            const minVpd = contract ? (contract.min_videos_per_day ?? 5) : (cr.min_videos_per_day ?? 5);

            // Check if creator earned the fixed this month
            const crAccIds = new Set(allAccountsByCreator.get(id) ?? []);
            const crMonthVideoCount = (allVideos ?? []).filter(
              (v) => crAccIds.has(v.tiktok_account_id) && v.published_at >= mStart && v.published_at < mEnd
            ).length;
            if (isFixedEarnedMonthly(crMonthVideoCount, minVpd, year, month0)) {
              cost += fixedAmt;
            }
            cost += cpmRate * (monthViews / 1000);
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
  videosSoFar: number;
  totalRequired: number;
  alertLevel: AlertLevel;
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
        const alertLevel = getCreatorAlertLevel(videosSoFar, min, year, month0);
        if (alertLevel !== "green") {
          alerts.push({ creatorName: c.name, videosSoFar, totalRequired, alertLevel });
        }
      });

      return alerts;
    },
  });
}
