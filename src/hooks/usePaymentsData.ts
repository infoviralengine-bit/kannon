import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sumEffectiveViews, countByWindowStatus } from "@/lib/videoWindow";
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
  dueDate: string;
  fixedAmount: number;
  cpmViews: number;
  cpmAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  isOverdue: boolean;
}

export function useClientPayments(filterMonth?: number, filterYear?: number) {
  return useQuery({
    queryKey: ["client-payments", filterMonth, filterYear],
    queryFn: async () => {
      let query = supabase
        .from("client_payments")
        .select("*")
        .order("due_date", { ascending: true });

      const { data: payments, error } = await query;
      if (error) throw error;

      const campIds = [...new Set((payments ?? []).map((p) => p.campaign_id))];
      let campMap = new Map<string, { name: string; client_name: string }>();
      if (campIds.length) {
        const { data: camps } = await supabase
          .from("campaigns")
          .select("id, name, client_name")
          .in("id", campIds);
        (camps ?? []).forEach((c) => campMap.set(c.id, { name: c.name, client_name: c.client_name }));
      }

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      return (payments ?? []).map((p): ClientPaymentRow => {
        const camp = campMap.get(p.campaign_id);
        const dueDate = p.due_date;
        const monthIdx = new Date(dueDate).getMonth();
        const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        const yr = new Date(dueDate).getFullYear();

        return {
          id: p.id,
          campaignId: p.campaign_id,
          campaignName: camp?.name ?? "—",
          clientName: camp?.client_name ?? "—",
          cycleNumber: p.cycle_number,
          cycleLabel: `Ciclo ${p.cycle_number} — ${monthNames[monthIdx]} ${yr}`,
          dueDate,
          fixedAmount: Number(p.fixed_amount),
          cpmViews: p.cpm_views,
          cpmAmount: Number(p.cpm_amount),
          totalAmount: Number(p.total_amount),
          isPaid: p.is_paid,
          paidAt: p.paid_at,
          isOverdue: !p.is_paid && dueDate < todayStr,
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
      ] = await Promise.all([
        supabase.from("creators").select("*").eq("status", "active"),
        supabase.from("tiktok_accounts").select("id, creator_id"),
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
      ]);

      const allCreators = creators ?? [];
      const allAccounts = accounts ?? [];
      const allVideos = videos ?? [];
      const allPayments = existingPayments ?? [];

      const accountsByCreator = new Map<string, string[]>();
      allAccounts.forEach((a) => {
        if (!a.creator_id) return;
        const list = accountsByCreator.get(a.creator_id) ?? [];
        list.push(a.id);
        accountsByCreator.set(a.creator_id, list);
      });

      return allCreators.map((cr): CreatorPaymentRow => {
        const accIds = new Set(accountsByCreator.get(cr.id) ?? []);
        const crVideos = allVideos.filter((v) => accIds.has(v.tiktok_account_id));
        const monthVideoCount = crVideos.length;
        const min = cr.min_videos_per_day ?? 5;
        const fixedEarned = isFixedEarnedMonthly(monthVideoCount, min, year, month);
        const monthlyTarget = getMonthlyTarget(min, year, month);
        const monthViews = sumEffectiveViews(crVideos);
        const windowStats = countByWindowStatus(crVideos);

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
        .select("name, client_name")
        .eq("id", campaignId)
        .single();

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

      return (cycles ?? []).map((c): CampaignCycleRow => {
        const p = (payments ?? []).find((p) => p.cycle_id === c.id);
        let payment: ClientPaymentRow | null = null;
        if (p) {
          const dueDate = p.due_date;
          const monthIdx = new Date(dueDate).getMonth();
          const yr = new Date(dueDate).getFullYear();
          payment = {
            id: p.id,
            campaignId: p.campaign_id,
            campaignName: camp?.name ?? "—",
            clientName: camp?.client_name ?? "—",
            cycleNumber: p.cycle_number,
            cycleLabel: `Ciclo ${p.cycle_number} — ${monthNames[monthIdx]} ${yr}`,
            dueDate,
            fixedAmount: Number(p.fixed_amount),
            cpmViews: p.cpm_views,
            cpmAmount: Number(p.cpm_amount),
            totalAmount: Number(p.total_amount),
            isPaid: p.is_paid,
            paidAt: p.paid_at,
            isOverdue: !p.is_paid && dueDate < todayStr,
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
