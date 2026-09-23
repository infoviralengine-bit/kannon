import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

export type CompanyNote = {
  id: string;
  company_id: string;
  body: string;
  is_pinned: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelStat = {
  channel: string;
  leads: number;
  calls: number;
  proposals: number;
  won: number;
  won_value: number;
};

export function useCompanyNotes(companyId: string | null) {
  return useQuery({
    queryKey: ["company-notes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db.from("company_notes").select("*")
        .eq("company_id", companyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompanyNote[];
    },
  });
}

export function useSaveNote() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (n: { id?: string; companyId: string; body?: string; isPinned?: boolean }) => {
      if (n.id) {
        const patch: Record<string, unknown> = {};
        if (n.body !== undefined) patch.body = n.body;
        if (n.isPinned !== undefined) patch.is_pinned = n.isPinned;
        const { error } = await db.from("company_notes").update(patch).eq("id", n.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await db.from("company_notes").insert({
          company_id: n.companyId, body: n.body, is_pinned: n.isPinned ?? false, author_id: u.user?.id ?? null,
        });
        if (error) throw error;
      }
      return n.companyId;
    },
    onSuccess: (id) => qc.invalidateQueries({ queryKey: ["company-notes", id] }),
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await db.from("company_notes").delete().eq("id", id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["company-notes", id] });
      toast({ title: "Appunto eliminato" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

/** Registra una call con i campi strutturati. */
export function useAddCallNote() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (c: {
      companyId: string; type: string; occurredAt: string | null; summary: string;
      participants: string | null; outcome: string | null; objections: string | null;
      nextSteps: string | null; fullText: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("company_activities").insert({
        company_id: c.companyId, type: c.type, summary: c.summary,
        participants: c.participants, outcome: c.outcome, objections: c.objections,
        next_steps: c.nextSteps, full_text: c.fullText,
        occurred_at: c.occurredAt || new Date().toISOString(),
        author_id: u.user?.id ?? null,
      });
      if (error) throw error;
      return c.companyId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["company", id] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast({ title: "Call registrata" });
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });
}

export function useChannelStats(period: string) {
  return useQuery({
    queryKey: ["channel-stats", period],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_channel_stats", { p_period: period });
      if (error) throw error;
      return (data ?? []) as ChannelStat[];
    },
  });
}
