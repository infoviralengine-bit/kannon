import { useMemo, useState } from "react";
import { ArrowRightLeft, CheckSquare, FileText, Mail, MessageSquare, Phone, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      id: `d-${d.id}`, kind: "file", date: d.created_at, title: d.name,
      label: t(d.direction === "da_inviare" ? "File inviato" : "File ricevuto"),
    }));
    tasks.filter((tk) => tk.is_done && tk.done_at).forEach((tk) => out.push({
      id: `t-${tk.id}`, kind: "task", date: tk.done_at!, title: tk.title, label: t("Task completato"), detail: tk.notes,
    }));
    notes.forEach((n) => out.push({
      id: `n-${n.id}`, kind: "nota", date: n.created_at, title: n.body.split("\n")[0].slice(0, 140),
      label: t("Appunto"), detail: n.body.length > 140 || n.body.includes("\n") ? n.body : null, author: authorName(n.author_id),
    }));
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, documents, tasks, notes, authorName]);

  const visible = filter === "tutto" ? items : items.filter((i) => i.kind === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("rounded-full border px-2.5 py-1 text-xs",
              filter === f.key ? "border-foreground bg-foreground text-background" : "border-border/60 hover:border-accent hover:text-accent")}>
            {t(f.label)}
          </button>
        ))}
      </div>
      <ol className="relative ml-3 space-y-3 border-l border-border/60 pl-5">
        {visible.map((i) => {
          const Icon = ICON[i.kind];
          const isOpen = open === i.id;
          return (
            <li key={i.id} className="relative">
              <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{i.label}</Badge>
                {i.direction && <span>{t(ACTIVITY_DIRECTION_LABEL[i.direction as ActivityDirection] ?? i.direction)}</span>}
                <span>{formatDateTimeIt(i.date)}</span>
                {i.author && <span>· {i.author}</span>}
              </div>
              <p className="mt-1 text-sm">{i.title}</p>
              {i.detail && (
                <>
                  <button className="text-xs text-accent" onClick={() => setOpen(isOpen ? null : i.id)}>
                    {isOpen ? t("Nascondi") : t("Mostra dettagli")}
                  </button>
                  {isOpen && <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{i.detail}</p>}
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
