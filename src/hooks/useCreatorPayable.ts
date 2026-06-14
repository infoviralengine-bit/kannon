import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeContractPortion, type ContractInput } from "@/lib/creatorPayable";
import {
  getContractPeriod,
  getPeriodTarget,
  parseContractStartDate,
  getCurrentPeriodNumber,
} from "@/lib/contractPeriods";

/* ══════════════════════════════════════
   Contract-centric payable data
   Each contract has its own period timeline
   ══════════════════════════════════════ */

export interface CreatorInContract {
  creatorId: string;
  creatorName: string;
  videoCount: number;
  monthlyTarget: number;
  fixedAmount: number;
  fixedEarned: boolean;
  cpmAmount: number;
  subtotal: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
}

export interface ContractPayableSection {
  contractId: string;
  contractName: string;
  startDate: string;
  firstPeriodStart: string | null;
  periodOverrides: Record<string, { end?: string; start?: string }> | null;
  currentPeriod: number;
  creators: CreatorInContract[];
  totalAmount: number;
  totalVideoCount: number;
}

/**
 * Fetch all contract payable data.
 * periodByContract maps contractId → selected period number.
 * Contracts not in the map use their current period.
 */
export function useContractPayable(periodByContract: Record<string, number>) {
  const periodKey = JSON.stringify(periodByContract);

  return useQuery({
    queryKey: ["contract-payable", periodKey],
    queryFn: async (): Promise<ContractPayableSection[]> => {
      const [
        { data: creators },
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
        { data: accounts },
        { data: campaigns },
      ] = await Promise.all([
        supabase.from("creators").select("id, name").eq("status", "active"),
        supabase.from("contracts" as any).select("*").eq("is_active", true),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
        supabase.from("tiktok_accounts").select("id, creator_id, campaign_id"),
        supabase.from("campaigns").select("id, video_views_cap"),
      ]);

      const allCreators = (creators ?? []) as any[];
      const allContracts = (contracts ?? []) as any[];
      const allCC = (contractCampaigns ?? []) as any[];
      const allCCr = (contractCreators ?? []) as any[];
      const allAccounts = (accounts ?? []) as any[];
      const allCampaigns = (campaigns ?? []) as any[];

      const creatorMap = new Map(allCreators.map((c) => [c.id, c.name]));

      // Contract → campaigns
      const contractCampMap = new Map<string, string[]>();
      allCC.forEach((r) => {
        const list = contractCampMap.get(r.contract_id) ?? [];
        list.push(r.campaign_id);
        contractCampMap.set(r.contract_id, list);
      });

      // Contract → creators
      const contractCreatorMap = new Map<string, string[]>();
      allCCr.forEach((r) => {
        const list = contractCreatorMap.get(r.contract_id) ?? [];
        list.push(r.creator_id);
        contractCreatorMap.set(r.contract_id, list);
      });

      // Compute the widest date range needed across all contracts/periods
      let globalStart: Date | null = null;
      let globalEnd: Date | null = null;

      allContracts.forEach((contract) => {
        const sd = contract.start_date
          ? parseContractStartDate(contract.start_date)
          : new Date();
        const fps = contract.first_period_start
          ? parseContractStartDate(contract.first_period_start)
          : null;
        const ov = (contract as any).period_overrides ?? null;
        const pn = periodByContract[contract.id] ?? getCurrentPeriodNumber(sd, fps, ov);
        const { periodStart, periodEnd } = getContractPeriod(sd, pn, fps, ov);
        if (!globalStart || periodStart < globalStart) globalStart = periodStart;
        if (!globalEnd || periodEnd > globalEnd) globalEnd = periodEnd;
      });

      if (!globalStart || !globalEnd) {
        return [];
      }

      // Local aliases so TS keeps the narrowed Date type across the closure boundary
      // (control-flow narrowing doesn't survive forEach assignments above).
      const gStart: Date = globalStart;
      const gEnd: Date = globalEnd;
      const fetchStart = gStart.toISOString();
      const fetchEndDate = new Date(gEnd);
      fetchEndDate.setUTCDate(fetchEndDate.getUTCDate() + 1);
      const fetchEnd = fetchEndDate.toISOString();

      // Fetch videos with pagination (Supabase default limit is 1000)
      const fetchAllVideos = async () => {
        const all: any[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data } = await supabase.from("videos")
            .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
            .gte("published_at", fetchStart).lt("published_at", fetchEnd)
            .range(from, from + pageSize - 1);
          const rows = data ?? [];
          all.push(...rows);
          if (rows.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };

      const [allVideos, { data: allPayments }] = await Promise.all([
        fetchAllVideos(),
        supabase.from("creator_payments").select("*"),
      ]);
      const paymentsList = (allPayments ?? []) as any[];

      // Build sections per contract
      return allContracts.map((contract): ContractPayableSection => {
        const sd = contract.start_date
          ? parseContractStartDate(contract.start_date)
          : new Date();
        const fps = contract.first_period_start
          ? parseContractStartDate(contract.first_period_start)
          : null;
        const ov = (contract as any).period_overrides ?? null;
        const currentPeriod = getCurrentPeriodNumber(sd, fps, ov);
        const selectedPeriod = periodByContract[contract.id] ?? currentPeriod;
        const { periodStart, periodEnd } = getContractPeriod(sd, selectedPeriod, fps, ov);

        const pStartISO = periodStart.toISOString();
        const pEndDate = new Date(periodEnd);
        pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
        const pEndISO = pEndDate.toISOString();

        const campIds = contractCampMap.get(contract.id) ?? [];
        const creatorIds = contractCreatorMap.get(contract.id) ?? [];

        // min_videos_per_day: contract value, fallback 5 (Premium obligation).
        const minVpd = contract.min_videos_per_day ?? 5;
        const target = getPeriodTarget(minVpd, periodStart, periodEnd);

        // Single source of truth (creatorPayable.ts). Each contract has its own
        // rolling period, so we compute the portion per (contract, creator) with
        // this period's date range — exactly the case the SOT documents.
        const contractInput: ContractInput = {
          id: contract.id,
          name: contract.name,
          creator_cpm: contract.creator_cpm,
          creator_fixed: contract.creator_fixed,
          min_videos_per_day: contract.min_videos_per_day,
        };
        const periodVideos = allVideos.filter(
          (v) => v.published_at >= pStartISO && v.published_at < pEndISO,
        );

        let sectionTotal = 0;
        let sectionVideos = 0;

        const creatorsInContract: CreatorInContract[] = creatorIds
          .map((creatorId) => {
            const name = creatorMap.get(creatorId) ?? "—";
            const portion = computeContractPortion({
              creatorId,
              contract: contractInput,
              contractCampaignIds: campIds,
              videos: periodVideos as any,
              accounts: allAccounts as any,
              campaigns: allCampaigns as any,
              periodStart,
              periodEnd,
            });

            sectionTotal += portion.subtotal;
            sectionVideos += portion.videoCount;

            // Find payment for this creator + period
            const pStartStr = periodStart.toISOString().split("T")[0];
            const pEndStr = periodEnd.toISOString().split("T")[0];
            const payment = paymentsList.find(
              (p) => p.creator_id === creatorId &&
                ((p.period_start === pStartStr && p.period_end === pEndStr) ||
                 (!p.period_start && p.period_month === periodStart.getUTCMonth() + 1 && p.period_year === periodStart.getUTCFullYear()))
            );

            return {
              creatorId,
              creatorName: name,
              videoCount: portion.videoCount,
              monthlyTarget: target,
              fixedAmount: portion.fixedRate,
              fixedEarned: portion.fixedEarned,
              cpmAmount: portion.cpmAmount,
              subtotal: portion.subtotal,
              isPaid: payment?.is_paid ?? false,
              paidAt: payment?.paid_at ?? null,
              paymentId: payment?.id ?? null,
            };
          })
          .sort((a, b) => a.creatorName.localeCompare(b.creatorName));

        return {
          contractId: contract.id,
          contractName: contract.name,
          startDate: contract.start_date ?? new Date().toISOString().split("T")[0],
          firstPeriodStart: contract.first_period_start ?? null,
          periodOverrides: (contract as any).period_overrides ?? null,
          currentPeriod,
          creators: creatorsInContract,
          totalAmount: sectionTotal,
          totalVideoCount: sectionVideos,
        };
      });
    },
  });
}
