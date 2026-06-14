import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCampaignsLite() {
  return useQuery({
    queryKey: ["campaigns-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_name, status")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; client_name: string | null; status: string | null }[];
    },
  });
}

export function useCreatorsLite() {
  return useQuery({
    queryKey: ["creators-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creators")
        .select("id, name, status")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string; status: string | null }[];
    },
  });
}