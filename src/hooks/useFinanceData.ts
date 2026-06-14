import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancePeriod = "month" | "3m" | "6m" | "year";

export interface FinanceData {
  cash: { in_bank: number | null; updated_at: string | null; burn_monthly: number; avg_burn_3m: number; runway_months: number | null; cash_expected: number };
  revenue: { mtd: number; prev_month: number; mom_pct: number | null; pipeline: number; top_brands: { brand: string; revenue: number }[]; by_campaign: any[]; monthly: { month: string; revenue: number }[] };
  costs: { by_category: { category: string; amount: number }[]; monthly: { month: string; cost: number }[] };
  margins: { total_revenue: number; total_costs: number; gross: number; gross_pct: number; pl: number; by_campaign: any[]; by_creator: any[] };
  invoices: any[];
  flows: any[];
  forecast: { date: string; pessimistic: number; base: number; optimistic: number }[];
}

export function useFinanceData(period: FinancePeriod) {
  return useQuery({
    queryKey: ["finance-dashboard", period],
    queryFn: async (): Promise<FinanceData> => {
      const { data, error } = await (supabase.rpc as any)("get_finance_dashboard", { p_period: period });
      if (error) throw error;
      return data as FinanceData;
    },
  });
}

export function useUpdateCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await (supabase.rpc as any)("update_finance_cash", { p_amount: amount });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-dashboard"] }),
  });
}

export interface FinancialEntryInput {
  type: "revenue" | "cost" | "invoice_in" | "invoice_out";
  category?: string | null;
  description?: string | null;
  amount: number;
  date: string;
  due_date?: string | null;
  status: "expected" | "confirmed" | "received" | "paid";
  campaign_id?: string | null;
  creator_id?: string | null;
  brand_name?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinancialEntryInput) => {
      const { error } = await (supabase.from as any)("financial_entries").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-dashboard"] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance-dashboard"] }),
  });
}

/* ═══════════════════════════════════════════════
   Recurring Expenses
   ═══════════════════════════════════════════════ */

export type RecurringExpenseCategory =
  | "creator_pay" | "operator_pay" | "tool" | "software" | "rent" | "salary_fixed" | "other";

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category: RecurringExpenseCategory;
  due_day: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  vendor: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpenseInput {
  name: string;
  amount: number;
  category: RecurringExpenseCategory;
  due_day: number;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  vendor?: string | null;
  notes?: string | null;
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ["recurring-expenses"],
    queryFn: async (): Promise<RecurringExpense[]> => {
      const { data, error } = await (supabase.from as any)("recurring_expenses")
        .select("*").order("name", { ascending: true });
      if (error) throw error;
      return data as RecurringExpense[];
    },
  });
}

export function useCreateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecurringExpenseInput) => {
      const { error } = await (supabase.from as any)("recurring_expenses").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
  });
}

export function useUpdateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RecurringExpenseInput> }) => {
      const { error } = await (supabase.from as any)("recurring_expenses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
  });
}

export function useDeleteRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-expenses"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
  });
}

/* ═══════════════════════════════════════════════
   Override manuale su pagamenti auto
   ═══════════════════════════════════════════════ */

export function useOverrideClientPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount_override, notes_override }: { id: string; amount_override: number | null; notes_override?: string | null }) => {
      const { error } = await (supabase.from as any)("client_payments")
        .update({ amount_override, notes_override: notes_override ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
  });
}

export function useOverrideCreatorPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount_override, notes_override }: { id: string; amount_override: number | null; notes_override?: string | null }) => {
      const { error } = await (supabase.from as any)("creator_payments")
        .update({ amount_override, notes_override: notes_override ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creator-payments"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["financial-movements"] });
    },
  });
}

/* ═══════════════════════════════════════════════
   Vista unificata movimenti
   ═══════════════════════════════════════════════ */

export interface FinancialMovement {
  id: string;
  source: "client_payment" | "creator_payment" | "recurring_expense" | "manual_entry";
  type: "revenue" | "cost";
  category: string;
  description: string;
  amount: number;
  date: string;
  due_date: string | null;
  status: "expected" | "paid" | "overdue";
  campaign_id: string | null;
  creator_id: string | null;
  brand_name: string | null;
  invoice_number: string | null;
  notes: string | null;
  recurring_expense_id: string | null;
  has_override: boolean;
  created_at: string;
}

export function useFinancialMovements(filters?: {
  from?: string; to?: string;
  type?: "revenue" | "cost";
  source?: FinancialMovement["source"];
  status?: "expected" | "paid" | "overdue";
}) {
  return useQuery({
    queryKey: ["financial-movements", filters],
    queryFn: async (): Promise<FinancialMovement[]> => {
      let q = (supabase.from as any)("v_financial_movements").select("*").order("date", { ascending: false }).limit(500);
      if (filters?.from)   q = q.gte("date", filters.from);
      if (filters?.to)     q = q.lte("date", filters.to);
      if (filters?.type)   q = q.eq("type", filters.type);
      if (filters?.source) q = q.eq("source", filters.source);
      if (filters?.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data as FinancialMovement[];
    },
  });
}