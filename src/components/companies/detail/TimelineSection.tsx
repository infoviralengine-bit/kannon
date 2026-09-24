import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, CheckSquare, FileText, GripVertical, Mail, MessageSquare, Phone, StickyNote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ACTIVITY_DIRECTION_LABEL, ACTIVITY_TYPE_LABEL, STAGE_LABEL, formatDateTimeIt,
  type ActivityDirection, type ActivityType, type CompanyStage,
} from "@/lib/companies";
import type { CompanyActivity, CompanyDocument, CompanyTask } from "@/hooks/useCompanies";
import type { CompanyNote } from "@/hooks/useCompanyNotes";
import {
  useDeleteTimelineItem,
  useSaveTimelineOrder,
  useTimelineOrder,
  type TimelineItemType,
} from "@/hooks/useCompanyTimeline";
import { useI18n } from "@/i18n";

type Kind = "call" | "email" | "messaggio" | "fase" | "file" | "task" | "nota";
type Item = {
  id: string;
  sourceId: string;
  itemType: TimelineItemType;
  kind: Kind;
  date: string;
  title: string;
  label: string;
  detail?: string | null;
  direction?: string | null;
  author?: string;
  storagePath?: string | null;
};

const FILTERS: { key: Kind | "tutto"; label: string }[] = [
  { key: "tutto", label: "Tutto" }, { key: "call", label: "Call" }, { key: "email", label: "Email" },
  { key: "messaggio", label: "Messaggi" }, { key: "fase", label: "Cambi fase" }, { key: "file", label: "File" },
  { key: "task", label: "Task" }, { key: "nota", label: "Appunti" },
];

const ICON: Record<Kind, typeof Phone> = {
  call: Phone, email: Mail, messaggio: MessageSquare, fase: ArrowRightLeft, file: FileText, task: CheckSquare, nota: StickyNote,
};

function activityKind(type: string): Kind {
  if (type === "chiamata" || type === "incontro") return "call";
  if (type === "email") return "email";
  if (type === "cambio_stadio" || type === "sistema") return "fase";
  if (type === "nota") return "nota";
  return "messaggio";
}

function prettyStage(summary: string) {
  return summary.replace(/(\w+) -> (\w+)/, (_match, from, to) =>
    `${STAGE_LABEL[from as CompanyStage] ?? from} → ${STAGE_LABEL[to as CompanyStage] ?? to}`);
}

function SortableTimelineItem({ item, canDrag, isOpen, onToggle, onDelete }: {
  item: Item;
  canDrag: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !canDrag,
  });
  const Icon = ICON[item.kind];

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative rounded-md border border-border/50 bg-background/30 p-4 transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:z-10 hover:scale-[1.015] hover:border-accent/60 hover:bg-background hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none ${isDragging ? "z-20 opacity-80 shadow-xl" : ""}`}>
      <span className="absolute -left-[43px] top-4 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background transition-colors group-hover:border-accent group-hover:text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex items-start gap-2">
        {canDrag && (
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            aria-label={t("Trascina per riordinare")} {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">{item.label}</Badge>
            {item.direction && <span>{t(ACTIVITY_DIRECTION_LABEL[item.direction as ActivityDirection] ?? item.direction)}</span>}
            <span>{formatDateTimeIt(item.date)}</span>
            {item.author && <span>· {item.author}</span>}
          </div>
          <p className="mt-2 text-base leading-relaxed">{item.title}</p>
          {item.detail && (
            <>
              <Button type="button" variant="link" className="h-auto p-0 text-xs text-accent" onClick={onToggle}>
                {isOpen ? t("Nascondi") : t("Mostra dettagli")}
              </Button>
              {isOpen && <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{item.detail}</p>}
            </>
          )}
        </div>
        <Button type="button" size="icon" variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t("Elimina dalla cronologia")} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

export function TimelineSection({ companyId, activities, documents, tasks, notes, authorName }: {
  companyId: string;
  activities: CompanyActivity[];
  documents: CompanyDocument[];
  tasks: CompanyTask[];
  notes: CompanyNote[];
  authorName: (id: string | null) => string | undefined;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Kind | "tutto">("tutto");
  const [open, setOpen] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const { data: savedOrder = [] } = useTimelineOrder(companyId);
  const saveOrder = useSaveTimelineOrder();
  const deleteItem = useDeleteTimelineItem();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const chronologicalItems = useMemo<Item[]>(() => {
    const out: Item[] = [];
    activities.forEach((activity) => {
      const kind = activityKind(activity.type);
      const detail = [
        activity.participants && t("Partecipanti: {value}", { value: activity.participants }),
        activity.outcome && t("Esito: {value}", { value: activity.outcome }),
        activity.objections && t("Obiezioni: {value}", { value: activity.objections }),
        activity.next_steps && t("Prossimi passi: {value}", { value: activity.next_steps }),
        activity.full_text,
      ].filter(Boolean).join("\n");
      const text = activity.summary ?? activity.body ?? "";
      out.push({
        id: `activity-${activity.id}`, sourceId: activity.id, itemType: "activity", kind, date: activity.occurred_at,
        title: activity.type === "cambio_stadio" ? prettyStage(text) : text,
        label: t(ACTIVITY_TYPE_LABEL[activity.type as ActivityType] ?? activity.type),
        detail: detail || null, direction: activity.direction, author: authorName(activity.author_id),
      });
    });
    documents.forEach((document) => out.push({
      id: `document-${document.id}`, sourceId: document.id, itemType: "document", kind: "file", date: document.occurred_at,
      title: document.name, label: t(document.direction === "da_inviare" ? "File inviato" : "File ricevuto"),
      storagePath: document.storage_path,
    }));
    tasks.forEach((task) => {
      if (!task.is_done || !task.done_at) return;
      out.push({
        id: `task-${task.id}`, sourceId: task.id, itemType: "task", kind: "task", date: task.done_at,
        title: task.title, label: t("Task completato"), detail: task.notes,
      });
    });
    notes.forEach((note) => out.push({
      id: `note-${note.id}`, sourceId: note.id, itemType: "note", kind: "nota", date: note.created_at,
      title: note.body.split("\n")[0].slice(0, 140), label: t("Appunto"),
      detail: note.body.length > 140 || note.body.includes("\n") ? note.body : null, author: authorName(note.author_id),
    }));
    return out.sort((first, second) => second.date.localeCompare(first.date));
  }, [activities, documents, tasks, notes, authorName, t]);

  const savedOrderKey = savedOrder.map((row) => `${row.item_type}-${row.item_id}:${row.position}`).join("|");
  const chronologicalKey = chronologicalItems.map((item) => item.id).join("|");

  useEffect(() => {
    const currentIds = new Set(chronologicalItems.map((item) => item.id));
    const persisted = savedOrder
      .slice()
      .sort((first, second) => first.position - second.position)
      .map((row) => `${row.item_type}-${row.item_id}`)
      .filter((id) => currentIds.has(id));
    const persistedSet = new Set(persisted);
    const unseen = chronologicalItems.filter((item) => !persistedSet.has(item.id)).map((item) => item.id);
    setOrderedIds([...unseen, ...persisted]);
  }, [savedOrderKey, chronologicalKey]);

  const itemById = useMemo(() => new Map(chronologicalItems.map((item) => [item.id, item])), [chronologicalItems]);
  const orderedItems = orderedIds.map((id) => itemById.get(id)).filter((item): item is Item => Boolean(item));
  const visible = filter === "tutto" ? orderedItems : orderedItems.filter((item) => item.kind === filter);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(nextIds);
    const nextItems = nextIds.map((id) => itemById.get(id)).filter((item): item is Item => Boolean(item));
    saveOrder.mutate({
      companyId,
      items: nextItems.map((item) => ({ itemType: item.itemType, itemId: item.sourceId })),
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteItem.mutate({
      companyId,
      itemType: pendingDelete.itemType,
      itemId: pendingDelete.sourceId,
      storagePath: pendingDelete.storagePath,
    }, { onSuccess: () => setPendingDelete(null) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button key={item.key} type="button" size="sm" variant={filter === item.key ? "default" : "outline"}
            onClick={() => setFilter(item.key)} className="h-8 rounded-full px-3 text-xs">
            {t(item.label)}
          </Button>
        ))}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ol className="relative ml-4 space-y-4 border-l border-border/60 pl-7">
            {visible.map((item) => (
              <SortableTimelineItem key={item.id} item={item} canDrag={filter === "tutto"}
                isOpen={open === item.id} onToggle={() => setOpen(open === item.id ? null : item.id)}
                onDelete={() => setPendingDelete(item)} />
            ))}
            {!visible.length && <p className="text-sm text-muted-foreground">{t("Nessun evento.")}</p>}
          </ol>
        </SortableContext>
      </DndContext>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(isOpen) => { if (!isOpen) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Eliminare questo elemento?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("L’elemento verrà eliminato definitivamente dalla cronologia e dalla relativa sezione.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annulla")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteItem.isPending} onClick={confirmDelete}>
              {t("Elimina")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}