import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViewsCapped } from "@/lib/videoWindow";
import {
  getContractPeriod,
  getPeriodTarget,
  isFixedEarnedInPeriod,
  parseContractStartDate,
  getCurrentPeriodNumber,
  formatPeriodRange,
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

      const capByCampaign = new Map<string, number | null>();
      allCampaigns.forEach((c) => capByCampaign.set(c.id, c.video_views_cap));

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
        const pn = periodByContract[contract.id] ?? getCurrentPeriodNumber(sd);
        const { periodStart, periodEnd } = getContractPeriod(sd, pn);
        if (!globalStart || periodStart < globalStart) globalStart = periodStart;
        if (!globalEnd || periodEnd > globalEnd) globalEnd = periodEnd;
      });

      if (!globalStart || !globalEnd) {
        return [];
      }

      const fetchStart = globalStart.toISOString();
      const fetchEndDate = new Date(globalEnd);
      fetchEndDate.setUTCDate(fetchEndDate.getUTCDate() + 1);
      const fetchEnd = fetchEndDate.toISOString();

      const [{ data: videos }, { data: allPayments }] = await Promise.all([
        supabase.from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", fetchStart).lt("published_at", fetchEnd),
        supabase.from("creator_payments").select("*"),
      ]);

      const allVideos = (videos ?? []) as any[];
      const paymentsList = (allPayments ?? []) as any[];

      // Build sections per contract
      return allContracts.map((contract): ContractPayableSection => {
        const sd = contract.start_date
          ? parseContractStartDate(contract.start_date)
          : new Date();
        const currentPeriod = getCurrentPeriodNumber(sd);
        const selectedPeriod = periodByContract[contract.id] ?? currentPeriod;
        const { periodStart, periodEnd } = getContractPeriod(sd, selectedPeriod);

        const pStartISO = periodStart.toISOString();
        const pEndDate = new Date(periodEnd);
        pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
        const pEndISO = pEndDate.toISOString();

        const campIds = contractCampMap.get(contract.id) ?? [];
        const campIdSet = new Set(campIds);
        const creatorIds = contractCreatorMap.get(contract.id) ?? [];

        const cpmRate = Number(contract.creator_cpm ?? 0.5);
        const fixedAmt = Number(contract.creator_fixed ?? 0);
        const minVpd = contract.min_videos_per_day ?? 5;
        const target = getPeriodTarget(minVpd, periodStart, periodEnd);

        let sectionTotal = 0;
        let sectionVideos = 0;

        const creatorsInContract: CreatorInContract[] = creatorIds
          .map((creatorId) => {
            const name = creatorMap.get(creatorId) ?? "—";
            const crAccounts = allAccounts.filter(
              (a) => a.creator_id === creatorId && a.campaign_id && campIdSet.has(a.campaign_id)
            );
            const crAccIds = new Set(crAccounts.map((a) => a.id));

            // Videos in this contract's period
            const crVideos = allVideos.filter((v) =>
              crAccIds.has(v.tiktok_account_id) &&
              v.published_at >= pStartISO &&
              v.published_at < pEndISO
            );
            const videoCount = crVideos.length;

            // CPM with per-campaign cap
            let totalViews = 0;
            campIds.forEach((campId) => {
              const cap = capByCampaign.get(campId) ?? null;
              const campAccs = crAccounts.filter((a) => a.campaign_id === campId);
              const campAccSet = new Set(campAccs.map((a) => a.id));
              const campVideos = crVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
              totalViews += sumEffectiveViewsCapped(campVideos, cap);
            });

            const fixedEarned = isFixedEarnedInPeriod(videoCount, minVpd, periodStart, periodEnd);
            const cpmAmount = cpmRate * (totalViews / 1000);
            const subtotal = (fixedEarned ? fixedAmt : 0) + cpmAmount;

            sectionTotal += subtotal;
            sectionVideos += videoCount;

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
              videoCount,
              monthlyTarget: target,
              fixedAmount: fixedAmt,
              fixedEarned,
              cpmAmount,
              subtotal,
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
          currentPeriod,
          creators: creatorsInContract,
          totalAmount: sectionTotal,
          totalVideoCount: sectionVideos,
        };
      });
    },
  });
}
