import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews } from "@/lib/videoWindow";

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 1).toISOString();
  return { start, end };
}

export interface CampaignPayoffRow {
  campaignId: string;
  name: string;
  clientName: string;
  creatorCount: number;
  viewsMonth: number;
  clientIncome: number;
  creatorCost: number;
  margin: number;
}

export interface CreatorPayoffRow {
  creatorId: string;
  name: string;
  creatorFixed: number;
  creatorCpm: number;
  minVideosPerDay: number;
  viewsMonth: number;
  fixedEarned: boolean;
  fixedAmount: number;
  cpmAmount: number;
  total: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
}

export interface PaymentHistoryRow {
  id: string;
  creatorName: string;
  periodMonth: number;
  periodYear: number;
  fixedAmount: number;
  cpmAmount: number;
  totalAmount: number;
  paidAt: string;
}

export function usePayoffData(year: number, month: number) {
  const { start: mStart, end: mEnd } = monthRange(year, month);

  return useQuery({
    queryKey: ["payoff", year, month],
    queryFn: async () => {
      // Fetch all needed data in parallel
      const [
        { data: creators },
        { data: campaigns },
        { data: ccRows },
        { data: accounts },
        { data: videos },
        { data: payments },
      ] = await Promise.all([
        supabase.from("creators").select("*").eq("status", "active"),
        supabase.from("campaigns").select("*").eq("status", "active"),
        supabase.from("campaign_creators").select("*"),
        supabase.from("tiktok_accounts").select("*"),
        supabase.from("videos").select("tiktok_account_id, views, published_at").gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("payments").select("*").eq("period_month", month + 1).eq("period_year", year),
      ]);

      const allCreators = creators ?? [];
      const allCampaigns = campaigns ?? [];
      const allCC = ccRows ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = videos ?? [];
      const allPayments = payments ?? [];

      // Map: accountId -> views this month
      const viewsByAccount = new Map<string, number>();
      allVideos.forEach((v) => {
        viewsByAccount.set(v.tiktok_account_id, (viewsByAccount.get(v.tiktok_account_id) ?? 0) + (v.views ?? 0));
      });

      // Map: creatorId -> accountIds
      const accountsByCreator = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      // Map: campaignId -> accountIds
      const accountsByCampaign = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.campaign_id) return;
        const list = accountsByCampaign.get(a.campaign_id) ?? [];
        list.push(a.id);
        accountsByCampaign.set(a.campaign_id, list);
      });

      // Check if creator earned fixed (all days >= min_videos_per_day)
      const videosByDay = new Map<string, Map<string, number>>(); // creatorId -> day -> count
      allVideos.forEach((v) => {
        const day = v.published_at.slice(0, 10);
        allAccounts
          .filter((a) => a.id === v.tiktok_account_id && a.creator_id)
          .forEach((a) => {
            const creatorMap = videosByDay.get(a.creator_id!) ?? new Map();
            creatorMap.set(day, (creatorMap.get(day) ?? 0) + 1);
            videosByDay.set(a.creator_id!, creatorMap);
          });
      });

      const now = new Date();
      const endDay = year === now.getFullYear() && month === now.getMonth()
        ? now.getDate() - 1 // yesterday
        : new Date(year, month + 1, 0).getDate();

      function isFixedEarned(creatorId: string, minPerDay: number): boolean {
        const dayMap = videosByDay.get(creatorId) ?? new Map();
        for (let d = 1; d <= endDay; d++) {
          const date = new Date(year, month, d);
          if (date.getDay() === 0) continue; // skip Sunday
          const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if ((dayMap.get(dayStr) ?? 0) < minPerDay) return false;
        }
        return true;
      }

      // Creator views month (across all accounts)
      function creatorMonthViews(creatorId: string): number {
        const accIds = accountsByCreator.get(creatorId) ?? [];
        return accIds.reduce((s, id) => s + (viewsByAccount.get(id) ?? 0), 0);
      }

      // ── Campaign Payoff ──
      const campaignRows: CampaignPayoffRow[] = allCampaigns.map((camp) => {
        const creatorIds = allCC.filter((r) => r.campaign_id === camp.id).map((r) => r.creator_id);
        const creatorCount = creatorIds.length;
        const campAccIds = accountsByCampaign.get(camp.id) ?? [];
        const viewsMonth = campAccIds.reduce((s, id) => s + (viewsByAccount.get(id) ?? 0), 0);

        const clientFixed = (camp.client_fixed_per_creator ?? 200) * creatorCount;
        const clientCpm = (camp.client_cpm ?? 2) * (viewsMonth / 1000);
        const clientIncome = clientFixed + clientCpm;

        // Creator cost for this campaign
        let creatorCost = 0;
        creatorIds.forEach((cid) => {
          const cr = allCreators.find((c) => c.id === cid);
          if (!cr) return;
          // Creator accounts on THIS campaign
          const crAccIds = allAccounts.filter((a) => a.creator_id === cid && a.campaign_id === camp.id).map((a) => a.id);
          const crViews = crAccIds.reduce((s, id) => s + (viewsByAccount.get(id) ?? 0), 0);
          const earned = isFixedEarned(cid, cr.min_videos_per_day ?? 5);
          creatorCost += (earned ? (cr.creator_fixed ?? 200) : 0) + (cr.creator_cpm ?? 0.5) * (crViews / 1000);
        });

        return {
          campaignId: camp.id,
          name: camp.name,
          clientName: camp.client_name,
          creatorCount,
          viewsMonth,
          clientIncome,
          creatorCost,
          margin: clientIncome - creatorCost,
        };
      });

      // ── Creator Payoff ──
      const creatorRows: CreatorPayoffRow[] = allCreators.map((cr) => {
        const views = creatorMonthViews(cr.id);
        const min = cr.min_videos_per_day ?? 5;
        const earned = isFixedEarned(cr.id, min);
        const fixedAmt = cr.creator_fixed ?? 200;
        const cpmAmt = (cr.creator_cpm ?? 0.5) * (views / 1000);
        const total = (earned ? fixedAmt : 0) + cpmAmt;

        const payment = allPayments.find((p) => p.creator_id === cr.id);

        return {
          creatorId: cr.id,
          name: cr.name,
          creatorFixed: fixedAmt,
          creatorCpm: cr.creator_cpm ?? 0.5,
          minVideosPerDay: min,
          viewsMonth: views,
          fixedEarned: earned,
          fixedAmount: fixedAmt,
          cpmAmount: cpmAmt,
          total,
          isPaid: payment?.is_paid ?? false,
          paidAt: payment?.paid_at ?? null,
          paymentId: payment?.id ?? null,
        };
      });

      // ── Agency Totals ──
      const totalIncome = campaignRows.reduce((s, r) => s + r.clientIncome, 0);
      const totalCost = creatorRows.reduce((s, r) => s + r.total, 0);
      const netMargin = totalIncome - totalCost;

      return { campaignRows, creatorRows, totalIncome, totalCost, netMargin };
    },
  });
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ["payment-history"],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("*")
        .eq("is_paid", true)
        .order("paid_at", { ascending: false });
      if (error) throw error;

      const creatorIds = [...new Set((payments ?? []).map((p) => p.creator_id))];
      let creatorMap = new Map<string, string>();
      if (creatorIds.length) {
        const { data: creators } = await supabase.from("creators").select("id, name").in("id", creatorIds);
        (creators ?? []).forEach((c) => creatorMap.set(c.id, c.name));
      }

      return (payments ?? []).map((p): PaymentHistoryRow => ({
        id: p.id,
        creatorName: creatorMap.get(p.creator_id) ?? "—",
        periodMonth: p.period_month,
        periodYear: p.period_year,
        fixedAmount: p.fixed_amount ?? 0,
        cpmAmount: p.cpm_amount ?? 0,
        totalAmount: p.total_amount ?? 0,
        paidAt: p.paid_at ?? "",
      }));
    },
  });
}
