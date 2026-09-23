import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_TYPES, TASK_TYPE_LABEL, formatDateIt, isOverdue, type TaskType } from "@/lib/companies";
import {
  useDeleteTask, useSaveTask, useToggleTask, useStaffProfiles, type CompanyTask,
} from "@/hooks/useCompanies";

const NONE = "__none__";

export function TasksTab({ companyId, tasks }: { companyId: string; tasks: CompanyTask[] }) {
  const saveTask = useSaveTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const { data: staff = [] } = useStaffProfiles();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("follow_up");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState(NONE);

  const submit = () => {
    if (!title.trim()) return;
    saveTask.mutate(
      {
        values: {
          company_id: companyId,
          title: title.trim(),
          task_type: type,
          due_date: dueDate || null,
          assignee_id: assignee === NONE ? null : assignee,
        },
      },
      { onSuccess: () => { setTitle(""); setDueDate(""); } },
    );
  };

  const open = tasks.filter((t) => !t.is_done);
  const done = tasks.filter((t) => t.is_done);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Nuova cosa da fare</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Titolo *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. richiamare Marco" />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{TASK_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Scadenza</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Assegnata a</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nessuno</SelectItem>
                {staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Senza nome"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-5 flex justify-end">
            <Button onClick={submit} disabled={!title.trim() || saveTask.isPending}>Aggiungi</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {open.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleTask.mutate} onDelete={deleteTask.mutate} />)}
        {!open.length && <p className="text-sm text-muted-foreground">Niente da fare al momento.</p>}
      </div>

      {done.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Completate</p>
          {done.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleTask.mutate} onDelete={deleteTask.mutate} />)}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, onToggle, onDelete,
}: {
  task: CompanyTask;
  onToggle: (v: { id: string; isDone: boolean; companyId: string | null }) => void;
  onDelete: (v: { id: string; companyId: string | null }) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <Checkbox checked={task.is_done}
        onCheckedChange={(v) => onToggle({ id: task.id, isDone: !!v, companyId: task.company_id })} />
      <div className="flex-1">
        <p className={cn("text-sm", task.is_done && "text-muted-foreground line-through")}>{task.title}</p>
        {task.task_type && (
          <p className="text-xs text-muted-foreground">{TASK_TYPE_LABEL[task.task_type as TaskType] ?? task.task_type}</p>
        )}
      </div>
      {task.due_date && (
        <span className={cn("flex items-center gap-1 text-xs",
          !task.is_done && isOverdue(task.due_date) ? "text-destructive" : "text-muted-foreground")}>
          <CalendarClock className="h-3 w-3" />{formatDateIt(task.due_date)}
        </span>
      )}
      <Button size="sm" variant="ghost" onClick={() => onDelete({ id: task.id, companyId: task.company_id })}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
