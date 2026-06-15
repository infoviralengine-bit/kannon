import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Types are not in the generated Supabase types yet; cast at call sites.
const sb = supabase as any;

export type BriefStatus = "draft" | "in_review" | "approved" | "archived";

export interface BriefReferenceLink {
  label: string;
  url: string;
}

export interface BriefTopMatchedVideo {
  tiktok_url: string;
  account_username: string | null;
  effective_views: number;
}

export interface Brief {
  id: string;
  campaign_id: string;
  title: string | null;
  planned_publish_date: string;
  week_label: string | null;
  status: BriefStatus;
  reference_type: string;
  reference_links: BriefReferenceLink[];
  format_id: string | null;
  format_name: string | null;
  topic_ids: string[];
  topic_names: string[];
  copy_text: string;
  caption: string | null;
  hashtags: string[];
  visual_note: string | null;
  audio_id: string | null;
  expected_caption_keywords: string[];
  threshold_views_override: number | null;
  threshold_engagement_override: number | null;
  threshold_views: number | null;
  threshold_engagement: number | null;
  matched_videos_count: number;
  total_effective_views: number;
  total_engagements: number;
  avg_engagement_pct: number;
  is_winner: boolean;
  top_matched_video: BriefTopMatchedVideo | null;
  comments_count_open: number;
  change_requests_count_pending: number;
}

export interface CalendarWeek {
  week_start: string;
  briefs: Brief[];
}

export interface ContentCalendarData {
  campaign_defaults: { threshold_views: number; threshold_engagement: number };
  weeks: CalendarWeek[];
}

export interface BriefInput {
  campaign_id: string;
  planned_publish_date: string;
  week_label?: string | null;
  reference_type: string;
  reference_links: BriefReferenceLink[];
  audio_id?: string | null;
  expected_caption_keywords?: string[] | null;
  format_id?: string | null;
  title?: string | null;
  copy_text: string;
  caption?: string | null;
  hashtags?: string[] | null;
  visual_note?: string | null;
  threshold_views_override?: number | null;
  threshold_engagement_override?: number | null;
  status?: BriefStatus;
  topic_ids?: string[];
}

export interface BriefComment {
  id: string;
  brief_id: string;
  author_id: string;
  author_role: string;
  body: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface BriefChangeRequest {
  id: string;
  brief_id: string;
  author_id: string;
  proposed_copy_text: string | null;
  proposed_caption: string | null;
  proposed_hashtags: string[] | null;
  proposed_visual_note: string | null;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface BriefMatch {
  id: string;
  video_id: string;
  brief_id: string;
  match_method: "audio_id" | "caption_keywords" | "manual";
  confidence: number;
  created_at: string;
  account_username: string | null;
  tiktok_url: string;
  effective_views: number;
  engagement_pct: number;
}

const calendarKey = (campaignId: string | null) => ["content-calendar", campaignId];

export function useContentCalendar(
  campaignId: string | null,
  fromDate: string | null,
  toDate: string | null
) {
  return useQuery({
    queryKey: ["content-calendar", campaignId, fromDate, toDate],
    enabled: !!campaignId && !!fromDate && !!toDate,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_content_calendar", {
        p_campaign_id: campaignId,
        p_from: fromDate,
        p_to: toDate,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<ContentCalendarData>;
      return {
        campaign_defaults: d.campaign_defaults ?? { threshold_views: 50000, threshold_engagement: 5.0 },
        weeks: (d.weeks ?? []) as CalendarWeek[],
      } as ContentCalendarData;
    },
  });
}

export function useContentAnalytics(
  period: string,
  campaignId?: string | null,
  formatId?: string | null,
  topicId?: string | null
) {
  return useQuery({
    queryKey: ["content-analytics", period, campaignId ?? null, formatId ?? null, topicId ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_content_analytics", {
        p_period: period,
        p_campaign_id: campaignId ?? null,
        p_format_id: formatId ?? null,
        p_topic_id: topicId ?? null,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

export function useContentInsights(period: string, campaignId?: string | null) {
  return useQuery({
    queryKey: ["content-insights", period, campaignId ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_content_insights", {
        p_period: period,
        p_campaign_id: campaignId ?? null,
      });
      if (error) throw error;
      return data as any;
    },
  });
}

/** Single brief detail: matches + comments + change requests. */
export function useBrief(briefId: string | null) {
  return useQuery({
    queryKey: ["brief-detail", briefId],
    enabled: !!briefId,
    queryFn: async () => {
      const [matchesRes, commentsRes, crRes] = await Promise.all([
        sb
          .from("video_brief_matches")
          .select(
            "id, video_id, brief_id, match_method, confidence, created_at, videos(tiktok_video_id, views, likes, comments, window_closed, views_final, tiktok_accounts(username))"
          )
          .eq("brief_id", briefId),
        sb
          .from("brief_comments")
          .select("*")
          .eq("brief_id", briefId)
          .order("created_at", { ascending: false }),
        sb
          .from("brief_change_requests")
          .select("*")
          .eq("brief_id", briefId)
          .order("created_at", { ascending: false }),
      ]);
      if (matchesRes.error) throw matchesRes.error;
      if (commentsRes.error) throw commentsRes.error;
      if (crRes.error) throw crRes.error;

      const matches: BriefMatch[] = (matchesRes.data ?? []).map((m: any) => {
        const v = m.videos ?? {};
        const username = v.tiktok_accounts?.username ?? null;
        const effective =
          v.window_closed ? Number(v.views_final ?? v.views ?? 0) : Number(v.views ?? 0);
        const views = Number(v.views ?? 0);
        const eng = views === 0 ? 0 : ((Number(v.likes ?? 0) + Number(v.comments ?? 0)) / views) * 100;
        return {
          id: m.id,
          video_id: m.video_id,
          brief_id: m.brief_id,
          match_method: m.match_method,
          confidence: Number(m.confidence),
          created_at: m.created_at,
          account_username: username,
          tiktok_url: `https://www.tiktok.com/@${username ?? ""}/video/${v.tiktok_video_id ?? ""}`,
          effective_views: effective,
          engagement_pct: Math.round(eng * 100) / 100,
        };
      });

      return {
        matches,
        comments: (commentsRes.data ?? []) as BriefComment[],
        changeRequests: (crRes.data ?? []) as BriefChangeRequest[],
      };
    },
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["content-calendar"] });
  qc.invalidateQueries({ queryKey: ["brief-detail"] });
  qc.invalidateQueries({ queryKey: ["content-analytics"] });
  qc.invalidateQueries({ queryKey: ["content-insights"] });
}

async function syncBriefTopics(briefId: string, topicIds: string[]) {
  await sb.from("brief_topics").delete().eq("brief_id", briefId);
  if (topicIds.length > 0) {
    const { error } = await sb
      .from("brief_topics")
      .insert(topicIds.map((topic_id) => ({ brief_id: briefId, topic_id })));
    if (error) throw error;
  }
}

export function useCreateBrief() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: BriefInput) => {
      const { topic_ids = [], ...rest } = input;
      const { data, error } = await sb
        .from("video_briefs")
        .insert({ ...rest, created_by: user?.id ?? null })
        .select("id, status, campaign_id")
        .single();
      if (error) throw error;
      await syncBriefTopics(data.id, topic_ids);
      if (data.status === "in_review") {
        await sb.rpc("notify_brief_event", {
          p_brief_id: data.id,
          p_type: "brief_loaded_to_review",
          p_message: "Un nuovo contenuto è in revisione.",
          p_link: "/dashboard/content-calendar",
          p_targets: ["creators", "clients"],
        });
      }
      return data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<BriefInput> }) => {
      const { topic_ids, ...rest } = input;
      if (Object.keys(rest).length > 0) {
        const { error } = await sb.from("video_briefs").update(rest).eq("id", id);
        if (error) throw error;
      }
      if (topic_ids) await syncBriefTopics(id, topic_ids);
      return id;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("video_briefs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useChangeBriefStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BriefStatus }) => {
      const { error } = await sb.from("video_briefs").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "approved") {
        await sb.rpc("notify_brief_event", {
          p_brief_id: id,
          p_type: "brief_approved",
          p_message: "Un contenuto è stato approvato.",
          p_link: "/dashboard/content-calendar",
          p_targets: ["creators", "staff"],
        });
      } else if (status === "in_review") {
        await sb.rpc("notify_brief_event", {
          p_brief_id: id,
          p_type: "brief_loaded_to_review",
          p_message: "Un contenuto è in revisione.",
          p_link: "/dashboard/content-calendar",
          p_targets: ["creators", "clients"],
        });
      }
      return id;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useBulkLoadWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      weekStart,
      weekEnd,
    }: {
      campaignId: string;
      weekStart: string;
      weekEnd: string;
    }) => {
      const { data, error } = await sb
        .from("video_briefs")
        .update({ status: "in_review" })
        .eq("campaign_id", campaignId)
        .eq("status", "draft")
        .gte("planned_publish_date", weekStart)
        .lte("planned_publish_date", weekEnd)
        .select("id");
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.id);
      await Promise.all(
        ids.map((id: string) =>
          sb.rpc("notify_brief_event", {
            p_brief_id: id,
            p_type: "brief_loaded_to_review",
            p_message: "Nuovi contenuti della settimana sono in revisione.",
            p_link: "/dashboard/content-calendar",
            p_targets: ["creators", "clients"],
          })
        )
      );
      return ids.length;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddBriefComment() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  return useMutation({
    mutationFn: async ({ briefId, body }: { briefId: string; body: string }) => {
      const { error } = await sb.from("brief_comments").insert({
        brief_id: briefId,
        author_id: user?.id,
        author_role: role ?? "",
        body,
      });
      if (error) throw error;
      // Notify the counterpart: if client commented -> staff; otherwise -> clients.
      const targets = role === "client" ? ["staff"] : ["clients"];
      await sb.rpc("notify_brief_event", {
        p_brief_id: briefId,
        p_type: "brief_comment_new",
        p_message: "Nuovo commento su un contenuto.",
        p_link: "/dashboard/content-calendar",
        p_targets: targets,
      });
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useResolveBriefComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await sb
        .from("brief_comments")
        .update({
          resolved,
          resolved_by: resolved ? user?.id : null,
          resolved_at: resolved ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export interface ChangeRequestInput {
  briefId: string;
  reason: string;
  proposed_copy_text?: string | null;
  proposed_caption?: string | null;
  proposed_hashtags?: string[] | null;
  proposed_visual_note?: string | null;
}

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: ChangeRequestInput) => {
      const { briefId, ...rest } = input;
      const { error } = await sb.from("brief_change_requests").insert({
        brief_id: briefId,
        author_id: user?.id,
        ...rest,
      });
      if (error) throw error;
      await sb.rpc("notify_brief_event", {
        p_brief_id: briefId,
        p_type: "brief_change_request_new",
        p_message: "Richiesta di modifica su un contenuto.",
        p_link: "/dashboard/content-calendar",
        p_targets: ["staff"],
      });
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useResolveChangeRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      cr,
      accept,
      applyFields,
      note,
    }: {
      cr: BriefChangeRequest;
      accept: boolean;
      applyFields?: {
        copy_text?: boolean;
        caption?: boolean;
        hashtags?: boolean;
        visual_note?: boolean;
      };
      note?: string;
    }) => {
      if (accept) {
        const patch: Record<string, unknown> = {};
        if (applyFields?.copy_text && cr.proposed_copy_text != null) patch.copy_text = cr.proposed_copy_text;
        if (applyFields?.caption && cr.proposed_caption != null) patch.caption = cr.proposed_caption;
        if (applyFields?.hashtags && cr.proposed_hashtags != null) patch.hashtags = cr.proposed_hashtags;
        if (applyFields?.visual_note && cr.proposed_visual_note != null) patch.visual_note = cr.proposed_visual_note;
        if (Object.keys(patch).length > 0) {
          const { error: upErr } = await sb.from("video_briefs").update(patch).eq("id", cr.brief_id);
          if (upErr) throw upErr;
        }
      }
      const { error } = await sb
        .from("brief_change_requests")
        .update({
          status: accept ? "accepted" : "rejected",
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_note: note ?? null,
        })
        .eq("id", cr.id);
      if (error) throw error;
      await sb.rpc("notify_brief_event", {
        p_brief_id: cr.brief_id,
        p_type: "brief_change_request_resolved",
        p_message: accept ? "La tua richiesta di modifica è stata accettata." : "La tua richiesta di modifica è stata respinta.",
        p_link: "/client",
        p_targets: ["clients"],
      });
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useManualMatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ videoId, briefId }: { videoId: string; briefId: string }) => {
      const { error } = await sb.from("video_brief_matches").insert({
        video_id: videoId,
        brief_id: briefId,
        match_method: "manual",
        confidence: 1.0,
        matched_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ videoId, briefId }: { videoId: string; briefId: string }) => {
      const { error } = await sb
        .from("video_brief_matches")
        .delete()
        .eq("video_id", videoId)
        .eq("brief_id", briefId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRefreshMatching() {
  const qc = useQueryClient();
  return useMutation<number, Error, number | undefined>({
    mutationFn: async (daysBack) => {
      const { data, error } = await sb.rpc("rematch_all_unmatched_videos", { p_days_back: daysBack ?? 30 });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Search videos of a campaign for the manual-match modal. */
export function useCampaignVideosSearch(campaignId: string | null, search: string) {
  return useQuery({
    queryKey: ["campaign-videos-search", campaignId, search],
    enabled: !!campaignId,
    queryFn: async () => {
      let q = sb
        .from("videos")
        .select(
          "id, tiktok_video_id, caption, views, published_at, tiktok_accounts!inner(username, campaign_id)"
        )
        .eq("tiktok_accounts.campaign_id", campaignId)
        .order("published_at", { ascending: false })
        .limit(40);
      if (search.trim()) q = q.ilike("caption", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows.map((v) => ({
        id: v.id as string,
        tiktok_video_id: v.tiktok_video_id as string,
        caption: (v.caption ?? null) as string | null,
        views: Number(v.views ?? 0),
        published_at: v.published_at as string,
        username: (v.tiktok_accounts?.username ?? null) as string | null,
      }));
    },
  });
}

export interface CampaignOption {
  id: string;
  name: string;
  status: string | null;
}

/** Lightweight campaign list for the hub campaign selector. */
export function useCampaignOptions() {
  return useQuery({
    queryKey: ["campaign-options"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb
        .from("campaigns")
        .select("id, name, status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CampaignOption[];
    },
  });
}

// ---------------------------------------------------------------------------
// SP#5 Part B: AI-paste brief import
// ---------------------------------------------------------------------------
export interface ParsedBrief {
  planned_publish_date: string;
  title: string;
  reference_type: "video" | "audio" | "video_audio" | "format_audio" | "format";
  reference_links: { label: string; url: string }[];
  copy_text: string;
  caption: string | null;
  hashtags: string[];
  visual_note: string | null;
  audio_id: string | null;
  expected_caption_keywords: string[];
  format_id: string | null;
  topic_ids: string[];
}

export function useParseBriefsFromText() {
  return useMutation({
    mutationFn: async (input: { raw_text: string; campaign_name?: string }) => {
      const { data, error } = await supabase.functions.invoke("parse-briefs-from-text", {
        body: { raw_text: input.raw_text, campaign_context: { campaign_name: input.campaign_name } },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Parse failed");
      return data.briefs as ParsedBrief[];
    },
  });
}

export function useBulkCreateBriefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { campaign_id: string; briefs: ParsedBrief[] }) => {
      const rows = input.briefs.map((b) => ({
        campaign_id: input.campaign_id,
        planned_publish_date: b.planned_publish_date,
        title: b.title,
        reference_type: b.reference_type,
        reference_links: b.reference_links,
        copy_text: b.copy_text,
        caption: b.caption,
        hashtags: b.hashtags,
        visual_note: b.visual_note,
        audio_id: b.audio_id,
        expected_caption_keywords: b.expected_caption_keywords,
        format_id: b.format_id,
        status: "draft" as const,
      }));
      const { data, error } = await sb.from("video_briefs").insert(rows).select("id");
      if (error) throw error;

      const topicLinks: { brief_id: string; topic_id: string }[] = [];
      (data ?? []).forEach((inserted: any, i: number) => {
        (input.briefs[i]?.topic_ids ?? []).forEach((tid) =>
          topicLinks.push({ brief_id: inserted.id, topic_id: tid })
        );
      });
      if (topicLinks.length > 0) {
        const { error: linkErr } = await sb.from("brief_topics").insert(topicLinks);
        if (linkErr) throw linkErr;
      }
      return (data ?? []) as { id: string }[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-calendar"] });
    },
  });
}

export { calendarKey };
