import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BriefReferenceLink, BriefStatus } from "@/hooks/useContentCalendar";

const sb = supabase as any;

export interface PortalBrief {
  id: string;
  campaign_id: string;
  title: string | null;
  planned_publish_date: string;
  week_label: string | null;
  status: BriefStatus;
  reference_type: string;
  reference_links: BriefReferenceLink[];
  format_name: string | null;
  topic_names: string[];
  copy_text: string;
  caption: string | null;
  hashtags: string[];
  visual_note: string | null;
  has_pending_cr: boolean;
}

function mapBriefRow(row: any, pendingSet: Set<string>): PortalBrief {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    title: row.title,
    planned_publish_date: row.planned_publish_date,
    week_label: row.week_label,
    status: row.status,
    reference_type: row.reference_type,
    reference_links: (row.reference_links ?? []) as BriefReferenceLink[],
    format_name: row.video_formats?.name ?? null,
    topic_names: (row.brief_topics ?? [])
      .map((bt: any) => bt.content_topics?.name)
      .filter(Boolean),
    copy_text: row.copy_text,
    caption: row.caption,
    hashtags: (row.hashtags ?? []) as string[],
    visual_note: row.visual_note,
    has_pending_cr: pendingSet.has(row.id),
  };
}

/** Briefs of the client's campaign (RLS limits to in_review/approved/archived). */
export function useClientCampaignBriefs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["client-briefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("video_briefs")
        .select(
          "*, video_formats(name), brief_topics(content_topics(name))"
        )
        .order("planned_publish_date", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: any) => r.id);
      const pendingSet = new Set<string>();
      if (ids.length > 0) {
        const { data: crs } = await sb
          .from("brief_change_requests")
          .select("brief_id")
          .eq("status", "pending")
          .in("brief_id", ids);
        for (const c of crs ?? []) pendingSet.add(c.brief_id);
      }
      return rows.map((r: any) => mapBriefRow(r, pendingSet));
    },
  });
}
