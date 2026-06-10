import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViewsCapped } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget, getWorkingDaysInMonth } from "@/lib/fixedEarned";
import {
  getContractPeriod,
  getCurrentPeriodNumber,
  parseContractStartDate,
  getPeriodTarget,
  isFixedEarnedInPeriod,
  formatPeriodRange,
} from "@/lib/contractPeriods";

/* ── Contract List ── */

export interface ContractListRow {
  id: string;
  name: string;
  type: string;
  creatorFixed: number;
  creatorCpm: number;
  minVideosPerDay: number;
  isActive: boolean;
  campaignCount: number;
  creatorCount: number;
}

export function useContractList() {
  return useQuery({
    queryKey: ["contract-list"],
    queryFn: async () => {
      const [
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
      ] = await Promise.all([
        supabase.from("contracts" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
      ]);

      return ((contracts ?? []) as any[]).map((c): ContractListRow => ({
        id: c.id,
        name: c.name,
        type: c.type,
        creatorFixed: Number(c.creator_fixed),
        creatorCpm: Number(c.creator_cpm),
        minVideosPerDay: c.min_videos_per_day,
        isActive: c.is_active,
        campaignCount: ((contractCampaigns ?? []) as any[]).filter((cc) => cc.contract_id === c.id).length,
        creatorCount: ((contractCreators ?? []) as any[]).filter((cc) => cc.contract_id === c.id).length,
      }));
    },
  });
}

/* ── Contract Detail ── */

export function useContractDetail(contractId: string) {
  return useQuery({
    queryKey: ["contract-detail", contractId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts" as any).select("*").eq("id", contractId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!contractId,
  });
}

/* ── Contract Campaigns ── */

export interface ContractCampaignRow {
  id: string; // contract_campaigns.id
  campaignId: string;
  name: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  status: string;
}

export function useContractCampaigns(contractId: string) {
  return useQuery({
    queryKey: ["contract-campaigns", contractId],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("contract_campaigns" as any)
        .select("id, campaign_id")
        .eq("contract_id", contractId);
      const campIds = ((links ?? []) as any[]).map((l) => l.campaign_id);
      if (!campIds.length) return [];

      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name, client_name, start_date, end_date, status")
        .in("id", campIds);

      const linkMap = new Map(((links ?? []) as any[]).map((l) => [l.campaign_id, l.id]));

      return ((campaigns ?? []) as any[]).map((c): ContractCampaignRow => ({
        id: linkMap.get(c.id) ?? "",
        campaignId: c.id,
        name: c.name,
        clientName: c.client_name,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
      }));
    },
    enabled: !!contractId,
  });
}

/* ── Contract Creators ── */

export interface ContractCreatorAccount {
  accountId: string;
  username: string;
  campaignId: string | null;
  campaignName: string | null;
}

export interface ContractCreatorRow {
  id: string; // contract_creators.id
  creatorId: string;
  name: string;
  accounts: ContractCreatorAccount[];
  videoCount: number;
  target: number;
  totalViews: number;
  cpmRate: number;
  cpmAmount: number;
  fixedAmount: number;
  fixedEarned: boolean;
  subtotal: number;
}

export interface ContractCreatorsResult {
  creators: ContractCreatorRow[];
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  currentPeriod: number;
  maxPeriod: number;
}

export function useContractCreators(contractId: string, selectedPeriod?: number) {
  return useQuery({
    queryKey: ["contract-creators", contractId, selectedPeriod],
    queryFn: async (): Promise<ContractCreatorsResult | null> => {
      const [
        { data: links },
        { data: campLinks },
        { data: contract },
      ] = await Promise.all([
        supabase.from("contract_creators" as any).select("id, creator_id").eq("contract_id", contractId),
        supabase.from("contract_campaigns" as any).select("campaign_id").eq("contract_id", contractId),
        supabase.from("contracts" as any).select("*").eq("id", contractId).single(),
      ]);

      const creatorIds = ((links ?? []) as any[]).map((l) => l.creator_id);
      const campIds = ((campLinks ?? []) as any[]).map((l) => l.campaign_id);
      if (!creatorIds.length || !contract) return { creators: [], periodStart: new Date(), periodEnd: new Date(), periodLabel: "", currentPeriod: 1, maxPeriod: 1 };

      const contractStart = (contract as any).start_date
        ? parseContractStartDate((contract as any).start_date)
        : new Date();
      const fps = (contract as any).first_period_start
        ? parseContractStartDate((contract as any).first_period_start)
        : null;
      const ov = (contract as any).period_overrides ?? null;
      const currentPeriod = getCurrentPeriodNumber(contractStart, fps, ov);
      const activePeriod = selectedPeriod ?? currentPeriod;
      const { periodStart, periodEnd } = getContractPeriod(contractStart, activePeriod, fps, ov);
      const periodLabel = formatPeriodRange(periodStart, periodEnd);

      const pStartISO = periodStart.toISOString();
      const pEndDate = new Date(periodEnd);
      pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
      const pEndISO = pEndDate.toISOString();

      // Fetch all data with pagination for videos
      const [
        { data: creators },
        { data: accounts },
        { data: campaigns },
      ] = await Promise.all([
        supabase.from("creators").select("id, name").in("id", creatorIds),
        supabase.from("tiktok_accounts").select("id, creator_id, username, campaign_id").in("creator_id", creatorIds),
        supabase.from("campaigns").select("id, name, video_views_cap").in("id", campIds.length ? campIds : ["__none__"]),
      ]);

      // Paginated video fetch
      let allVideos: any[] = [];
      const pageSize = 1000;
      let page = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", pStartISO)
          .lt("published_at", pEndISO)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (!batch || batch.length === 0) break;
        allVideos = allVideos.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      const campMap = new Map(((campaigns ?? []) as any[]).map((c) => [c.id, c]));
      const campIdSet = new Set(campIds);
      const linkMap = new Map(((links ?? []) as any[]).map((l: any) => [l.creator_id, l.id]));
      const cpmRate = Number((contract as any)?.creator_cpm ?? 0.5);
      const fixedAmt = Number((contract as any)?.creator_fixed ?? 0);
      const minVpd = (contract as any)?.min_videos_per_day ?? 5;
      const target = getPeriodTarget(minVpd, periodStart, periodEnd);

      const sortedCreators = ((creators ?? []) as any[]).sort((a: any, b: any) => a.name.localeCompare(b.name));
      const creatorRows = sortedCreators.map((cr): ContractCreatorRow => {
        const crAccounts = ((accounts ?? []) as any[]).filter((a) => a.creator_id === cr.id);
        const contractAccounts = crAccounts.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
        const contractAccIds = new Set(contractAccounts.map((a) => a.id));

        const crVideos = allVideos.filter((v) => contractAccIds.has(v.tiktok_account_id));
        const videoCount = crVideos.length;

        let totalViews = 0;
        campIds.forEach((campId) => {
          const cap = campMap.get(campId)?.video_views_cap as number | null;
          const campAccIds = contractAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
          const campAccSet = new Set(campAccIds);
          const campVideos = crVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
          totalViews += sumEffectiveViewsCapped(campVideos, cap);
        });

        const fixedEarned = minVpd === 0 || isFixedEarnedInPeriod(videoCount, minVpd, periodStart, periodEnd);
        const cpmAmount = cpmRate * (totalViews / 1000);
        const subtotal = (fixedEarned ? fixedAmt : 0) + cpmAmount;

        return {
          id: linkMap.get(cr.id) ?? "",
          creatorId: cr.id,
          name: cr.name,
          accounts: crAccounts
            .filter((a) => !a.campaign_id || campIdSet.has(a.campaign_id))
            .map((a) => ({
            accountId: a.id,
            username: a.username,
            campaignId: a.campaign_id,
            campaignName: a.campaign_id ? campMap.get(a.campaign_id)?.name ?? null : null,
          })),
          videoCount,
          target,
          totalViews,
          cpmRate,
          cpmAmount,
          fixedAmount: fixedAmt,
          fixedEarned,
          subtotal,
        };
      });

      return {
        creators: creatorRows,
        periodStart,
        periodEnd,
        periodLabel,
        currentPeriod,
        maxPeriod: currentPeriod,
      };
    },
    enabled: !!contractId,
  });
}

/* ── Contract-based Creator Payments (for Payments page) ── */

export interface ContractPaymentRow {
  creatorId: string;
  creatorName: string;
  contractId: string;
  contractName: string;
  periodMonth: number;
  periodYear: number;
  fixedAmount: number;
  fixedEarned: boolean;
  cpmAmount: number;
  totalAmount: number;
  monthVideoCount: number;
  monthlyTarget: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
}

export function useContractPayments(year: number, month: number) {
  const mStart = new Date(year, month, 1).toISOString();
  const mEnd = new Date(year, month + 1, 1).toISOString();

  return useQuery({
    queryKey: ["contract-payments", year, month],
    queryFn: async () => {
      const [
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
        { data: creators },
        { data: accounts },
        { data: videos },
        { data: campaigns },
        { data: existingPayments },
      ] = await Promise.all([
        supabase.from("contracts" as any).select("*").eq("is_active", true),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
        supabase.from("creators").select("id, name").eq("status", "active"),
        supabase.from("tiktok_accounts").select("id, creator_id, campaign_id"),
        supabase.from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("campaigns").select("id, video_views_cap"),
        supabase.from("creator_payments").select("*").eq("period_month", month + 1).eq("period_year", year),
      ]);

      const allContracts = (contracts ?? []) as any[];
      const allCC = (contractCampaigns ?? []) as any[];
      const allCCr = (contractCreators ?? []) as any[];
      const allCreators = (creators ?? []) as any[];
      const allAccounts = (accounts ?? []) as any[];
      const allVideos = (videos ?? []) as any[];
      const allCampaigns = (campaigns ?? []) as any[];
      const allPayments = (existingPayments ?? []) as any[];

      const capByCampaign = new Map<string, number | null>();
      allCampaigns.forEach((c) => capByCampaign.set(c.id, c.video_views_cap));

      const creatorMap = new Map(allCreators.map((c) => [c.id, c.name]));

      const rows: ContractPaymentRow[] = [];

      allContracts.forEach((contract) => {
        const contractCampIds = allCC.filter((r) => r.contract_id === contract.id).map((r) => r.campaign_id);
        const contractCreatorIds = allCCr.filter((r) => r.contract_id === contract.id).map((r) => r.creator_id);
        const contractCampSet = new Set(contractCampIds);

        const cpmRate = Number(contract.creator_cpm ?? 0.5);
        const fixedAmt = Number(contract.creator_fixed ?? 0);
        const minVpd = contract.min_videos_per_day ?? 5;
        const target = getMonthlyTarget(minVpd, year, month);

        contractCreatorIds.forEach((creatorId) => {
          const name = creatorMap.get(creatorId);
          if (!name) return;

          // Get accounts for this creator linked to contract campaigns
          const crAccounts = allAccounts.filter(
            (a) => a.creator_id === creatorId && a.campaign_id && contractCampSet.has(a.campaign_id)
          );
          const crAccIds = new Set(crAccounts.map((a) => a.id));
          const crVideos = allVideos.filter((v) => crAccIds.has(v.tiktok_account_id));
          const monthVideoCount = crVideos.length;

          // CPM with per-campaign cap
          let totalViews = 0;
          contractCampIds.forEach((campId) => {
            const cap = capByCampaign.get(campId) ?? null;
            const campAccIds = crAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
            const campAccSet = new Set(campAccIds);
            const campVideos = crVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
            totalViews += sumEffectiveViewsCapped(campVideos, cap);
          });

          const fixedEarned = isFixedEarnedMonthly(monthVideoCount, minVpd, year, month);
          const cpmAmount = cpmRate * (totalViews / 1000);
          const total = (fixedEarned ? fixedAmt : 0) + cpmAmount;

          // Check existing payment (match by creator + period — simplified)
          const payment = allPayments.find((p) => p.creator_id === creatorId);

          rows.push({
            creatorId,
            creatorName: name,
            contractId: contract.id,
            contractName: contract.name,
            periodMonth: month + 1,
            periodYear: year,
            fixedAmount: fixedAmt,
            fixedEarned,
            cpmAmount,
            totalAmount: total,
            monthVideoCount,
            monthlyTarget: target,
            isPaid: payment?.is_paid ?? false,
            paidAt: payment?.paid_at ?? null,
            paymentId: payment?.id ?? null,
          });
        });
      });

      return rows;
    },
  });
}

/* ── All active campaigns for multiselect ── */

export function useActiveCampaignsForSelect() {
  return useQuery({
    queryKey: ["active-campaigns-select"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("id, name").eq("status", "active");
      return data ?? [];
    },
  });
}

/* ── All active creators for select ── */

export function useActiveCreatorsForSelect() {
  return useQuery({
    queryKey: ["active-creators-select"],
    queryFn: async () => {
      const { data } = await supabase.from("creators").select("id, name").eq("status", "active").order("name");
      return data ?? [];
    },
  });
}
