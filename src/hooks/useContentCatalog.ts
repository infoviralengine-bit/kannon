import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface CatalogItem {
  id: string;
  name: string;
  is_active: boolean;
  brief_count: number;
}

export function useVideoFormats() {
  return useQuery({
    queryKey: ["content-catalog", "formats"],
    queryFn: async () => {
      const [fmtRes, briefsRes] = await Promise.all([
        sb.from("video_formats").select("id, name, is_active").order("name"),
        sb.from("video_briefs").select("format_id"),
      ]);
      if (fmtRes.error) throw fmtRes.error;
      if (briefsRes.error) throw briefsRes.error;
      const counts = new Map<string, number>();
      for (const b of briefsRes.data ?? []) {
        if (b.format_id) counts.set(b.format_id, (counts.get(b.format_id) ?? 0) + 1);
      }
      return (fmtRes.data ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        is_active: f.is_active ?? true,
        brief_count: counts.get(f.id) ?? 0,
      })) as CatalogItem[];
    },
  });
}

export function useContentTopics() {
  return useQuery({
    queryKey: ["content-catalog", "topics"],
    queryFn: async () => {
      const [topRes, linkRes] = await Promise.all([
        sb.from("content_topics").select("id, name, is_active").order("name"),
        sb.from("brief_topics").select("topic_id"),
      ]);
      if (topRes.error) throw topRes.error;
      if (linkRes.error) throw linkRes.error;
      const counts = new Map<string, number>();
      for (const l of linkRes.data ?? []) {
        if (l.topic_id) counts.set(l.topic_id, (counts.get(l.topic_id) ?? 0) + 1);
      }
      return (topRes.data ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        is_active: t.is_active ?? true,
        brief_count: counts.get(t.id) ?? 0,
      })) as CatalogItem[];
    },
  });
}

function makeCrud(table: "video_formats" | "content_topics", key: "formats" | "topics") {
  const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: ["content-catalog", key] });
    qc.invalidateQueries({ queryKey: ["content-calendar"] });
  };

  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (name: string) => {
        const { data, error } = await sb.from(table).insert({ name: name.trim() }).select("id").single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => invalidate(qc),
    });
  };

  const useRename = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, name }: { id: string; name: string }) => {
        const { error } = await sb.from(table).update({ name: name.trim() }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => invalidate(qc),
    });
  };

  const useToggleActive = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
        const { error } = await sb.from(table).update({ is_active }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => invalidate(qc),
    });
  };

  const useDelete = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => invalidate(qc),
    });
  };

  return { useCreate, useRename, useToggleActive, useDelete };
}

const formatCrud = makeCrud("video_formats", "formats");
export const useCreateFormat = formatCrud.useCreate;
export const useRenameFormat = formatCrud.useRename;
export const useToggleFormatActive = formatCrud.useToggleActive;
export const useDeleteFormat = formatCrud.useDelete;

const topicCrud = makeCrud("content_topics", "topics");
export const useCreateTopic = topicCrud.useCreate;
export const useRenameTopic = topicCrud.useRename;
export const useToggleTopicActive = topicCrud.useToggleActive;
export const useDeleteTopic = topicCrud.useDelete;
