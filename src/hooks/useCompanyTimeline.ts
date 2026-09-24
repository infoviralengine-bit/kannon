import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/i18n";

const db = supabase as any;
const DOCUMENTS_BUCKET = "company-documents";

export type TimelineItemType = "activity" | "document" | "task" | "note";

export type TimelineOrderRow = {
  item_type: TimelineItemType;
  item_id: string;
  position: number;
};

export function useTimelineOrder(companyId: string) {
  return useQuery({
    queryKey: ["company-timeline-order", companyId],
    queryFn: async () => {
      const { data, error } = await db
        .from("company_timeline_order")
        .select("item_type, item_id, position")
        .eq("company_id", companyId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as TimelineOrderRow[];
    },
  });
}

export function useSaveTimelineOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ companyId, items }: {
      companyId: string;
      items: { itemType: TimelineItemType; itemId: string }[];
    }) => {
      const rows = items.map((item, position) => ({
        company_id: companyId,
        item_type: item.itemType,
        item_id: item.itemId,
        position,
      }));
      if (!rows.length) return companyId;
      const { error } = await db
        .from("company_timeline_order")
        .upsert(rows, { onConflict: "company_id,item_type,item_id" });
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => qc.invalidateQueries({ queryKey: ["company-timeline-order", companyId] }),
    onError: (error: Error) => toast({
      title: t("Ordine non salvato"),
      description: error.message,
      variant: "destructive",
    }),
  });
}

export function useDeleteTimelineItem() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ companyId, itemType, itemId, storagePath }: {
      companyId: string;
      itemType: TimelineItemType;
      itemId: string;
      storagePath?: string | null;
    }) => {
      const table = {
        activity: "company_activities",
        document: "company_documents",
        task: "company_tasks",
        note: "company_notes",
      }[itemType];

      if (itemType === "document" && storagePath) {
        const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
        if (storageError) throw storageError;
      }

      const { error } = await db.from(table).delete().eq("id", itemId).eq("company_id", companyId);
      if (error) throw error;

      const { error: orderError } = await db
        .from("company_timeline_order")
        .delete()
        .eq("company_id", companyId)
        .eq("item_type", itemType)
        .eq("item_id", itemId);
      if (orderError) throw orderError;

      return companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["company-notes", companyId] });
      qc.invalidateQueries({ queryKey: ["company-timeline-order", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["clients-overview"] });
      qc.invalidateQueries({ queryKey: ["company-tasks-agenda"] });
      toast({ title: t("Elemento eliminato dalla cronologia") });
    },
    onError: (error: Error) => toast({
      title: t("Errore"),
      description: error.message,
      variant: "destructive",
    }),
  });
}