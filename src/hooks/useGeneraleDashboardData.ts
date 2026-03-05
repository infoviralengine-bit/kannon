import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews } from "@/lib/videoWindow";

function monthRange(year: number, month: number) {
  return {
    start: new Date(year, month, 1).toISOString(),
    end: new Date(year, month + 1, 1).toISOString(),
  };
}

/* ══════════════════════════════════════
   Financial KPIs
   ══════════════════════════════════════ */

export interface FinancialKpi {
  fixedIncome: number;
  fixedExpense: number;
  cpmMargin: number;
  clientCpmTotal: number;
  creatorCpmTotal: number;
}

export function useFinancialKpis() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const mStart = new Date(y, m, 1).toISOString();
  const mEnd = new Date(y, m + 1, 1).toISOString();

  return useQuery({
    queryKey: ["dashboard-financial-kpis", y, m],
    queryFn: async (): Promise<FinancialKpi> => {
      const [
        { data: campaigns },
        { data: contracts },
        { data: contractCreators },
        { data: contractCampaigns },
        { data: accounts },
        { data: videos },
        { data: ccRows },
      ] = await Promise.all([
        supabase.from("campaigns").select("id, client_cpm, client_fixed_per_creator, planned_creators, video_views_cap, status").eq("status", "active"),
        supabase.from("contracts").select("id, creator_cpm, creator_fixed, is_active").eq("is_active", true),
        supabase.from("contract_creators").select("contract_id, creator_id"),
        supabase.from("contract_campaigns").select("contract_id, campaign_id"),
        supabase.from("tiktok_accounts").select("id, creator_id, campaign_id"),
        supabase.from("videos").select("tiktok_account_id, views, views_final, window_closed, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
      ]);

      const allCampaigns = campaigns ?? [];
      const allContracts = contracts ?? [];
      const allContractCreators = contractCreators ?? [];
      const allContractCampaigns = contractCampaigns ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = videos ?? [];
      const allCC = ccRows ?? [];

      // ── Entrate Fisse: planned_creators × fisso per ogni campagna attiva ──
      const fixedIncome = allCampaigns.reduce((s, c) => {
        return s + ((c.client_fixed_per_creator ?? 0) * (c.planned_creators ?? 1));
      }, 0);

      // ── Uscite Fisse: fisso di ogni contratto attivo × numero creator nel contratto ──
      const fixedExpense = allContracts.reduce((s, contract) => {
        const creatorsInContract = allContractCreators.filter((r) => r.contract_id === contract.id).length;
        return s + ((contract.creator_fixed ?? 0) * creatorsInContract);
      }, 0);

      // ── CPM Margins ──
      // Build views by account (with per-video cap from campaign)
      const campaignByAccount = new Map<string, string>();
      allAccounts.forEach((a) => { if (a.campaign_id) campaignByAccount.set(a.id, a.campaign_id); });

      const capByCampaign = new Map<string, number | null>();
      allCampaigns.forEach((c) => capByCampaign.set(c.id, (c as any).video_views_cap as number | null));

      // Views by campaign (capped)
      const viewsByCampaign = new Map<string, number>();
      allVideos.forEach((v) => {
        const campId = campaignByAccount.get(v.tiktok_account_id);
        if (!campId) return;
        let views = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
        const cap = capByCampaign.get(campId);
        if (cap != null && cap > 0) views = Math.min(views, cap);
        viewsByCampaign.set(campId, (viewsByCampaign.get(campId) ?? 0) + views);
      });

      // Client CPM total
      const clientCpmTotal = allCampaigns.reduce((s, c) => {
        const views = viewsByCampaign.get(c.id) ?? 0;
        return s + ((c.client_cpm ?? 0) * (views / 1000));
      }, 0);

      // Creator CPM total (based on contracts)
      // Build: for each contract, find its campaigns, find creator accounts in those campaigns, sum capped views
      const contractCampMap = new Map<string, string[]>();
      allContractCampaigns.forEach((r) => {
        const list = contractCampMap.get(r.contract_id) ?? [];
        list.push(r.campaign_id);
        contractCampMap.set(r.contract_id, list);
      });

      const creatorContractMap = new Map<string, string[]>();
      allContractCreators.forEach((r) => {
        const list = creatorContractMap.get(r.creator_id) ?? [];
        list.push(r.contract_id);
        creatorContractMap.set(r.creator_id, list);
      });

      // Views by creator×campaign (capped)
      const viewsByCreatorCampaign = new Map<string, number>();
      allVideos.forEach((v) => {
        const acc = allAccounts.find((a) => a.id === v.tiktok_account_id);
        if (!acc || !acc.creator_id || !acc.campaign_id) return;
        const key = `${acc.creator_id}::${acc.campaign_id}`;
        let views = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
        const cap = capByCampaign.get(acc.campaign_id);
        if (cap != null && cap > 0) views = Math.min(views, cap);
        viewsByCreatorCampaign.set(key, (viewsByCreatorCampaign.get(key) ?? 0) + views);
      });

      let creatorCpmTotal = 0;
      // For each contract, for each creator in that contract, sum views across contract's campaigns
      allContracts.forEach((contract) => {
        const campIds = contractCampMap.get(contract.id) ?? [];
        const creatorIds = allContractCreators.filter((r) => r.contract_id === contract.id).map((r) => r.creator_id);
        const cpmRate = contract.creator_cpm ?? 0;

        creatorIds.forEach((creatorId) => {
          const views = campIds.reduce((s, campId) => {
            return s + (viewsByCreatorCampaign.get(`${creatorId}::${campId}`) ?? 0);
          }, 0);
          creatorCpmTotal += cpmRate * (views / 1000);
        });
      });

      const cpmMargin = clientCpmTotal - creatorCpmTotal;

      return { fixedIncome, fixedExpense, cpmMargin, clientCpmTotal, creatorCpmTotal };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   Views Chart (daily, last N days)
   ══════════════════════════════════════ */

export interface DailyViewPoint {
  date: string;
  label: string;
  views: number;
}

export function useViewsChart(days: number) {
  return useQuery({
    queryKey: ["dashboard-views-chart", days],
    queryFn: async (): Promise<DailyViewPoint[]> => {
      const end = new Date();
      const start = new Date(end.getTime() - days * 86400000);

      const { data: videos } = await supabase
        .from("videos")
        .select("views, published_at")
        .gte("published_at", start.toISOString())
        .lt("published_at", end.toISOString());

      const map = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        map.set(d.toISOString().slice(0, 10), 0);
      }

      (videos ?? []).forEach((v) => {
        const date = v.published_at.slice(0, 10);
        if (map.has(date)) map.set(date, (map.get(date) ?? 0) + (v.views ?? 0));
      });

      const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, views]) => {
          const d = new Date(date);
          return { date, label: `${d.getDate()} ${monthNames[d.getMonth()]}`, views };
        });
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   Active Campaigns with stats
   ══════════════════════════════════════ */

export interface CampaignCardData {
  id: string;
  name: string;
  clientName: string;
  status: string;
  viewsMonth: number;
  viewsCap: number | null;
  spendCap: number | null;
  currentSpend: number;
  revenueMonth: number;
  creatorCount: number;
  capPercent: number | null;
  spendCapPercent: number | null;
}

export function useActiveCampaignCards() {
  const now = new Date();
  const { start: mStart, end: mEnd } = monthRange(now.getFullYear(), now.getMonth());

  return useQuery({
    queryKey: ["dashboard-campaign-cards"],
    queryFn: async (): Promise<CampaignCardData[]> => {
      const [
        { data: campaigns },
        { data: ccRows },
        { data: accounts },
        { data: videos },
        { data: clientPayments },
      ] = await Promise.all([
        supabase.from("campaigns").select("*").eq("status", "active"),
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
        supabase.from("tiktok_accounts").select("id, campaign_id"),
        supabase.from("videos").select("tiktok_account_id, views, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("client_payments").select("campaign_id, total_amount, cpm_amount, is_paid"),
      ]);

      const accountsByCampaign = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.campaign_id) return;
        const list = accountsByCampaign.get(a.campaign_id) ?? [];
        list.push(a.id);
        accountsByCampaign.set(a.campaign_id, list);
      });

      return (campaigns ?? []).map((c): CampaignCardData => {
        const accIds = new Set(accountsByCampaign.get(c.id) ?? []);
        const campVideos = (videos ?? []).filter((v) => accIds.has(v.tiktok_account_id));
        const viewsMonth = campVideos.reduce((s, v) => s + (v.views ?? 0), 0);
        const creatorCount = (ccRows ?? []).filter((r) => r.campaign_id === c.id).length;

        const viewsCap = (c as any).video_views_cap as number | null;
        const spendCap = (c as any).monthly_spend_cap as number | null;
        const clientCpm = c.client_cpm ?? 2;
        const plannedCreators = c.planned_creators ?? 1;
        const clientFixed = (c.client_fixed_per_creator ?? 0) * plannedCreators;
        const cpmRevenue = clientCpm * (viewsMonth / 1000);
        const revenueMonth = clientFixed + cpmRevenue;

        // Current spend from unpaid client payments (CPM only, fixed excluded from cap)
        const currentSpend = (clientPayments ?? [])
          .filter((p) => p.campaign_id === c.id && !p.is_paid)
          .reduce((s, p) => s + Number(p.cpm_amount), 0);

        return {
          id: c.id,
          name: c.name,
          clientName: c.client_name,
          status: c.status,
          viewsMonth,
          viewsCap,
          spendCap,
          currentSpend,
          revenueMonth,
          creatorCount,
          capPercent: viewsCap ? Math.round((viewsMonth / viewsCap) * 100) : null,
          spendCapPercent: spendCap ? Math.round((cpmRevenue / Number(spendCap)) * 100) : null,
        };
      });
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   Creator Alerts + Top Performers
   ══════════════════════════════════════ */

export interface CreatorAlertRow {
  creatorName: string;
  videosSoFar: number;
  totalRequired: number;
  daysRemaining: number;
}

export interface TopCreatorRow {
  creatorName: string;
  viewsMonth: number;
  cpmEarned: number;
  contractName: string;
}

export function useCreatorStatus() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const { start: mStart, end: mEnd } = monthRange(y, m);

  return useQuery({
    queryKey: ["dashboard-creator-status"],
    queryFn: async () => {
      const [
        { data: creators },
        { data: accounts },
        { data: videos },
        { data: contractCreators },
        { data: contracts },
      ] = await Promise.all([
        supabase.from("creators").select("id, name, min_videos_per_day, creator_cpm").eq("status", "active"),
        supabase.from("tiktok_accounts").select("id, creator_id").eq("account_type", "creator"),
        supabase.from("videos").select("tiktok_account_id, views, published_at")
          .gte("published_at", mStart).lt("published_at", mEnd),
        supabase.from("contract_creators").select("creator_id, contract_id"),
        supabase.from("contracts").select("id, name"),
      ]);

      const accountsByCreator = new Map<string, string[]>();
      (accounts ?? []).forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      const contractMap = new Map((contracts ?? []).map((c) => [c.id, c.name]));
      const creatorContract = new Map<string, string>();
      (contractCreators ?? []).forEach((cc) => {
        creatorContract.set(cc.creator_id, contractMap.get(cc.contract_id) ?? "—");
      });


      const alerts: CreatorAlertRow[] = [];
      const performers: { name: string; views: number; cpm: number; contract: string }[] = [];

      (creators ?? []).forEach((c) => {
        const accIds = new Set(accountsByCreator.get(c.id) ?? []);
        const crVideos = (videos ?? []).filter((v) => accIds.has(v.tiktok_account_id));
        const viewsMonth = crVideos.reduce((s, v) => s + (v.views ?? 0), 0);

        performers.push({
          name: c.name,
          views: viewsMonth,
          cpm: (c.creator_cpm ?? 0.5) * (viewsMonth / 1000),
          contract: creatorContract.get(c.id) ?? "—",
        });
      });

      // Top 3 by views
      performers.sort((a, b) => b.views - a.views);
      const topPerformers: TopCreatorRow[] = performers.slice(0, 3).map((p) => ({
        creatorName: p.name,
        viewsMonth: p.views,
        cpmEarned: p.cpm,
        contractName: p.contract,
      }));

      return { alerts, topPerformers };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   Payment Deadlines + System Alerts
   ══════════════════════════════════════ */

export interface PaymentDeadline {
  campaignName: string;
  clientName: string;
  amount: number;
  dueDate: string;
  daysUntil: number;
  isOverdue: boolean;
}

export interface CreatorPaymentDeadline {
  creatorName: string;
  amount: number;
  periodLabel: string;
  isPaid: boolean;
}

export interface SystemAlert {
  type: "cap" | "window" | "scraping";
  message: string;
  severity: "red" | "yellow" | "muted";
}

export function useDeadlinesAndAlerts() {
  return useQuery({
    queryKey: ["dashboard-deadlines-alerts"],
    queryFn: async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const weekFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

      // Current month for creator payments
      const currentMonth = now.getMonth() + 1; // 1-based
      const currentYear = now.getFullYear();

      const [
        { data: clientPayments },
        { data: campaigns },
        { data: scrapingLogs },
        { data: creatorPayments },
        { data: creators },
      ] = await Promise.all([
        supabase.from("client_payments").select("*").eq("is_paid", false).lte("due_date", weekFromNow).order("due_date"),
        supabase.from("campaigns").select("id, name, client_name, monthly_spend_cap, video_views_cap"),
        supabase.from("scraping_logs").select("*").order("run_at", { ascending: false }).limit(5),
        supabase.from("creator_payments").select("*").eq("period_month", currentMonth).eq("period_year", currentYear),
        supabase.from("creators").select("id, name").eq("status", "active"),
      ]);

      const campMap = new Map((campaigns ?? []).map((c) => [c.id, c]));
      const creatorMap = new Map((creators ?? []).map((c) => [c.id, c.name]));

      const deadlines: PaymentDeadline[] = (clientPayments ?? []).map((p) => {
        const camp = campMap.get(p.campaign_id);
        const dueDate = p.due_date;
        const daysUntil = Math.ceil((new Date(dueDate).getTime() - now.getTime()) / 86400000);
        return {
          campaignName: camp?.name ?? "—",
          clientName: camp?.client_name ?? "—",
          amount: Number(p.total_amount),
          dueDate,
          daysUntil,
          isOverdue: dueDate < todayStr,
        };
      });

      const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      const creatorDeadlines: CreatorPaymentDeadline[] = (creatorPayments ?? []).map((p) => ({
        creatorName: creatorMap.get(p.creator_id) ?? "—",
        amount: Number(p.total_amount),
        periodLabel: `${monthNames[p.period_month - 1]} ${p.period_year}`,
        isPaid: p.is_paid,
      }));

      const systemAlerts: SystemAlert[] = [];

      // Failed scraping
      const failedScrapes = (scrapingLogs ?? []).filter((l) => l.status === "error");
      if (failedScrapes.length > 0) {
        systemAlerts.push({
          type: "scraping",
          message: `Ultimo scraping fallito: ${failedScrapes[0].error_message?.slice(0, 60) ?? "errore sconosciuto"}`,
          severity: "red",
        });
      }

      return { deadlines, creatorDeadlines, systemAlerts };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
