import { useNavigate } from "react-router-dom";
import { Handshake, Users2, AlertCircle, ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/companies/CompanyLogo";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/i18n";
import { usePipelineSummary } from "@/hooks/useCommandCenter";
import { useToggleTask } from "@/hooks/useCompanies";

function KpiTile({
  label, value, hint, icon: Icon, accent, onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/30"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </button>
  );
}

export function PipelineSummaryPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading } = usePipelineSummary();
  const toggleTask = useToggleTask();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Handshake className="h-4 w-4 text-primary" />
          {t("Pipeline clienti e azioni")}
        </CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate("/dashboard/clients/pipeline")}>
          {t("Apri pipeline")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiTile
              label={t("Lead attive")}
              value={String(data?.activeLeads ?? 0)}
              icon={Users2}
              accent="text-primary"
              onClick={() => navigate("/dashboard/clients/pipeline")}
            />
            <KpiTile
              label={t("In trattativa")}
              value={String(data?.negotiating ?? 0)}
              hint={
                data?.negotiatingValue
                  ? t("Valore stimato {amount}/mese", { amount: formatCurrency(data.negotiatingValue) })
                  : undefined
              }
              icon={Handshake}
              accent="text-emerald-400"
              onClick={() => navigate("/dashboard/clients/pipeline")}
            />
            <KpiTile
              label={t("Azioni urgenti")}
              value={String(data?.urgentCount ?? 0)}
              hint={t("In ritardo o in scadenza oggi")}
              icon={AlertCircle}
              accent={(data?.urgentCount ?? 0) > 0 ? "text-red-400" : "text-muted-foreground"}
              onClick={() => navigate("/dashboard/clients/agenda")}
            />
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("Prossime azioni prioritarie")}
          </p>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : !data?.tasks.length ? (
            <p className="py-4 text-sm text-muted-foreground">{t("Nessuna azione in sospeso")}</p>
          ) : (
            <div className="space-y-2">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                >
                  <button
                    type="button"
                    aria-label={t("Segna come fatto")}
                    onClick={() => toggleTask.mutate({ id: task.id, isDone: true, companyId: task.companyId })}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <CompanyLogo name={task.companyName ?? "—"} logoUrl={task.companyLogo} className="h-7 w-7" />
                  <button
                    type="button"
                    onClick={() => task.companyId && navigate(`/dashboard/clients/${task.companyId}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{task.companyName ?? "—"}</p>
                  </button>
                  {task.dueDate && (
                    <Badge
                      className={`text-[10px] ${
                        task.isOverdue
                          ? "border-red-500/30 bg-red-500/15 text-red-400"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {task.isOverdue ? t("In ritardo") : new Date(task.dueDate).toLocaleDateString("it-IT")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PipelineSummaryPanel;
