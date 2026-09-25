import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const DAY = 86_400_000;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/* ══════════════════════════════════════
   1. Stato operativo e allarmi
   ══════════════════════════════════════ */

export interface OperationalAlert {
  id: string;
  kind: "scraping" | "cap" | "creator";
  message: string;
  severity: "red" | "amber";
  link?: string;
}

export interface OperationalStatus {
  lastScrapeAt: string | null;
  scrapeStatus: "success" | "error" | "running" | "none";
  alerts: OperationalAlert[];
}

export function useOperationalStatus() {
  return useQuery({
    queryKey: ["command-center-status"],
    queryFn: async (): Promise<OperationalStatus> => {
      const now = Date.now();
      const [logs, campaigns, payments, accounts, videos, creators] = await Promise.all([
        db.from("scraping_logs").select("status, run_at, completed_at, error_message").order("run_at", { ascending: false }).limit(5),
        db.from("campaigns").select("id, name, monthly_spend_cap, video_views_cap").eq("status", "active"),
        db.from("client_payments").select("campaign_id, cpm_amount, is_paid"),
        db.from("tiktok_accounts").select("id, creator_id, campaign_id, is_active").eq("account_type", "creator"),
        db.from("videos").select("tiktok_account_id, published_at").gte("published_at", new Date(now - 3 * DAY).toISOString()),
        db.from("creators").select("id, name").eq("status", "active"),
      ]);

      const logRows = (logs.data ?? []) as any[];
      const lastDone = logRows.find((l) => l.status === "success" || l.status === "error") ?? null;
      const running = logRows.find((l) => l.status === "running");
      const alerts: OperationalAlert[] = [];

      const lastScrapeAt: string | null = lastDone?.completed_at ?? lastDone?.run_at ?? null;
      const scrapeStatus: OperationalStatus["scrapeStatus"] = running
        ? "running"
        : lastDone
          ? (lastDone.status as "success" | "error")
          : "none";

      if (lastDone?.status === "error") {
        alerts.push({
          id: "scrape-error",
          kind: "scraping",
          message: `Ultimo aggiornamento dati non riuscito: ${String(lastDone.error_message ?? "errore sconosciuto").slice(0, 70)}`,
          severity: "red",
          link: "/dashboard/videos",
        });
      } else if (lastScrapeAt && now - new Date(lastScrapeAt).getTime() > 24 * 3600 * 1000) {
        const hours = Math.round((now - new Date(lastScrapeAt).getTime()) / 3600000);
        alerts.push({
          id: "scrape-stale",
          kind: "scraping",
          message: `Nessun aggiornamento dati da ${hours} ore`,
          severity: "amber",
          link: "/dashboard/videos",
        });
      }

      // Cap di spesa CPM per campagna attiva
      const unpaidCpm = new Map<string, number>();
      ((payments.data ?? []) as any[]).forEach((p) => {
        if (p.is_paid) return;
        unpaidCpm.set(p.campaign_id, (unpaidCpm.get(p.campaign_id) ?? 0) + Number(p.cpm_amount ?? 0));
      });

      ((campaigns.data ?? []) as any[]).forEach((c) => {
        const cap = Number(c.monthly_spend_cap ?? 0);
        if (!cap) return;
        const spent = unpaidCpm.get(c.id) ?? 0;
        const pct = Math.round((spent / cap) * 100);
        if (pct >= 100) {
          alerts.push({
            id: `cap-${c.id}`,
            kind: "cap",
            message: `${c.name}: tetto di spesa raggiunto (${pct}%)`,
            severity: "red",
            link: `/dashboard/campaigns/${c.id}`,
          });
        } else if (pct >= 80) {
          alerts.push({
            id: `cap-${c.id}`,
            kind: "cap",
            message: `${c.name}: tetto di spesa al ${pct}%`,
            severity: "amber",
            link: `/dashboard/campaigns/${c.id}`,
          });
        }
      });

      // Creator senza pubblicazioni nelle ultime 48 ore
      const cutoff = now - 2 * DAY;
      const recentAccounts = new Set(
        ((videos.data ?? []) as any[])
          .filter((v) => new Date(v.published_at).getTime() >= cutoff)
          .map((v) => v.tiktok_account_id),
      );
      const activeAccounts = ((accounts.data ?? []) as any[]).filter((a) => a.is_active !== false && a.creator_id && a.campaign_id);
      const creatorsWithAccounts = new Set(activeAccounts.map((a) => a.creator_id));
      const creatorsActive = new Set(
        activeAccounts.filter((a) => recentAccounts.has(a.id)).map((a) => a.creator_id),
      );
      const idle = [...creatorsWithAccounts].filter((id) => !creatorsActive.has(id));
      if (idle.length > 0) {
        alerts.push({
          id: "creator-idle",
          kind: "creator",
          message: `${idle.length} creator senza video pubblicati nelle ultime 48 ore`,
          severity: "amber",
          link: "/dashboard/creators",
        });
      }
      void creators;

      return { lastScrapeAt, scrapeStatus, alerts };
    },
    refetchInterval: 3 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   2. Timeline campagne attive
   ══════════════════════════════════════ */

export interface TimelineCampaign {
  id: string;
  name: string;
  clientName: string;
  logoUrl: string | null;
  startDate: string;
  endDate: string | null;
  isOngoing: boolean;
  daysLeft: number | null;
  progressPct: number;
  creatorCount: number;
}

export function useCampaignTimeline() {
  return useQuery({
    queryKey: ["command-center-timeline"],
    queryFn: async (): Promise<TimelineCampaign[]> => {
      const [campaigns, ccRows, accounts, companies] = await Promise.all([
        db.from("campaigns").select("id, name, client_name, start_date, end_date, company_id").eq("status", "active").order("start_date"),
        db.from("campaign_creators").select("campaign_id, creator_id"),
        db.from("tiktok_accounts").select("campaign_id, creator_id"),
        db.from("companies").select("id, logo_url"),
      ]);

      const logoMap = new Map(((companies.data ?? []) as any[]).map((c) => [c.id, c.logo_url as string | null]));
      const creatorsByCampaign = new Map<string, Set<string>>();
      const add = (campaignId: string | null, creatorId: string | null) => {
        if (!campaignId || !creatorId) return;
        const set = creatorsByCampaign.get(campaignId) ?? new Set<string>();
        set.add(creatorId);
        creatorsByCampaign.set(campaignId, set);
      };
      ((ccRows.data ?? []) as any[]).forEach((r) => add(r.campaign_id, r.creator_id));
      ((accounts.data ?? []) as any[]).forEach((r) => add(r.campaign_id, r.creator_id));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return ((campaigns.data ?? []) as any[]).map((c) => {
        const start = new Date(c.start_date);
        const end = c.end_date ? new Date(c.end_date) : null;
        const daysLeft = end ? Math.ceil((end.getTime() - today.getTime()) / DAY) : null;
        const total = end ? Math.max(1, (end.getTime() - start.getTime()) / DAY) : null;
        const elapsed = Math.max(0, (today.getTime() - start.getTime()) / DAY);
        const progressPct = total ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
        return {
          id: c.id,
          name: c.name,
          clientName: c.client_name,
          logoUrl: c.company_id ? logoMap.get(c.company_id) ?? null : null,
          startDate: c.start_date,
          endDate: c.end_date,
          isOngoing: !c.end_date,
          daysLeft,
          progressPct,
          creatorCount: creatorsByCampaign.get(c.id)?.size ?? 0,
        };
      });
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   3. Serie views (tutte le campagne o una)
   ══════════════════════════════════════ */

export interface ViewsPoint {
  date: string;
  label: string;
  views: number;
}

export interface ViewsSeries {
  points: ViewsPoint[];
  total: number;
  dailyAverage: number;
  previousTotal: number;
  capUsedPct: number | null;
}

const MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function useCampaignViewsSeries(campaignId: string | null, days: number) {
  return useQuery({
    queryKey: ["command-center-views", campaignId ?? "all", days],
    queryFn: async (): Promise<ViewsSeries> => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date(end.getTime() - (days - 1) * DAY);
      start.setHours(0, 0, 0, 0);
      const prevStart = new Date(start.getTime() - days * DAY);

      const [accounts, videos, campaigns] = await Promise.all([
        db.from("tiktok_accounts").select("id, campaign_id"),
        db.from("videos").select("tiktok_account_id, views, published_at").gte("published_at", prevStart.toISOString()).lte("published_at", end.toISOString()),
        campaignId
          ? db.from("campaigns").select("id, video_views_cap").eq("id", campaignId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const campaignByAccount = new Map(((accounts.data ?? []) as any[]).map((a) => [a.id, a.campaign_id as string | null]));
      const rows = ((videos.data ?? []) as any[]).filter((v) => {
        if (!campaignId) return true;
        return campaignByAccount.get(v.tiktok_account_id) === campaignId;
      });

      const map = new Map<string, number>();
      for (let i = 0; i < days; i++) map.set(isoDay(new Date(start.getTime() + i * DAY)), 0);

      let previousTotal = 0;
      rows.forEach((v) => {
        const key = String(v.published_at).slice(0, 10);
        const views = Number(v.views ?? 0);
        if (map.has(key)) map.set(key, (map.get(key) ?? 0) + views);
        else if (new Date(v.published_at) < start) previousTotal += views;
      });

      const points = [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, views]) => {
          const d = new Date(date);
          return { date, label: `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`, views };
        });

      const total = points.reduce((s, p) => s + p.views, 0);
      const cap = (campaigns as any)?.data?.video_views_cap ?? null;

      return {
        points,
        total,
        dailyAverage: Math.round(total / days),
        previousTotal,
        capUsedPct: cap && cap > 0 ? Math.round((total / (cap * Math.max(1, rows.length))) * 100) : null,
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

/* ══════════════════════════════════════
   4. Pipeline B2B e azioni urgenti
   ══════════════════════════════════════ */

const NEGOTIATION_STAGES = ["call_fissata", "call_fatta", "proposta_inviata", "trattativa"];

export interface UrgentTask {
  id: string;
  title: string;
  companyId: string | null;
  companyName: string | null;
  companyLogo: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface PipelineSummary {
  activeLeads: number;
  negotiating: number;
  negotiatingValue: number;
  urgentCount: number;
  tasks: UrgentTask[];
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: ["command-center-pipeline"],
    queryFn: async (): Promise<PipelineSummary> => {
      const todayStr = isoDay(new Date());
      const [companies, tasks] = await Promise.all([
        db.from("companies").select("id, stage, status, estimated_monthly_value, deal_fixed"),
        db.from("company_tasks").select("id, title, due_date, company_id, companies(name, logo_url)").eq("is_done", false).order("due_date", { ascending: true }).limit(40),
      ]);

      const rows = ((companies.data ?? []) as any[]).filter((c) => c.status === "lead");
      const activeLeads = rows.filter((c) => c.stage !== "perso" && c.stage !== "vinto").length;
      const inNegotiation = rows.filter((c) => NEGOTIATION_STAGES.includes(c.stage));
      const negotiatingValue = inNegotiation.reduce(
        (s, c) => s + Number(c.estimated_monthly_value ?? c.deal_fixed ?? 0),
        0,
      );

      const allTasks: UrgentTask[] = ((tasks.data ?? []) as any[]).map((t) => ({
        id: t.id,
        title: t.title,
        companyId: t.company_id,
        companyName: t.companies?.name ?? null,
        companyLogo: t.companies?.logo_url ?? null,
        dueDate: t.due_date,
        isOverdue: !!t.due_date && t.due_date < todayStr,
      }));

      const urgent = allTasks.filter((t) => t.dueDate && t.dueDate <= todayStr);

      return {
        activeLeads,
        negotiating: inNegotiation.length,
        negotiatingValue,
        urgentCount: urgent.length,
        tasks: (urgent.length ? urgent : allTasks).slice(0, 5),
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
