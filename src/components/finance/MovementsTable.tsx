import { useState } from "react";
import { useFinancialMovements, type FinancialMovement } from "@/hooks/useFinanceData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { ArrowDownCircle, ArrowUpCircle, Repeat, PencilLine, Edit3 } from "lucide-react";
import { OverrideDialog } from "./OverrideDialog";
import { useI18n } from "@/i18n";

const SOURCE_ICON: Record<FinancialMovement["source"], any> = {
  client_payment: ArrowDownCircle,
  creator_payment: ArrowUpCircle,
  recurring_expense: Repeat,
  manual_entry: PencilLine,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", expected: "outline", overdue: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  paid: "Pagato", expected: "Previsto", overdue: "Scaduto",
};

export function MovementsTable() {
  const { t } = useI18n();
  const [type, setType] = useState<"all" | "revenue" | "cost">("all");
  const [source, setSource] = useState<"all" | FinancialMovement["source"]>("all");
  const [status, setStatus] = useState<"all" | "expected" | "paid" | "overdue">("all");
  const [editing, setEditing] = useState<FinancialMovement | null>(null);

  const { data, isLoading } = useFinancialMovements({
    type: type === "all" ? undefined : type,
    source: source === "all" ? undefined : source,
    status: status === "all" ? undefined : status,
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>{t("Tutti i movimenti")}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder={t("Tipo")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Tutti")}</SelectItem>
                <SelectItem value="revenue">{t("Ricavi")}</SelectItem>
                <SelectItem value="cost">{t("Costi")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v: any) => setSource(v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder={t("Origine")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Tutte origini")}</SelectItem>
                <SelectItem value="client_payment">{t("Cliente")}</SelectItem>
                <SelectItem value="creator_payment">{t("Creator")}</SelectItem>
                <SelectItem value="recurring_expense">{t("Ricorrente")}</SelectItem>
                <SelectItem value="manual_entry">{t("Manuale")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder={t("Stato")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Tutti")}</SelectItem>
                <SelectItem value="expected">{t("Previsto")}</SelectItem>
                <SelectItem value="paid">{t("Pagato")}</SelectItem>
                <SelectItem value="overdue">{t("Scaduto")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>{t("Descrizione")}</TableHead>
                <TableHead>{t("Categoria")}</TableHead>
                <TableHead>{t("Data")}</TableHead>
                <TableHead className="text-right">{t("Importo")}</TableHead>
                <TableHead>{t("Stato")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Caricamento...")}</TableCell></TableRow>}
              {!isLoading && (data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Nessun movimento")}</TableCell></TableRow>}
              {data?.map((m) => {
                const Icon = SOURCE_ICON[m.source];
                const isRevenue = m.type === "revenue";
                return (
                  <TableRow key={`${m.source}-${m.id}`}>
                    <TableCell><Icon className={`h-4 w-4 ${isRevenue ? "text-emerald-500" : "text-red-500"}`} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{m.description}</span>
                        {m.has_override && <Badge variant="outline" className="text-[10px]">{t("OVERRIDE")}</Badge>}
                        {m.source === "recurring_expense" && <Badge variant="outline" className="text-[10px]">{t("AUTO")}</Badge>}
                      </div>
                      {m.notes && <div className="text-xs text-muted-foreground mt-0.5">{m.notes}</div>}
                    </TableCell>
                    <TableCell><span className="capitalize text-sm">{m.category.replace("_", " ")}</span></TableCell>
                    <TableCell>{new Date(m.date).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell className={`text-right font-mono ${isRevenue ? "text-emerald-400" : ""}`}>
                      {isRevenue ? "+" : "−"}{formatCurrency(Math.abs(Number(m.amount)))}
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[m.status]}>{t(STATUS_LABEL[m.status])}</Badge></TableCell>
                    <TableCell>
                      {(m.source === "client_payment" || m.source === "creator_payment") && (
                        <button onClick={() => setEditing(m)} className="opacity-60 hover:opacity-100" aria-label={t("Modifica")}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <OverrideDialog movement={editing} onClose={() => setEditing(null)} />
    </>
  );
}