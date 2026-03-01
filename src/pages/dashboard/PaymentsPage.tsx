import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, ArrowDownCircle, ArrowUpCircle, TrendingUp, Clock, Check, AlertTriangle,
  ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatViews } from "@/lib/format";
import {
  useClientPayments, useCreatorPayments, usePaymentHistory, usePaymentSummary,
  type ClientPaymentRow, type CreatorPaymentRow,
} from "@/hooks/usePaymentsData";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/* ── Tab 1: Da Ricevere ── */
function ClientPaymentsTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useClientPayments();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<ClientPaymentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const summaryCards = [
    { label: "Da ricevere questo mese", value: thisMonthTotal, color: "text-foreground" },
    { label: "Da ricevere in futuro", value: futureTotal, color: "text-muted-foreground" },
    { label: "Scaduto non pagato", value: overdueTotal, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      {/* Header cards */}
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

      {/* Filter */}
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
                <TableHead className="text-right">Views nuove</TableHead>
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
                  <>
                    <TableRow
                      key={p.id}
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
                        <span className="block text-xs text-muted-foreground">
                          {p.creatorCount} × €{p.clientFixedPerCreator}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatViews(p.cpmViews)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.cpmAmount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.totalAmount)}</TableCell>
                      <TableCell>
                        {p.isPaid ? (
                          <Badge className="bg-success/20 text-success border-success/30">✅</Badge>
                        ) : p.isOverdue ? (
                          <Badge variant="destructive">🔴</Badge>
                        ) : (
                          <Badge variant="secondary">⏳</Badge>
                        )}
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
                                <span className="text-muted-foreground">Periodo views</span>
                                <span>{new Date(p.cycleStartDate).toLocaleDateString("it-IT")} — {new Date(p.cycleEndDate).toLocaleDateString("it-IT")}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Dettaglio fisso</span>
                                <span>{p.creatorCount} creator × €{p.clientFixedPerCreator} = {formatCurrency(p.fixedAmount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Dettaglio CPM</span>
                                <span>{formatViews(p.cpmViews)} views × €{p.clientCpm} / 1.000 = {formatCurrency(p.cpmAmount)}</span>
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
                                  <span>Nessun CPM — primo mese di campagna, le views verranno pagate il mese successivo</span>
                                </div>
                              )}
                              {p.isLastCycle && (
                                <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs">
                                  <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                                  <span>Campagna conclusa — solo CPM residuo, nessun fisso</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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

/* ── Tab 2: Da Pagare ── */
function CreatorPaymentsTab() {
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useCreatorPayments(year, month);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<CreatorPaymentRow | null>(null);
  const [saving, setSaving] = useState(false);

  const pendingTotal = (data ?? []).filter((p) => !p.isPaid).reduce((s, p) => s + p.totalAmount, 0);

  async function handleMarkPaid(cr: CreatorPaymentRow) {
    setSaving(true);
    try {
      const payload = {
        creator_id: cr.creatorId,
        period_month: month + 1,
        period_year: year,
        fixed_amount: cr.fixedEarned ? cr.fixedAmount : 0,
        fixed_earned: cr.fixedEarned,
        cpm_amount: cr.cpmAmount,
        total_amount: cr.totalAmount,
        is_paid: true,
        paid_at: new Date().toISOString(),
      };

      if (cr.id) {
        const { error } = await supabase.from("creator_payments").update(payload).eq("id", cr.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("creator_payments").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pagamento registrato", description: `${cr.creatorName} segnato come pagato.` });
      qc.invalidateQueries({ queryKey: ["creator-payments"] });
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
    <div className="space-y-4">
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
      ) : !data?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun creator attivo</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Fisso (€)</TableHead>
                <TableHead className="text-right">CPM (€)</TableHead>
                <TableHead className="text-right">Totale (€)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((cr) => (
                <TableRow key={cr.creatorId}>
                  <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}>
                    {cr.creatorName}
                  </TableCell>
                  <TableCell>{MONTHS[month]} {year}</TableCell>
                  <TableCell className="text-right">
                    <span className="mr-2">{formatCurrency(cr.fixedEarned ? cr.fixedAmount : 0)}</span>
                    <Badge variant={cr.fixedEarned ? "default" : "destructive"} className="text-xs">
                      {cr.fixedEarned ? "✅" : "❌"}
                    </Badge>
                    <span className="block text-xs text-muted-foreground mt-1">
                      {cr.monthVideoCount}/{cr.monthlyTarget} video
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cr.cpmAmount)}
                    <span className="block text-xs text-muted-foreground mt-1">
                      {cr.windowClosed} definitivi, {cr.windowOpen} provvisori
                    </span>
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
                      <Button size="sm" variant="outline" onClick={() => setConfirm(cr)}>
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
              Vuoi segnare come pagato {confirm?.creatorName} per {MONTHS[month]} {year}?
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fisso</span>
                <span>{confirm.fixedEarned ? formatCurrency(confirm.fixedAmount) : "€ 0,00 (non maturato)"}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">CPM</span><span>{formatCurrency(confirm.cpmAmount)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-2"><span>Totale</span><span>{formatCurrency(confirm.totalAmount)}</span></div>
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

/* ── Tab 3: Storico ── */
function HistoryTab() {
  const { data, isLoading } = usePaymentHistory();
  const [filter, setFilter] = useState<"all" | "client" | "creator">("all");

  const filtered = (data ?? []).filter((p) => {
    if (filter === "client") return p.type === "client";
    if (filter === "creator") return p.type === "creator";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="client">Clienti</SelectItem>
            <SelectItem value="creator">Creator</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !filtered.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nessun pagamento registrato</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Periodo / Ciclo</TableHead>
                <TableHead className="text-right">Importo (€)</TableHead>
                <TableHead>Data pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={`${p.type}-${p.id}`}>
                  <TableCell>
                    <Badge variant={p.type === "client" ? "default" : "secondary"}>
                      {p.type === "client" ? "Cliente" : "Creator"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.periodLabel}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                  <TableCell>{p.paidAt ? new Date(p.paidAt).toLocaleDateString("it-IT") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ── Tab 4: Riepilogo ── */
function SummaryTab() {
  const { data, isLoading } = usePaymentSummary();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { icon: ArrowDownCircle, label: "Incassato questo mese", value: data.clientReceivedMonth, color: "text-success" },
    { icon: ArrowUpCircle, label: "Pagato questo mese", value: data.creatorPaidMonth, color: "text-destructive" },
    { icon: TrendingUp, label: "Margine mese", value: data.marginMonth, color: data.marginMonth >= 0 ? "text-success" : "text-destructive" },
    { icon: Clock, label: "In attesa (clienti)", value: data.pendingClientAmount, color: "text-warning" },
    { icon: AlertTriangle, label: "Da pagare (creator)", value: data.pendingCreatorAmount, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entrate vs Uscite — Ultimi 6 mesi</CardTitle>
        </CardHeader>
        <CardContent>
          {data.last6Months.every((m) => m.income === 0 && m.expense === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun dato disponibile per il grafico</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.last6Months}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Bar dataKey="income" name="Entrate" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Uscite" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════ */

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Pagamenti</h1>
      </div>

      <Tabs defaultValue="receivable" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receivable">Da Ricevere</TabsTrigger>
          <TabsTrigger value="payable">Da Pagare</TabsTrigger>
          <TabsTrigger value="history">Storico</TabsTrigger>
          <TabsTrigger value="summary">Riepilogo</TabsTrigger>
        </TabsList>

        <TabsContent value="receivable"><ClientPaymentsTab /></TabsContent>
        <TabsContent value="payable"><CreatorPaymentsTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="summary"><SummaryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
