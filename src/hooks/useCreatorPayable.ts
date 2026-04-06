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
   Creator-centric payments with rolling 30-day contract periods
   ══════════════════════════════════════ */

export interface ContractBreakdown {
  contractId: string;
  contractName: string;
  monthVideoCount: number;
  monthlyTarget: number;
  fixedAmount: number;
  fixedEarned: boolean;
  cpmAmount: number;
  subtotal: number;
  periodStart: string;
  periodEnd: string;
}

export interface CreatorPayableRow {
  creatorId: string;
  creatorName: string;
  contracts: ContractBreakdown[];
  totalAmount: number;
  monthVideoCount: number;
  hasContracts: boolean;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
}

export interface PayableMeta {
  referenceStartDate: Date | null;
  currentPeriod: number;
  periodLabel: string;
}

export function useCreatorPayable(periodNumber: number) {
  return useQuery({
    queryKey: ["creator-payable", periodNumber],
    queryFn: async (): Promise<{ rows: CreatorPayableRow[]; meta: PayableMeta }> => {
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

      // Find earliest contract start_date for reference
      let earliestStart: Date | null = null;
      allContracts.forEach((c) => {
        if (c.start_date) {
          const d = parseContractStartDate(c.start_date);
          if (!earliestStart || d < earliestStart) earliestStart = d;
        }
      });

      if (!earliestStart) {
        earliestStart = new Date();
      }

      const currentPeriod = getCurrentPeriodNumber(earliestStart);
      const refPeriod = getContractPeriod(earliestStart, periodNumber);
      const periodLabel = formatPeriodRange(refPeriod.periodStart, refPeriod.periodEnd);

      // We need to fetch videos across the widest possible period range
      // Since contracts may have different start dates, compute the full range
      let globalStart = refPeriod.periodStart;
      let globalEnd = refPeriod.periodEnd;
      allContracts.forEach((c) => {
        if (c.start_date) {
          const sd = parseContractStartDate(c.start_date);
          const p = getContractPeriod(sd, periodNumber);
          if (p.periodStart < globalStart) globalStart = p.periodStart;
          if (p.periodEnd > globalEnd) globalEnd = p.periodEnd;
        }
      });

      // Fetch videos in the global range + 1 day buffer
      const fetchStart = globalStart.toISOString();
      const fetchEndDate = new Date(globalEnd);
      fetchEndDate.setUTCDate(fetchEndDate.getUTCDate() + 1);
      const fetchEnd = fetchEndDate.toISOString();

      const { data: videos } = await supabase.from("videos")
        .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
        .gte("published_at", fetchStart).lt("published_at", fetchEnd);

      // Query payments - use period_start if available, fall back to scanning all
      const { data: existingPayments } = await (supabase.from("creator_payments") as any)
        .select("*")
        .eq("period_start", globalStart.toISOString().split("T")[0])
        .eq("period_end", globalEnd.toISOString().split("T")[0]);

      const allVideos = (videos ?? []) as any[];
      const allPayments = (existingPayments ?? []) as any[];

      const capByCampaign = new Map<string, number | null>();
      allCampaigns.forEach((c) => capByCampaign.set(c.id, c.video_views_cap));

      // Build creator → contracts map
      const creatorContracts = new Map<string, string[]>();
      allCCr.forEach((r) => {
        const list = creatorContracts.get(r.creator_id) ?? [];
        list.push(r.contract_id);
        creatorContracts.set(r.creator_id, list);
      });

      const contractMap = new Map(allContracts.map((c) => [c.id, c]));

      // Contract → campaigns
      const contractCampMap = new Map<string, string[]>();
      allCC.forEach((r) => {
        const list = contractCampMap.get(r.contract_id) ?? [];
        list.push(r.campaign_id);
        contractCampMap.set(r.contract_id, list);
      });

      // Also try to find payments by period_month/period_year for backward compat
      // We'll match payments by creator_id + period_start or by period_month/year
      const paymentsByCreator = new Map<string, any>();
      allPayments.forEach((p) => {
        paymentsByCreator.set(p.creator_id, p);
      });

      allCreators.sort((a, b) => a.name.localeCompare(b.name));
      const rows = allCreators.map((cr): CreatorPayableRow => {
        const crContractIds = creatorContracts.get(cr.id) ?? [];
        const hasContracts = crContractIds.length > 0;

        const crAccounts = allAccounts.filter((a) => a.creator_id === cr.id);
        const crAccIds = new Set(crAccounts.map((a) => a.id));

        const breakdowns: ContractBreakdown[] = [];
        let totalVideoCount = 0;

        crContractIds.forEach((contractId) => {
          const contract = contractMap.get(contractId);
          if (!contract) return;

          // Compute this contract's period
          const contractStart = contract.start_date
            ? parseContractStartDate(contract.start_date)
            : earliestStart!;
          const { periodStart, periodEnd } = getContractPeriod(contractStart, periodNumber);
          const pStartISO = periodStart.toISOString();
          const pEndDate = new Date(periodEnd);
          pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
          const pEndISO = pEndDate.toISOString();

          const campIds = contractCampMap.get(contractId) ?? [];
          const campIdSet = new Set(campIds);
          const contractAccounts = crAccounts.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
          const contractAccIds = new Set(contractAccounts.map((a) => a.id));

          // Filter videos within this contract's period
          const contractVideos = allVideos.filter((v) =>
            contractAccIds.has(v.tiktok_account_id) &&
            v.published_at >= pStartISO &&
            v.published_at < pEndISO
          );
          const videoCount = contractVideos.length;
          totalVideoCount += videoCount;

          const cpmRate = Number(contract.creator_cpm ?? 0.5);
          const fixedAmt = Number(contract.creator_fixed ?? 0);
          const minVpd = contract.min_videos_per_day ?? 5;
          const target = getPeriodTarget(minVpd, periodStart, periodEnd);

          // CPM with per-campaign cap
          let totalViews = 0;
          campIds.forEach((campId) => {
            const cap = capByCampaign.get(campId) ?? null;
            const campAccIds = contractAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
            const campAccSet = new Set(campAccIds);
            const campVideos = contractVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
            totalViews += sumEffectiveViewsCapped(campVideos, cap);
          });

          const fixedEarned = isFixedEarnedInPeriod(videoCount, minVpd, periodStart, periodEnd);
          const cpmAmount = cpmRate * (totalViews / 1000);
          const subtotal = (fixedEarned ? fixedAmt : 0) + cpmAmount;

          breakdowns.push({
            contractId,
            contractName: contract.name,
            monthVideoCount: videoCount,
            monthlyTarget: target,
            fixedAmount: fixedAmt,
            fixedEarned,
            cpmAmount,
            subtotal,
            periodStart: periodStart.toISOString().split("T")[0],
            periodEnd: periodEnd.toISOString().split("T")[0],
          });
        });

        const totalAmount = breakdowns.reduce((s, b) => s + b.subtotal, 0);
        const payment = paymentsByCreator.get(cr.id);

        return {
          creatorId: cr.id,
          creatorName: cr.name,
          contracts: breakdowns,
          totalAmount,
          monthVideoCount: totalVideoCount,
          hasContracts,
          isPaid: payment?.is_paid ?? false,
          paidAt: payment?.paid_at ?? null,
          paymentId: payment?.id ?? null,
        };
      });

      return {
        rows,
        meta: {
          referenceStartDate: earliestStart,
          currentPeriod,
          periodLabel,
        },
      };
    },
  });
}
