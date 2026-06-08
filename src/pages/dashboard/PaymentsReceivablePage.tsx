import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle, Check, ChevronDown, ChevronRight, Info, Pencil, Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { paymentKindLabel } from "@/lib/paymentTerms";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const [editing, setEditing] = useState<ClientPaymentRow | null>(null);
  const [editForm, setEditForm] = useState({ fixed: 0, cpm: 0, dueDate: "", notes: "" });
  const [deleting, setDeleting] = useState<ClientPaymentRow | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  function openEdit(p: ClientPaymentRow) {
    setEditing(p);
    setEditForm({
      fixed: p.fixedAmount,
      cpm: p.cpmAmount,
      dueDate: p.dueDate,
      notes: p.notes ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setActionSaving(true);
    try {
      const total = Number(editForm.fixed) + Number(editForm.cpm);
      const { error } = await supabase
        .from("client_payments")
        .update({
          fixed_amount: Number(editForm.fixed),
          cpm_amount: Number(editForm.cpm),
          total_amount: total,
          due_date: editForm.dueDate,
          notes: editForm.notes || null,
          amount_overridden: true,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Pagamento modificato", description: `${editing.campaignName} — ${editing.monthLabel}` });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      qc.invalidateQueries({ queryKey: ["payment-history-all"] });
      setEditing(null);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setActionSaving(true);
    try {
      const { error } = await supabase.from("client_payments").delete().eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Pagamento eliminato", description: `${deleting.campaignName} — ${deleting.monthLabel}` });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      setDeleting(null);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  }

  const filtered = (data ?? []).filter((p) => {
    if (filter === "pending") return !p.isPaid && !p.isOverdue;
    if (filter === "paid") return p.isPaid;
    if (filter === "overdue") return p.isOverdue;
    return true;
  });

  // Group filtered payments by campaign
  const grouped = filtered.reduce<Record<string, ClientPaymentRow[]>>((acc, p) => {
    (acc[p.campaignId] = acc[p.campaignId] ?? []).push(p);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) =>
    grouped[a][0].campaignName.localeCompare(grouped[b][0].campaignName),
  );
  groupKeys.forEach((k) => grouped[k].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));

  function campaignSummary(rows: ClientPaymentRow[]) {
    const paid = rows.filter((r) => r.isPaid).reduce((s, r) => s + r.totalAmount, 0);
    const overdue = rows.filter((r) => r.isOverdue && !r.isPaid).reduce((s, r) => s + r.totalAmount, 0);
    const pending = rows.filter((r) => !r.isPaid && !r.isOverdue).reduce((s, r) => s + r.totalAmount, 0);
    return { paid, overdue, pending, count: rows.length };
  }

  const defaultExpanded = groupKeys.filter((k) => grouped[k].some((p) => !p.isPaid));

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
        <Accordion type="multiple" defaultValue={defaultExpanded} className="space-y-3">
          {groupKeys.map((campaignId) => {
            const rows = grouped[campaignId];
            const camp = rows[0];
            const sum = campaignSummary(rows);

            return (
              <AccordionItem key={campaignId} value={campaignId} className="border-0">
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    <div className="flex flex-1 items-center justify-between gap-4 pr-3">
                      <div className="text-left">
                        <div className="font-semibold text-base">{camp.campaignName}</div>
                        <div className="text-xs text-muted-foreground">
                          {camp.clientName} · {sum.count} {sum.count === 1 ? "pagamento" : "pagamenti"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {sum.overdue > 0 && (
                          <Badge variant="destructive">🔴 Scaduto: {formatCurrency(sum.overdue)}</Badge>
                        )}
                        {sum.pending > 0 && (
                          <Badge variant="secondary">⏳ In attesa: {formatCurrency(sum.pending)}</Badge>
                        )}
                        {sum.paid > 0 && (
                          <Badge variant="outline">✅ Pagato: {formatCurrency(sum.paid)}</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/campaigns/${campaignId}`);
                          }}
                        >
                          Apri →
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
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
                        {rows.map((p) => {
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
                                <TableCell>
                                  {p.monthLabel}
                                  {p.paymentKind === "tot_fixed_first" && <Badge variant="secondary" className="ml-2">1ª metà</Badge>}
                                  {p.paymentKind === "tot_fixed_second" && <Badge variant="secondary" className="ml-2">2ª metà</Badge>}
                                  {p.paymentKind === "tot_final_cpm" && <Badge className="ml-2">CPM finale</Badge>}
                                </TableCell>
                                <TableCell>{new Date(p.dueDate).toLocaleDateString("it-IT")}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.fixedAmount)}</TableCell>
                                <TableCell className="text-right">{formatViews(p.cpmViews)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.cpmAmount)}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(p.totalAmount)}
                                  {p.amountOverridden && (
                                    <Badge variant="outline" className="ml-2 text-[10px]">manuale</Badge>
                                  )}
                                </TableCell>
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
                                  <div className="flex items-center justify-end gap-1">
                                    {p.isPaid ? (
                                      <span className="text-xs text-muted-foreground mr-1">
                                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("it-IT") : "—"}
                                      </span>
                                    ) : (
                                      <Button size="sm" variant="outline" onClick={() => setConfirm(p)}>
                                        <Check className="mr-1 h-3 w-3" /> Segna Ricevuto
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-8 w-8"
                                      onClick={() => openEdit(p)} title="Modifica">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setDeleting(p)} title="Elimina">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow key={`${p.id}-detail`}>
                                  <TableCell colSpan={9} className="bg-muted/30 px-6 py-4">
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
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>
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

      {/* Edit payment dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica pagamento</DialogTitle>
            <DialogDescription>
              {editing?.campaignName} — {editing?.monthLabel}
              <br />
              <span className="text-xs">Modifiche manuali bypassano il ricalcolo automatico dei CPM.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Fisso (€)</Label>
                <Input type="number" step="0.01" value={editForm.fixed}
                  onChange={(e) => setEditForm({ ...editForm, fixed: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label>CPM (€)</Label>
                <Input type="number" step="0.01" value={editForm.cpm}
                  onChange={(e) => setEditForm({ ...editForm, cpm: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Scadenza</Label>
              <Input type="date" value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Note (opzionali)</Label>
              <Textarea value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Es: pagamento anticipato, sconto su CPM..." />
            </div>
            <div className="rounded-md bg-muted p-2 text-sm flex justify-between">
              <span>Totale</span>
              <span className="font-semibold">
                {formatCurrency((Number(editForm.fixed) || 0) + (Number(editForm.cpm) || 0))}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={handleSaveEdit} disabled={actionSaving}>
              {actionSaving ? "Salvando..." : "Salva modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.campaignName} — {deleting?.monthLabel} — {deleting ? formatCurrency(deleting.totalAmount) : ""}.
              L'azione non è reversibile. Se la riga è stata generata automaticamente, verrà ricreata alla prossima rigenerazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionSaving}>
              {actionSaving ? "Eliminando..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
