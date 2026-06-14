import { useState } from "react";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isStaff, type AppRole } from "@/lib/roles";
import { formatDateIt } from "./_helpers";
import { useBrief, useAddBriefComment, useResolveBriefComment } from "@/hooks/useContentCalendar";

export function BriefCommentsThread({ briefId }: { briefId: string }) {
  const { role } = useAuth();
  const { data, isLoading } = useBrief(briefId);
  const addComment = useAddBriefComment();
  const resolve = useResolveBriefComment();
  const [body, setBody] = useState("");
  const staff = isStaff(role as AppRole | null) || role === "campaign_manager";

  const send = async () => {
    if (!body.trim()) return;
    try {
      await addComment.mutateAsync({ briefId, body: body.trim() });
      setBody("");
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const comments = data?.comments ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Scrivi un commento" />
        <div className="flex justify-end">
          <Button size="sm" onClick={send} disabled={addComment.isPending || !body.trim()}>Invia</Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun commento.</p>
      )}
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border border-border p-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{c.author_role}</span>
              <div className="flex items-center gap-2">
                {c.resolved && <Badge variant="secondary" className="text-[10px]">Risolto</Badge>}
                <span className="text-[10px] text-muted-foreground">{formatDateIt(c.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            {staff && (
              <div className="mt-1.5 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolve.mutate({ id: c.id, resolved: !c.resolved })}
                >
                  {c.resolved ? <><Undo2 className="h-3.5 w-3.5 mr-1" />Riapri</> : <><Check className="h-3.5 w-3.5 mr-1" />Risolvi</>}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
