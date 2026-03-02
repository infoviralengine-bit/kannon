import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViewsCapped } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget, getWorkingDaysInMonth } from "@/lib/fixedEarned";

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
  monthVideos: number;
  cpmAmount: number;
  fixedEarned: boolean;
}

export function useContractCreators(contractId: string, year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const mStart = new Date(y, m, 1).toISOString();
  const mEnd = new Date(y, m + 1, 1).toISOString();

  return useQuery({
    queryKey: ["contract-creators", contractId, y, m],
    queryFn: async () => {
      const [
        { data: links },
        { data: campLinks },
      ] = await Promise.all([
        supabase.from("contract_creators" as any).select("id, creator_id").eq("contract_id", contractId),
        supabase.from("contract_campaigns" as any).select("campaign_id").eq("contract_id", contractId),
      ]);

      const creatorIds = ((links ?? []) as any[]).map((l) => l.creator_id);
      const campIds = ((campLinks ?? []) as any[]).map((l) => l.campaign_id);
      if (!creatorIds.length) return [];

      const [
        { data: creators },
        { data: accounts },
        { data: videos },
        { data: campaigns },
        { data: contract },
      ] = await Promise.all([
        supabase.from("creators").select("id, name").in("id", creatorIds),
        supabase.from("tiktok_accounts").select("id, creator_id, username, campaign_id").in("creator_id", creatorIds),
        supabase.from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("campaigns").select("id, name, video_views_cap").in("id", campIds.length ? campIds : ["__none__"]),
        supabase.from("contracts" as any).select("creator_cpm, creator_fixed, min_videos_per_day").eq("id", contractId).single(),
      ]);

      const campMap = new Map(((campaigns ?? []) as any[]).map((c) => [c.id, c]));
      const campIdSet = new Set(campIds);
      const linkMap = new Map(((links ?? []) as any[]).map((l: any) => [l.creator_id, l.id]));
      const cpmRate = Number((contract as any)?.creator_cpm ?? 0.5);
      const fixedAmt = Number((contract as any)?.creator_fixed ?? 0);
      const minVpd = (contract as any)?.min_videos_per_day ?? 5;

      const sortedCreators = ((creators ?? []) as any[]).sort((a: any, b: any) => a.name.localeCompare(b.name));
      return sortedCreators.map((cr): ContractCreatorRow => {
        const crAccounts = ((accounts ?? []) as any[]).filter((a) => a.creator_id === cr.id);
        // Only accounts linked to contract campaigns
        const contractAccounts = crAccounts.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
        const contractAccIds = new Set(contractAccounts.map((a) => a.id));

        const crVideos = ((videos ?? []) as any[]).filter((v) => contractAccIds.has(v.tiktok_account_id));
        const monthVideos = crVideos.length;

        // CPM with per-campaign cap
        let totalViews = 0;
        campIds.forEach((campId) => {
          const cap = campMap.get(campId)?.video_views_cap as number | null;
          const campAccIds = contractAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
          const campAccSet = new Set(campAccIds);
          const campVideos = crVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
          totalViews += sumEffectiveViewsCapped(campVideos, cap);
        });

        const fixedEarned = isFixedEarnedMonthly(monthVideos, minVpd, y, m);
        const cpmAmount = cpmRate * (totalViews / 1000);

        return {
          id: linkMap.get(cr.id) ?? "",
          creatorId: cr.id,
          name: cr.name,
          accounts: crAccounts.map((a) => ({
            accountId: a.id,
            username: a.username,
            campaignId: a.campaign_id,
            campaignName: a.campaign_id ? campMap.get(a.campaign_id)?.name ?? null : null,
          })),
          monthVideos,
          cpmAmount,
          fixedEarned,
        };
      });
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
      const { data } = await supabase.from("creators").select("id, name").eq("status", "active");
      return data ?? [];
    },
  });
}
