import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Check, ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useAgendaTasks, useCompanies, useSaveTask, useStaffProfiles, useToggleTask } from "@/hooks/useCompanies";
import { isOverdue, type TaskType } from "@/lib/companies";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

const ALL = "__all__";
const NONE = "__none__";

const TASK_LABEL: Record<string, string> = {
  chiamata: "Call",
  email: "Email",
  follow_up: "Follow-up",
  documento: "Documento",
  altro: "Attività",
};

export default function AgendaPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tasks = [] } = useAgendaTasks();
  const { data: staff = [] } = useStaffProfiles();
  const { data: companies = [] } = useCompanies();
  const toggleTask = useToggleTask();
  const saveTask = useSaveTask();

  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assignee, setAssignee] = useState<string>(user?.id ?? ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [dueTime, setDueTime] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("follow_up");
  const [companyId, setCompanyId] = useState(NONE);

  const scoped = useMemo(
    () => tasks.filter((task) => assignee === ALL || task.assignee_id === assignee || (assignee === user?.id && !task.assignee_id)),
    [tasks, assignee],
  );

  const calendarDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: first, end: last });
  }, [month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof scoped>();
    scoped.forEach((task) => {
      if (!task.due_date) return;
      const current = map.get(task.due_date) ?? [];
      current.push(task);
      map.set(task.due_date, current);
    });
    map.forEach((items) => items.sort((a, b) => (a.due_time ?? "23:59").localeCompare(b.due_time ?? "23:59")));
    return map;
  }, [scoped]);

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedTasks = tasksByDate.get(selectedKey) ?? [];
  const withoutDate = scoped.filter((task) => !task.due_date);

  const openNewTask = (date = selectedDate) => {
    setDueDate(date);
    setSelectedDate(date);
    setFormOpen(true);
  };

  const submit = () => {
    if (!title.trim()) return;
    saveTask.mutate(
      {
        values: {
          title: title.trim(),
          task_type: taskType,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          due_time: dueTime || null,
          company_id: companyId === NONE ? null : companyId,
          assignee_id: user?.id ?? null,
        },
      },
      {
        onSuccess: () => {
          setTitle("");
          setDueTime("");
          setFormOpen(false);
        },
      },
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("Agenda")}</h1>
          <p className="text-sm text-muted-foreground">{t("Tutte le azioni commerciali, organizzate per giorno.")}</p>
        </div>
        <div className="flex gap-2">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {user?.id && <SelectItem value={user.id}>{t("Le mie attività")}</SelectItem>}
              <SelectItem value={ALL}>{t("Tutto il team")}</SelectItem>
              {staff.filter((person) => person.id !== user?.id).map((person) => (
                <SelectItem key={person.id} value={person.id}>{person.full_name ?? t("Senza nome")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => openNewTask()}><Plus className="mr-2 h-4 w-4" /> {t("Nuova attività")}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t("Mese precedente")} onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("Mese successivo")} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="ml-2" onClick={() => { setMonth(startOfMonth(new Date())); setSelectedDate(new Date()); }}>
            {t("Oggi")}
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize">{format(month, "MMMM yyyy", { locale: it })}</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />{t("Scaduta")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />{t("Pianificata")}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(760px,1fr)_280px]">
        <div className="min-w-0 overflow-x-auto border bg-card">
          <div className="grid min-w-[760px] grid-cols-7 border-b bg-muted/40">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
              <div key={day} className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">{t(day)}</div>
            ))}
          </div>
          <div className="grid min-w-[760px] grid-cols-7">
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDate.get(key) ?? [];
              const selected = isSameDay(day, selectedDate);
              const today = isSameDay(day, new Date());
              return (
                <div
                  key={key}
                  className={cn(
                    "group min-h-[126px] border-b border-r p-2 transition-colors hover:bg-muted/30",
                    !isSameMonth(day, month) && "bg-muted/20 text-muted-foreground",
                    selected && "bg-accent/50",
                  )}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => openNewTask(day)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                        today && "bg-primary text-primary-foreground",
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      {format(day, "d")}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      aria-label={t("Aggiungi attività il {date}", { date: format(day, "d MMMM", { locale: it }) })}
                      onClick={(event) => { event.stopPropagation(); openNewTask(day); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={cn(
                          "block w-full truncate border-l-2 bg-muted px-2 py-1 text-left text-[11px] hover:bg-accent",
                          isOverdue(task.due_date) ? "border-destructive" : "border-primary",
                        )}
                        title={task.title}
                        onClick={(event) => { event.stopPropagation(); setSelectedDate(day); }}
                      >
                        {task.due_time ? task.due_time.slice(0, 5) : ""} {task.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && <p className="px-2 text-[10px] text-muted-foreground">{t("+{n} altre", { n: dayTasks.length - 3 })}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("Dettaglio giorno")}</p>
              <h3 className="mt-1 font-semibold capitalize">{format(selectedDate, "EEEE d MMMM", { locale: it })}</h3>
            </div>
            <Button size="icon" variant="outline" aria-label={t("Aggiungi attività")} onClick={() => openNewTask(selectedDate)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {selectedTasks.map((task) => {
              const company = task.companies;
              return (
                <div key={task.id} className="border-l-2 border-primary bg-muted/50 p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      className="mt-0.5"
                      checked={task.is_done}
                      onCheckedChange={(checked) => toggleTask.mutate({ id: task.id, isDone: !!checked, companyId: task.company_id })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{t(TASK_LABEL[task.task_type ?? "altro"] ?? "Attività")}</span>
                        {task.due_time && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{task.due_time.slice(0, 5)}</span>}
                      </div>
                      {company && (
                        <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={() => navigate(`/dashboard/clients/${company.id}`)}>
                          {company.name}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!selectedTasks.length && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <CalendarIcon className="mx-auto mb-2 h-5 w-5" />
                {t("Nessuna attività pianificata.")}
              </div>
            )}
          </div>
          {withoutDate.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{t("Da pianificare ({n})", { n: withoutDate.length })}</p>
              {withoutDate.slice(0, 4).map((task) => <p key={task.id} className="truncate py-1 text-xs">{task.title}</p>)}
            </div>
          )}
        </aside>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("Nuova attività")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t("Titolo *")}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("Es. Follow-up proposta")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("Tipo")}</Label>
                <Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{t(label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Orario")}</Label>
                <Input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Data")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "d MMMM yyyy", { locale: it }) : t("Seleziona una data")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto p-3" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Azienda")}</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder={t("Nessuna")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("Nessuna")}</SelectItem>
                  {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("Annulla")}</Button>
            <Button onClick={submit} disabled={!title.trim() || saveTask.isPending}>
              <Check className="mr-2 h-4 w-4" /> {t("Salva")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}