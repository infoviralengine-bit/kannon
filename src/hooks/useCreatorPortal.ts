import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WarmupAccount {
  id: string;
  username: string;
  campaignName: string;
  campaignId: string | null;
  warmupDay: number;
  warmupStartedAt: string | null;
  followingCount: number;
  isReady: boolean;
  needsMoreFollowing: boolean;
}

export interface CreatorContentItem {
  id: string;
  title: string;
  type: string;
  body: string | null;
  file_url: string | null;
  due_date: string | null;
  status: string;
  campaignName: string;
}

export interface CalendarEntry {
  id: string;
  scheduled_for: string;
  status: string;
  contentTitle: string | null;
  contentId: string | null;
  accountUsername: string | null;
}

export interface EarningsData {
  monthEarnings: number;
  totalEarnings: number;
  totalViews: number;
  payments: {
    period: string;
    gross: number;
    tax: number;
    net: number;
    isPaid: boolean;
    paidAt: string | null;
  }[];
}

export function useCreatorPortal() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["creator-portal", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get creator
      const { data: creator, error: crErr } = await supabase
        .from("creators")
        .select("*")
        .eq("profile_id", user.id)
        .single();
      if (crErr || !creator) return null;

      // Get accounts with warmup data
      const { data: accounts } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("creator_id", creator.id);
      const accs = (accounts ?? []) as any[];

      // Get campaigns for names
      const campIds = [...new Set(accs.map((a: any) => a.campaign_id).filter(Boolean))] as string[];
      let campMap = new Map<string, string>();
      if (campIds.length) {
        const { data } = await supabase.from("campaigns").select("id, name").in("id", campIds);
        (data ?? []).forEach((c: any) => campMap.set(c.id, c.name));
      }

      // Build warmup accounts
      const warmupAccounts: WarmupAccount[] = accs.map((a: any) => {
        const day = a.warmup_day ?? 0;
        const following = a.following_count ?? 0;
        const isReady = day >= 3 && following >= 40;
        const needsMoreFollowing = day >= 3 && following < 40;
        return {
          id: a.id,
          username: a.username,
          campaignName: a.campaign_id ? campMap.get(a.campaign_id) ?? "—" : "—",
          campaignId: a.campaign_id,
          warmupDay: day,
          warmupStartedAt: a.warmup_started_at,
          followingCount: following,
          isReady,
          needsMoreFollowing,
        };
      });

      const allWarmupDone = warmupAccounts.length > 0 && warmupAccounts.every((a) => a.isReady);
      const anyWarmupDone = warmupAccounts.some((a) => a.isReady);
      const isOperativo = creator.onboarding_phase === "operativo";
      const unlocked = anyWarmupDone || isOperativo;

      // Check if first visit (no warmup started on any account)
      const isFirstVisit = !isOperativo && warmupAccounts.every((a) => a.warmupDay === 0 && !a.warmupStartedAt);

      // Fetch content
      let content: CreatorContentItem[] = [];
      if (unlocked) {
        const { data } = await supabase
          .from("creator_content" as any)
          .select("*")
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false });
        content = ((data ?? []) as any[]).map((c: any) => ({
          id: c.id,
          title: c.title,
          type: c.type,
          body: c.body,
          file_url: c.file_url,
          due_date: c.due_date,
          status: c.status,
          campaignName: c.campaign_id ? campMap.get(c.campaign_id) ?? "—" : "—",
        }));
      }

      // Fetch calendar
      let calendar: CalendarEntry[] = [];
      if (unlocked) {
        const { data } = await supabase
          .from("creator_calendar" as any)
          .select("*")
          .eq("creator_id", creator.id)
          .order("scheduled_for", { ascending: true });
        const contentMap = new Map(content.map((c) => [c.id, c.title]));
        const accMap = new Map(accs.map((a: any) => [a.id, a.username]));
        calendar = ((data ?? []) as any[]).map((e: any) => ({
          id: e.id,
          scheduled_for: e.scheduled_for,
          status: e.status,
          contentTitle: e.content_id ? contentMap.get(e.content_id) ?? null : null,
          contentId: e.content_id,
          accountUsername: e.tiktok_account_id ? accMap.get(e.tiktok_account_id) ?? null : null,
        }));
      }

      // Fetch earnings
      let earnings: EarningsData = { monthEarnings: 0, totalEarnings: 0, totalViews: 0, totalVideos: 0, payments: [] };
      if (unlocked) {
        const { data: payments } = await supabase
          .from("creator_payments")
          .select("*")
          .eq("creator_id", creator.id)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false });
        const paymentRows = (payments ?? []) as any[];
        
        const now = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear = now.getFullYear();
        
        const monthPayment = paymentRows.find((p: any) => p.period_month === curMonth && p.period_year === curYear);
        
        earnings = {
          monthEarnings: monthPayment ? Number(monthPayment.total_amount ?? 0) : 0,
          totalEarnings: paymentRows.reduce((s: number, p: any) => s + Number(p.total_amount ?? 0), 0),
          totalViews: 0,
          payments: paymentRows.map((p: any) => {
            const gross = Number(p.total_amount ?? 0);
            const tax = gross * 0.2;
            return {
              period: `${String(p.period_month).padStart(2, "0")}/${p.period_year}`,
              gross,
              tax,
              net: gross - tax,
              isPaid: p.is_paid,
              paidAt: p.paid_at,
            };
          }),
        };

        // Get total views
        const accIds = accs.map((a: any) => a.id);
        if (accIds.length) {
          const { data: vData } = await supabase
            .from("videos")
            .select("views")
            .in("tiktok_account_id", accIds);
          earnings.totalViews = (vData ?? []).reduce((s: number, v: any) => s + (v.views ?? 0), 0);
        }
      }

      return {
        creator,
        warmupAccounts,
        allWarmupDone,
        anyWarmupDone,
        isFirstVisit,
        content,
        calendar,
        earnings,
      };
    },
    enabled: !!user,
  });
}

export function useCompleteWarmupDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, currentDay }: { accountId: string; currentDay: number }) => {
      const newDay = currentDay + 1;
      const updates: any = { warmup_day: newDay };
      if (currentDay === 0) {
        updates.warmup_started_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("tiktok_accounts")
        .update(updates)
        .eq("id", accountId);
      if (error) throw error;
      return newDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-portal"] });
    },
  });
}

export function useUpdateContentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, status }: { contentId: string; status: string }) => {
      const { error } = await supabase
        .from("creator_content" as any)
        .update({ status } as any)
        .eq("id", contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-portal"] });
    },
  });
}
