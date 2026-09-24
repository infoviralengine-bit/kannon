import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CheckSquare, FileWarning, Megaphone, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { STATUS_BADGE, STATUS_LABEL, formatDateIt, type CompanyStatus } from "@/lib/companies";
import { useClientsOverview } from "@/hooks/useCompanies";
import { CompanyFormDialog } from "@/components/companies/CompanyFormDialog";
import { useI18n } from "@/i18n";

export default function ClientiPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data = [], isLoading } = useClientsOverview();
  const [search, setSearch] = useState("");
  const [showFormer, setShowFormer] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (!showFormer && row.company.status !== "cliente") return false;
      if (q && !row.company.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, showFormer]);

  const activeCount = data.filter((r) => r.company.status === "cliente").length;
  const totalValue = data
    .filter((r) => r.company.status === "cliente")
    .reduce((s, r) => s + Number(r.company.estimated_monthly_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("Clienti")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("{n} clienti attivi, {value} al mese stimati.", { n: activeCount, value: formatCurrency(totalValue) })}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("Nuovo cliente")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("Cerca cliente")} value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant={showFormer ? "default" : "outline"} onClick={() => setShowFormer(!showFormer)}>
          {t("Mostra anche gli ex")}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const c = row.company;
            const pct = row.onboardingTotal
              ? Math.round((row.onboardingDone / row.onboardingTotal) * 100) : 0;
            return (
              <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => navigate(`/dashboard/clients/${c.id}`)}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.app_name && <p className="text-xs text-muted-foreground">{c.app_name}</p>}
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE[c.status as CompanyStatus]}>
                      {t(STATUS_LABEL[c.status as CompanyStatus])}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <Metric icon={<Megaphone className="h-3 w-3" />} value={row.activeCampaigns} label={t("campagne")} />
                    <Metric icon={<CheckSquare className="h-3 w-3" />} value={row.openTasks} label={t("da fare")} />
                    <Metric icon={<FileWarning className="h-3 w-3" />} value={row.pendingDocs} label={t("documenti")} />
                  </div>

                  {row.onboardingTotal > 0 && pct < 100 && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">
                        {t("Onboarding {done} di {total}", { done: row.onboardingDone, total: row.onboardingTotal })}
                      </p>
                      <Progress value={pct} />
                    </div>
                  )}

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {c.estimated_monthly_value != null
                        ? t("{value} / mese", { value: formatCurrency(Number(c.estimated_monthly_value)) }) : t("Valore non indicato")}
                    </span>
                    <span>
                      {c.last_contact_at ? t("Ultimo contatto {date}", { date: formatDateIt(c.last_contact_at) }) : t("Mai contattato")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!filtered.length && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Building2 className="mx-auto mb-2 h-6 w-6" />
                {t("Nessun cliente da mostrare.")}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <CompanyFormDialog open={formOpen} onOpenChange={setFormOpen} company={null} />
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-md border border-border py-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
