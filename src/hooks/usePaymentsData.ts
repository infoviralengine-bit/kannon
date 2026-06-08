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
  clientFixed: number;
  clientCpm: number;
  paymentKind: "standard" | "tot_fixed_first" | "tot_fixed_second" | "tot_final_cpm";
  amountOverridden: boolean;
  notes: string | null;
  invoiceSent: boolean;
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
      let campMap = new Map<string, { name: string; client_name: string; client_fixed: number; client_cpm: number; video_views_cap: number | null; monthly_spend_cap: number | null }>();

      if (campIds.length) {
        const [{ data: camps }] = await Promise.all([
          supabase.from("campaigns").select("id, name, client_name, client_fixed, client_cpm, video_views_cap, monthly_spend_cap").in("id", campIds),
        ]);
        (camps ?? []).forEach((c) => campMap.set(c.id, {
          name: c.name, client_name: c.client_name,
          client_fixed: Number(c.client_fixed ?? 0),
          client_cpm: Number(c.client_cpm ?? 2),
          video_views_cap: (c as any).video_views_cap as number | null,
          monthly_spend_cap: (c as any).monthly_spend_cap as number | null,
        }));
      }

      // Fetch all cycles for these campaigns
      let cycleMap = new Map<string, { cycle_start_date: string; cycle_end_date: string; is_last_cycle: boolean }>();
      if (campIds.length) {
        const { data: cycles } = await supabase.from("payment_cycles").select("id, cycle_start_date, cycle_end_date, is_last_cycle").in("campaign_id", campIds);
        (cycles ?? []).forEach((c) => cycleMap.set(c.id, { cycle_start_date: c.cycle_start_date, cycle_end_date: c.cycle_end_date, is_last_cycle: c.is_last_cycle }));
      }

      // ── Live recalculation for unpaid payments ──
      // For each campaign with unpaid payments, compute the CURRENT TOTAL effective
      // views across all videos. Unpaid cycles get: total - cumulative_already_paid.
      // (Only the first unpaid cycle gets the residual; later unpaid cycles get 0.)
      const unpaidCampIds = [...new Set((payments ?? []).filter(p => !p.is_paid).map(p => p.campaign_id))];
      // videos kept per-campaign so we can compute paid-window subtractions
      const videosByCampaign = new Map<string, Array<{ published_at: string; effective_views: number }>>();
      const totalViewsByCampaign = new Map<string, number>();

      if (unpaidCampIds.length) {
        // Fetch accounts of these campaigns
        const { data: accs } = await supabase
          .from("tiktok_accounts")
          .select("id, campaign_id")
          .in("campaign_id", unpaidCampIds);
        const accountToCampaign = new Map<string, string>();
        (accs ?? []).forEach((a) => { if (a.campaign_id) accountToCampaign.set(a.id, a.campaign_id); });
        const accIds = (accs ?? []).map((a) => a.id);

        if (accIds.length) {
          // Fetch all videos for these accounts. Use range pagination to bypass 1k limit.
          const allVideos: Array<{ tiktok_account_id: string; published_at: string; views: number | null; views_final: number | null; window_closed: boolean | null }> = [];
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data: page, error: vErr } = await supabase
              .from("videos")
              .select("tiktok_account_id, published_at, views, views_final, window_closed")
              .in("tiktok_account_id", accIds)
              .range(from, from + pageSize - 1);
            if (vErr) throw vErr;
            if (!page || !page.length) break;
            allVideos.push(...(page as any));
            if (page.length < pageSize) break;
          }

          allVideos.forEach((v) => {
            const campId = accountToCampaign.get(v.tiktok_account_id);
            if (!campId) return;
            const camp = campMap.get(campId);
            const cap = camp?.video_views_cap ?? null;
            let views = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
            if (cap != null && cap > 0) views = Math.min(views, cap);
            totalViewsByCampaign.set(campId, (totalViewsByCampaign.get(campId) ?? 0) + views);
            const list = videosByCampaign.get(campId) ?? [];
            list.push({ published_at: v.published_at, effective_views: views });
            videosByCampaign.set(campId, list);
          });
        }
      }

      // Sort payments by campaign + cycle_number to compute cumulative views correctly
      const sortedPayments = [...(payments ?? [])].sort((a, b) => {
        if (a.campaign_id !== b.campaign_id) return a.campaign_id.localeCompare(b.campaign_id);
        return a.cycle_number - b.cycle_number;
      });

      // Build recalculated map for unpaid payments.
      // Each unpaid cycle gets the effective views of videos PUBLISHED inside its date range.
      // Paid cycles keep their stored snapshot (already frozen).
      const recalculated = new Map<string, { cpmViews: number; cpmAmount: number; fixedAmount: number; totalAmount: number; viewsPaidCumulative: number }>();

      // Group ALL payments by campaign in cycle order
      const paymentsByCampaign = new Map<string, typeof sortedPayments>();
      sortedPayments.forEach((p) => {
        const list = paymentsByCampaign.get(p.campaign_id) ?? [];
        list.push(p);
        paymentsByCampaign.set(p.campaign_id, list);
      });

      paymentsByCampaign.forEach((cycleList, campId) => {
        if (!unpaidCampIds.includes(campId)) return; // skip campaigns with no unpaid cycles
        const camp = campMap.get(campId);
        const clientCpm = camp?.client_cpm ?? 2;
        const clientFixed = camp?.client_fixed ?? 0;
        const spendCap = camp?.monthly_spend_cap ?? null;
        const totalCampaignViews = totalViewsByCampaign.get(campId) ?? 0;
        const campVideos = videosByCampaign.get(campId) ?? [];

        // Cumulative views already accounted (paid cycles + previously-attributed unpaid cycles)
        let cumulative = 0;
        let residualAssigned = false;
        cycleList.forEach((p) => {
          const kind = (p as any).payment_kind ?? "standard";
          const overridden = (p as any).amount_overridden ?? false;

          // Manual override: never recalc; use stored values
          if (overridden) return;

          // ToT half-fixed rows: static amounts, no recalc
          if (kind === "tot_fixed_first" || kind === "tot_fixed_second") return;

          // ToT final CPM: recalc on TOTAL campaign views
          if (kind === "tot_final_cpm") {
            if (p.is_paid) {
              cumulative = Math.max(cumulative, p.views_paid_cumulative ?? 0);
              return;
            }
            const cpmViews = totalCampaignViews;
            let cpmAmount = clientCpm * (cpmViews / 1000);
            if (spendCap != null && cpmAmount > spendCap) cpmAmount = spendCap;
            recalculated.set(p.id, {
              cpmViews,
              cpmAmount,
              fixedAmount: 0,
              totalAmount: cpmAmount,
              viewsPaidCumulative: cpmViews,
            });
            return;
          }

          // Standard kind: existing logic unchanged below
          const cycle = cycleMap.get(p.cycle_id);
          const isLast = cycle?.is_last_cycle ?? false;

          if (p.is_paid) {
            // Live-compute the views that belong to this paid cycle. We count videos
            // published on or before the EARLIER of (paid_at, cycle_end_date):
            //  - paid_at  : if the cycle was paid early, later-published videos are NOT
            //               part of this settled period and should roll to next cycle.
            //  - end_date : if the cycle ended before payment, videos published after
            //               its end belong to later cycles, not this one.
            const endDate = cycle?.cycle_end_date ?? null;
            const paidAt = p.paid_at ? p.paid_at.slice(0, 10) : null;
            let cutoff: string | null = null;
            if (endDate && paidAt) cutoff = endDate < paidAt ? endDate : paidAt;
            else cutoff = endDate ?? paidAt;
            let attributed = 0;
            if (cutoff) {
              campVideos.forEach((v) => {
                if (v.published_at.slice(0, 10) <= cutoff!) attributed += v.effective_views;
              });
            }
            // Never go below what's already been stored as paid, and accumulate forward.
            cumulative = Math.max(cumulative, p.views_paid_cumulative ?? 0, attributed);
            return;
          }

          // The first unpaid cycle absorbs ALL views accumulated since the last paid
          // cycle's snapshot. Later unpaid cycles show 0 until this one is paid.
          let cpmViews = 0;
          if (!residualAssigned) {
            cpmViews = Math.max(0, totalCampaignViews - cumulative);
            residualAssigned = true;
          }

          const fixedAmount = isLast ? 0 : clientFixed;
          let cpmAmount = clientCpm * (cpmViews / 1000);
          if (spendCap != null && cpmAmount > spendCap) cpmAmount = spendCap;
          const totalAmount = fixedAmount + cpmAmount;

          cumulative += cpmViews;

          recalculated.set(p.id, {
            cpmViews,
            cpmAmount,
            fixedAmount,
            totalAmount,
            viewsPaidCumulative: cumulative,
          });
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
            clientFixed: camp?.client_fixed ?? 0,
            clientCpm: camp?.client_cpm ?? 2,
            paymentKind: ((p as any).payment_kind ?? "standard") as ClientPaymentRow["paymentKind"],
            amountOverridden: (p as any).amount_overridden ?? false,
            notes: (p as any).notes ?? null,
            invoiceSent: (p as any).invoice_sent ?? false,
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
        .select("name, client_name, client_fixed, client_cpm, video_views_cap, monthly_spend_cap")
        .eq("id", campaignId)
        .single();

      const { data: ccRows } = await supabase
        .from("campaign_creators")
        .select("campaign_id")
        .eq("campaign_id", campaignId);
      const realCreators = ccRows?.length ?? 0;

      // ── Live recalculation for unpaid cycles ──
      const hasUnpaid = (payments ?? []).some(p => !p.is_paid);
      let liveViewsTotal = 0;
      if (hasUnpaid) {
        const { data: rpcRows } = await supabase.rpc("get_campaign_total_views", {
          p_campaign_ids: [campaignId],
        });
        liveViewsTotal = Number((rpcRows as any)?.[0]?.total_views ?? 0);
      }

      // Find last paid cumulative views
      const sortedPayments = [...(payments ?? [])].sort((a, b) => a.cycle_number - b.cycle_number);
      let lastPaidCumulative = 0;
      sortedPayments.forEach(p => {
        if (p.is_paid) lastPaidCumulative = p.views_paid_cumulative ?? 0;
      });

      const unpaidPayments = sortedPayments.filter(p => !p.is_paid);
      const lastUnpaidId = unpaidPayments.length > 0 ? unpaidPayments[unpaidPayments.length - 1].id : null;

      const recalculated = new Map<string, { cpmViews: number; cpmAmount: number; fixedAmount: number; totalAmount: number; viewsPaidCumulative: number }>();

      if (hasUnpaid) {
        const clientCpm = Number(camp?.client_cpm ?? 2);
        const clientFixed = Number(camp?.client_fixed ?? 0);
        const spendCap = (camp as any)?.monthly_spend_cap as number | null;
        const totalNewViews = Math.max(0, liveViewsTotal - lastPaidCumulative);

        unpaidPayments.forEach((p, idx) => {
          const cycle = (cycles ?? []).find(c => c.id === p.cycle_id);
          const isLast = cycle?.is_last_cycle ?? false;

          if (p.id === lastUnpaidId) {
            const prevCyclesCpmViews = unpaidPayments.slice(0, idx).reduce((s, up) => s + up.cpm_views, 0);
            const cpmViews = Math.max(0, totalNewViews - prevCyclesCpmViews);
            const fixedAmount = isLast ? 0 : clientFixed;
            let cpmAmount = clientCpm * (cpmViews / 1000);
            if (spendCap != null && cpmAmount > spendCap) cpmAmount = spendCap;
            const totalAmount = fixedAmount + cpmAmount;

            recalculated.set(p.id, {
              cpmViews,
              cpmAmount,
              fixedAmount,
              totalAmount,
              viewsPaidCumulative: lastPaidCumulative + totalNewViews,
            });
          }
        });
      }

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthNamesShort = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
      const monthNamesFull = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

      return (cycles ?? []).map((c): CampaignCycleRow => {
        const p = (payments ?? []).find((p) => p.cycle_id === c.id);
        let payment: ClientPaymentRow | null = null;
        if (p) {
          const recalc = recalculated.get(p.id);
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
            fixedAmount: recalc?.fixedAmount ?? Number(p.fixed_amount),
            cpmViews: recalc?.cpmViews ?? p.cpm_views,
            cpmAmount: recalc?.cpmAmount ?? Number(p.cpm_amount),
            totalAmount: recalc?.totalAmount ?? Number(p.total_amount),
            isPaid: p.is_paid,
            paidAt: p.paid_at,
            isOverdue: !p.is_paid && dueDate < todayStr,
            viewsPaidCumulative: recalc?.viewsPaidCumulative ?? ((p as any).views_paid_cumulative ?? 0),
            cycleStartDate: c.cycle_start_date,
            cycleEndDate: c.cycle_end_date,
            isLastCycle: c.is_last_cycle,
            isFirstCycle: p.cycle_number === 1,
            clientFixed: Number(camp?.client_fixed ?? 0),
            clientCpm: Number(camp?.client_cpm ?? 2),
            paymentKind: ((p as any).payment_kind ?? "standard") as ClientPaymentRow["paymentKind"],
            amountOverridden: (p as any).amount_overridden ?? false,
            notes: (p as any).notes ?? null,
            invoiceSent: (p as any).invoice_sent ?? false,
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
