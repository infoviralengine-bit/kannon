import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACTIVITY_DIRECTION_LABEL, ACTIVITY_DIRECTIONS, ACTIVITY_TYPE_LABEL,
  DIRECTIONAL_ACTIVITY_TYPES, MANUAL_ACTIVITY_TYPES, formatDateTimeIt,
  type ActivityDirection, type ActivityType,
} from "@/lib/companies";
import { useAddActivity, type CompanyActivity } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

const NONE = "__none__";

export function ActivityTab({ companyId, activities, types = MANUAL_ACTIVITY_TYPES }: { companyId: string; activities: CompanyActivity[]; types?: ActivityType[] }) {
  const { t } = useI18n();
  const addActivity = useAddActivity();
  const [type, setType] = useState<ActivityType>(types[0]);
  const [direction, setDirection] = useState(NONE);
  const [summary, setSummary] = useState("");
  const [fullText, setFullText] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const submit = () => {
    if (!summary.trim()) return;
    addActivity.mutate(
      {
        companyId,
        type,
        direction: direction === NONE ? null : direction,
        summary: summary.trim(),
        fullText: fullText.trim() || null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      },
      {
        onSuccess: () => {
          setSummary("");
          setFullText("");
          setOccurredAt("");
        },
      },
    );
  };

  const showDirection = DIRECTIONAL_ACTIVITY_TYPES.includes(type);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("Registra attività")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>{t("Tipo")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((at) => (
                    <SelectItem key={at} value={at}>{t(ACTIVITY_TYPE_LABEL[at])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showDirection && (
              <div className="grid gap-1.5">
                <Label>{t("Direzione")}</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger><SelectValue placeholder={t("Non indicata")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("Non indicata")}</SelectItem>
                    {ACTIVITY_DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{t(ACTIVITY_DIRECTION_LABEL[d])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>{t("Quando")}</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Riassunto *")}</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)}
              placeholder={t("Es. call di presentazione, molto interessati")} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Testo completo")}</Label>
            <Textarea rows={3} value={fullText} onChange={(e) => setFullText(e.target.value)}
              placeholder={t("Opzionale: testo dell'email o appunti della call")} />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!summary.trim() || addActivity.isPending}>{t("Registra")}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {activities.map((a) => {
          const text = a.summary ?? a.body ?? "";
          const open = expanded === a.id;
          return (
            <div key={a.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {t(ACTIVITY_TYPE_LABEL[a.type as ActivityType] ?? a.type)}
                </Badge>
                {a.direction && (
                  <Badge variant="outline" className="text-[10px]">
                    {t(ACTIVITY_DIRECTION_LABEL[a.direction as ActivityDirection])}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{formatDateTimeIt(a.occurred_at)}</span>
              </div>
              <p className="mt-2 text-sm">{text}</p>
              {a.full_text && (
                <>
                  <button className="mt-1 text-xs text-primary"
                    onClick={() => setExpanded(open ? null : a.id)}>
                    {open ? t("Nascondi testo") : t("Mostra testo completo")}
                  </button>
                  {open && (
                    <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      {a.full_text}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
        {!activities.length && <p className="text-sm text-muted-foreground">{t("Nessuna attività registrata.")}</p>}
      </div>
    </div>
  );
}
