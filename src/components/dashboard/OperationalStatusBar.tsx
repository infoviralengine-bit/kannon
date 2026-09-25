import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useOperationalStatus } from "@/hooks/useCommandCenter";

function relative(iso: string | null, t: (s: string, v?: Record<string, string | number>) => string) {
  if (!iso) return t("Mai");
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return t("ora");
  if (mins < 60) return t("{n}m fa", { n: mins });
  if (mins < 1440) return t("{n}h fa", { n: Math.floor(mins / 60) });
  return t("{n}g fa", { n: Math.floor(mins / 1440) });
}

export function OperationalStatusBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading } = useOperationalStatus();

  const alerts = data?.alerts ?? [];
  const healthy = !isLoading && alerts.length === 0;

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {data?.scrapeStatus === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : healthy ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            )}
            <span className="text-sm font-medium text-foreground">
              {isLoading
                ? t("Controllo stato in corso")
                : data?.scrapeStatus === "running"
                  ? t("Aggiornamento dati in corso")
                  : healthy
                    ? t("Tutti i sistemi e le campagne sono operativi")
                    : t("{n} elementi richiedono attenzione", { n: alerts.length })}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("Ultimo aggiornamento dati: {when}", { when: relative(data?.lastScrapeAt ?? null, t) })}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => a.link && navigate(a.link)}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  a.severity === "red"
                    ? "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
                    : "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10"
                }`}
              >
                <AlertTriangle
                  className={`h-3.5 w-3.5 shrink-0 ${a.severity === "red" ? "text-red-400" : "text-amber-400"}`}
                />
                <span className="text-xs text-muted-foreground">{t(a.message)}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OperationalStatusBar;
