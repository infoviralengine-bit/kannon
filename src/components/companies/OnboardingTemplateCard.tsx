import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import {
  useDeleteTemplateStep, useOnboardingTemplate, useSaveTemplateStep,
} from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

/** Modello della checklist di onboarding cliente, modificabile dall'admin. */
export function OnboardingTemplateCard() {
  const { t } = useI18n();
  const { data: steps = [] } = useOnboardingTemplate();
  const saveStep = useSaveTemplateStep();
  const deleteStep = useDeleteTemplateStep();
  const [title, setTitle] = useState("");
  const [dueDays, setDueDays] = useState("7");

  const add = () => {
    if (!title.trim()) return;
    saveStep.mutate(
      {
        values: {
          title: title.trim(),
          due_days: Number(dueDays) || 0,
          position: (steps.at(-1)?.position ?? 0) + 1,
          is_active: true,
        },
      },
      { onSuccess: () => { setTitle(""); setDueDays("7"); } },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("Modello di onboarding")}</CardTitle>
        <CardDescription>
          {t("I passaggi che vengono creati quando una trattativa viene vinta. Le modifiche valgono solo per i clienti nuovi.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
            <Input className="min-w-[180px] flex-1" defaultValue={s.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.title) saveStep.mutate({ id: s.id, values: { title: v } });
              }} />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t("Entro giorni")}</Label>
              <Input type="number" className="w-20" defaultValue={s.due_days}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== s.due_days) saveStep.mutate({ id: s.id, values: { due_days: v } });
                }} />
            </div>
            <Switch checked={s.is_active}
              onCheckedChange={(v) => saveStep.mutate({ id: s.id, values: { is_active: v } })} />
            <Button size="sm" variant="ghost" onClick={() => deleteStep.mutate(s.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-end gap-2 pt-2">
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label>{t("Nuovo passaggio")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Es. kickoff call fatta")} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Entro giorni")}</Label>
            <Input type="number" className="w-24" value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
          </div>
          <Button onClick={add} disabled={!title.trim() || saveStep.isPending}>
            <Plus className="mr-1 h-4 w-4" /> {t("Aggiungi")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
