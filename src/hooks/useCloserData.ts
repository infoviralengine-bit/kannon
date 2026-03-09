import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CloserLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  tiktok_username: string | null;
  call_datetime: string;
  source: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OnboardingLink {
  id: string;
  lead_id: string;
  token: string;
  contract_ids: string[];
  status: string;
  created_at: string;
  completed_at: string | null;
}

export function useCloserLeads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["closer-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closer_leads")
        .select("*")
        .order("call_datetime", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CloserLead[];
    },
    enabled: !!user,
  });
}

export function useOnboardingLinks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["onboarding-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OnboardingLink[];
    },
    enabled: !!user,
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updates: Record<string, unknown> = { status };
      if (notes !== undefined) updates.notes = notes;
      const { error } = await supabase.from("closer_leads").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closer-leads"] }),
  });
}

export function useCreateOnboardingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lead_id, contract_ids }: { lead_id: string; contract_ids: string[] }) => {
      const { data, error } = await supabase
        .from("onboarding_links")
        .insert({ lead_id, contract_ids })
        .select()
        .single();
      if (error) throw error;
      return data as OnboardingLink;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-links"] });
      qc.invalidateQueries({ queryKey: ["closer-leads"] });
    },
  });
}

export function useAddCloserLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (lead: {
      first_name: string;
      last_name: string;
      phone?: string;
      tiktok_username?: string;
      call_datetime: string;
    }) => {
      const { error } = await supabase.from("closer_leads").insert({
        ...lead,
        source: "manual",
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closer-leads"] }),
  });
}
