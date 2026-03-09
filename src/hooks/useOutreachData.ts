import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OutreachAccount {
  id: string;
  username: string;
  is_active: boolean;
  owner_profile_id: string | null;
}

export interface OutreachTemplate {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
}

export interface OutreachStat {
  id: string;
  tiktok_account_id: string;
  date: string;
  dm_sent: number;
  replies_received: number;
  template_id: string | null;
}

// --- Accounts ---
export function useOutreachAccounts() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["outreach-accounts", user?.id, role],
    queryFn: async () => {
      let q = supabase
        .from("tiktok_accounts")
        .select("id, username, is_active, owner_profile_id")
        .eq("account_type", "Outreach");
      // Outreach users only see own accounts via RLS; admin/team see all
      const { data, error } = await q.order("username");
      if (error) throw error;
      return (data ?? []) as OutreachAccount[];
    },
    enabled: !!user,
  });
}

export function useAddOutreachAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (username: string) => {
      const { error } = await supabase.from("tiktok_accounts").insert({
        username,
        account_type: "Outreach",
        owner_profile_id: user!.id,
      });
      if (error) {
        console.error("Insert tiktok_accounts error:", JSON.stringify(error));
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-accounts"] }),
  });
}

export function useToggleOutreachAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("tiktok_accounts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-accounts"] }),
  });
}

// --- Templates ---
export function useOutreachTemplates(includeInactive = false) {
  return useQuery({
    queryKey: ["outreach-templates", includeInactive],
    queryFn: async () => {
      let q = supabase.from("outreach_templates").select("*");
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return (data ?? []) as OutreachTemplate[];
    },
  });
}

export function useAddTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const { error } = await supabase.from("outreach_templates").insert({ name, content });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, content, is_active }: { id: string; name?: string; content?: string; is_active?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (content !== undefined) updates.content = content;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await supabase.from("outreach_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-templates"] }),
  });
}

// --- Stats ---
export function useOutreachStats() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["outreach-stats", user?.id, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_stats")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachStat[];
    },
    enabled: !!user,
  });
}

export function useLogOutreachStats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      tiktok_account_id: string;
      date: string;
      dm_sent: number;
      replies_received: number;
      template_id: string | null;
    }) => {
      const { error } = await supabase.from("outreach_stats").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-stats"] }),
  });
}

// --- Admin: all accounts with profile names ---
export function useAllOutreachMembers() {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["outreach-members"],
    queryFn: async () => {
      // Get all outreach accounts with their owner profile
      const { data: accounts, error } = await supabase
        .from("tiktok_accounts")
        .select("id, username, is_active, owner_profile_id")
        .eq("account_type", "Outreach")
        .order("username");
      if (error) throw error;

      // Get unique profile ids
      const profileIds = [...new Set((accounts ?? []).map(a => a.owner_profile_id).filter(Boolean))] as string[];
      
      let profiles: { id: string; full_name: string }[] = [];
      if (profileIds.length > 0) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", profileIds);
        profiles = pData ?? [];
      }

      // Get all outreach stats
      const { data: stats, error: statsErr } = await supabase
        .from("outreach_stats")
        .select("*")
        .order("date", { ascending: false });
      if (statsErr) throw statsErr;

      return {
        accounts: accounts ?? [],
        profiles,
        stats: (stats ?? []) as OutreachStat[],
      };
    },
    enabled: role === "admin" || role === "team",
  });
}
