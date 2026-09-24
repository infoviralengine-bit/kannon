import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOverrideClientPayment, useOverrideCreatorPayment, type FinancialMovement } from "@/hooks/useFinanceData";
import { useI18n } from "@/i18n";

export function OverrideDialog({ movement, onClose }: { movement: FinancialMovement | null; onClose: () => void }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const overrideClient = useOverrideClientPayment();
  const overrideCreator = useOverrideCreatorPayment();

  useEffect(() => {
    if (movement) {
      setAmount(String(movement.amount));
      setNotes(movement.notes ?? "");
    }
  }, [movement]);

  if (!movement) return null;

  const save = async () => {
    const newAmount = amount === "" ? null : Number(amount);
    if (movement.source === "client_payment") {
      await overrideClient.mutateAsync({ id: movement.id, amount_override: newAmount, notes_override: notes });
    } else if (movement.source === "creator_payment") {
      await overrideCreator.mutateAsync({ id: movement.id, amount_override: newAmount, notes_override: notes });
    }
    onClose();
  };

  const reset = async () => {
    if (movement.source === "client_payment") {
      await overrideClient.mutateAsync({ id: movement.id, amount_override: null, notes_override: null });
    } else if (movement.source === "creator_payment") {
      await overrideCreator.mutateAsync({ id: movement.id, amount_override: null, notes_override: null });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Correggi movimento")}</DialogTitle>
          <DialogDescription>
            {t("{desc}. L'importo originale calcolato dal sistema viene preservato: salvi un override.", { desc: movement.description })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="override-amount">{t("Importo effettivo (€)")}</Label>
            <Input id="override-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="override-notes">{t("Nota interna")}</Label>
            <Textarea id="override-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Es: cliente ha chiesto sconto 5%")} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {movement.has_override && <Button variant="ghost" onClick={reset}>{t("Rimuovi override")}</Button>}
          <Button variant="outline" onClick={onClose}>{t("Annulla")}</Button>
          <Button onClick={save}>{t("Salva")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}