import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { ChipsInput, addDays, toISODate } from "./_helpers";
import {
  useCreateBrief,
  useUpdateBrief,
  type Brief,
  type BriefInput,
  type BriefReferenceLink,
} from "@/hooks/useContentCalendar";
import {
  useVideoFormats,
  useContentTopics,
  useCreateTopic,
} from "@/hooks/useContentCatalog";

const REFERENCE_TYPES = [
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "video_audio", label: "Video + Audio" },
  { value: "format_audio", label: "Format + Audio" },
  { value: "format", label: "Format" },
];

type FormState = {
  planned_publish_date: string;
  reference_type: string;
  reference_links: BriefReferenceLink[];
  title: string;
  copy_text: string;
  caption: string;
  hashtags: string[];
  visual_note: string;
  format_id: string;
  topic_ids: string[];
  audio_id: string;
  expected_caption_keywords: string[];
  threshold_views_override: string;
  threshold_engagement_override: string;
};

function emptyState(): FormState {
  return {
    planned_publish_date: toISODate(addDays(new Date(), 7)),
    reference_type: "video_audio",
    reference_links: [],
    title: "",
    copy_text: "",
    caption: "",
    hashtags: [],
    visual_note: "",
    format_id: "",
    topic_ids: [],
    audio_id: "",
    expected_caption_keywords: [],
    threshold_views_override: "",
    threshold_engagement_override: "",
  };
}

function fromBrief(b: Brief): FormState {
  return {
    planned_publish_date: b.planned_publish_date,
    reference_type: b.reference_type,
    reference_links: b.reference_links ?? [],
    title: b.title ?? "",
    copy_text: b.copy_text ?? "",
    caption: b.caption ?? "",
    hashtags: b.hashtags ?? [],
    visual_note: b.visual_note ?? "",
    format_id: b.format_id ?? "",
    topic_ids: b.topic_ids ?? [],
    audio_id: b.audio_id ?? "",
    expected_caption_keywords: b.expected_caption_keywords ?? [],
    threshold_views_override: b.threshold_views_override != null ? String(b.threshold_views_override) : "",
    threshold_engagement_override:
      b.threshold_engagement_override != null ? String(b.threshold_engagement_override) : "",
  };
}

function fromTemplate(t: Partial<BriefInput>): FormState {
  const base = emptyState();
  return {
    ...base,
    reference_type: t.reference_type ?? base.reference_type,
    title: t.title ?? "",
    copy_text: t.copy_text ?? "",
    caption: t.caption ?? "",
    hashtags: t.hashtags ?? [],
    visual_note: t.visual_note ?? "",
    format_id: t.format_id ?? "",
    topic_ids: t.topic_ids ?? [],
  };
}

export function BriefFormDialog({
  open,
  onOpenChange,
  campaignId,
  brief,
  template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  brief?: Brief | null;
  template?: Partial<BriefInput> | null;
}) {
  const isEdit = !!brief;
  const [state, setState] = useState<FormState>(emptyState());
  const { data: formats } = useVideoFormats();
  const { data: topics } = useContentTopics();
  const createTopic = useCreateTopic();
  const createBrief = useCreateBrief();
  const updateBrief = useUpdateBrief();
  const [newLink, setNewLink] = useState<BriefReferenceLink>({ label: "", url: "" });

  useEffect(() => {
    if (!open) return;
    if (brief) setState(fromBrief(brief));
    else if (template) setState(fromTemplate(template));
    else setState(emptyState());
  }, [open, brief, template]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const buildInput = (status: "draft" | "in_review"): BriefInput | null => {
    if (!state.copy_text.trim()) {
      toast({ title: "Copy mancante", description: "Il testo da dire è obbligatorio.", variant: "destructive" });
      return null;
    }
    return {
      campaign_id: campaignId,
      planned_publish_date: state.planned_publish_date,
      reference_type: state.reference_type,
      reference_links: state.reference_links,
      audio_id: state.audio_id.trim() || null,
      expected_caption_keywords: state.expected_caption_keywords.length ? state.expected_caption_keywords : null,
      format_id: state.format_id || null,
      title: state.title.trim() || null,
      copy_text: state.copy_text.trim(),
      caption: state.caption.trim() || null,
      hashtags: state.hashtags.length ? state.hashtags : null,
      visual_note: state.visual_note.trim() || null,
      threshold_views_override: state.threshold_views_override ? Number(state.threshold_views_override) : null,
      threshold_engagement_override: state.threshold_engagement_override
        ? Number(state.threshold_engagement_override)
        : null,
      status,
      topic_ids: state.topic_ids,
    };
  };

  const save = async (status: "draft" | "in_review", keepOpen = false) => {
    const input = buildInput(status);
    if (!input) return;
    try {
      if (isEdit && brief) {
        await updateBrief.mutateAsync({ id: brief.id, input });
        toast({ title: "Brief aggiornato" });
      } else {
        await createBrief.mutateAsync(input);
        toast({ title: status === "in_review" ? "Brief caricato" : "Brief salvato come bozza" });
      }
      if (keepOpen) setState(emptyState());
      else onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const addLink = () => {
    if (!newLink.url.trim()) return;
    if (!newLink.url.includes("tiktok.com")) {
      toast({ title: "URL non valido", description: "Inserisci un link TikTok.", variant: "destructive" });
      return;
    }
    set("reference_links", [...state.reference_links, { label: newLink.label.trim() || "Link", url: newLink.url.trim() }]);
    setNewLink({ label: "", url: "" });
  };

  const toggleTopic = (id: string) =>
    set("topic_ids", state.topic_ids.includes(id) ? state.topic_ids.filter((t) => t !== id) : [...state.topic_ids, id]);

  const onCreateTopic = async (name: string) => {
    try {
      const created = await createTopic.mutateAsync(name);
      if (created?.id) toggleTopic(created.id);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const busy = createBrief.isPending || updateBrief.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica brief" : "Nuovo brief"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data prevista</Label>
              <Input
                type="date"
                value={state.planned_publish_date}
                onChange={(e) => set("planned_publish_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo riferimento</Label>
              <Select value={state.reference_type} onValueChange={(v) => set("reference_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REFERENCE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link di riferimento</Label>
            <div className="flex flex-wrap gap-1.5">
              {state.reference_links.map((l, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {l.label}
                  <button type="button" onClick={() => set("reference_links", state.reference_links.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Etichetta" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} className="w-32" />
              <Input placeholder="https://www.tiktok.com/..." value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={addLink}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Titolo</Label>
            <Input value={state.title} onChange={(e) => set("title", e.target.value)} placeholder="es. POV: apri l'app" />
          </div>

          <div className="space-y-1.5">
            <Label>Copy (testo da dire) *</Label>
            <Textarea value={state.copy_text} onChange={(e) => set("copy_text", e.target.value)} rows={5} />
          </div>

          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Textarea value={state.caption} onChange={(e) => set("caption", e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtag</Label>
            <ChipsInput value={state.hashtags} onChange={(v) => set("hashtags", v)} placeholder="Invio o virgola per aggiungere" stripHash />
          </div>

          <div className="space-y-1.5">
            <Label>Note visuali</Label>
            <Textarea value={state.visual_note} onChange={(e) => set("visual_note", e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={state.format_id || "__none__"} onValueChange={(v) => set("format_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuno</SelectItem>
                  {(formats ?? []).filter((f) => f.is_active).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Audio ID (opzionale)</Label>
              <Input value={state.audio_id} onChange={(e) => set("audio_id", e.target.value)} placeholder="musicId TikTok" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Topic</Label>
            <div className="flex flex-wrap gap-1.5">
              {(topics ?? []).filter((t) => t.is_active).map((t) => (
                <Badge
                  key={t.id}
                  variant={state.topic_ids.includes(t.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTopic(t.id)}
                >
                  {t.name}
                </Badge>
              ))}
            </div>
            <InlineTopicCreator onCreate={onCreateTopic} />
          </div>

          <div className="space-y-1.5">
            <Label>Keyword caption attese (per il matching)</Label>
            <ChipsInput value={state.expected_caption_keywords} onChange={(v) => set("expected_caption_keywords", v)} placeholder="Invio o virgola per aggiungere" />
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="thresholds">
              <AccordionTrigger className="text-sm">Soglie performance (override)</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label>Soglia views</Label>
                    <Input type="number" value={state.threshold_views_override} onChange={(e) => set("threshold_views_override", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Soglia engagement %</Label>
                    <Input type="number" step="0.1" value={state.threshold_engagement_override} onChange={(e) => set("threshold_engagement_override", e.target.value)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button variant="outline" onClick={() => save("draft")} disabled={busy}>Salva come bozza</Button>
          {!isEdit && (
            <Button variant="outline" onClick={() => save("draft", true)} disabled={busy}>Salva e aggiungi un altro</Button>
          )}
          <Button onClick={() => save("in_review")} disabled={busy}>Salva e carica</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineTopicCreator({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex gap-2 pt-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Crea nuovo topic"
        className="h-8"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            e.preventDefault();
            onCreate(name.trim());
            setName("");
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (name.trim()) {
            onCreate(name.trim());
            setName("");
          }
        }}
      >
        Aggiungi
      </Button>
    </div>
  );
}
