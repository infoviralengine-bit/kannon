import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sumEffectiveViewsCapped } from "@/lib/videoWindow";
import {
  getContractPeriod,
  getPeriodTarget,
  isFixedEarnedInPeriod,
  parseContractStartDate,
  getCurrentPeriodNumber,
  formatPeriodRange,
} from "@/lib/contractPeriods";

export interface WarmupAccount {
  id: string;
  username: string;
  campaignName: string;
  campaignId: string | null;
  warmupDay: number;
  warmupStartedAt: string | null;
  followingCount: number;
  isReady: boolean;
  needsMoreFollowing: boolean;
}

export interface AccountStats {
  id: string;
  username: string;
  campaignName: string;
  totalViews: number;
  totalVideos: number;
  monthViews: number;
  monthVideos: number;
}

export interface ContractBreakdown {
  contractId: string;
  contractName: string;
  videoCount: number;
  monthlyTarget: number;
  fixedAmount: number;
  fixedEarned: boolean;
  cpmRate: number;
  cpmAmount: number;
  totalViews: number;
  subtotal: number;
}

export interface EarningsData {
  monthEarnings: number;
  totalEarnings: number;
  totalViews: number;
  totalVideos: number;
  monthViews: number;
  monthVideos: number;
  contractBreakdowns: ContractBreakdown[];
  payments: {
    period: string;
    gross: number;
    tax: number;
    net: number;
    isPaid: boolean;
    paidAt: string | null;
  }[];
}

export interface CreatorContentItem {
  id: string;
  title: string;
  type: string;
  body: string | null;
  file_url: string | null;
  due_date: string | null;
  status: string;
  campaignName: string;
}

export interface CalendarEntry {
  id: string;
  scheduled_for: string;
  status: string;
  contentTitle: string | null;
  contentId: string | null;
  accountUsername: string | null;
}

export function useCreatorPortal(selectedPeriod?: number) {
  const { user } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return useQuery({
    queryKey: ["creator-portal", user?.id, selectedPeriod],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get creator
      const { data: creator, error: crErr } = await supabase
        .from("creators")
        .select("*")
        .eq("profile_id", user.id)
        .single();
      if (crErr || !creator) return null;

      // Get accounts
      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("creator_id", creator.id);
      const accs = (accounts ?? []) as any[];
      const accIds = accs.map((a: any) => a.id);

      // Get campaigns for names and caps
      const campIds = [...new Set(accs.map((a: any) => a.campaign_id).filter(Boolean))] as string[];
      let campaigns: { id: string; name: string; video_views_cap: number | null }[] = [];
      if (campIds.length) {
        const { data } = await supabase.from("campaigns").select("id, name, video_views_cap").in("id", campIds);
        campaigns = data ?? [];
      }
      const campMap = new Map(campaigns.map((c) => [c.id, c.name]));
      const capByCampaign = new Map(campaigns.map((c) => [c.id, c.video_views_cap]));

      // Get ALL videos for these accounts
      let allVideos: any[] = [];
      if (accIds.length) {
        const { data } = await supabase
          .from("videos")
          .select("*")
          .in("tiktok_account_id", accIds)
          .order("published_at", { ascending: false });
        allVideos = data ?? [];
      }

      // Build warmup accounts
      const creatorPhase = String(creator.onboarding_phase ?? "").trim().toLowerCase();
      const creatorIsOperativo = creatorPhase.startsWith("operativ");

      const warmupAccounts: WarmupAccount[] = accs.map((a: any) => {
        const day = a.warmup_day ?? 0;
        const following = a.following_count ?? 0;
        const isReady = creatorIsOperativo || (day >= 3 && following >= 40);
        const needsMoreFollowing = !creatorIsOperativo && day >= 3 && following < 40;
        return {
          id: a.id,
          username: a.username,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          campaignId: a.campaign_id,
          warmupDay: creatorIsOperativo ? 3 : day,
          warmupStartedAt: a.warmup_started_at,
          followingCount: following,
          isReady,
          needsMoreFollowing,
        };
      });

      // Per-account stats - period stats filled after contract computation
      const accountStats: AccountStats[] = accs.map((a: any) => {
        const accVids = allVideos.filter((v) => v.tiktok_account_id === a.id);
        return {
          id: a.id,
          username: a.username,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          totalViews: accVids.reduce((s, v) => s + (v.views ?? 0), 0),
          totalVideos: accVids.length,
          monthViews: 0,
          monthVideos: 0,
        };
      });

      const allWarmupDone = warmupAccounts.length > 0 && warmupAccounts.every((a) => a.isReady);
      const anyWarmupDone = warmupAccounts.some((a) => a.isReady);
      const isOperativo = creatorIsOperativo || allWarmupDone;
      const unlocked = anyWarmupDone || isOperativo;

      const isFirstVisit = !isOperativo && warmupAccounts.every((a) => a.warmupDay === 0 && !a.warmupStartedAt);

      // --- Contract-based earnings calculation ---
      const { data: contractCreators } = await supabase
        .from("contract_creators" as any)
        .select("contract_id, creator_id")
        .eq("creator_id", creator.id);
      const ccRows = (contractCreators ?? []) as any[];
      const contractIds = ccRows.map((r: any) => r.contract_id);

      let allContracts: any[] = [];
      let allContractCampaigns: any[] = [];
      if (contractIds.length) {
        const [{ data: cData }, { data: ccData }] = await Promise.all([
          supabase.from("contracts" as any).select("*").in("id", contractIds).eq("is_active", true),
          supabase.from("contract_campaigns" as any).select("contract_id, campaign_id").in("contract_id", contractIds),
        ]);
        allContracts = (cData ?? []) as any[];
        allContractCampaigns = (ccData ?? []) as any[];
      }

      const contractCampMap = new Map<string, string[]>();
      allContractCampaigns.forEach((r: any) => {
        const list = contractCampMap.get(r.contract_id) ?? [];
        list.push(r.campaign_id);
        contractCampMap.set(r.contract_id, list);
      });

      const contractBreakdowns: ContractBreakdown[] = allContracts.map((contract: any) => {
        const cCampIds = contractCampMap.get(contract.id) ?? [];
        const campIdSet = new Set(cCampIds);
        const contractAccounts = accs.filter((a: any) => a.campaign_id && campIdSet.has(a.campaign_id));
        const contractAccIds = new Set(contractAccounts.map((a: any) => a.id));

        // Use contract's own period based on start_date
        const contractStart = contract.start_date
          ? parseContractStartDate(contract.start_date)
          : new Date(Date.UTC(year, month, 1));
        const fps = contract.first_period_start
          ? parseContractStartDate(contract.first_period_start)
          : null;
        const activePeriod = selectedPeriod ?? getCurrentPeriodNumber(contractStart, fps);
        const { periodStart, periodEnd } = getContractPeriod(contractStart, activePeriod, fps);
        const pStartISO = periodStart.toISOString();
        const pEndDate = new Date(periodEnd);
        pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
        const pEndISO = pEndDate.toISOString();

        const contractPeriodVideos = allVideos.filter((v) =>
          contractAccIds.has(v.tiktok_account_id) &&
          v.published_at >= pStartISO &&
          v.published_at < pEndISO
        );
        const videoCount = contractPeriodVideos.length;

        const cpmRate = Number(contract.creator_cpm ?? 0.5);
        const fixedAmt = Number(contract.creator_fixed ?? 0);
        const minVpd = contract.min_videos_per_day ?? 5;
        const target = getPeriodTarget(minVpd, periodStart, periodEnd);

        let totalContractViews = 0;
        cCampIds.forEach((campId) => {
          const cap = capByCampaign.get(campId) ?? null;
          const campAccIds = contractAccounts.filter((a: any) => a.campaign_id === campId).map((a: any) => a.id);
          const campAccSet = new Set(campAccIds);
          const campVideos = contractPeriodVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
          totalContractViews += sumEffectiveViewsCapped(campVideos, cap);
        });

        const fixedEarned = minVpd === 0 || isFixedEarnedInPeriod(videoCount, minVpd, periodStart, periodEnd);
        const cpmAmount = cpmRate * (totalContractViews / 1000);
        const subtotal = (fixedEarned ? fixedAmt : 0) + cpmAmount;

        return {
          contractId: contract.id,
          contractName: contract.name,
          videoCount,
          monthlyTarget: target,
          fixedAmount: fixedAmt,
          fixedEarned,
          cpmRate,
          cpmAmount,
          totalViews: totalContractViews,
          subtotal,
        };
      });

      const currentMonthEarnings = contractBreakdowns.reduce((s, b) => s + b.subtotal, 0);

      // Historical payments
      const { data: payments } = await supabase
        .from("creator_payments")
        .select("*")
        .eq("creator_id", creator.id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      const paymentRows = (payments ?? []) as any[];

      const totalViews = allVideos.reduce((s, v) => s + (v.views ?? 0), 0);
      const totalVideos = allVideos.length;

      // Compute period views/videos from contract periods (not calendar month)
      const periodVideoIds = new Set<string>();
      let periodViewsTotal = 0;
      allContracts.forEach((contract: any) => {
        const contractStart = contract.start_date
          ? parseContractStartDate(contract.start_date)
          : new Date(Date.UTC(year, month, 1));
        const activePeriod = selectedPeriod ?? getCurrentPeriodNumber(contractStart);
        const { periodStart, periodEnd } = getContractPeriod(contractStart, activePeriod);
        const pStartISO = periodStart.toISOString();
        const pEndDate = new Date(periodEnd);
        pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
        const pEndISO = pEndDate.toISOString();
        allVideos.forEach((v) => {
          if (accIds.includes(v.tiktok_account_id) && v.published_at >= pStartISO && v.published_at < pEndISO && !periodVideoIds.has(v.id)) {
            periodVideoIds.add(v.id);
            periodViewsTotal += v.views ?? 0;
          }
        });
      });
      const monthViews = periodViewsTotal;
      const monthVideosCount = periodVideoIds.size;

      // Update account stats with period data
      accountStats.forEach((acc) => {
        let accPViews = 0;
        let accPVideos = 0;
        allContracts.forEach((contract: any) => {
          const contractStart = contract.start_date
            ? parseContractStartDate(contract.start_date)
            : new Date(Date.UTC(year, month, 1));
          const activePeriod = selectedPeriod ?? getCurrentPeriodNumber(contractStart);
          const { periodStart, periodEnd } = getContractPeriod(contractStart, activePeriod);
          const pStartISO = periodStart.toISOString();
          const pEndDate = new Date(periodEnd);
          pEndDate.setUTCDate(pEndDate.getUTCDate() + 1);
          const pEndISO = pEndDate.toISOString();
          allVideos.forEach((v) => {
            if (v.tiktok_account_id === acc.id && v.published_at >= pStartISO && v.published_at < pEndISO) {
              accPViews += v.views ?? 0;
              accPVideos++;
            }
          });
        });
        acc.monthViews = accPViews;
        acc.monthVideos = accPVideos;
      });

      const totalPaidEarnings = paymentRows.reduce((s: number, p: any) => s + Number(p.total_amount ?? 0), 0);

      const earnings: EarningsData = {
        monthEarnings: currentMonthEarnings,
        totalEarnings: totalPaidEarnings + currentMonthEarnings,
        totalViews,
        totalVideos,
        monthViews,
        monthVideos: monthVideosCount,
        contractBreakdowns,
        payments: paymentRows.map((p: any) => {
          const gross = Number(p.total_amount ?? 0);
          const tax = gross * 0.2;
          return {
            period: `${String(p.period_month).padStart(2, "0")}/${p.period_year}`,
            gross,
            tax,
            net: gross - tax,
            isPaid: p.is_paid,
            paidAt: p.paid_at,
          };
        }),
      };

      // Fetch content & calendar
      let content: CreatorContentItem[] = [];
      let calendar: CalendarEntry[] = [];
      if (unlocked) {
        const { data: cData } = await supabase
          .from("creator_content" as any)
          .select("*")
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false });
        content = ((cData ?? []) as any[]).map((c: any) => ({
          id: c.id, title: c.title, type: c.type, body: c.body,
          file_url: c.file_url, due_date: c.due_date, status: c.status,
          campaignName: c.campaign_id ? campMap.get(c.campaign_id) ?? "—" : "—",
        }));

        const { data: calData } = await supabase
          .from("creator_calendar" as any)
          .select("*")
          .eq("creator_id", creator.id)
          .order("scheduled_for", { ascending: true });
        const contentMapCal = new Map(content.map((c) => [c.id, c.title]));
        const accMapCal = new Map(accs.map((a: any) => [a.id, a.username]));
        calendar = ((calData ?? []) as any[]).map((e: any) => ({
          id: e.id, scheduled_for: e.scheduled_for, status: e.status,
          contentTitle: e.content_id ? contentMapCal.get(e.content_id) ?? null : null,
          contentId: e.content_id,
          accountUsername: e.tiktok_account_id ? accMapCal.get(e.tiktok_account_id) ?? null : null,
        }));
      }

      // Compute default period (max current period across all contracts)
      const defaultPeriod = allContracts.length > 0
        ? Math.max(...allContracts.map((c: any) => {
            const sd = c.start_date ? parseContractStartDate(c.start_date) : new Date();
            return getCurrentPeriodNumber(sd);
          }))
        : 1;

      return {
        creator,
        warmupAccounts,
        accountStats,
        allWarmupDone,
        anyWarmupDone,
        isOperativo,
        unlocked,
        isFirstVisit,
        content,
        calendar,
        earnings,
        defaultPeriod,
      };
    },
    enabled: !!user,
  });
}

export function useCompleteWarmupDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, currentDay }: { accountId: string; currentDay: number }) => {
      const newDay = currentDay + 1;
      const updates: any = { warmup_day: newDay };
      if (currentDay === 0) {
        updates.warmup_started_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("tiktok_accounts")
        .update(updates)
        .eq("id", accountId);
      if (error) throw error;
      return newDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-portal"] });
    },
  });
}

export function useUpdateContentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, status }: { contentId: string; status: string }) => {
      const { error } = await supabase
        .from("creator_content" as any)
        .update({ status } as any)
        .eq("id", contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-portal"] });
    },
  });
}
