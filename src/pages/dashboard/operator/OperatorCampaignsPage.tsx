import { Link } from "react-router-dom";
import { AtSign, Eye, Film, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyLogo } from "@/components/companies/CompanyLogo";
import { useOperatorCampaigns } from "@/hooks/useOperatorData";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";

export default function OperatorCampaignsPage() {
  const { t } = useI18n();
  const { data, isLoading } = useOperatorCampaigns();

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("Campagne attive")}</h1>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("Nessuna campagna attiva")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((c) => (
            <Link key={c.id} to={`/dashboard/operator/campaigns/${c.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <CompanyLogo name={c.client_name} logoUrl={c.logo_url} className="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.start_date).toLocaleDateString("it-IT")}
                        {" - "}
                        {c.end_date ? new Date(c.end_date).toLocaleDateString("it-IT") : t("Continuativa")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { icon: Users, v: c.creator_count, l: t("Creator") },
                      { icon: AtSign, v: c.account_count, l: t("Account") },
                      { icon: Film, v: c.video_count, l: t("Video") },
                      { icon: Eye, v: c.total_views, l: t("Views") },
                    ].map((s) => (
                      <div key={s.l} className="rounded-md bg-muted/40 py-2">
                        <s.icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-sm font-semibold tabular-nums">{formatViews(Number(s.v))}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
