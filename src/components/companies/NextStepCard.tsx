import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPE_LABEL, MANUAL_ACTIVITY_TYPES, formatDateIt, isOverdue, isoDateIn,
} from "@/lib/companies";
import { useCompleteNextStep, type Company } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

export function NextStepCard({ company }: { company: Company }) {
  const { t } = useI18n();
  const complete = useCompleteNextStep();
  const [open, setOpen] = useState(false);
  const [doneSummary, setDoneSummary] = useState("");
  const [activityType, setActivityType] = useState("nota");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState(isoDateIn(3));

  const openDialog = () => {
    setDoneSummary(company.next_step ?? "");
    setActivityType("nota");
    setNextStep("");
    setNextStepDate(isoDateIn(3));
    setOpen(true);
  };

  const submit = () => {
    if (!doneSummary.trim()) return;
    complete.mutate(
      {
        companyId: company.id,
        doneSummary: doneSummary.trim(),
        activityType,
        nextStep: nextStep.trim() || null,
        nextStepDate: nextStep.trim() ? nextStepDate || null : null,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  const overdue = isOverdue(company.next_step_date);

  return (
    <>
      <Card className={cn(overdue && "border-destructive/50")}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-[200px]">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Prossimo passo")}</p>
            {company.next_step ? (
              <>
                <p className="mt-1 text-sm font-medium">{company.next_step}</p>
                <p className={cn("mt-1 flex items-center gap-1 text-xs",
                  overdue ? "text-destructive" : "text-muted-foreground")}>
                  <CalendarClock className="h-3 w-3" />
                  {company.next_step_date ? formatDateIt(company.next_step_date) : t("senza data")}
                  {overdue && t(" · scaduto")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{t("Nessun passo impostato.")}</p>
            )}
          </div>
          <Button onClick={openDialog}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("Fatto, qual è il prossimo?")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Cosa è successo")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("Tipo")}</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_ACTIVITY_TYPES.map((at) => (
                    <SelectItem key={at} value={at}>{t(ACTIVITY_TYPE_LABEL[at])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Riassunto *")}</Label>
              <Textarea rows={2} value={doneSummary} onChange={(e) => setDoneSummary(e.target.value)}
                placeholder={t("Es. call fatta, interessati alla proposta")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>{t("Prossimo passo")}</Label>
                <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)}
                  placeholder={t("Es. inviare proposta")} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("Quando")}</Label>
                <Input type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("Annulla")}</Button>
            <Button onClick={submit} disabled={!doneSummary.trim() || complete.isPending}>{t("Salva")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
