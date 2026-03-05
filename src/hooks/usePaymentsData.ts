import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews, sumEffectiveViewsCapped, countByWindowStatus } from "@/lib/videoWindow";
import { isFixedEarnedMonthly, getMonthlyTarget } from "@/lib/fixedEarned";

/* ═══════════════════════════════════════════════
   Client Payments (Da Ricevere)
   ═══════════════════════════════════════════════ */

export interface ClientPaymentRow {
  id: string;
  campaignId: string;
  campaignName: string;
  clientName: string;
  cycleNumber: number;
  cycleLabel: string;
  monthLabel: string;
  dueDate: string;
  fixedAmount: number;
  cpmViews: number;
  cpmAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  isOverdue: boolean;
  viewsPaidCumulative: number;
  // enriched fields
  cycleStartDate: string;
  cycleEndDate: string;
  isLastCycle: boolean;
  isFirstCycle: boolean;
  clientFixedPerCreator: number;
  clientCpm: number;
  creatorCount: number;
  plannedCreators: number;
}

export function useClientPayments(filterMonth?: number, filterYear?: number) {
  return useQuery({
    queryKey: ["client-payments", filterMonth, filterYear],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("client_payments")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;

      const campIds = [...new Set((payments ?? []).map((p) => p.campaign_id))];
      let campMap = new Map<string, { name: string; client_name: string; client_fixed_per_creator: number; client_cpm: number; planned_creators: number; video_views_cap: number | null; monthly_spend_cap: number | null }>();
      let creatorCountMap = new Map<string, number>();

      if (campIds.length) {
        const [{ data: camps }, { data: ccRows }] = await Promise.all([
          supabase.from("campaigns").select("id, name, client_name, client_fixed_per_creator, client_cpm, planned_creators, video_views_cap, monthly_spend_cap").in("id", campIds),
          supabase.from("campaign_creators").select("campaign_id").in("campaign_id", campIds),
        ]);
        (camps ?? []).forEach((c) => campMap.set(c.id, {
          name: c.name, client_name: c.client_name,
          client_fixed_per_creator: Number(c.client_fixed_per_creator ?? 200),
          client_cpm: Number(c.client_cpm ?? 2),
          planned_creators: c.planned_creators ?? 1,
          video_views_cap: (c as any).video_views_cap as number | null,
          monthly_spend_cap: (c as any).monthly_spend_cap as number | null,
        }));
        (ccRows ?? []).forEach((r) => {
          creatorCountMap.set(r.campaign_id, (creatorCountMap.get(r.campaign_id) ?? 0) + 1);
        });
      }

      // Fetch all cycles for these campaigns
      let cycleMap = new Map<string, { cycle_start_date: string; cycle_end_date: string; is_last_cycle: boolean }>();
      if (campIds.length) {
        const { data: cycles } = await supabase.from("payment_cycles").select("id, cycle_start_date, cycle_end_date, is_last_cycle").in("campaign_id", campIds);
        (cycles ?? []).forEach((c) => cycleMap.set(c.id, { cycle_start_date: c.cycle_start_date, cycle_end_date: c.cycle_end_date, is_last_cycle: c.is_last_cycle }));
      }

      // ── Live recalculation for unpaid payments ──
      // Fetch accounts and videos for campaigns with unpaid payments
      const unpaidCampIds = [...new Set((payments ?? []).filter(p => !p.is_paid).map(p => p.campaign_id))];
      let liveViewsByCampaign = new Map<string, number>();

      if (unpaidCampIds.length) {
        const { data: rpcRows } = await supabase.rpc("get_campaign_total_views", {
          p_campaign_ids: unpaidCampIds,
        });
        (rpcRows ?? []).forEach((r: any) => {
          const camp = campMap.get(r.campaign_id);
          const cap = camp?.video_views_cap ?? null;
          // The RPC returns total views without per-video cap; for now use the aggregate.
          // Per-video cap would require a different RPC. The current campaigns don't use per-video cap heavily.
          liveViewsByCampaign.set(r.campaign_id, Number(r.total_views));
        });
      }

      // Sort payments by campaign + cycle_number to compute cumulative views correctly
      const sortedPayments = [...(payments ?? [])].sort((a, b) => {
        if (a.campaign_id !== b.campaign_id) return a.campaign_id.localeCompare(b.campaign_id);
        return a.cycle_number - b.cycle_number;
      });

      // For unpaid payments, recalculate views based on live data
      // We need to know views_paid_cumulative of the last PAID cycle for each campaign
      const lastPaidCumulativeBycamp = new Map<string, number>();
      sortedPayments.forEach(p => {
        if (p.is_paid) {
          lastPaidCumulativeBycamp.set(p.campaign_id, p.views_paid_cumulative);
        }
      });

      // Build recalculated map for unpaid payments
      const recalculated = new Map<string, { cpmViews: number; cpmAmount: number; fixedAmount: number; totalAmount: number; viewsPaidCumulative: number }>();

      // Group unpaid by campaign, ordered by cycle_number
      const unpaidByCampaign = new Map<string, typeof sortedPayments>();
      sortedPayments.filter(p => !p.is_paid).forEach(p => {
        const list = unpaidByCampaign.get(p.campaign_id) ?? [];
        list.push(p);
        unpaidByCampaign.set(p.campaign_id, list);
      });

      unpaidByCampaign.forEach((unpaidList, campId) => {
        const camp = campMap.get(campId);
        const totalLiveViews = liveViewsByCampaign.get(campId) ?? 0;
        const prevPaidCumulative = lastPaidCumulativeBycamp.get(campId) ?? 0;
        const totalNewViews = Math.max(0, totalLiveViews - prevPaidCumulative);
        const creatorCount = camp?.planned_creators ?? 1;
        const clientCpm = camp?.client_cpm ?? 2;
        const clientFixed = camp?.client_fixed_per_creator ?? 200;
        const spendCap = camp?.monthly_spend_cap ?? null;

        // If there's only one unpaid cycle, all new views go to it
        // If multiple unpaid cycles, assign all new views to the latest one (most common case)
        // Actually, the system generates one cycle at a time, so typically only one is unpaid
        // But to be safe, assign proportionally: earlier cycles keep their stored views if they had some,
        // and the last unpaid cycle gets the remainder
        
        // Simple approach: for the last unpaid cycle, recalculate with all remaining views
        // For earlier unpaid cycles, keep stored values (they were snapshots at creation)
        const lastUnpaid = unpaidList[unpaidList.length - 1];
        
        unpaidList.forEach((p, idx) => {
          const cycle = cycleMap.get(p.cycle_id);
          const isLast = cycle?.is_last_cycle ?? false;

          if (p.id === lastUnpaid.id) {
            // This is the current/latest unpaid cycle — recalculate with live views
            const prevCyclesCpmViews = unpaidList.slice(0, idx).reduce((s, up) => s + up.cpm_views, 0);
            const cpmViews = Math.max(0, totalNewViews - prevCyclesCpmViews);
            const fixedAmount = isLast ? 0 : clientFixed * creatorCount;
            let cpmAmount = clientCpm * (cpmViews / 1000);
            // Cap applies only to CPM, fixed is always added on top
            if (spendCap != null && cpmAmount > spendCap) cpmAmount = spendCap;
            const totalAmount = fixedAmount + cpmAmount;

            recalculated.set(p.id, {
              cpmViews,
              cpmAmount,
              fixedAmount,
              totalAmount,
              viewsPaidCumulative: prevPaidCumulative + totalNewViews,
            });
          }
        });
      });

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthNamesFull = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
      const monthNamesShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

      return (payments ?? []).map((p): ClientPaymentRow => {
        const camp = campMap.get(p.campaign_id);
        const dueDate = p.due_date;
        const dd = new Date(dueDate);
        const monthIdx = dd.getMonth();
        const yr = dd.getFullYear();
        const cycle = cycleMap.get(p.cycle_id);
        const realCreators = creatorCountMap.get(p.campaign_id) ?? 0;

        // Use recalculated values for unpaid payments, stored values for paid ones
        const recalc = recalculated.get(p.id);
        const cpmViews = recalc?.cpmViews ?? p.cpm_views;
        const cpmAmount = recalc?.cpmAmount ?? Number(p.cpm_amount);
        const fixedAmount = recalc?.fixedAmount ?? Number(p.fixed_amount);
        const totalAmount = recalc?.totalAmount ?? Number(p.total_amount);
        const viewsPaidCumulative = recalc?.viewsPaidCumulative ?? (p.views_paid_cumulative ?? 0);

        return {
          id: p.id,
          campaignId: p.campaign_id,
          campaignName: camp?.name ?? "—",
          clientName: camp?.client_name ?? "—",
          cycleNumber: p.cycle_number,
          cycleLabel: `Ciclo ${p.cycle_number} — ${monthNamesShort[monthIdx]} ${yr}`,
          monthLabel: `${monthNamesFull[monthIdx]} ${yr}`,
          dueDate,
          fixedAmount,
          cpmViews,
          cpmAmount,
          totalAmount,
          isPaid: p.is_paid,
          paidAt: p.paid_at,
          isOverdue: !p.is_paid && dueDate < todayStr,
          viewsPaidCumulative,
          cycleStartDate: cycle?.cycle_start_date ?? dueDate,
          cycleEndDate: cycle?.cycle_end_date ?? dueDate,
          isLastCycle: cycle?.is_last_cycle ?? false,
          isFirstCycle: p.cycle_number === 1 && cpmViews === 0,
          clientFixedPerCreator: camp?.client_fixed_per_creator ?? 200,
          clientCpm: camp?.client_cpm ?? 2,
          creatorCount: realCreators || (camp?.planned_creators ?? 1),
          plannedCreators: camp?.planned_creators ?? 1,
        };
      });
    },
  });
}

/* ═══════════════════════════════════════════════
   Creator Payments (Da Pagare)
   ═══════════════════════════════════════════════ */

export interface CreatorPaymentRow {
  id: string | null;
  creatorId: string;
  creatorName: string;
  periodMonth: number;
  periodYear: number;
  fixedAmount: number;
  fixedEarned: boolean;
  cpmAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  monthVideoCount: number;
  monthlyTarget: number;
  windowOpen: number;
  windowClosed: number;
}

export function useCreatorPayments(year: number, month: number) {
  return useQuery({
    queryKey: ["creator-payments", year, month],
    queryFn: async () => {
      const mStart = new Date(year, month, 1).toISOString();
      const mEnd = new Date(year, month + 1, 1).toISOString();

      const [
        { data: creators },
        { data: accounts },
        { data: videos },
        { data: existingPayments },
        { data: campaigns },
        { data: ccRows },
      ] = await Promise.all([
        supabase.from("creators").select("*").eq("status", "active"),
        supabase.from("tiktok_accounts").select("id, creator_id, campaign_id"),
        supabase
          .from("videos")
          .select("tiktok_account_id, views, views_final, window_closed, window_expires_at, published_at")
          .gte("published_at", mStart)
          .lt("published_at", mEnd),
        supabase
          .from("creator_payments")
          .select("*")
          .eq("period_month", month + 1)
          .eq("period_year", year),
        supabase.from("campaigns").select("id, video_views_cap"),
        supabase.from("campaign_creators").select("campaign_id, creator_id"),
      ]);

      const allCreators = creators ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = videos ?? [];
      const allPayments = existingPayments ?? [];
      const allCampaigns = campaigns ?? [];
      const allCC = ccRows ?? [];

      // Build cap map: campaignId -> video_views_cap
      const capByCampaign = new Map<string, number | null>();
      allCampaigns.forEach((c) => capByCampaign.set(c.id, (c as any).video_views_cap as number | null));

      // Build creator -> campaigns map for cap lookup
      const campaignsByCreator = new Map<string, string[]>();
      allCC.forEach((r) => {
        const list = campaignsByCreator.get(r.creator_id) ?? [];
        list.push(r.campaign_id);
        campaignsByCreator.set(r.creator_id, list);
      });

      const accountsByCreator = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      allCreators.sort((a, b) => a.name.localeCompare(b.name));
      return allCreators.map((cr): CreatorPaymentRow => {
        const accIds = new Set(accountsByCreator.get(cr.id) ?? []);
        const crVideos = allVideos.filter((v) => accIds.has(v.tiktok_account_id));
        const monthVideoCount = crVideos.length;
        const min = cr.min_videos_per_day ?? 5;
        const fixedEarned = isFixedEarnedMonthly(monthVideoCount, min, year, month);
        const monthlyTarget = getMonthlyTarget(min, year, month);
        const windowStats = countByWindowStatus(crVideos);

        // Apply video cap: group videos by campaign account and apply per-campaign cap
        let monthViews = 0;
        const crCampaigns = campaignsByCreator.get(cr.id) ?? [];
        if (crCampaigns.length > 0) {
          crCampaigns.forEach((campId) => {
            const cap = capByCampaign.get(campId) ?? null;
            const campAccIds = allAccounts
              .filter((a) => a.creator_id === cr.id && a.campaign_id === campId)
              .map((a) => a.id);
            const campAccSet = new Set(campAccIds);
            const campVideos = crVideos.filter((v) => campAccSet.has(v.tiktok_account_id));
            monthViews += sumEffectiveViewsCapped(campVideos, cap);
          });
          // Add views from accounts without campaign
          const campAccIds = new Set(allAccounts.filter((a) => a.creator_id === cr.id && a.campaign_id).map((a) => a.id));
          const noCampVideos = crVideos.filter((v) => !campAccIds.has(v.tiktok_account_id));
          monthViews += sumEffectiveViews(noCampVideos);
        } else {
          monthViews = sumEffectiveViews(crVideos);
        }

        const fixedAmt = cr.creator_fixed ?? 200;
        const cpmAmt = (cr.creator_cpm ?? 0.5) * (monthViews / 1000);
        const total = (fixedEarned ? fixedAmt : 0) + cpmAmt;

        const payment = allPayments.find((p) => p.creator_id === cr.id);

        return {
          id: payment?.id ?? null,
          creatorId: cr.id,
          creatorName: cr.name,
          periodMonth: month + 1,
          periodYear: year,
          fixedAmount: fixedAmt,
          fixedEarned,
          cpmAmount: cpmAmt,
          totalAmount: total,
          isPaid: payment?.is_paid ?? false,
          paidAt: payment?.paid_at ?? null,
          monthVideoCount,
          monthlyTarget,
          windowOpen: windowStats.open,
          windowClosed: windowStats.closed,
        };
      });
    },
  });
}

/* ═══════════════════════════════════════════════
   Payment History (Storico)
   ═══════════════════════════════════════════════ */

export interface PaymentHistoryRow {
  id: string;
  type: "client" | "creator";
  name: string;
  periodLabel: string;
  amount: number;
  paidAt: string;
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: ["payment-history-all"],
    queryFn: async () => {
      const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

      // Client payments
      const { data: clientPays } = await supabase
        .from("client_payments")
        .select("*")
        .eq("is_paid", true)
        .order("paid_at", { ascending: false });

      const campIds = [...new Set((clientPays ?? []).map((p) => p.campaign_id))];
      let campMap = new Map<string, string>();
      if (campIds.length) {
        const { data: camps } = await supabase.from("campaigns").select("id, name").in("id", campIds);
        (camps ?? []).forEach((c) => campMap.set(c.id, c.name));
      }

      // Creator payments
      const { data: creatorPays } = await supabase
        .from("creator_payments")
        .select("*")
        .eq("is_paid", true)
        .order("paid_at", { ascending: false });

      const creatorIds = [...new Set((creatorPays ?? []).map((p) => p.creator_id))];
      let creatorMap = new Map<string, string>();
      if (creatorIds.length) {
        const { data: crs } = await supabase.from("creators").select("id, name").in("id", creatorIds);
        (crs ?? []).forEach((c) => creatorMap.set(c.id, c.name));
      }

      const rows: PaymentHistoryRow[] = [];

      (clientPays ?? []).forEach((p) => {
        rows.push({
          id: p.id,
          type: "client",
          name: campMap.get(p.campaign_id) ?? "—",
          periodLabel: `Ciclo ${p.cycle_number}`,
          amount: Number(p.total_amount),
          paidAt: p.paid_at ?? "",
        });
      });

      (creatorPays ?? []).forEach((p) => {
        rows.push({
          id: p.id,
          type: "creator",
          name: creatorMap.get(p.creator_id) ?? "—",
          periodLabel: `${monthNames[(p.period_month - 1) % 12]} ${p.period_year}`,
          amount: Number(p.total_amount),
          paidAt: p.paid_at ?? "",
        });
      });

      rows.sort((a, b) => (b.paidAt > a.paidAt ? 1 : -1));
      return rows;
    },
  });
}

/* ═══════════════════════════════════════════════
   Payment Summary (Riepilogo)
   ═══════════════════════════════════════════════ */

export interface PaymentSummary {
  clientReceivedMonth: number;
  creatorPaidMonth: number;
  marginMonth: number;
  pendingClientAmount: number;
  pendingCreatorAmount: number;
  last6Months: { label: string; income: number; expense: number }[];
}

export function usePaymentSummary() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return useQuery({
    queryKey: ["payment-summary"],
    queryFn: async () => {
      const { data: clientPays } = await supabase.from("client_payments").select("*");
      const { data: creatorPays } = await supabase.from("creator_payments").select("*");

      const allClient = clientPays ?? [];
      const allCreator = creatorPays ?? [];

      // Current month
      const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
      const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const thisMonthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const clientReceivedMonth = allClient
        .filter((p) => p.is_paid && p.paid_at && p.paid_at >= thisMonthStart && p.paid_at < thisMonthEnd)
        .reduce((s, p) => s + Number(p.total_amount), 0);

      const creatorPaidMonth = allCreator
        .filter((p) => p.is_paid && p.paid_at && p.paid_at >= thisMonthStart && p.paid_at < thisMonthEnd)
        .reduce((s, p) => s + Number(p.total_amount), 0);

      const pendingClientAmount = allClient
        .filter((p) => !p.is_paid)
        .reduce((s, p) => s + Number(p.total_amount), 0);

      const pendingCreatorAmount = allCreator
        .filter((p) => !p.is_paid)
        .reduce((s, p) => s + Number(p.total_amount), 0);

      // Last 6 months
      const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
      const last6Months: { label: string; income: number; expense: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        const label = `${monthNames[m]} ${y}`;
        const mStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const mNext = m === 11 ? 1 : m + 2;
        const mNextY = m === 11 ? y + 1 : y;
        const mEnd = `${mNextY}-${String(mNext).padStart(2, "0")}-01`;

        const income = allClient
          .filter((p) => p.is_paid && p.paid_at && p.paid_at >= mStart && p.paid_at < mEnd)
          .reduce((s, p) => s + Number(p.total_amount), 0);

        const expense = allCreator
          .filter((p) => p.is_paid && p.paid_at && p.paid_at >= mStart && p.paid_at < mEnd)
          .reduce((s, p) => s + Number(p.total_amount), 0);

        last6Months.push({ label, income, expense });
      }

      return {
        clientReceivedMonth,
        creatorPaidMonth,
        marginMonth: clientReceivedMonth - creatorPaidMonth,
        pendingClientAmount,
        pendingCreatorAmount,
        last6Months,
      } as PaymentSummary;
    },
  });
}

/* ═══════════════════════════════════════════════
   Campaign Cycles
   ═══════════════════════════════════════════════ */

export interface CampaignCycleRow {
  id: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  isLastCycle: boolean;
  payment: ClientPaymentRow | null;
}

export function useCampaignCycles(campaignId: string) {
  return useQuery({
    queryKey: ["campaign-cycles", campaignId],
    queryFn: async () => {
      const { data: cycles } = await supabase
        .from("payment_cycles")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("cycle_number", { ascending: true });

      const { data: payments } = await supabase
        .from("client_payments")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("cycle_number", { ascending: true });

      const { data: camp } = await supabase
        .from("campaigns")
        .select("name, client_name, client_fixed_per_creator, client_cpm, planned_creators")
        .eq("id", campaignId)
        .single();

      const { data: ccRows } = await supabase
        .from("campaign_creators")
        .select("campaign_id")
        .eq("campaign_id", campaignId);
      const realCreators = ccRows?.length ?? 0;

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthNamesShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
      const monthNamesFull = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

      return (cycles ?? []).map((c): CampaignCycleRow => {
        const p = (payments ?? []).find((p) => p.cycle_id === c.id);
        let payment: ClientPaymentRow | null = null;
        if (p) {
          const dueDate = p.due_date;
          const dd = new Date(dueDate);
          const monthIdx = dd.getMonth();
          const yr = dd.getFullYear();
          payment = {
            id: p.id,
            campaignId: p.campaign_id,
            campaignName: camp?.name ?? "—",
            clientName: camp?.client_name ?? "—",
            cycleNumber: p.cycle_number,
            cycleLabel: `Ciclo ${p.cycle_number} — ${monthNamesShort[monthIdx]} ${yr}`,
            monthLabel: `${monthNamesFull[monthIdx]} ${yr}`,
            dueDate,
            fixedAmount: Number(p.fixed_amount),
            cpmViews: p.cpm_views,
            cpmAmount: Number(p.cpm_amount),
            totalAmount: Number(p.total_amount),
            isPaid: p.is_paid,
            paidAt: p.paid_at,
            isOverdue: !p.is_paid && dueDate < todayStr,
            viewsPaidCumulative: (p as any).views_paid_cumulative ?? 0,
            cycleStartDate: c.cycle_start_date,
            cycleEndDate: c.cycle_end_date,
            isLastCycle: c.is_last_cycle,
            isFirstCycle: p.cycle_number === 1,
            clientFixedPerCreator: Number(camp?.client_fixed_per_creator ?? 200),
            clientCpm: Number(camp?.client_cpm ?? 2),
            creatorCount: realCreators || (camp?.planned_creators ?? 1),
            plannedCreators: camp?.planned_creators ?? 1,
          };
        }

        return {
          id: c.id,
          cycleNumber: c.cycle_number,
          startDate: c.cycle_start_date,
          endDate: c.cycle_end_date,
          isLastCycle: c.is_last_cycle,
          payment,
        };
      });
    },
    enabled: !!campaignId,
  });
}
