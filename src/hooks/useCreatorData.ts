import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews, countByWindowStatus } from "@/lib/videoWindow";
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

function monthRangeFor(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

function currentMonthRange() {
  const now = new Date();
  return monthRangeFor(now.getFullYear(), now.getMonth());
}

/* ── Creator Table (list page) ── */

export interface CreatorTableRow {
  id: string;
  name: string;
  status: string;
  activeCampaigns: number;
  totalViews: number;
  monthVideos: number;
  monthlyTarget: number;
  alertLevel: "green" | "yellow" | "red";
  isOnTrack: boolean;
}

export function useCreatorTable(selectedYear?: number, selectedMonth?: number) {
  const now = new Date();
  const year = selectedYear ?? now.getFullYear();
  const month0 = selectedMonth ?? now.getMonth();
  const { start: mStart, end: mEnd } = monthRangeFor(year, month0);

  return useQuery({
    queryKey: ["creator-table", year, month0],
    queryFn: async () => {
      const { data: creators } = await supabase.from("creators").select("*");
      if (!creators?.length) return [] as CreatorTableRow[];

      const { data: ccRows } = await supabase.from("campaign_creators").select("campaign_id, creator_id");
      const { data: campaigns } = await supabase.from("campaigns").select("id, status");
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, creator_id");
      const { data: allVideos } = await supabase.from("videos").select("tiktok_account_id, views, published_at");

      const activeCampaignIds = new Set((campaigns ?? []).filter(c => c.status === "active").map(c => c.id));

      const accountsByCreator = new Map<string, string[]>();
      (accounts ?? []).forEach(a => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      return creators.map((c): CreatorTableRow => {
        const accIds = new Set(accountsByCreator.get(c.id) ?? []);
        const vids = (allVideos ?? []).filter(v => accIds.has(v.tiktok_account_id));
        const monthVideos = vids.filter(v => v.published_at >= mStart && v.published_at < mEnd).length;
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
        const activeCampaigns = (ccRows ?? []).filter(r => r.creator_id === c.id && activeCampaignIds.has(r.campaign_id)).length;
        const min = c.min_videos_per_day ?? 5;
        const target = getMonthlyTarget(min, year, month0);
        const progress = getProgressData(monthVideos, min, year, month0);

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          activeCampaigns,
          totalViews,
          monthVideos,
          monthlyTarget: target,
          alertLevel: progress.alertLevel,
          isOnTrack: progress.alertLevel === "green",
        };
      });
    },
  });
}

/* ── Creator Detail ── */

export function useCreatorDetail(creatorId: string) {
  return useQuery({
    queryKey: ["creator-detail", creatorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("creators").select("*").eq("id", creatorId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!creatorId,
  });
}

/* ── Creator KPIs ── */

export function useCreatorKpi(creatorId: string) {
  const { start: tStart, end: tEnd } = todayRange();
  const { start: wStart, end: wEnd } = weekRange();
  const { start: mStart, end: mEnd } = currentMonthRange();

  return useQuery({
    queryKey: ["creator-kpi", creatorId],
    queryFn: async () => {
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("creator_id", creatorId);
      const accIds = (accounts ?? []).map(a => a.id);

      if (!accIds.length) return { todayVideos: 0, weekVideos: 0, monthVideos: 0, totalViews: 0, monthViews: 0, activeCampaigns: 0 };

      const { data: allVideos } = await supabase.from("videos").select("views, published_at").in("tiktok_account_id", accIds);
      const vids = allVideos ?? [];

      const todayVideos = vids.filter(v => v.published_at >= tStart && v.published_at < tEnd).length;
      const weekVideos = vids.filter(v => v.published_at >= wStart && v.published_at < wEnd).length;
      const monthVideos = vids.filter(v => v.published_at >= mStart && v.published_at < mEnd).length;
      const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);
      const monthViews = vids.filter(v => v.published_at >= mStart && v.published_at < mEnd).reduce((s, v) => s + (v.views ?? 0), 0);

      const { data: cc } = await supabase.from("campaign_creators").select("campaign_id").eq("creator_id", creatorId);
      const campIds = (cc ?? []).map(r => r.campaign_id);
      let activeCampaigns = 0;
      if (campIds.length) {
        const { count } = await supabase.from("campaigns").select("*", { count: "exact", head: true }).in("id", campIds).eq("status", "active");
        activeCampaigns = count ?? 0;
      }

      return { todayVideos, weekVideos, monthVideos, totalViews, monthViews, activeCampaigns };
    },
    enabled: !!creatorId,
  });
}

/* ── Payoff for a given month (contract-based) ── */

export interface CreatorPayoffContract {
  contractId: string;
  contractName: string;
  creatorFixed: number;
  creatorCpm: number;
  min: number;
  monthlyTarget: number;
  monthVideoCount: number;
  monthViews: number;
  cpmAmount: number;
  fixedEarned: boolean;
  total: number;
  progress: ReturnType<typeof getProgressData>;
  windowOpen: number;
  windowClosed: number;
  hasVideoTarget: boolean;
}

export interface CreatorPayoffResult {
  contracts: CreatorPayoffContract[];
  grandTotal: number;
}

export function useCreatorPayoff(creatorId: string, year: number, month: number) {
  const { start: mStart, end: mEnd } = monthRangeFor(year, month);

  return useQuery({
    queryKey: ["creator-payoff", creatorId, year, month],
    queryFn: async () => {
      // Get contracts this creator belongs to
      const { data: contractLinks } = await supabase
        .from("contract_creators" as any)
        .select("contract_id")
        .eq("creator_id", creatorId);

      const contractIds = ((contractLinks ?? []) as any[]).map((l) => l.contract_id);

      if (!contractIds.length) {
        // Fallback: creator not in any contract
        return { contracts: [] as CreatorPayoffContract[], grandTotal: 0 } as CreatorPayoffResult;
      }

      const [
        { data: contracts },
        { data: contractCampaigns },
        { data: accounts },
      ] = await Promise.all([
        supabase.from("contracts" as any).select("*").in("id", contractIds),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id").in("contract_id", contractIds),
        supabase.from("tiktok_accounts").select("id, campaign_id").eq("creator_id", creatorId),
      ]);

      const allAccounts = accounts ?? [];
      const accIds = allAccounts.map((a) => a.id);

      let allVideos: any[] = [];
      if (accIds.length) {
        const { data: vids } = await supabase
          .from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .in("tiktok_account_id", accIds)
          .gte("published_at", mStart)
          .lt("published_at", mEnd);
        allVideos = vids ?? [];
      }

      const allCC = (contractCampaigns ?? []) as any[];
      const allContracts = (contracts ?? []) as any[];

      const payoffContracts: CreatorPayoffContract[] = allContracts.map((contract) => {
        const campIds = allCC.filter((cc) => cc.contract_id === contract.id).map((cc) => cc.campaign_id);
        const campIdSet = new Set(campIds);

        // Accounts assigned to this contract's campaigns
        const contractAccounts = allAccounts.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
        const contractAccIds = new Set(contractAccounts.map((a) => a.id));

        const contractVideos = allVideos.filter((v) => contractAccIds.has(v.tiktok_account_id));
        const monthVideoCount = contractVideos.length;
        const monthViews = sumEffectiveViews(contractVideos);
        const windowStats = countByWindowStatus(contractVideos);

        const minVpd = contract.min_videos_per_day ?? 0;
        const hasVideoTarget = minVpd > 0;
        const creatorFixed = Number(contract.creator_fixed ?? 0);
        const creatorCpm = Number(contract.creator_cpm ?? 0.5);
        const target = hasVideoTarget ? getMonthlyTarget(minVpd, year, month) : 0;
        const fixedEarned = hasVideoTarget ? isFixedEarnedMonthly(monthVideoCount, minVpd, year, month) : true;
        const progress = hasVideoTarget ? getProgressData(monthVideoCount, minVpd, year, month) : { percent: 100, alertLevel: "green" as const, avgCurrent: 0, avgNeeded: 0, workingDaysLeft: 0 };

        const cpmAmount = creatorCpm * (monthViews / 1000);

        return {
          contractId: contract.id,
          contractName: contract.name,
          creatorFixed,
          creatorCpm,
          min: minVpd,
          monthlyTarget: target,
          monthVideoCount,
          monthViews,
          cpmAmount,
          fixedEarned,
          total: (fixedEarned ? creatorFixed : 0) + cpmAmount,
          progress,
          windowOpen: windowStats.open,
          windowClosed: windowStats.closed,
          hasVideoTarget,
        };
      });

      const grandTotal = payoffContracts.reduce((s, c) => s + c.total, 0);

      return { contracts: payoffContracts, grandTotal } as CreatorPayoffResult;
    },
    enabled: !!creatorId,
  });
}

/* ── Creator Accounts ── */

export interface CreatorAccountRow {
  accountId: string;
  username: string;
  accountType: string;
  campaignName: string | null;
  todayVideos: number;
  totalViews: number;
  minVideos: number;
  isOnTrack: boolean;
}

export function useCreatorAccounts(creatorId: string) {
  const { start: tStart, end: tEnd } = todayRange();

  return useQuery({
    queryKey: ["creator-accounts", creatorId],
    queryFn: async () => {
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, username, account_type, campaign_id").eq("creator_id", creatorId);
      if (!accounts?.length) return [] as CreatorAccountRow[];

      const { data: creator } = await supabase.from("creators").select("min_videos_per_day").eq("id", creatorId).single();
      const min = creator?.min_videos_per_day ?? 5;

      const campIds = [...new Set(accounts.map(a => a.campaign_id).filter(Boolean))] as string[];
      let campMap = new Map<string, string>();
      if (campIds.length) {
        const { data: camps } = await supabase.from("campaigns").select("id, name").in("id", campIds);
        (camps ?? []).forEach(c => campMap.set(c.id, c.name));
      }

      const accIds = accounts.map(a => a.id);
      const { data: allVids } = await supabase.from("videos").select("tiktok_account_id, views, published_at").in("tiktok_account_id", accIds);

      return accounts.map((a): CreatorAccountRow => {
        const vids = (allVids ?? []).filter(v => v.tiktok_account_id === a.id);
        const todayVideos = vids.filter(v => v.published_at >= tStart && v.published_at < tEnd).length;
        const totalViews = vids.reduce((s, v) => s + (v.views ?? 0), 0);

        return {
          accountId: a.id,
          username: a.username,
          accountType: a.account_type,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          todayVideos,
          totalViews,
          minVideos: min,
          isOnTrack: todayVideos >= min,
        };
      });
    },
    enabled: !!creatorId,
  });
}

/* ── Creator Campaigns ── */

export interface CreatorCampaignRow {
  campaignId: string;
  name: string;
  clientName: string;
  startDate: string;
  views: number;
}

export function useCreatorCampaigns(creatorId: string) {
  return useQuery({
    queryKey: ["creator-campaigns", creatorId],
    queryFn: async () => {
      const { data: cc } = await supabase.from("campaign_creators").select("campaign_id").eq("creator_id", creatorId);
      const campIds = (cc ?? []).map(r => r.campaign_id);
      if (!campIds.length) return [] as CreatorCampaignRow[];

      const { data: campaigns } = await supabase.from("campaigns").select("id, name, client_name, start_date").in("id", campIds);
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id, campaign_id").eq("creator_id", creatorId);
      const { data: allVids } = await supabase.from("videos").select("tiktok_account_id, views");

      return (campaigns ?? []).map((c): CreatorCampaignRow => {
        const accIds = new Set((accounts ?? []).filter(a => a.campaign_id === c.id).map(a => a.id));
        const views = (allVids ?? []).filter(v => accIds.has(v.tiktok_account_id)).reduce((s, v) => s + (v.views ?? 0), 0);
        return { campaignId: c.id, name: c.name, clientName: c.client_name, startDate: c.start_date, views };
      });
    },
    enabled: !!creatorId,
  });
}
