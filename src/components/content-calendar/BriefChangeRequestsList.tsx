import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatDateIt } from "./_helpers";
import {
  useBrief,
  useResolveChangeRequest,
  type Brief,
  type BriefChangeRequest,
} from "@/hooks/useContentCalendar";

const CR_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-amber-500/15 text-amber-600" },
  accepted: { label: "Accettata", cls: "bg-emerald-500/15 text-emerald-600" },
  rejected: { label: "Respinta", cls: "bg-red-500/15 text-red-600" },
};

export function BriefChangeRequestsList({ briefId }: { briefId: string; brief: Brief | null }) {
  const { data, isLoading } = useBrief(briefId);
  const resolve = useResolveChangeRequest();
  const [accepting, setAccepting] = useState<BriefChangeRequest | null>(null);
  const [fields, setFields] = useState({ copy_text: true, caption: true, hashtags: true, visual_note: true });

  const crs = data?.changeRequests ?? [];

  const confirmAccept = async () => {
    if (!accepting) return;
    try {
      await resolve.mutateAsync({ cr: accepting, accept: true, applyFields: fields });
      toast({ title: "Richiesta accettata" });
      setAccepting(null);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const reject = async (cr: BriefChangeRequest) => {
    try {
      await resolve.mutateAsync({ cr, accept: false });
      toast({ title: "Richiesta respinta" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      {isLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!isLoading && crs.length === 0 && <p className="text-sm text-muted-foreground">Nessuna richiesta di modifica.</p>}

      {crs.map((cr) => (
        <div key={cr.id} className="rounded-md border border-border p-2.5 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <Badge className={CR_STATUS[cr.status]?.cls}>{CR_STATUS[cr.status]?.label}</Badge>
            <span className="text-[10px] text-muted-foreground">{formatDateIt(cr.created_at, { day: "numeric", month: "short" })}</span>
          </div>
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {cr.reason}</p>
          {cr.proposed_copy_text != null && <p><span className="text-muted-foreground">Copy:</span> {cr.proposed_copy_text}</p>}
          {cr.proposed_caption != null && <p><span className="text-muted-foreground">Caption:</span> {cr.proposed_caption}</p>}
          {cr.proposed_hashtags != null && <p><span className="text-muted-foreground">Hashtag:</span> {cr.proposed_hashtags.map((h) => `#${h}`).join(" ")}</p>}
          {cr.proposed_visual_note != null && <p><span className="text-muted-foreground">Note visuali:</span> {cr.proposed_visual_note}</p>}
          {cr.status === "pending" && (
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => reject(cr)} disabled={resolve.isPending}>
                <X className="h-3.5 w-3.5 mr-1" />Rifiuta
              </Button>
              <Button size="sm" onClick={() => { setAccepting(cr); setFields({ copy_text: true, caption: true, hashtags: true, visual_note: true }); }}>
                <Check className="h-3.5 w-3.5 mr-1" />Accetta
              </Button>
            </div>
          )}
        </div>
      ))}

      <Dialog open={!!accepting} onOpenChange={(o) => !o && setAccepting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Applica modifiche</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Seleziona i campi da applicare al brief.</p>
          <div className="space-y-2 py-2">
            {accepting?.proposed_copy_text != null && (
              <FieldRow id="copy_text" label="Copy" value={accepting.proposed_copy_text} checked={fields.copy_text} onChange={(v) => setFields((f) => ({ ...f, copy_text: v }))} />
            )}
            {accepting?.proposed_caption != null && (
              <FieldRow id="caption" label="Caption" value={accepting.proposed_caption} checked={fields.caption} onChange={(v) => setFields((f) => ({ ...f, caption: v }))} />
            )}
            {accepting?.proposed_hashtags != null && (
              <FieldRow id="hashtags" label="Hashtag" value={accepting.proposed_hashtags.map((h) => `#${h}`).join(" ")} checked={fields.hashtags} onChange={(v) => setFields((f) => ({ ...f, hashtags: v }))} />
            )}
            {accepting?.proposed_visual_note != null && (
              <FieldRow id="visual_note" label="Note visuali" value={accepting.proposed_visual_note} checked={fields.visual_note} onChange={(v) => setFields((f) => ({ ...f, visual_note: v }))} />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccepting(null)}>Annulla</Button>
            <Button onClick={confirmAccept} disabled={resolve.isPending}>Applica e accetta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldRow({ id, label, value, checked, onChange }: { id: string; label: string; value: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border p-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
