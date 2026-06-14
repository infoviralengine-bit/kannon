import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useRecurringExpenses, useDeleteRecurringExpense, useUpdateRecurringExpense, type RecurringExpense } from "@/hooks/useFinanceData";
import { formatCurrency } from "@/lib/format";
import { RecurringExpenseDialog } from "./RecurringExpenseDialog";

function nextDueDate(dueDay: number, startDate: string, endDate?: string | null): Date | null {
  const today = new Date();
  for (let offset = 0; offset <= 1; offset++) {
    const y = today.getFullYear();
    const m = today.getMonth() + offset;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(dueDay, lastDay);
    const candidate = new Date(y, m, day);
    if (candidate >= today && candidate >= new Date(startDate) && (!endDate || candidate <= new Date(endDate))) {
      return candidate;
    }
  }
  return null;
}

export function RecurringExpensesCard() {
  const { data, isLoading } = useRecurringExpenses();
  const update = useUpdateRecurringExpense();
  const del = useDeleteRecurringExpense();
  const [editing, setEditing] = useState<RecurringExpense | null | "new">(null);

  const activeTotal = (data ?? []).filter((r) => r.is_active).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Spese ricorrenti</CardTitle>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Giorno scadenza</TableHead>
                <TableHead>Prossima scadenza</TableHead>
                <TableHead>Attiva</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Caricamento...</TableCell></TableRow>}
              {!isLoading && (data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nessuna spesa ricorrente. Aggiungine una per iniziare.</TableCell></TableRow>}
              {data?.map((r) => {
                const next = nextDueDate(r.due_day, r.start_date, r.end_date);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.vendor && <div className="text-xs text-muted-foreground">{r.vendor}</div>}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{r.category.replace("_", " ")}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(r.amount))}</TableCell>
                    <TableCell>Giorno {r.due_day}</TableCell>
                    <TableCell>{next ? next.toLocaleDateString("it-IT") : "—"}</TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} onCheckedChange={(v) => update.mutate({ id: r.id, patch: { is_active: v } })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Eliminare "${r.name}"?`)) del.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data?.length ?? 0) > 0 && (
                <TableRow className="font-semibold bg-muted/30">
                  <TableCell colSpan={2}>Totale mensile attive</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(activeTotal)}</TableCell>
                  <TableCell colSpan={4}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing !== null && (
        <RecurringExpenseDialog
          expense={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}