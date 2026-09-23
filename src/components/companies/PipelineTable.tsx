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

type Props = {
  companies: Company[];
  ownerName: (id: string | null) => string;
  onOpenCompany: (id: string) => void;
};

export function PipelineTable({ companies, ownerName, onOpenCompany }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Azienda</TableHead>
              <TableHead>Stadio</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Responsabile</TableHead>
              <TableHead>Valore mensile</TableHead>
              <TableHead>Prossimo passo</TableHead>
              <TableHead>Ferma da</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => {
              const idle = daysSince(c.last_contact_at ?? c.updated_at);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpenCompany(c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.status === "cliente" ? "-" : STAGE_LABEL[c.stage as CompanyStage]}</TableCell>
                  <TableCell>
                    {c.temperature && c.status !== "cliente" ? (
                      <Badge variant="outline" className={cn("text-[10px]", TEMPERATURE_BADGE[c.temperature as Temperature])}>
                        {TEMPERATURE_LABEL[c.temperature as Temperature]}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>{ownerName(c.owner_id)}</TableCell>
                  <TableCell>
                    {c.estimated_monthly_value != null ? formatCurrency(Number(c.estimated_monthly_value)) : "-"}
                  </TableCell>
                  <TableCell>
                    {c.next_step ? (
                      <span className={cn(isOverdue(c.next_step_date) && "text-destructive")}>
                        {c.next_step}{c.next_step_date ? ` (${formatDateIt(c.next_step_date)})` : ""}
                      </span>
                    ) : <span className="text-destructive">Da impostare</span>}
                  </TableCell>
                  <TableCell>{idle != null ? `${idle} giorni` : "-"}</TableCell>
                </TableRow>
              );
            })}
            {!companies.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nessuna lead con questi filtri.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
