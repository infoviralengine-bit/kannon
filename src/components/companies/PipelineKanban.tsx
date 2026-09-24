import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, CalendarClock, Flame, Thermometer } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  PIPELINE_STAGES, STAGE_LABEL, TEMPERATURE_BADGE, TEMPERATURE_LABEL,
  formatDateIt, isOverdue, type CompanyStage, type Temperature,
} from "@/lib/companies";
import type { Company } from "@/hooks/useCompanies";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

type Props = {
  companies: Company[];
  ownerName: (id: string | null) => string;
  onOpenCompany: (id: string) => void;
  /** Richiede conferma dello spostamento (prossimo passo o motivo della perdita). */
  onRequestStage: (company: Company, stage: CompanyStage) => void;
};

export function PipelineKanban({ companies, ownerName, onOpenCompany, onRequestStage }: Props) {
  const { t } = useI18n();
  const [dragId, setDragId] = useState<string | null>(null);
  const firstPopulatedStage = PIPELINE_STAGES.find((stage) => companies.some((c) => c.stage === stage));
  const [selectedStage, setSelectedStage] = useState<CompanyStage>(firstPopulatedStage ?? "nuova");

  useEffect(() => {
    if (!companies.some((c) => c.stage === selectedStage) && firstPopulatedStage) {
      setSelectedStage(firstPopulatedStage);
    }
  }, [companies, firstPopulatedStage, selectedStage]);

  const stageItems = useMemo(
    () => companies.filter((company) => company.stage === selectedStage),
    [companies, selectedStage],
  );

  const handleDrop = (stage: CompanyStage) => {
    if (!dragId) return;
    const current = companies.find((c) => c.id === dragId);
    setDragId(null);
    if (!current || current.stage === stage) return;
    onRequestStage(current, stage);
  };

  return (
    <div className="grid min-h-[460px] overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[minmax(360px,2fr)_minmax(0,3fr)]">
      <aside className="border-b border-border bg-background/40 lg:border-b-0 lg:border-r">
        <div className="border-b border-border px-5 py-3">
          <p className="text-base font-semibold">{t("Fasi")}</p>
          <p className="text-xs text-muted-foreground">{t("{n} lead nei risultati", { n: companies.length })}</p>
        </div>
        <nav className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-3 lg:grid-cols-1 lg:p-4">
        {PIPELINE_STAGES.map((stage) => {
          const items = companies.filter((c) => c.stage === stage);
          const total = items.reduce((s, c) => s + Number(c.estimated_monthly_value ?? 0), 0);
          const selected = stage === selectedStage;
          return (
            <Button
              key={stage}
              type="button"
              variant="ghost"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { handleDrop(stage); setSelectedStage(stage); }}
              onClick={() => setSelectedStage(stage)}
              className={cn(
                "h-auto min-w-0 justify-between rounded-md px-4 py-3 text-left",
                selected
                  ? "bg-card text-foreground shadow-sm hover:bg-accent/15 hover:text-foreground"
                  : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
              )}
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t(STAGE_LABEL[stage])}</span>
                {total > 0 && <span className="block truncate text-xs font-normal text-muted-foreground">{formatCurrency(total)}</span>}
              </div>
              <Badge variant={selected ? "default" : "outline"} className="ml-3 shrink-0 px-2 text-xs">
                {items.length}
              </Badge>
            </Button>
          );
        })}
        </nav>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold">{t(STAGE_LABEL[selectedStage])}</h2>
            <p className="text-[11px] text-muted-foreground">
              {t("{n} {label}", { n: stageItems.length, label: t(stageItems.length === 1 ? "azienda" : "aziende") })}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatCurrency(stageItems.reduce((sum, company) => sum + Number(company.estimated_monthly_value ?? 0), 0))} {t("/ mese")}
          </p>
        </header>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[minmax(170px,1.4fr)_100px_120px_minmax(150px,1fr)_90px] border-b border-border bg-background/50 px-3 py-2 text-[9px] font-semibold uppercase text-muted-foreground">
              <span>{t("Azienda")}</span>
              <span>{t("Valore")}</span>
              <span>{t("Responsabile")}</span>
              <span>{t("Prossimo passo")}</span>
              <span />
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {stageItems.map((c) => (
                <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onOpenCompany(c.id)}
                    className={cn(
                      "grid cursor-pointer grid-cols-[minmax(170px,1.4fr)_100px_120px_minmax(150px,1fr)_90px] items-center border-b border-border px-3 py-2.5 text-xs transition-colors hover:bg-background/60",
                      dragId === c.id && "opacity-50",
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-[13px] font-semibold">{c.app_name || c.legal_name || c.name}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        {(c.app_name || c.legal_name) && c.name !== (c.app_name || c.legal_name) && (
                          <span className="truncate text-[11px] text-muted-foreground">{c.name}</span>
                        )}
                      {c.temperature && c.status !== "cliente" && (
                        <Badge variant="outline"
                          className={cn("h-4 shrink-0 px-1 text-[8px]", TEMPERATURE_BADGE[c.temperature as Temperature])}>
                          {c.temperature === "caldo"
                            ? <Flame className="mr-0.5 h-2 w-2" />
                            : <Thermometer className="mr-0.5 h-2 w-2" />}
                          {t(TEMPERATURE_LABEL[c.temperature as Temperature])}
                        </Badge>
                      )}
                      </div>
                    </div>
                    <span className="text-xs font-medium">{c.estimated_monthly_value != null ? formatCurrency(Number(c.estimated_monthly_value)) : "-"}</span>
                    <span className="truncate pr-2 text-[11px] text-muted-foreground">{ownerName(c.owner_id)}</span>
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-[11px]">{c.next_step ?? t("Da impostare")}</p>
                      {c.next_step_date && (
                        <p className={cn("mt-0.5 flex items-center gap-1 text-[9px]", isOverdue(c.next_step_date) ? "text-destructive" : "text-muted-foreground")}>
                          <CalendarClock className="h-2.5 w-2.5" /> {formatDateIt(c.next_step_date)}
                        </p>
                      )}
                    </div>
                      <div className="flex flex-col items-center gap-0.5">
                        {(() => {
                          const idx = PIPELINE_STAGES.indexOf(c.stage);
                          const nextStage = idx >= 0 && idx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[idx + 1] : null;
                          return (
                            <>
                              {c.stage !== "vinto" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onRequestStage(c, "perso"); }}
                              >
                                {t("Persa")}
                              </Button>
                              )}
                              {nextStage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("Passa alla fase successiva")}
                                  title={t("Passa alla fase successiva")}
                                  className="h-6 w-6 text-green-600 hover:bg-green-500/10 hover:text-green-700"
                                  onClick={(e) => { e.stopPropagation(); onRequestStage(c, nextStage); }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                </div>
              ))}
              {!stageItems.length && (
                <p className="px-4 py-16 text-center text-xs text-muted-foreground">{t("Nessuna lead in questa fase.")}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
