import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpCircle, Check, ChevronLeft, ChevronRight, FileText, Users, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { useContractPayable, type CreatorInContract, type ContractPayableSection } from "@/hooks/useCreatorPayable";
import {
  getContractPeriod,
  parseContractStartDate,
  formatPeriodRange,
} from "@/lib/contractPeriods";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#1a1a28] ${className}`} />;
}

interface ConfirmData {
  creator: CreatorInContract;
  section: ContractPayableSection;
  periodNumber: number;
}

export default function PaymentsPayablePage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [periodByContract, setPeriodByContract] = useState<Record<string, number>>({});

  useEffect(() => {
    if (role === "team") navigate("/dashboard", { replace: true });
  }, [role, navigate]);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmData | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: sections, isLoading } = useContractPayable(periodByContract);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Initialize periods to current on first load
  useEffect(() => {
    if (sections && Object.keys(periodByContract).length === 0) {
      const initial: Record<string, number> = {};
      sections.forEach((s) => {
        initial[s.contractId] = s.currentPeriod;
      });
      setPeriodByContract(initial);
    }
  }, [sections]);

  function setPeriod(contractId: string, period: number) {
    setPeriodByContract((prev) => ({ ...prev, [contractId]: Math.max(1, period) }));
  }

  function getPeriodLabel(startDate: string, periodNumber: number, firstPeriodStartStr?: string | null): string {
    const sd = parseContractStartDate(startDate);
    const fps = firstPeriodStartStr ? parseContractStartDate(firstPeriodStartStr) : null;
    const { periodStart, periodEnd } = getContractPeriod(sd, periodNumber, fps);
    return formatPeriodRange(periodStart, periodEnd);
  }

  async function handleMarkPaid(data: ConfirmData) {
    setSaving(true);
    try {
      const { creator, section, periodNumber } = data;
      const sd = parseContractStartDate(section.startDate);
      const fps = section.firstPeriodStart ? parseContractStartDate(section.firstPeriodStart) : null;
      const { periodStart, periodEnd } = getContractPeriod(sd, periodNumber, fps);

      const payload: any = {
        creator_id: creator.creatorId,
        period_month: periodStart.getUTCMonth() + 1,
        period_year: periodStart.getUTCFullYear(),
        period_start: periodStart.toISOString().split("T")[0],
        period_end: periodEnd.toISOString().split("T")[0],
        fixed_amount: creator.fixedEarned ? creator.fixedAmount : 0,
        fixed_earned: creator.fixedEarned,
        cpm_amount: creator.cpmAmount,
        total_amount: creator.subtotal,
        is_paid: true,
        paid_at: new Date().toISOString(),
      };

      if (creator.paymentId) {
        const { error } = await supabase.from("creator_payments").update(payload).eq("id", creator.paymentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("creator_payments").insert(payload);
        if (error) throw error;
      }

      toast({ title: "Pagamento registrato", description: `${creator.creatorName} segnato come pagato.` });
      qc.invalidateQueries({ queryKey: ["contract-payable"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }

  // Global totals across all contracts
  const allSections = sections ?? [];
  const globalPending = allSections.reduce((s, sec) =>
    s + sec.creators.filter((c) => !c.isPaid).reduce((ss, c) => ss + c.subtotal, 0), 0);
  const globalPaid = allSections.reduce((s, sec) =>
    s + sec.creators.filter((c) => c.isPaid).reduce((ss, c) => ss + c.subtotal, 0), 0);

  // Aggregate per-creator across all contracts (current selected periods)
  type CreatorBreakdown = {
    contractId: string;
    contractName: string;
    periodNumber: number;
    section: ContractPayableSection;
    creator: CreatorInContract;
  };
  type CreatorRollup = {
    creatorId: string;
    creatorName: string;
    totalPending: number;
    totalPaid: number;
    total: number;
    breakdown: CreatorBreakdown[];
  };
  const creatorRollupMap = new Map<string, CreatorRollup>();
  allSections.forEach((sec) => {
    const pn = periodByContract[sec.contractId] ?? sec.currentPeriod;
    sec.creators.forEach((cr) => {
      if (cr.subtotal <= 0 && cr.videoCount === 0) return;
      const cur = creatorRollupMap.get(cr.creatorId) ?? {
        creatorId: cr.creatorId,
        creatorName: cr.creatorName,
        totalPending: 0,
        totalPaid: 0,
        total: 0,
        breakdown: [],
      };
      cur.total += cr.subtotal;
      if (cr.isPaid) cur.totalPaid += cr.subtotal;
      else cur.totalPending += cr.subtotal;
      cur.breakdown.push({
        contractId: sec.contractId,
        contractName: sec.contractName,
        periodNumber: pn,
        section: sec,
        creator: cr,
      });
      creatorRollupMap.set(cr.creatorId, cur);
    });
  });
  const creatorRollups = Array.from(creatorRollupMap.values())
    .filter((r) => r.total > 0)
    .sort((a, b) => b.totalPending - a.totalPending || a.creatorName.localeCompare(b.creatorName));

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-[#f8fafc]">Pagamenti da fare</h1>
      </div>

      {/* Global KPI + filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider">Da pagare</p>
            <p className="text-xl font-bold text-[#f8fafc]">{formatCurrency(globalPending)}</p>
          </div>
          <div className="h-8 w-px bg-[#1e1e2e]" />
          <div>
            <p className="text-xs text-[#64748b] uppercase tracking-wider">Già pagato</p>
            <p className="text-xl font-bold text-emerald-400">{formatCurrency(globalPaid)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="active-filter" checked={showOnlyActive} onCheckedChange={setShowOnlyActive} />
          <Label htmlFor="active-filter" className="text-xs text-[#64748b] cursor-pointer">Solo con attività</Label>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Shimmer key={i} className="h-32" />)}
        </div>
      ) : !allSections.length ? (
        <Card className="border-[#1e1e2e] bg-[#111118]">
          <CardContent className="py-12 text-center text-[#64748b]">
            Nessun contratto attivo.
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Unified per-creator rollup */}
        <Card className="border-[#1e1e2e] bg-[#111118] overflow-hidden">
          <CardHeader className="border-b border-[#1e1e2e] pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base text-[#f8fafc]">Totale per Creator</CardTitle>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Somma di tutti i contratti nei periodi selezionati. Espandi per vedere il dettaglio.
                </p>
              </div>
            </div>
          </CardHeader>
          {!creatorRollups.length ? (
            <CardContent className="py-8 text-center text-[#64748b] text-sm">
              Nessun creator con attività nei periodi selezionati.
            </CardContent>
          ) : (
            <div className="divide-y divide-[#1e1e2e]">
              {creatorRollups.map((r) => (
                <Collapsible key={r.creatorId}>
                  <CollapsibleTrigger className="w-full group">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#0d0d14]/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <ChevronDown className="h-4 w-4 text-[#64748b] transition-transform group-data-[state=open]:rotate-180 shrink-0" />
                        <span
                          className="font-medium text-[#f8fafc] hover:underline truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/creators/${r.creatorId}`);
                          }}
                        >
                          {r.creatorName}
                        </span>
                        <Badge className="bg-[#1a1a28] text-[#94a3b8] border-[#2a2a3e] text-[10px] shrink-0">
                          {r.breakdown.length} {r.breakdown.length === 1 ? "contratto" : "contratti"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {r.totalPaid > 0 && (
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Pagato</p>
                            <p className="text-sm font-semibold text-emerald-400">{formatCurrency(r.totalPaid)}</p>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-[10px] text-[#64748b] uppercase tracking-wider">Da pagare</p>
                          <p className="text-base font-bold text-[#f8fafc]">{formatCurrency(r.totalPending)}</p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-[#0d0d14]/50 px-4 py-2">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                            <TableHead className="text-[#64748b] text-xs">Contratto</TableHead>
                            <TableHead className="text-[#64748b] text-xs text-center">Video</TableHead>
                            <TableHead className="text-[#64748b] text-xs text-center">Fisso</TableHead>
                            <TableHead className="text-[#64748b] text-xs text-right">CPM</TableHead>
                            <TableHead className="text-[#64748b] text-xs text-right">Subtotale</TableHead>
                            <TableHead className="text-[#64748b] text-xs">Stato</TableHead>
                            <TableHead className="text-[#64748b] text-xs text-right">Azioni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {r.breakdown.map((b) => (
                            <TableRow key={b.contractId} className="border-[#1e1e2e] hover:bg-[#0d0d14]/50">
                              <TableCell>
                                <span
                                  className="font-medium text-[#f8fafc] hover:underline cursor-pointer text-sm"
                                  onClick={() => navigate(`/dashboard/contracts/${b.contractId}`)}
                                >
                                  {b.contractName}
                                </span>
                                <p className="text-[10px] text-[#64748b]">
                                  Periodo {b.periodNumber} · {getPeriodLabel(b.section.startDate, b.periodNumber, b.section.firstPeriodStart)}
                                </p>
                              </TableCell>
                              <TableCell className="text-center text-[#94a3b8] text-sm">
                                {b.creator.videoCount}/{b.creator.monthlyTarget}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  className={`text-[10px] ${
                                    b.creator.fixedEarned
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                      : "bg-red-500/15 text-red-400 border-red-500/30"
                                  }`}
                                >
                                  {formatCurrency(b.creator.fixedEarned ? b.creator.fixedAmount : 0)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-[#94a3b8] text-sm">
                                {formatCurrency(b.creator.cpmAmount)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-[#f8fafc]">
                                {formatCurrency(b.creator.subtotal)}
                              </TableCell>
                              <TableCell>
                                {b.creator.isPaid ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                                    ✅ Pagato
                                  </Badge>
                                ) : b.creator.subtotal > 0 ? (
                                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                                    ⏳ Da pagare
                                  </Badge>
                                ) : (
                                  <Badge className="bg-[#1a1a28] text-[#64748b] border-[#2a2a3e] text-[10px]">—</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!b.creator.isPaid && b.creator.subtotal > 0 && (
                                  <Button
                                    size="sm" variant="outline"
                                    className="border-[#1e1e2e] hover:bg-[#1a1a28]"
                                    onClick={() => setConfirm({ creator: b.creator, section: b.section, periodNumber: b.periodNumber })}
                                  >
                                    <Check className="mr-1 h-3 w-3" /> Pagato
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </Card>

        {/* One section per contract */}
        {allSections.map((section) => {
          const pn = periodByContract[section.contractId] ?? section.currentPeriod;
          const filteredCreators = section.creators.filter((c) => {
            if (!showOnlyActive) return true;
            return c.subtotal > 0 || c.videoCount > 0;
          });
          const sectionPending = filteredCreators.filter((c) => !c.isPaid).reduce((s, c) => s + c.subtotal, 0);

          return (
            <Card key={section.contractId} className="border-[#1e1e2e] bg-[#111118] overflow-hidden">
              <CardHeader className="border-b border-[#1e1e2e] pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle
                        className="text-base text-[#f8fafc] hover:underline cursor-pointer"
                        onClick={() => navigate(`/dashboard/contracts/${section.contractId}`)}
                      >
                        {section.contractName}
                      </CardTitle>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        Subtotale: {formatCurrency(sectionPending)}
                      </p>
                    </div>
                  </div>

                  {/* Period navigator per contract */}
                  <div className="flex items-center gap-1 bg-[#0d0d14] border border-[#1e1e2e] rounded-lg px-2 py-1">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setPeriod(section.contractId, pn - 1)}
                      disabled={pn <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center min-w-[160px]">
                      <p className="text-xs font-medium text-[#f8fafc]">Periodo {pn}</p>
                      <p className="text-[10px] text-[#64748b]">{getPeriodLabel(section.startDate, pn, section.firstPeriodStart)}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => setPeriod(section.contractId, pn + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!filteredCreators.length ? (
                <CardContent className="py-8 text-center text-[#64748b] text-sm">
                  {showOnlyActive
                    ? "Nessun creator con attività per questo periodo."
                    : "Nessun creator in questo contratto."}
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1e1e2e] hover:bg-transparent">
                      <TableHead className="text-[#64748b]">Creator</TableHead>
                      <TableHead className="text-[#64748b] text-center">Video</TableHead>
                      <TableHead className="text-[#64748b] text-center">Fisso</TableHead>
                      <TableHead className="text-[#64748b] text-right">CPM</TableHead>
                      <TableHead className="text-[#64748b] text-right">Totale</TableHead>
                      <TableHead className="text-[#64748b]">Status</TableHead>
                      <TableHead className="text-[#64748b] text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCreators.map((cr) => (
                      <TableRow key={cr.creatorId} className="border-[#1e1e2e] hover:bg-[#0d0d14]/50">
                        <TableCell>
                          <span
                            className="font-medium text-[#f8fafc] hover:underline cursor-pointer"
                            onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}
                          >
                            {cr.creatorName}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-[#94a3b8]">
                          {cr.videoCount}/{cr.monthlyTarget}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={`text-[10px] ${
                              cr.fixedEarned
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border-red-500/30"
                            }`}
                          >
                            {cr.fixedEarned ? "✅" : "❌"} {formatCurrency(cr.fixedEarned ? cr.fixedAmount : 0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-[#94a3b8] text-sm">
                          {formatCurrency(cr.cpmAmount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-[#f8fafc]">
                          {formatCurrency(cr.subtotal)}
                        </TableCell>
                        <TableCell>
                          {cr.isPaid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                              ✅ Pagato
                            </Badge>
                          ) : cr.subtotal > 0 ? (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                              ⏳ Da pagare
                            </Badge>
                          ) : (
                            <Badge className="bg-[#1a1a28] text-[#64748b] border-[#2a2a3e] text-[10px]">—</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {cr.isPaid ? (
                            <span className="text-xs text-[#64748b]">
                              {cr.paidAt ? new Date(cr.paidAt).toLocaleDateString("it-IT") : "—"}
                            </span>
                          ) : cr.subtotal > 0 ? (
                            <Button
                              size="sm" variant="outline"
                              className="border-[#1e1e2e] hover:bg-[#1a1a28]"
                              onClick={() => setConfirm({ creator: cr, section, periodNumber: pn })}
                            >
                              <Check className="mr-1 h-3 w-3" /> Pagato
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          );
        })}
        </>
      )}

      {/* Confirm Dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="bg-[#111118] border-[#1e1e2e]">
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Segna come pagato <strong>{confirm?.creator.creatorName}</strong> per{" "}
              {confirm?.section.contractName} — Periodo {confirm?.periodNumber}?
            </DialogDescription>
          </DialogHeader>
          {confirm && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-[#64748b]">Fisso</span>
                <span className="text-[#f8fafc]">
                  {formatCurrency(confirm.creator.fixedEarned ? confirm.creator.fixedAmount : 0)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748b]">CPM</span>
                <span className="text-[#f8fafc]">{formatCurrency(confirm.creator.cpmAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-[#2a2a3e]">
                <span>Totale</span>
                <span className="text-[#f8fafc]">{formatCurrency(confirm.creator.subtotal)}</span>
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
