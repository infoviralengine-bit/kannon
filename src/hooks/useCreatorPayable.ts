import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViewsCapped } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget } from "@/lib/fixedEarned";

/* ══════════════════════════════════════
   Creator-centric payments with contract breakdown
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

export function useCreatorPayable(year: number, month: number) {
  const mStart = new Date(year, month, 1).toISOString();
  const mEnd = new Date(year, month + 1, 1).toISOString();

  return useQuery({
    queryKey: ["creator-payable", year, month],
    queryFn: async (): Promise<CreatorPayableRow[]> => {
      const [
        { data: creators },
        { data: contracts },
        { data: contractCampaigns },
        { data: contractCreators },
        { data: accounts },
        { data: videos },
        { data: campaigns },
        { data: existingPayments },
      ] = await Promise.all([
        supabase.from("creators").select("id, name").eq("status", "active"),
        supabase.from("contracts" as any).select("*").eq("is_active", true),
        supabase.from("contract_campaigns" as any).select("contract_id, campaign_id"),
        supabase.from("contract_creators" as any).select("contract_id, creator_id"),
        supabase.from("tiktok_accounts").select("id, creator_id, campaign_id"),
        supabase.from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("campaigns").select("id, video_views_cap"),
        supabase.from("creator_payments").select("*").eq("period_month", month + 1).eq("period_year", year),
      ]);

      const allCreators = (creators ?? []) as any[];
      const allContracts = (contracts ?? []) as any[];
      const allCC = (contractCampaigns ?? []) as any[];
      const allCCr = (contractCreators ?? []) as any[];
      const allAccounts = (accounts ?? []) as any[];
      const allVideos = (videos ?? []) as any[];
      const allCampaigns = (campaigns ?? []) as any[];
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

      allCreators.sort((a, b) => a.name.localeCompare(b.name));
      return allCreators.map((cr): CreatorPayableRow => {
        const crContractIds = creatorContracts.get(cr.id) ?? [];
        const hasContracts = crContractIds.length > 0;

        // All accounts for this creator
        const crAccounts = allAccounts.filter((a) => a.creator_id === cr.id);
        const crAccIds = new Set(crAccounts.map((a) => a.id));
        const crAllVideos = allVideos.filter((v) => crAccIds.has(v.tiktok_account_id));
        const monthVideoCount = crAllVideos.length;

        const breakdowns: ContractBreakdown[] = [];

        crContractIds.forEach((contractId) => {
          const contract = contractMap.get(contractId);
          if (!contract) return;

          const campIds = contractCampMap.get(contractId) ?? [];
          const campIdSet = new Set(campIds);
          const contractAccounts = crAccounts.filter((a) => a.campaign_id && campIdSet.has(a.campaign_id));
          const contractAccIds = new Set(contractAccounts.map((a) => a.id));
          const contractVideos = crAllVideos.filter((v) => contractAccIds.has(v.tiktok_account_id));
          const videoCount = contractVideos.length;

          const cpmRate = Number(contract.creator_cpm ?? 0.5);
          const fixedAmt = Number(contract.creator_fixed ?? 0);
          const minVpd = contract.min_videos_per_day ?? 5;
          const target = getMonthlyTarget(minVpd, year, month);

          // CPM with per-campaign cap
          let totalViews = 0;
          campIds.forEach((campId) => {
            const cap = capByCampaign.get(campId) ?? null;
            const campAccIds = contractAccounts.filter((a) => a.campaign_id === campId).map((a) => a.id);
            const campAccSet = new Set(campAccIds);
            const campVideos = contractVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
            totalViews += sumEffectiveViewsCapped(campVideos, cap);
          });

          const fixedEarned = isFixedEarnedMonthly(videoCount, minVpd, year, month);
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
          });
        });

        const totalAmount = breakdowns.reduce((s, b) => s + b.subtotal, 0);
        const payment = allPayments.find((p) => p.creator_id === cr.id);

        return {
          creatorId: cr.id,
          creatorName: cr.name,
          contracts: breakdowns,
          totalAmount,
          monthVideoCount,
          hasContracts,
          isPaid: payment?.is_paid ?? false,
          paidAt: payment?.paid_at ?? null,
          paymentId: payment?.id ?? null,
        };
      });
    },
  });
}
