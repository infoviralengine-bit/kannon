import { useState } from "react";
import { Wallet, TrendingUp, TrendingDown, DollarSign, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePayoffData, usePaymentHistory, type CreatorPayoffRow } from "@/hooks/usePayoffData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatViews } from "@/lib/format";
import { useNavigate } from "react-router-dom";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default function PayoffPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = usePayoffData(year, month);
  const { data: history, isLoading: historyLoading } = usePaymentHistory();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [confirmCreator, setConfirmCreator] = useState<CreatorPayoffRow | null>(null);
  const [paying, setPaying] = useState(false);

  async function handleMarkPaid(cr: CreatorPayoffRow) {
    setPaying(true);
    try {
      const payload = {
        creator_id: cr.creatorId,
        period_month: month + 1,
        period_year: year,
        fixed_amount: cr.fixedEarned ? cr.fixedAmount : 0,
        fixed_earned: cr.fixedEarned,
        cpm_amount: cr.cpmAmount,
        total_amount: cr.total,
        is_paid: true,
        paid_at: new Date().toISOString(),
      };

      if (cr.paymentId) {
        const { error } = await supabase.from("payments").update(payload).eq("id", cr.paymentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pagamento registrato", description: `${cr.name} segnato come pagato.` });
      qc.invalidateQueries({ queryKey: ["payoff"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setPaying(false);
      setConfirmCreator(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Payoff</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Section 1: Agency Summary */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entrata Totale</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data?.totalIncome ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Uscita Totale</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data?.totalCost ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className={(data?.netMargin ?? 0) >= 0 ? "border-success/50" : "border-destructive/50"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Margine Netto</CardTitle>
              <DollarSign className={`h-4 w-4 ${(data?.netMargin ?? 0) >= 0 ? "text-success" : "text-destructive"}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(data?.netMargin ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(data?.netMargin ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section 2: Campaign Detail */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Dettaglio per Campagna</h2>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !data?.campaignRows.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nessuna campagna attiva</CardContent></Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campagna</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Creator</TableHead>
                  <TableHead className="text-right">Views mese</TableHead>
                  <TableHead className="text-right">Entrata (€)</TableHead>
                  <TableHead className="text-right">Uscita (€)</TableHead>
                  <TableHead className="text-right">Margine (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaignRows.map((r) => (
                  <TableRow key={r.campaignId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/campaigns/${r.campaignId}`)}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.clientName}</TableCell>
                    <TableCell className="text-right">{r.creatorCount}</TableCell>
                    <TableCell className="text-right">{formatViews(r.viewsMonth)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.clientIncome)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.creatorCost)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.margin >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(r.margin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Section 3: Creator Payments */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Pagamenti Creator</h2>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : !data?.creatorRows.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun creator attivo</CardContent></Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Fisso (€)</TableHead>
                  <TableHead className="text-right">CPM maturato (€)</TableHead>
                  <TableHead className="text-right">Totale (€)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.creatorRows.map((cr) => (
                  <TableRow key={cr.creatorId}>
                    <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}>
                      {cr.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="mr-2">{formatCurrency(cr.fixedAmount)}</span>
                      <Badge variant={cr.fixedEarned ? "default" : "destructive"} className="text-xs">
                        {cr.fixedEarned ? "✅ Maturato" : "❌ Non maturato"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(cr.cpmAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(cr.total)}</TableCell>
                    <TableCell>
                      <Badge variant={cr.isPaid ? "default" : "secondary"}>
                        {cr.isPaid ? "✅ Pagato" : "⏳ Da pagare"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {cr.isPaid ? (
                        <span className="text-xs text-muted-foreground">
                          {cr.paidAt ? new Date(cr.paidAt).toLocaleDateString("it-IT") : "—"}
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirmCreator(cr)}>
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
      </div>

      {/* Section 4: Payment History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Storico Pagamenti</h2>
        {historyLoading ? (
          <Skeleton className="h-32" />
        ) : !history?.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun pagamento registrato</CardContent></Card>
        ) : (
          <Accordion type="single" collapsible>
            <AccordionItem value="history">
              <AccordionTrigger className="px-4">
                Mostra storico ({history.length} pagamenti)
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead className="text-right">Fisso (€)</TableHead>
                      <TableHead className="text-right">CPM (€)</TableHead>
                      <TableHead className="text-right">Totale (€)</TableHead>
                      <TableHead>Data pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.creatorName}</TableCell>
                        <TableCell>{MONTHS[p.periodMonth - 1]} {p.periodYear}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.fixedAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.cpmAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(p.totalAmount)}</TableCell>
                        <TableCell>{new Date(p.paidAt).toLocaleDateString("it-IT")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* Confirm Payment Dialog */}
      <Dialog open={!!confirmCreator} onOpenChange={(o) => !o && setConfirmCreator(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Vuoi segnare come pagato {confirmCreator?.name} per {MONTHS[month]} {year}?
            </DialogDescription>
          </DialogHeader>
          {confirmCreator && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fisso</span>
                <span>{confirmCreator.fixedEarned ? formatCurrency(confirmCreator.fixedAmount) : "€ 0,00 (non maturato)"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPM</span>
                <span>{formatCurrency(confirmCreator.cpmAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span>Totale</span>
                <span>{formatCurrency(confirmCreator.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCreator(null)}>Annulla</Button>
            <Button onClick={() => confirmCreator && handleMarkPaid(confirmCreator)} disabled={paying}>
              {paying ? "Salvataggio..." : "Conferma Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
