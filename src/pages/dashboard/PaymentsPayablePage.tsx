import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpCircle, Check, ChevronDown, ChevronRight,
  ChevronLeft, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { useCreatorPayable, type CreatorPayableRow } from "@/hooks/useCreatorPayable";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#1a1a28] ${className}`} />;
}

export default function PaymentsPayablePage() {
  const navigate = useNavigate();
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<CreatorPayableRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useCreatorPayable(periodNumber);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Set initial period to current when meta loads
  useEffect(() => {
    if (data?.meta && periodNumber === 1 && data.meta.currentPeriod > 1) {
      setPeriodNumber(data.meta.currentPeriod);
    }
  }, [data?.meta?.currentPeriod]);

  const rows = (data?.rows ?? []).filter((r) => {
    if (!showOnlyActive) return true;
    return r.totalAmount > 0 || r.monthVideoCount > 0;
  });

  const pendingTotal = rows.filter((r) => !r.isPaid).reduce((s, r) => s + r.totalAmount, 0);
  const paidTotal = rows.filter((r) => r.isPaid).reduce((s, r) => s + r.totalAmount, 0);

  function toggleExpand(creatorId: string) {
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
  }

  async function handleMarkPaid(row: CreatorPayableRow) {
    setSaving(true);
    try {
      // Use the first contract's period dates as reference
      const firstBreakdown = row.contracts[0];
      const periodStart = firstBreakdown?.periodStart;
      const periodEnd = firstBreakdown?.periodEnd;
      const pStartDate = periodStart ? new Date(periodStart) : new Date();

      const payload: any = {
        creator_id: row.creatorId,
        period_month: pStartDate.getUTCMonth() + 1,
        period_year: pStartDate.getUTCFullYear(),
        period_start: periodStart,
        period_end: periodEnd,
        fixed_amount: row.contracts.reduce((s, c) => s + (c.fixedEarned ? c.fixedAmount : 0), 0),
        fixed_earned: row.contracts.some((c) => c.fixedEarned),
        cpm_amount: row.contracts.reduce((s, c) => s + c.cpmAmount, 0),
        total_amount: row.totalAmount,
        is_paid: true,
        paid_at: new Date().toISOString(),
      };

      if (row.paymentId) {
        const { error } = await supabase.from("creator_payments").update(payload).eq("id", row.paymentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("creator_payments").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pagamento registrato", description: `${row.creatorName} segnato come pagato.` });
      qc.invalidateQueries({ queryKey: ["creator-payable"] });
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
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-[#f8fafc]">Pagamenti da fare</h1>
      </div>

      {/* KPI + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider">Da pagare</p>
            <p className="text-xl font-bold text-[#f8fafc]">{formatCurrency(pendingTotal)}</p>
          </div>
          <div className="h-8 w-px bg-[#1e1e2e]" />
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider">Già pagato</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(paidTotal)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="active-filter"
              checked={showOnlyActive}
              onCheckedChange={setShowOnlyActive}
            />
            <Label htmlFor="active-filter" className="text-xs text-[#64748b] cursor-pointer">
              Solo con attività
            </Label>
          </div>

          {/* Period Navigator */}
          <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-lg px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPeriodNumber((p) => Math.max(1, p - 1))}
              disabled={periodNumber <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[180px]">
              <p className="text-xs font-medium text-[#f8fafc]">Periodo {periodNumber}</p>
              <p className="text-[10px] text-[#64748b]">{data?.meta?.periodLabel ?? "..."}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPeriodNumber((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-14" />)}
        </div>
      ) : !rows.length ? (
        <Card className="border-[#1e1e2e] bg-[#111118]">
          <CardContent className="py-12 text-center text-[#64748b]">
            {showOnlyActive
              ? "Nessun creator con attività per questo periodo. Disattiva il filtro per vedere tutti."
              : "Nessun creator attivo."}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#1e1e2e] bg-[#111118] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead className="text-[#64748b]">Creator</TableHead>
                <TableHead className="text-[#64748b]">Contratti</TableHead>
                <TableHead className="text-[#64748b] text-right">Video</TableHead>
                <TableHead className="text-[#64748b] text-right">Totale (€)</TableHead>
                <TableHead className="text-[#64748b]">Status</TableHead>
                <TableHead className="text-[#64748b] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((cr) => {
                const isExpanded = expandedCreators.has(cr.creatorId);

                return (
                  <>
                    {/* Main row */}
                    <TableRow
                      key={cr.creatorId}
                      className={`border-[#1e1e2e] cursor-pointer transition-colors ${
                        isExpanded ? "bg-[#0d0d14]" : "hover:bg-[#0d0d14]/50"
                      }`}
                      onClick={() => cr.hasContracts && toggleExpand(cr.creatorId)}
                    >
                      <TableCell className="w-8 px-3">
                        {cr.hasContracts ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#64748b]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#64748b]" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-medium text-[#f8fafc] hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/creators/${cr.creatorId}`);
                          }}
                        >
                          {cr.creatorName}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!cr.hasContracts ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                            ⚠️ Nessun contratto
                          </Badge>
                        ) : cr.contracts.length === 1 ? (
                          <span
                            className="text-sm text-[#94a3b8] hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/dashboard/contracts/${cr.contracts[0].contractId}`);
                            }}
                          >
                            {cr.contracts[0].contractName}
                          </span>
                        ) : (
                          <span className="text-sm text-[#94a3b8]">
                            {cr.contracts.length} contratti
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[#f8fafc]">
                        {cr.monthVideoCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[#f8fafc]">
                        {formatCurrency(cr.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {cr.isPaid ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                            ✅ Pagato
                          </Badge>
                        ) : cr.totalAmount > 0 ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                            ⏳ Da pagare
                          </Badge>
                        ) : (
                          <Badge className="bg-[#1a1a28] text-[#64748b] border-[#2a2a3e] text-[10px]">
                            — Nessun importo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {cr.isPaid ? (
                          <span className="text-xs text-[#64748b]">
                            {cr.paidAt ? new Date(cr.paidAt).toLocaleDateString("it-IT") : "—"}
                          </span>
                        ) : cr.totalAmount > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#1e1e2e] hover:bg-[#1a1a28]"
                            onClick={() => setConfirm(cr)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Segna Pagato
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>

                    {/* Expanded contract rows */}
                    {isExpanded && cr.contracts.map((c) => (
                      <TableRow
                        key={`${cr.creatorId}-${c.contractId}`}
                        className="border-[#1e1e2e] bg-[#0a0a12]"
                      >
                        <TableCell />
                        <TableCell className="pl-10">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-[#64748b]" />
                            <span
                              className="text-sm text-[#94a3b8] hover:underline cursor-pointer"
                              onClick={() => navigate(`/dashboard/contracts/${c.contractId}`)}
                            >
                              {c.contractName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-[#64748b]">
                          Video: {c.monthVideoCount}/{c.monthlyTarget}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`text-[10px] ${
                              c.fixedEarned
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border-red-500/30"
                            }`}
                          >
                            Fisso {c.fixedEarned ? "✅" : "❌"} {formatCurrency(c.fixedEarned ? c.fixedAmount : 0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-[#94a3b8]">
                          CPM {formatCurrency(c.cpmAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-[#f8fafc]">
                          {formatCurrency(c.subtotal)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e]">
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Segna come pagato <strong>{confirm?.creatorName}</strong> per Periodo {periodNumber}?
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="space-y-2 text-sm">
              {confirm.contracts.map((c) => (
                <div key={c.contractId} className="flex justify-between py-1 border-b border-[#1e1e2e] last:border-b-0">
                  <span className="text-[#64748b]">{c.contractName}</span>
                  <span className="text-[#f8fafc]">{formatCurrency(c.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold pt-2 border-t border-[#2a2a3e]">
                <span>Totale</span>
                <span className="text-[#f8fafc]">{formatCurrency(confirm.totalAmount)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-[#1e1e2e]" onClick={() => setConfirm(null)}>
              Annulla
            </Button>
            <Button onClick={() => confirm && handleMarkPaid(confirm)} disabled={saving}>
              {saving ? "Salvataggio..." : "Conferma Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
