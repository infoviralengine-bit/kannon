import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PortalBrief } from "@/hooks/useClientBriefs";

const sb = supabase as any;

/** Briefs assigned to the creator (RLS limits to in_review/approved of their campaigns). */
export function useCreatorAssignedBriefs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["creator-briefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb
        .from("video_briefs")
        .select("*, video_formats(name), brief_topics(content_topics(name))")
        .order("planned_publish_date", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows.map(
        (row): PortalBrief => ({
          id: row.id,
          campaign_id: row.campaign_id,
          title: row.title,
          planned_publish_date: row.planned_publish_date,
          week_label: row.week_label,
          status: row.status,
          reference_type: row.reference_type,
          reference_links: row.reference_links ?? [],
          format_name: row.video_formats?.name ?? null,
          topic_names: (row.brief_topics ?? [])
            .map((bt: any) => bt.content_topics?.name)
            .filter(Boolean),
          copy_text: row.copy_text,
          caption: row.caption,
          hashtags: row.hashtags ?? [],
          visual_note: row.visual_note,
          has_pending_cr: false,
        })
      );
    },
  });
}
