import { AccountSignals } from '@/components/account/AccountSignals';
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyLogo } from "@/components/companies/CompanyLogo";
import { OperatorVideoTable } from "@/components/operator/OperatorVideoTable";
import { useOperatorCampaignDetail, type OperatorAccount, type OperatorFilters } from "@/hooks/useOperatorData";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";

export default function OperatorCampaignDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, isLoading } = useOperatorCampaignDetail(id);

  const filters: OperatorFilters = useMemo(() => ({
    from: null, to: null, campaignIds: id ? [id] : [], creatorIds: [], accountIds: [],
    format: null, window: null, minViews: null,
  }), [id]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        {t("Campagna non trovata o non attiva")}
        <div className="mt-3"><Link to="/dashboard/operator/campaigns" className="text-primary">{t("Torna alle campagne")}</Link></div>
      </div>
    );
  }

  const rows: { creator: string | null; account: OperatorAccount }[] = [
    ...data.creators.flatMap((c) =>
      c.accounts.length ? c.accounts.map((a) => ({ creator: c.name, account: a })) : [{ creator: c.name, account: null as unknown as OperatorAccount }]),
    ...data.unassigned_accounts.map((a) => ({ creator: null, account: a })),
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link to="/dashboard/operator/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("Campagne")}
      </Link>
      <div className="flex items-center gap-3">
        <CompanyLogo name={data.campaign.client_name} logoUrl={data.campaign.logo_url} className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(data.campaign.start_date).toLocaleDateString("it-IT")}
            {" - "}
            {data.campaign.end_date ? new Date(data.campaign.end_date).toLocaleDateString("it-IT") : t("Continuativa")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("Creator e account assegnati")} · {data.creators.length} {t("creator")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Creator")}</TableHead>
                <TableHead>{t("Account")}</TableHead>
                <TableHead>{t("Stato")}</TableHead>
                <TableHead className="text-right">{t("Video")}</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>{t("Ultimo video")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("Nessun creator assegnato")}</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={`${r.creator}-${r.account?.id ?? i}`}>
                  <TableCell className="font-medium">{r.creator ?? <span className="text-muted-foreground">{t("Senza creator")}</span>}</TableCell>
                  <TableCell>
                    {r.account ? (
                      <Link to={`/dashboard/accounts/${r.account.id}`} className="hover:text-primary">@{r.account.username.replace(/^@+/, "")}</Link>
                    ) : <span className="text-muted-foreground">{t("Nessun account")}</span>}
                  </TableCell>
                  <TableCell>
                    {r.account && <AccountSignals accountId={r.account.id} />}
                    {r.account && (
                      <Badge variant={r.account.is_active === false ? "outline" : "default"}>
                        {r.account.is_active === false ? t("Inattivo") : t("Attivo")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.account ? formatViews(Number(r.account.video_count)) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.account ? formatViews(Number(r.account.total_views)) : "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.account?.last_video_at ? new Date(r.account.last_video_at).toLocaleDateString("it-IT") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <OperatorVideoTable filters={filters} />
    </div>
  );
}
