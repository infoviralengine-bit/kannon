import { useState } from "react";
import { Loader2, Trash2, Plus, X, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ChipsInput } from "./_helpers";
import {
  useParseBriefsFromText,
  useBulkCreateBriefs,
  type ParsedBrief,
} from "@/hooks/useContentCalendar";
import { useVideoFormats, useContentTopics } from "@/hooks/useContentCatalog";

const REFERENCE_TYPES = ["video", "audio", "video_audio", "format_audio", "format"];

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
}

export function BriefImportDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  campaignName?: string | null;
}) {
  const [mode, setMode] = useState<"paste" | "preview">("paste");
  const [rawText, setRawText] = useState("");
  const [briefs, setBriefs] = useState<ParsedBrief[]>([]);
  const parse = useParseBriefsFromText();
  const bulkCreate = useBulkCreateBriefs();
  const { data: formats } = useVideoFormats();
  const { data: topics } = useContentTopics();

  const reset = () => {
    setMode("paste");
    setRawText("");
    setBriefs([]);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const analyze = async () => {
    try {
      const result = await parse.mutateAsync({ raw_text: rawText, campaign_name: campaignName ?? undefined });
      if (result.length === 0) {
        toast({ title: "Nessun brief estratto", description: "Controlla il testo incollato.", variant: "destructive" });
        return;
      }
      setBriefs(result);
      setMode("preview");
    } catch (e: any) {
      toast({ title: "Errore analisi", description: e.message, variant: "destructive" });
    }
  };

  const update = (i: number, patch: Partial<ParsedBrief>) =>
    setBriefs((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const removeBrief = (i: number) => setBriefs((prev) => prev.filter((_, j) => j !== i));

  const valid =
    briefs.length > 0 &&
    briefs.every((b) => b.copy_text.trim().length > 0 && isValidDate(b.planned_publish_date));

  const create = async () => {
    try {
      const created = await bulkCreate.mutateAsync({ campaign_id: campaignId, briefs });
      toast({ title: `${created.length} brief creati`, description: "Aggiunti come bozze nel calendario." });
      close();
    } catch (e: any) {
      toast({ title: "Errore creazione", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto sm:rounded-lg">
        {mode === "paste" ? (
          <>
            <DialogHeader>
              <DialogTitle>Importa da Google Doc</DialogTitle>
              <DialogDescription>
                Incolla la tabella settimanale dei brief. L'AI estrae i singoli brief che potrai rivedere prima di crearli.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Incolla qui il testo della tabella (Cmd+V)..."
            />
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Annulla</Button>
              <Button onClick={analyze} disabled={rawText.trim().length < 20 || parse.isPending}>
                {parse.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Analizza
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Anteprima: {briefs.length} brief estratti</DialogTitle>
              <DialogDescription>Rivedi e correggi prima di creare. Verranno salvati come bozze.</DialogDescription>
            </DialogHeader>
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setMode("paste")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Torna a incolla
            </Button>

            <div className="space-y-4">
              {briefs.map((b, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Brief {i + 1}</span>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeBrief(i)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Rimuovi
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        value={b.planned_publish_date}
                        onChange={(e) => update(i, { planned_publish_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo riferimento</Label>
                      <Select value={b.reference_type} onValueChange={(v) => update(i, { reference_type: v as ParsedBrief["reference_type"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REFERENCE_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Titolo</Label>
                    <Input value={b.title} onChange={(e) => update(i, { title: e.target.value })} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Link di riferimento</Label>
                    {b.reference_links.map((l, li) => (
                      <div key={li} className="flex gap-2">
                        <Input
                          className="w-28"
                          value={l.label}
                          onChange={(e) =>
                            update(i, { reference_links: b.reference_links.map((x, j) => (j === li ? { ...x, label: e.target.value } : x)) })
                          }
                        />
                        <Input
                          className="flex-1"
                          placeholder="https://www.tiktok.com/..."
                          value={l.url}
                          onChange={(e) =>
                            update(i, { reference_links: b.reference_links.map((x, j) => (j === li ? { ...x, url: e.target.value } : x)) })
                          }
                        />
                        <Button variant="ghost" size="icon" onClick={() => update(i, { reference_links: b.reference_links.filter((_, j) => j !== li) })}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => update(i, { reference_links: [...b.reference_links, { label: "Link", url: "" }] })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi link
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Format</Label>
                      <Select value={b.format_id ?? "__none__"} onValueChange={(v) => update(i, { format_id: v === "__none__" ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {(formats ?? []).filter((f) => f.is_active).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Topic</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(topics ?? []).filter((t) => t.is_active).map((t) => (
                        <Badge
                          key={t.id}
                          variant={b.topic_ids.includes(t.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            update(i, { topic_ids: b.topic_ids.includes(t.id) ? b.topic_ids.filter((x) => x !== t.id) : [...b.topic_ids, t.id] })
                          }
                        >
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Copy *</Label>
                    <Textarea value={b.copy_text} onChange={(e) => update(i, { copy_text: e.target.value })} rows={4} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Caption</Label>
                    <Textarea value={b.caption ?? ""} onChange={(e) => update(i, { caption: e.target.value || null })} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hashtag</Label>
                    <ChipsInput value={b.hashtags} onChange={(v) => update(i, { hashtags: v })} stripHash placeholder="Invio o virgola" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Note visuali</Label>
                    <Textarea value={b.visual_note ?? ""} onChange={(e) => update(i, { visual_note: e.target.value || null })} rows={2} />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={close}>Annulla</Button>
              <Button onClick={create} disabled={!valid || bulkCreate.isPending}>
                {bulkCreate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crea {briefs.length} brief
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
