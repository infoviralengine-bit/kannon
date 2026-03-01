import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { CappedBadge } from "@/components/CappedViewsBadge";
import {
  useCreatorPayments, type CreatorPaymentRow,
} from "@/hooks/usePaymentsData";
import { useContractPayments, type ContractPaymentRow } from "@/hooks/useContractData";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default function PaymentsPayablePage() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const { data: legacyData, isLoading: legacyLoading } = useCreatorPayments(year, month);
  const { data: contractData, isLoading: contractLoading } = useContractPayments(year, month);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<CreatorPaymentRow | ContractPaymentRow | null>(null);
  const [saving, setSaving] = useState(false);

  const isLoading = legacyLoading || contractLoading;

  const contractCreatorIds = new Set((contractData ?? []).map((r) => r.creatorId));
  const legacyRows = (legacyData ?? []).filter((r) => !contractCreatorIds.has(r.creatorId));

  const allRows = [
    ...(contractData ?? []).map((r) => ({ ...r, source: "contract" as const })),
    ...legacyRows.map((r) => ({ ...r, source: "legacy" as const, contractName: "—" })),
  ];

  const pendingTotal = allRows.filter((p) => !p.isPaid).reduce((s, p) => s + p.totalAmount, 0);

  async function handleMarkPaid(row: any) {
    setSaving(true);
    try {
      const payload = {
        creator_id: row.creatorId,
        period_month: month + 1,
        period_year: year,
        fixed_amount: row.fixedEarned ? row.fixedAmount : 0,
        fixed_earned: row.fixedEarned,
        cpm_amount: row.cpmAmount,
        total_amount: row.totalAmount,
        is_paid: true,
        paid_at: new Date().toISOString(),
      };

      if (row.id || row.paymentId) {
        const id = row.id || row.paymentId;
        const { error } = await supabase.from("creator_payments").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("creator_payments").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pagamento registrato", description: `${row.creatorName} segnato come pagato.` });
      qc.invalidateQueries({ queryKey: ["creator-payments"] });
      qc.invalidateQueries({ queryKey: ["contract-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-history-all"] });
      qc.invalidateQueries({ queryKey: ["payment-summary"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Pagamenti Da Pagare</h1>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Totale da pagare: <span className="font-semibold text-foreground">{formatCurrency(pendingTotal)}</span>
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !allRows.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun creator attivo</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Contratto</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Video mese</TableHead>
                <TableHead className="text-right">Fisso (€)</TableHead>
                <TableHead className="text-right">CPM (€) <CappedBadge /></TableHead>
                <TableHead className="text-right">Totale (€)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRows.map((cr, idx) => (
                <TableRow key={`${cr.creatorId}-${(cr as any).contractId ?? "legacy"}-${idx}`}>
                  <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}>
                    {cr.creatorName}
                  </TableCell>
                  <TableCell>
                    {cr.source === "contract" ? (
                      <span className="cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/contracts/${(cr as any).contractId}`)}>
                        {(cr as any).contractName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{MONTHS[month]} {year}</TableCell>
                  <TableCell className="text-right">
                    {cr.monthVideoCount}/{cr.monthlyTarget}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="mr-2">{formatCurrency(cr.fixedEarned ? cr.fixedAmount : 0)}</span>
                    <Badge variant={cr.fixedEarned ? "default" : "destructive"} className="text-xs">
                      {cr.fixedEarned ? "✅" : "❌"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cr.cpmAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(cr.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={cr.isPaid ? "default" : "secondary"}>
                      {cr.isPaid ? "✅" : "⏳"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {cr.isPaid ? (
                      <span className="text-xs text-muted-foreground">
                        {cr.paidAt ? new Date(cr.paidAt).toLocaleDateString("it-IT") : "—"}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setConfirm(cr as any)}>
                        <Check className="mr-1 h-3 w-3" /> Segna Pagato
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Vuoi segnare come pagato {(confirm as any)?.creatorName} per {MONTHS[month]} {year}?
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fisso</span>
                <span>{(confirm as any).fixedEarned ? formatCurrency((confirm as any).fixedAmount) : "€ 0,00 (non maturato)"}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">CPM</span><span>{formatCurrency((confirm as any).cpmAmount)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-2"><span>Totale</span><span>{formatCurrency((confirm as any).totalAmount)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Annulla</Button>
            <Button onClick={() => confirm && handleMarkPaid(confirm)} disabled={saving}>
              {saving ? "Salvataggio..." : "Conferma Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
