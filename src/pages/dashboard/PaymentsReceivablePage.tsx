import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle, Check, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatViews } from "@/lib/format";
import { CappedBadge } from "@/components/CappedViewsBadge";
import {
  useClientPayments, type ClientPaymentRow,
} from "@/hooks/usePaymentsData";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function PaymentsReceivablePage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data, isLoading } = useClientPayments();

  useEffect(() => {
    if (role === "team") navigate("/dashboard", { replace: true });
  }, [role, navigate]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<ClientPaymentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = (data ?? []).filter((p) => {
    if (filter === "pending") return !p.isPaid && !p.isOverdue;
    if (filter === "paid") return p.isPaid;
    if (filter === "overdue") return p.isOverdue;
    return true;
  });

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const allUnpaid = (data ?? []).filter((p) => !p.isPaid);
  const thisMonthTotal = allUnpaid.filter((p) => p.dueDate.startsWith(currentMonthStr)).reduce((s, p) => s + p.totalAmount, 0);
  const futureTotal = allUnpaid.filter((p) => p.dueDate > `${currentMonthStr}-31`).reduce((s, p) => s + p.totalAmount, 0);
  const overdueTotal = allUnpaid.filter((p) => p.isOverdue).reduce((s, p) => s + p.totalAmount, 0);

  async function handleMarkReceived(p: ClientPaymentRow) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_payments")
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq("id", p.id);
      if (error) throw error;
      toast({ title: "Pagamento ricevuto", description: `${p.campaignName} — ${p.monthLabel}` });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-history-all"] });
      qc.invalidateQueries({ queryKey: ["payment-summary"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  async function handleStatusChange(p: ClientPaymentRow, newStatus: "paid" | "pending") {
    setUpdatingId(p.id);
    try {
      const { error } = await supabase
        .from("client_payments")
        .update(
          newStatus === "paid"
            ? { is_paid: true, paid_at: new Date().toISOString() }
            : { is_paid: false, paid_at: null },
        )
        .eq("id", p.id);
      if (error) throw error;
      toast({ title: "Status aggiornato", description: `${p.campaignName} — ${p.monthLabel}` });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-history-all"] });
      qc.invalidateQueries({ queryKey: ["payment-summary"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  const summaryCards = [
    { label: "Da ricevere questo mese", value: thisMonthTotal, color: "text-foreground" },
    { label: "Da ricevere in futuro", value: futureTotal, color: "text-muted-foreground" },
    { label: "Scaduto non pagato", value: overdueTotal, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ArrowDownCircle className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Pagamenti Da Ricevere</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="pending">In attesa</SelectItem>
            <SelectItem value="paid">Pagati</SelectItem>
            <SelectItem value="overdue">Scaduti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !filtered.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun pagamento cliente trovato</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Campagna</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Mese</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead className="text-right">Fisso (€)</TableHead>
                <TableHead className="text-right">Views nuove <CappedBadge /></TableHead>
                <TableHead className="text-right">CPM (€)</TableHead>
                <TableHead className="text-right">Totale (€)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const isExpanded = expandedId === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <TableCell className="px-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        <span
                          className="hover:underline"
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/campaigns/${p.campaignId}`); }}
                        >
                          {p.campaignName}
                        </span>
                      </TableCell>
                      <TableCell>{p.clientName}</TableCell>
                      <TableCell>{p.monthLabel}</TableCell>
                      <TableCell>{new Date(p.dueDate).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.fixedAmount)}
                      </TableCell>
                      <TableCell className="text-right">{formatViews(p.cpmViews)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.cpmAmount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={p.isPaid ? "paid" : "pending"}
                            disabled={updatingId === p.id}
                            onValueChange={(v: "paid" | "pending") => handleStatusChange(p, v)}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">
                                {p.isOverdue && !p.isPaid ? "🔴 Scaduto" : "⏳ In attesa"}
                              </SelectItem>
                              <SelectItem value="paid">✅ Pagato</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {p.isPaid ? (
                          <span className="text-xs text-muted-foreground">
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString("it-IT") : "—"}
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirm(p)}>
                            <Check className="mr-1 h-3 w-3" /> Segna Ricevuto
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${p.id}-detail`}>
                        <TableCell colSpan={11} className="bg-muted/30 px-6 py-4">
                          <div className="grid gap-3 md:grid-cols-2 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Periodo</span>
                                <span>{new Date(p.cycleStartDate).toLocaleDateString("it-IT")} — {new Date(p.cycleEndDate).toLocaleDateString("it-IT")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Fisso</span>
                                <span>{formatCurrency(p.fixedAmount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Views totali campagna</span>
                                <span>{formatViews(p.viewsPaidCumulative)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Views già pagate cicli precedenti</span>
                                <span>{formatViews(Math.max(0, p.viewsPaidCumulative - p.cpmViews))}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Views nuove questo ciclo <CappedBadge /></span>
                                <span>{formatViews(p.cpmViews)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">CPM</span>
                                <span>{formatViews(p.cpmViews)} × €{p.clientCpm} / 1.000 = {formatCurrency(p.cpmAmount)}</span>
                              </div>
                              <div className="flex justify-between font-semibold border-t border-border pt-2">
                                <span>Totale da ricevere</span>
                                <span>{formatCurrency(p.totalAmount)}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {p.isFirstCycle && (
                                <div className="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-xs">
                                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <span>Nessun CPM — le views verranno conteggiate dal prossimo ciclo</span>
                                </div>
                              )}
                              {p.isLastCycle && (
                                <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs">
                                  <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                  <span>Campagna conclusa — nessun fisso, solo CPM residuo</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma incasso</DialogTitle>
            <DialogDescription>
              Vuoi segnare come ricevuto il pagamento di {confirm?.campaignName} — {confirm?.monthLabel}?
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Fisso</span><span>{formatCurrency(confirm.fixedAmount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CPM</span><span>{formatCurrency(confirm.cpmAmount)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-2"><span>Totale</span><span>{formatCurrency(confirm.totalAmount)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Annulla</Button>
            <Button onClick={() => confirm && handleMarkReceived(confirm)} disabled={saving}>
              {saving ? "Salvataggio..." : "Conferma Incasso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
