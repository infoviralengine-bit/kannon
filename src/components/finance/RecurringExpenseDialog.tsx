import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRecurringExpense, useUpdateRecurringExpense, type RecurringExpense, type RecurringExpenseCategory } from "@/hooks/useFinanceData";
import { useI18n } from "@/i18n";

const CATEGORIES: { value: RecurringExpenseCategory; label: string }[] = [
  { value: "rent", label: "Affitto" },
  { value: "software", label: "Software" },
  { value: "tool", label: "Tool" },
  { value: "salary_fixed", label: "Stipendio fisso" },
  { value: "operator_pay", label: "Operator" },
  { value: "creator_pay", label: "Creator" },
  { value: "other", label: "Altro" },
];

export function RecurringExpenseDialog({ expense, onClose }: { expense: RecurringExpense | null; onClose: () => void }) {
  const { t } = useI18n();
  const create = useCreateRecurringExpense();
  const update = useUpdateRecurringExpense();
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "software" as RecurringExpenseCategory,
    due_day: 1,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    is_active: true,
    vendor: "",
    notes: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        amount: String(expense.amount),
        category: expense.category,
        due_day: expense.due_day,
        start_date: expense.start_date,
        end_date: expense.end_date ?? "",
        is_active: expense.is_active,
        vendor: expense.vendor ?? "",
        notes: expense.notes ?? "",
      });
    }
  }, [expense]);

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      amount: Number(form.amount),
      category: form.category,
      due_day: form.due_day,
      start_date: form.start_date,
      end_date: form.end_date || null,
      is_active: form.is_active,
      vendor: form.vendor || null,
      notes: form.notes || null,
    };
    if (expense) await update.mutateAsync({ id: expense.id, patch: payload });
    else await create.mutateAsync(payload);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? t("Modifica spesa ricorrente") : t("Nuova spesa ricorrente")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("Nome *")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("Affitto ufficio")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("Importo (€) *")}</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>{t("Categoria *")}</Label>
              <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{t(c.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t("Giorno *")}</Label>
              <Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("Dal")}</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>{t("Al (opz.)")}</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>{t("Fornitore (opzionale)")}</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder={t("Notion, AWS, Locatore...")} />
          </div>
          <div>
            <Label>{t("Note")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("Attiva")}</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Annulla")}</Button>
          <Button onClick={save} disabled={!form.name || !form.amount}>{t("Salva")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}