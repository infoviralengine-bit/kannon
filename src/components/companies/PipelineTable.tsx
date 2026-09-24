import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import {
  STAGE_LABEL, TEMPERATURE_BADGE, TEMPERATURE_LABEL, daysSince, formatDateIt, isOverdue,
  type CompanyStage, type Temperature,
} from "@/lib/companies";
import type { Company } from "@/hooks/useCompanies";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { CompanyLogo } from "@/components/companies/CompanyLogo";

type Props = {
  companies: Company[];
  ownerName: (id: string | null) => string;
  onOpenCompany: (id: string) => void;
};

export function PipelineTable({ companies, ownerName, onOpenCompany }: Props) {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Azienda")}</TableHead>
              <TableHead>{t("Stadio")}</TableHead>
              <TableHead>{t("Responsabile")}</TableHead>
              <TableHead>{t("Valore mensile")}</TableHead>
              <TableHead>{t("Prossimo passo")}</TableHead>
              <TableHead>{t("Ferma da")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => {
              const idle = daysSince(c.last_contact_at ?? c.updated_at);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpenCompany(c.id)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <CompanyLogo name={c.name} logoUrl={c.logo_url} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="truncate">{c.name}</p>
                        {c.temperature && c.status !== "cliente" && (
                          <Badge variant="outline" className={cn("mt-1 text-[10px]", TEMPERATURE_BADGE[c.temperature as Temperature])}>
                            {t(TEMPERATURE_LABEL[c.temperature as Temperature])}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.status === "cliente" ? "-" : t(STAGE_LABEL[c.stage as CompanyStage])}</TableCell>
                  <TableCell>{ownerName(c.owner_id)}</TableCell>
                  <TableCell>
                    {c.estimated_monthly_value != null ? formatCurrency(Number(c.estimated_monthly_value)) : "-"}
                  </TableCell>
                  <TableCell>
                    {c.next_step ? (
                      <span className={cn(isOverdue(c.next_step_date) && "text-destructive")}>
                        {c.next_step}{c.next_step_date ? ` (${formatDateIt(c.next_step_date)})` : ""}
                      </span>
                    ) : <span className="text-destructive">{t("Da impostare")}</span>}
                  </TableCell>
                  <TableCell>{idle != null ? t("{n} giorni", { n: idle }) : "-"}</TableCell>
                </TableRow>
              );
            })}
            {!companies.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {t("Nessuna lead con questi filtri.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
