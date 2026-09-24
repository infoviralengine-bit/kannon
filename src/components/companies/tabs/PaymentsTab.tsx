import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { formatDateIt } from "@/lib/companies";
import { useCompanyPayments } from "@/hooks/useCompanies";
import { useI18n } from "@/i18n";

/** Sola lettura, visibile solo all'admin (la funzione sul database rifiuta gli altri ruoli). */
export function PaymentsTab({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const { data = [], isLoading, error } = useCompanyPayments(companyId, true);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <p className="text-sm text-muted-foreground">{t("Pagamenti non disponibili.")}</p>;

  const total = data.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const unpaid = data.filter((p) => !p.is_paid).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Fatturato collegato")}</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(total)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Ancora da incassare")}</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(unpaid)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Campagna")}</TableHead>
                <TableHead>{t("Ciclo")}</TableHead>
                <TableHead>{t("Scadenza")}</TableHead>
                <TableHead>{t("Importo")}</TableHead>
                <TableHead>{t("Stato")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.campaign_name}</TableCell>
                  <TableCell>{p.cycle_number}</TableCell>
                  <TableCell>{formatDateIt(p.due_date)}</TableCell>
                  <TableCell>{formatCurrency(Number(p.amount ?? 0))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.is_paid
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-warning/20 text-warning border-warning/30"}>
                      {p.is_paid ? t("Incassato") : t("Da incassare")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!data.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("Nessun pagamento collegato.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
