import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, ChevronLeft, Infinity as InfinityIcon, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/companies/CompanyLogo";
import { useI18n } from "@/i18n";
import { useCampaignTimeline, type TimelineCampaign } from "@/hooks/useCommandCenter";

const DAY = 86_400_000;
const MONTHS_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
}

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CampaignTimeline({ selectedId, onSelect }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading } = useCampaignTimeline();

  const campaigns: TimelineCampaign[] = data ?? [];

  const scale = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!campaigns.length) return null;
    const monthAgo = new Date(today);
    monthAgo.setUTCDate(1);
    monthAgo.setUTCMonth(monthAgo.getUTCMonth() - 1);
    monthAgo.setUTCDate(Math.min(today.getUTCDate(), new Date(Date.UTC(monthAgo.getUTCFullYear(), monthAgo.getUTCMonth() + 1, 0)).getUTCDate()));
    const ends = campaigns.map((c) =>
      c.endDate ? new Date(c.endDate).getTime() : today.getTime() + 45 * DAY,
    );
    const min = monthAgo.getTime();
    const max = Math.max(...ends, today.getTime() + 20 * DAY);
    const span = Math.max(DAY, max - min);

    // Tacche mensili
    const ticks: { label: string; left: number }[] = [];
    const cursor = new Date(min);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor.getTime() <= max) {
      const left = ((cursor.getTime() - min) / span) * 100;
      if (left >= 0 && left <= 100) {
        ticks.push({ label: `${MONTHS_IT[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`, left });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return { min, span, ticks, todayLeft: ((today.getTime() - min) / span) * 100 };
  }, [campaigns]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarRange className="h-4 w-4 text-primary" />
            {t("Campagne attive nel tempo")}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("Durata, giorni rimanenti e creator per ogni campagna in corso")}
          </p>
        </div>
        {selectedId && (
          <Button variant="outline" size="sm" onClick={() => onSelect(null)}>
            {t("Mostra tutte")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !campaigns.length || !scale ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarRange className="mb-3 h-10 w-10 text-muted" />
            <p className="mb-4 text-sm text-muted-foreground">{t("Nessuna campagna attiva")}</p>
            <Button size="sm" onClick={() => navigate("/dashboard/campaigns")}>
              {t("Vai alle campagne")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Righello mesi */}
            <div className="relative ml-0 h-5 md:ml-[220px]">
              {scale.ticks.map((tick) => (
                <span
                  key={tick.label}
                  className="absolute -translate-x-1/2 text-[10px] uppercase tracking-wide text-muted-foreground"
                  style={{ left: `${tick.left}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>

            {campaigns.map((c) => {
              const startMs = new Date(c.startDate).getTime();
              const endMs = c.endDate ? new Date(c.endDate).getTime() : scale.min + scale.span;
              const clippedStart = Math.max(startMs, scale.min);
              const clippedEnd = Math.min(endMs, scale.min + scale.span);
              const left = ((clippedStart - scale.min) / scale.span) * 100;
              const width = Math.max(0, ((clippedEnd - clippedStart) / scale.span) * 100);
              const isSelected = selectedId === c.id;
              const ending = c.daysLeft !== null && c.daysLeft <= 14;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : c.id)}
                  className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-all md:flex-row md:items-center ${
                    isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-background hover:border-primary/30"
                  }`}
                >
                  <div className="flex w-full min-w-0 items-center gap-2.5 md:w-[208px]">
                    <CompanyLogo name={c.clientName} logoUrl={c.logoUrl} className="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.clientName}</p>
                    </div>
                  </div>

                  <div className="relative h-9 flex-1">
                    <div className="absolute inset-y-0 left-0 right-0 rounded-md bg-muted/40" />
                    {scale.ticks.map((tick) => (
                      <span
                        key={`grid-${c.id}-${tick.label}`}
                        className="absolute inset-y-0 w-px bg-border/60"
                        style={{ left: `${tick.left}%` }}
                      />
                    ))}
                    {width > 0 && <div
                      className={`absolute inset-y-1 flex items-center gap-2 overflow-hidden rounded-md px-2 ${
                        ending ? "bg-amber-500/25" : "bg-primary/25"
                      } ${isSelected ? "ring-1 ring-primary" : ""}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${shortDate(c.startDate)}${c.endDate ? ` – ${shortDate(c.endDate)}` : ""}`}
                    >
                      <span className="truncate text-[11px] font-medium text-foreground">
                        {startMs < scale.min ? <ChevronLeft className="inline h-3 w-3" aria-label={t("Iniziata prima della visualizzazione")} /> : shortDate(c.startDate)}
                        {c.endDate ? ` – ${shortDate(c.endDate)}` : ""}
                      </span>
                    </div>}
                    <span
                      className="absolute inset-y-0 w-px bg-red-400"
                      style={{ left: `${scale.todayLeft}%` }}
                      title={t("Oggi")}
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-2 md:w-[168px] md:justify-end">
                    <Badge variant="outline" className="gap-1 border-border text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {c.creatorCount}
                    </Badge>
                    {c.isOngoing ? (
                      <Badge className="gap-1 border-border bg-muted text-[10px] text-muted-foreground">
                        <InfinityIcon className="h-3 w-3" />
                        {t("Continuativa")}
                      </Badge>
                    ) : (
                      <Badge
                        className={`text-[10px] ${
                          (c.daysLeft ?? 0) < 0
                            ? "border-red-500/30 bg-red-500/15 text-red-400"
                            : ending
                              ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {(c.daysLeft ?? 0) < 0
                          ? t("Conclusa")
                          : t("Mancano {n}gg", { n: c.daysLeft ?? 0 })}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CampaignTimeline;
