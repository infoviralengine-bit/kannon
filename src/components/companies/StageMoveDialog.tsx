import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STAGE_LABEL, isoDateIn, type CompanyStage } from "@/lib/companies";
import { useUpdateCompanyStage, type Company } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

type Props = {
  company: Company | null;
  targetStage: CompanyStage | null;
  onClose: () => void;
};

/**
 * Conferma lo spostamento di stadio: chiede il prossimo passo (obbligatorio se la
 * lead resta attiva) oppure il motivo della perdita.
 */
export function StageMoveDialog({ company, targetStage, onClose }: Props) {
  const { t } = useI18n();
  const updateStage = useUpdateCompanyStage();
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState(isoDateIn(3));
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");

  useEffect(() => {
    if (!company) return;
    setNextStep(company.next_step ?? "");
    setNextStepDate(company.next_step_date ?? isoDateIn(3));
    setLostReason(company.lost_reason ?? "");
    setLostNote(company.lost_note ?? "");
  }, [company, targetStage]);

  const isLost = targetStage === "perso";
  const isWon = targetStage === "vinto";
  const canSave = isLost ? !!lostReason.trim() : isWon || !!nextStep.trim();

  const submit = () => {
    if (!company || !targetStage || !canSave) return;
    updateStage.mutate(
      isLost
        ? { id: company.id, stage: targetStage, lostReason: lostReason.trim(), lostNote: lostNote.trim() || undefined }
        : {
            id: company.id,
            stage: targetStage,
            nextStep: nextStep.trim() || null,
            nextStepDate: nextStep.trim() ? nextStepDate || null : null,
          },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!company && !!targetStage} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isLost ? t("Segna come persa") : t("Sposta in {stage}", { stage: targetStage ? t(STAGE_LABEL[targetStage]) : "" })}
          </DialogTitle>
        </DialogHeader>

        {isLost ? (
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("Motivo della perdita *")}</Label>
              <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                placeholder={t("Es. budget non disponibile")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Nota")}</Label>
              <Textarea rows={2} value={lostNote} onChange={(e) => setLostNote(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Se la riapri, riparte dallo stadio in cui si trovava. Il motivo resta nella cronologia.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>{t("Prossimo passo")} {isWon ? "" : "*"}</Label>
              <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)}
                placeholder={t("Es. inviare proposta")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Quando")}</Label>
              <Input type="date" value={nextStepDate} onChange={(e) => setNextStepDate(e.target.value)} />
            </div>
            {isWon && (
              <p className="text-xs text-muted-foreground">
                {t("Diventa cliente e parte la checklist di onboarding. Ricordati di creare la campagna.")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Annulla")}</Button>
          <Button variant={isLost ? "destructive" : "default"} onClick={submit}
            disabled={!canSave || updateStage.isPending}>
            {t("Conferma")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
