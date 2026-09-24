import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTimeIt } from "@/lib/companies";
import { useAddCallNote } from "@/hooks/useCompanyNotes";
import type { CompanyActivity } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

const OUTCOMES = ["Positiva", "Da ricontattare", "Serve proposta", "Non interessati"];

export function CallNotesSection({ companyId, activities, formOpen, setFormOpen, onUpdateNextStep, authorName }: {
  companyId: string; activities: CompanyActivity[]; formOpen: boolean; setFormOpen: (v: boolean) => void;
  onUpdateNextStep: (text: string) => void; authorName: (id: string | null) => string | undefined;
}) {
  const { t } = useI18n();
  const add = useAddCallNote();
  const [type, setType] = useState("chiamata");
  const [when, setWhen] = useState("");
  const [summary, setSummary] = useState("");
  const [participants, setParticipants] = useState("");
  const [outcome, setOutcome] = useState("");
  const [points, setPoints] = useState("");
  const [objections, setObjections] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const calls = activities.filter((a) => a.type === "chiamata" || a.type === "incontro");

  const submit = () => {
    if (!summary.trim()) return;
    add.mutate({
      companyId, type, summary: summary.trim(),
      occurredAt: when ? new Date(when).toISOString() : null,
      participants: participants.trim() || null, outcome: outcome || null,
      objections: objections.trim() || null, nextSteps: nextSteps.trim() || null,
      fullText: points.trim() || null,
    }, {
      onSuccess: () => {
        const ns = nextSteps.trim();
        setSummary(""); setParticipants(""); setOutcome(""); setPoints(""); setObjections(""); setNextSteps(""); setWhen("");
        setFormOpen(false);
        if (ns) onUpdateNextStep(ns);
      },
    });
  };

  return (
    <div className="space-y-3">
      {formOpen && (
        <div className="grid gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>{t("Tipo")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chiamata">{t("Call")}</SelectItem>
                  <SelectItem value="incontro">{t("Incontro")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Quando")}</Label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Esito")}</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue placeholder={t("Seleziona")} /></SelectTrigger>
                <SelectContent>{OUTCOMES.map((o) => <SelectItem key={o} value={o}>{t(o)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Titolo *")}</Label>
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("Es. call di presentazione")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Partecipanti")}</Label>
              <Input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder={t("Es. Marco (CEO), Stan")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Punti discussi")}</Label>
            <Textarea rows={3} value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("Obiezioni")}</Label>
              <Textarea rows={2} value={objections} onChange={(e) => setObjections(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Prossimi passi")}</Label>
              <Textarea rows={2} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)}
                placeholder={t("Se compilato, puoi aggiornare il prossimo passo della lead")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>{t("Annulla")}</Button>
            <Button onClick={submit} disabled={!summary.trim() || add.isPending}>{t("Salva call")}</Button>
          </div>
        </div>
      )}

      {calls.map((c) => (
        <div key={c.id} className="rounded-lg border border-border/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{c.summary ?? c.body}</p>
            <span className="text-xs text-muted-foreground">
              {formatDateTimeIt(c.occurred_at)}{authorName(c.author_id) ? ` · ${authorName(c.author_id)}` : ""}
            </span>
          </div>
          {c.outcome && <p className="mt-1 text-xs"><span className="font-medium text-accent">{t(c.outcome)}</span></p>}
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            {c.participants && <Field label={t("Partecipanti")} value={c.participants} />}
            {c.full_text && <Field label={t("Punti discussi")} value={c.full_text} />}
            {c.objections && <Field label={t("Obiezioni")} value={c.objections} />}
            {c.next_steps && <Field label={t("Prossimi passi")} value={c.next_steps} />}
          </dl>
        </div>
      ))}
      {!calls.length && !formOpen && <p className="text-sm text-muted-foreground">{t("Nessuna call registrata.")}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
