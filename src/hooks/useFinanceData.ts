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