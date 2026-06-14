import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAddBriefComment, type BriefComment } from "@/hooks/useContentCalendar";
import { formatDateIt } from "@/components/content-calendar/_helpers";
import type { PortalBrief } from "@/hooks/useClientBriefs";

const sb = supabase as any;

export function ClientCommentsDrawer({
  brief,
  open,
  onOpenChange,
}: {
  brief: PortalBrief | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const addComment = useAddBriefComment();
  const [body, setBody] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["client-brief-comments", brief?.id],
    enabled: !!brief && open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("brief_comments")
        .select("*")
        .eq("brief_id", brief!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefComment[];
    },
  });

  const send = async () => {
    if (!brief || !body.trim()) return;
    try {
      await addComment.mutateAsync({ briefId: brief.id, body: body.trim() });
      setBody("");
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Commenti</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Scrivi un commento" />
            <div className="flex justify-end">
              <Button size="sm" onClick={send} disabled={addComment.isPending || !body.trim()}>Invia</Button>
            </div>
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {!isLoading && (comments ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nessun commento.</p>}
          <ul className="space-y-2">
            {(comments ?? []).map((c) => (
              <li key={c.id} className="rounded-md border border-border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{c.author_role}</span>
                  {c.resolved && <Badge variant="secondary" className="text-[10px]">Risolto</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDateIt(c.created_at, { day: "numeric", month: "short" })}</p>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
