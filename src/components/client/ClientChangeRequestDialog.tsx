import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useCreateChangeRequest } from "@/hooks/useContentCalendar";
import type { PortalBrief } from "@/hooks/useClientBriefs";

export function ClientChangeRequestDialog({
  brief,
  open,
  onOpenChange,
}: {
  brief: PortalBrief | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateChangeRequest();
  const [reason, setReason] = useState("");
  const [copyText, setCopyText] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [visualNote, setVisualNote] = useState("");

  const reset = () => {
    setReason(""); setCopyText(""); setCaption(""); setHashtags(""); setVisualNote("");
  };

  const submit = async () => {
    if (!brief) return;
    if (!reason.trim()) {
      toast({ title: "Motivo mancante", description: "Indica il motivo della richiesta.", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        briefId: brief.id,
        reason: reason.trim(),
        proposed_copy_text: copyText.trim() || null,
        proposed_caption: caption.trim() || null,
        proposed_hashtags: hashtags.trim()
          ? hashtags.split(/[\s,]+/).map((h) => h.replace(/^#+/, "")).filter(Boolean)
          : null,
        proposed_visual_note: visualNote.trim() || null,
      });
      toast({ title: "Richiesta inviata" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Richiedi modifica</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Perche serve una modifica" />
          </div>
          <p className="text-xs text-muted-foreground">Proponi i nuovi testi (opzionali). Lo staff decidera quali applicare.</p>
          <div className="space-y-1.5">
            <Label>Copy proposto</Label>
            <Textarea value={copyText} onChange={(e) => setCopyText(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Caption proposta</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Hashtag proposti</Label>
            <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="separati da spazio o virgola" />
          </div>
          <div className="space-y-1.5">
            <Label>Note visuali proposte</Label>
            <Textarea value={visualNote} onChange={(e) => setVisualNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={create.isPending}>Invia richiesta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
