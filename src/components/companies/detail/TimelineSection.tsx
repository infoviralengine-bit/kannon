import { useMemo, useState } from "react";
import { ArrowRightLeft, CheckSquare, FileText, Mail, MessageSquare, Phone, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_DIRECTION_LABEL, ACTIVITY_TYPE_LABEL, STAGE_LABEL, formatDateTimeIt,
  type ActivityDirection, type ActivityType, type CompanyStage,
} from "@/lib/companies";
import type { CompanyActivity, CompanyDocument, CompanyTask } from "@/hooks/useCompanies";
import type { CompanyNote } from "@/hooks/useCompanyNotes";
import { useI18n } from "@/i18n";

type Kind = "call" | "email" | "messaggio" | "fase" | "file" | "task" | "nota";
type Item = { id: string; kind: Kind; date: string; title: string; label: string; detail?: string | null; direction?: string | null; author?: string };

const FILTERS: { key: Kind | "tutto"; label: string }[] = [
  { key: "tutto", label: "Tutto" }, { key: "call", label: "Call" }, { key: "email", label: "Email" },
  { key: "messaggio", label: "Messaggi" }, { key: "fase", label: "Cambi fase" }, { key: "file", label: "File" },
  { key: "task", label: "Task" }, { key: "nota", label: "Appunti" },
];

const ICON: Record<Kind, typeof Phone> = {
  call: Phone, email: Mail, messaggio: MessageSquare, fase: ArrowRightLeft, file: FileText, task: CheckSquare, nota: StickyNote,
};

function activityKind(t: string): Kind {
  if (t === "chiamata" || t === "incontro") return "call";
  if (t === "email") return "email";
  if (t === "cambio_stadio" || t === "sistema") return "fase";
  if (t === "nota") return "nota";
  return "messaggio";
}

function prettyStage(summary: string) {
  return summary.replace(/(\w+) -> (\w+)/, (_m, a, b) =>
    `${STAGE_LABEL[a as CompanyStage] ?? a} → ${STAGE_LABEL[b as CompanyStage] ?? b}`);
}

export function TimelineSection({ activities, documents, tasks, notes, authorName }: {
  activities: CompanyActivity[]; documents: CompanyDocument[]; tasks: CompanyTask[]; notes: CompanyNote[];
  authorName: (id: string | null) => string | undefined;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Kind | "tutto">("tutto");
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    activities.forEach((a) => {
      const kind = activityKind(a.type);
      const extra = [a.participants && t("Partecipanti: {value}", { value: a.participants }), a.outcome && t("Esito: {value}", { value: a.outcome }),
        a.objections && t("Obiezioni: {value}", { value: a.objections }), a.next_steps && t("Prossimi passi: {value}", { value: a.next_steps }), a.full_text]
        .filter(Boolean).join("\n");
      const text = a.summary ?? a.body ?? "";
      out.push({
        id: `a-${a.id}`, kind, date: a.occurred_at,
        title: a.type === "cambio_stadio" ? prettyStage(text) : text,
        label: t(ACTIVITY_TYPE_LABEL[a.type as ActivityType] ?? a.type),
        detail: extra || null, direction: a.direction, author: authorName(a.author_id),
      });
    });
    documents.forEach((d) => out.push({
      id: `d-${d.id}`, kind: "file", date: d.occurred_at, title: d.name,
      label: t(d.direction === "da_inviare" ? "File inviato" : "File ricevuto"),
    }));
    tasks.forEach((tk) => {
      if (!tk.is_done || !tk.done_at) return;
      out.push({
        id: `t-${tk.id}`, kind: "task", date: tk.done_at, title: tk.title,
        label: t("Task completato"), detail: tk.notes,
      });
    });
    notes.forEach((n) => out.push({
      id: `n-${n.id}`, kind: "nota", date: n.created_at, title: n.body.split("\n")[0].slice(0, 140),
      label: t("Appunto"), detail: n.body.length > 140 || n.body.includes("\n") ? n.body : null, author: authorName(n.author_id),
    }));
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, documents, tasks, notes, authorName]);

  const visible = filter === "tutto" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} type="button" size="sm" variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)} className="h-8 rounded-full px-3 text-xs">
            {t(f.label)}
          </Button>
        ))}
      </div>
      <ol className="relative ml-4 space-y-4 border-l border-border/60 pl-7">
        {visible.map((i) => {
          const Icon = ICON[i.kind];
          const isOpen = open === i.id;
          return (
            <li key={i.id}
              className="group relative rounded-md border border-border/50 bg-background/30 p-4 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.015] hover:border-accent/60 hover:bg-background hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none">
              <span className="absolute -left-[43px] top-4 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background transition-colors group-hover:border-accent group-hover:text-accent">
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">{i.label}</Badge>
                {i.direction && <span>{t(ACTIVITY_DIRECTION_LABEL[i.direction as ActivityDirection] ?? i.direction)}</span>}
                <span>{formatDateTimeIt(i.date)}</span>
                {i.author && <span>· {i.author}</span>}
              </div>
              <p className="mt-2 text-base leading-relaxed">{i.title}</p>
              {i.detail && (
                <>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs text-accent"
                    onClick={() => setOpen(isOpen ? null : i.id)}>
                    {isOpen ? t("Nascondi") : t("Mostra dettagli")}
                  </Button>
                  {isOpen && <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{i.detail}</p>}
                </>
              )}
            </li>
          );
        })}
        {!visible.length && <p className="text-sm text-muted-foreground">{t("Nessun evento.")}</p>}
      </ol>
    </div>
  );
}
