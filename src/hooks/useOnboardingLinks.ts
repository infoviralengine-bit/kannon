import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingLink {
  id: string;
  token: string;
  contract_ids: string[];
  status: string;
  created_at: string;
  completed_at: string | null;
  creator_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export function getOnboardingBaseUrl() {
  const host = window.location.hostname;
  // Preview URLs require Lovable login: use the published URL for onboarding links
  if (host.includes("lovableproject.com") || host.startsWith("id-preview--")) {
    return "https://kannon.lovable.app";
  }
  return window.location.origin;
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

export function useCreateOnboardingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      first_name: string;
      last_name: string;
      phone?: string | null;
      contract_ids: string[];
    }) => {
      const { data, error } = await supabase
        .from("onboarding_links")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as OnboardingLink;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["onboarding-links"] });
      qc.invalidateQueries({ queryKey: ["onboarding-pipeline"] });
    },
  });
}
