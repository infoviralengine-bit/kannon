import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronRight, Pencil, CalendarIcon, RefreshCw, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatViews, formatCurrency } from "@/lib/format";
import { getEffectiveViews } from "@/lib/videoWindow";
import { CappedBadge } from "@/components/CappedViewsBadge";
import {
  useCampaignDetail, useCampaignKpi, useCampaignMargin,
  useCampaignCreators, useCampaignAccounts,
  useAllCreatorsForSelect,
} from "@/hooks/useCampaignData";
import { useCampaignCycles, type ClientPaymentRow } from "@/hooks/usePaymentsData";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/contexts/AuthContext";

const statusColor: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground border-border",
};
const statusLabel: Record<string, string> = {
  active: "Attiva",
  paused: "In pausa",
  completed: "Conclusa",
};

function StatItem({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-lg font-bold", accent && "text-primary")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EditCampaignModal({
  open, onOpenChange, campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: {
    id: string; name: string; client_name: string;
    client_cpm: number | null; client_fixed_per_creator: number | null;
    start_date: string; end_date: string | null; notes: string | null;
    planned_creators?: number;
    video_views_cap?: number | null;
    monthly_spend_cap?: number | null;
  };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(campaign.name);
  const [clientName, setClientName] = useState(campaign.client_name);
  const [clientCpm, setClientCpm] = useState(String(campaign.client_cpm ?? 2));
  const [clientFixed, setClientFixed] = useState(String(campaign.client_fixed_per_creator ?? 200));
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(campaign.start_date));
  const [endDate, setEndDate] = useState<Date | undefined>(campaign.end_date ? new Date(campaign.end_date) : undefined);
  const [notes, setNotes] = useState(campaign.notes ?? "");
  const [plannedCreators, setPlannedCreators] = useState(String((campaign as any).planned_creators ?? 1));
  const [videoViewsCap, setVideoViewsCap] = useState(campaign.video_views_cap != null ? String(campaign.video_views_cap) : "");
  const [monthlySpendCap, setMonthlySpendCap] = useState(campaign.monthly_spend_cap != null ? String(campaign.monthly_spend_cap) : "");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name || !clientName || !startDate) throw new Error("Compila i campi obbligatori");
      const parsedCpm = parseFloat(clientCpm);
      const newCpm = isNaN(parsedCpm) ? 2 : parsedCpm;
      const parsedFixed = parseFloat(clientFixed);
      const newFixed = isNaN(parsedFixed) ? 200 : parsedFixed;
      const parsedPlanned = parseInt(plannedCreators);
      const newPlanned = Math.max(1, isNaN(parsedPlanned) ? 1 : parsedPlanned);
      const parsedViewsCap = videoViewsCap.trim() ? parseInt(videoViewsCap) : null;
      const parsedSpendCap = monthlySpendCap.trim() ? parseFloat(monthlySpendCap) : null;

      const { error } = await supabase.from("campaigns").update({
        name,
        client_name: clientName,
        client_cpm: newCpm,
        client_fixed_per_creator: newFixed,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        notes: notes || null,
        planned_creators: newPlanned,
        video_views_cap: parsedViewsCap,
        monthly_spend_cap: parsedSpendCap,
      } as any).eq("id", campaign.id);
      if (error) throw error;

      // Recalculate unpaid cycles
      const { data: unpaidPayments } = await supabase
        .from("client_payments")
        .select("id, cycle_id, cpm_views")
        .eq("campaign_id", campaign.id)
        .eq("is_paid", false);

      if (unpaidPayments && unpaidPayments.length > 0) {
        const cycleIds = unpaidPayments.map((p) => p.cycle_id);
        const { data: cycles } = await supabase
          .from("payment_cycles")
          .select("id, is_last_cycle")
          .in("id", cycleIds);
        const cycleMap = new Map((cycles ?? []).map((c) => [c.id, c.is_last_cycle]));

        const { data: cc } = await supabase
          .from("campaign_creators")
          .select("creator_id")
          .eq("campaign_id", campaign.id);
        const actualCreators = (cc ?? []).length;
        const creatorCount = actualCreators > 0 ? actualCreators : newPlanned;

        for (const p of unpaidPayments) {
          const isLast = cycleMap.get(p.cycle_id) ?? false;
          const fixedAmount = isLast ? 0 : newFixed * creatorCount;
          const cpmAmount = newCpm * (p.cpm_views / 1000);
          let totalAmount = fixedAmount + cpmAmount;
          
          // Apply spend cap
          if (parsedSpendCap != null && totalAmount > parsedSpendCap) {
            totalAmount = parsedSpendCap;
          }

          await supabase.from("client_payments").update({
            fixed_amount: fixedAmount,
            cpm_amount: cpmAmount,
            total_amount: totalAmount,
          }).eq("id", p.id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Campagna aggiornata", description: "Cicli di pagamento ricalcolati" });
      qc.invalidateQueries({ queryKey: ["campaign-detail", campaign.id] });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      qc.invalidateQueries({ queryKey: ["campaign-cycles", campaign.id] });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Modifica Campagna</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nome campagna *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Nome cliente *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>CPM Cliente (€)</Label>
              <Input type="number" step="0.01" value={clientCpm} onChange={(e) => setClientCpm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fisso per Creator (€)</Label>
              <Input type="number" step="0.01" value={clientFixed} onChange={(e) => setClientFixed(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Data inizio *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Seleziona"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" locale={it} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label>Data fine</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Opzionale"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" locale={it} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>N° creator previsti</Label>
            <Input type="number" min="1" step="1" value={plannedCreators} onChange={(e) => setPlannedCreators(e.target.value)} />
          </div>
          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Cap (opzionali)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Cap views per video</Label>
              <Input type="number" min="0" step="1" value={videoViewsCap} onChange={(e) => setVideoViewsCap(e.target.value)} placeholder="es. 100000 — vuoto = nessun cap" />
            </div>
            <div className="grid gap-1.5">
              <Label>Cap di spesa per ciclo (€)</Label>
              <Input type="number" min="0" step="0.01" value={monthlySpendCap} onChange={(e) => setMonthlySpendCap(e.target.value)} placeholder="es. 5000 — vuoto = nessun cap" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddCreatorModal({ open, onOpenChange, campaignId }: {
  open: boolean; onOpenChange: (v: boolean) => void; campaignId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: creators } = useAllCreatorsForSelect();
  const [selectedId, setSelectedId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Seleziona un creator");
      const { error } = await supabase.from("campaign_creators").insert({
        campaign_id: campaignId,
        creator_id: selectedId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator aggiunto alla campagna" });
      qc.invalidateQueries({ queryKey: ["campaign-creators", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-kpi", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-margin", campaignId] });
      onOpenChange(false);
      setSelectedId("");
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Aggiungi Creator</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Seleziona creator" /></SelectTrigger>
            <SelectContent>
              {(creators ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Aggiunta..." : "Aggiungi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Spend Cap Banner ── */
function SpendCapBanner({ campaign, campaignId }: {
  campaign: any;
  campaignId: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newCap, setNewCap] = useState("");

  const isPausedForCap = campaign.status === "paused" && campaign.monthly_spend_cap != null;

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const parsedCap = parseFloat(newCap);
      if (isNaN(parsedCap) || parsedCap <= 0) throw new Error("Inserisci un cap valido");
      const { error } = await supabase.from("campaigns").update({
        monthly_spend_cap: parsedCap,
        status: "active",
      } as any).eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campagna riattivata", description: `Nuovo cap: €${newCap}` });
      qc.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      setShowModal(false);
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  if (!isPausedForCap) return null;

  return (
    <>
      <Card className="border-warning/50 bg-warning/10">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span className="text-sm">
              ⚠️ Cap di spesa raggiunto ({formatCurrency(campaign.monthly_spend_cap)}) — Campagna in pausa.
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setNewCap(String(campaign.monthly_spend_cap * 1.5)); setShowModal(true); }}>
              Aumenta cap e riprendi
            </Button>
            <Button size="sm" variant="outline">
              Mantieni in pausa
            </Button>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Aumenta Cap di Spesa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">Cap attuale: {formatCurrency(campaign.monthly_spend_cap)}</p>
            <div className="grid gap-1.5">
              <Label>Nuovo cap (€)</Label>
              <Input type="number" step="0.01" value={newCap} onChange={(e) => setNewCap(e.target.value)} />
            </div>
            <Button onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}>
              {resumeMutation.isPending ? "Salvataggio..." : "Salva e Riattiva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Cycles Section ── */
function CyclesSection({ campaignId, campaign, cycles }: {
  campaignId: string;
  campaign: { start_date: string; end_date: string | null; client_fixed_per_creator: number | null; client_cpm: number | null; video_views_cap?: number | null; monthly_spend_cap?: number | null };
  cycles: ReturnType<typeof useCampaignCycles>;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  async function handleGenerateNextCycle() {
    setGenerating(true);
    try {
      const existingCycles = cycles.data ?? [];
      const lastCycle = existingCycles[existingCycles.length - 1];
      const nextNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

      let startDate: string;
      if (lastCycle) {
        startDate = lastCycle.endDate;
      } else {
        startDate = campaign.start_date;
      }

      const endD = new Date(startDate + "T00:00:00Z");
      endD.setUTCDate(endD.getUTCDate() + 30);
      const endDate = endD.toISOString().slice(0, 10);

      const campEndDate = campaign.end_date;
      const isLastCycle = campEndDate ? startDate >= campEndDate : false;

      const { data: cycle, error: cycleErr } = await supabase.from("payment_cycles").insert({
        campaign_id: campaignId,
        cycle_number: nextNumber,
        cycle_start_date: startDate,
        cycle_end_date: endDate,
        is_last_cycle: isLastCycle,
      }).select().single();
      if (cycleErr) throw cycleErr;

      const { data: cc } = await supabase.from("campaign_creators").select("creator_id").eq("campaign_id", campaignId);
      const actualCreatorCount = (cc ?? []).length;
      const plannedCount = (campaign as any).planned_creators ?? 1;
      const isFirstCycle = nextNumber === 1;
      const creatorCount = isFirstCycle ? plannedCount : (actualCreatorCount > 0 ? actualCreatorCount : plannedCount);

      let prevViewsPaidCumulative = 0;
      if (lastCycle?.payment) {
        prevViewsPaidCumulative = lastCycle.payment.viewsPaidCumulative ?? 0;
      }

      const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("campaign_id", campaignId);
      const accIds = (accounts ?? []).map((a) => a.id);

      const cap = (campaign as any).video_views_cap as number | null;
      let totalCurrentViews = 0;
      if (accIds.length) {
        const { data: videos } = await supabase.from("videos").select("views, views_final, window_closed").in("tiktok_account_id", accIds);
        totalCurrentViews = (videos ?? []).reduce((s, v) => {
          let effectiveViews = v.window_closed ? (v.views_final ?? v.views ?? 0) : (v.views ?? 0);
          if (cap != null && cap > 0) effectiveViews = Math.min(effectiveViews, cap);
          return s + effectiveViews;
        }, 0);
      }

      const newViews = isFirstCycle ? 0 : Math.max(0, totalCurrentViews - prevViewsPaidCumulative);
      const viewsPaidCumulative = prevViewsPaidCumulative + newViews;

      const fixedAmount = isLastCycle ? 0 : (campaign.client_fixed_per_creator ?? 200) * creatorCount;
      const cpmAmount = isFirstCycle ? 0 : (campaign.client_cpm ?? 2) * (newViews / 1000);
      let totalAmount = fixedAmount + cpmAmount;

      // Apply spend cap
      const spendCap = (campaign as any).monthly_spend_cap as number | null;
      let capReached = false;
      if (spendCap != null && totalAmount >= spendCap) {
        totalAmount = spendCap;
        capReached = true;
      }

      await supabase.from("client_payments").insert({
        campaign_id: campaignId,
        cycle_id: cycle.id,
        cycle_number: nextNumber,
        due_date: startDate,
        fixed_amount: fixedAmount,
        cpm_views: newViews,
        cpm_amount: cpmAmount,
        total_amount: totalAmount,
        views_snapshot_at: new Date().toISOString(),
        views_paid_cumulative: viewsPaidCumulative,
      } as any);

      // If spend cap reached, pause campaign and create notifications
      if (capReached) {
        await supabase.from("campaigns").update({ status: "paused" } as any).eq("id", campaignId);

        // Create notifications for admin/team
        const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "team"]);
        const userIds = new Set((roles ?? []).map(r => r.user_id));

        // Add client
        const { data: campFull } = await supabase.from("campaigns").select("client_profile_id, name").eq("id", campaignId).single();
        if (campFull?.client_profile_id) userIds.add(campFull.client_profile_id);

        // Add creators
        const creatorProfileIds = (cc ?? []).map(r => r.creator_id);
        if (creatorProfileIds.length) {
          const { data: crs } = await supabase.from("creators").select("profile_id").in("id", creatorProfileIds);
          (crs ?? []).forEach(c => { if (c.profile_id) userIds.add(c.profile_id); });
        }

        const message = `Cap di spesa raggiunto per "${campFull?.name ?? "campagna"}" (${formatCurrency(spendCap)}). Campagna in pausa.`;
        const notifs = Array.from(userIds).map(uid => ({
          campaign_id: campaignId,
          type: "spend_cap_reached",
          message,
          user_id: uid,
        }));
        if (notifs.length) {
          await supabase.from("notifications").insert(notifs);
        }

        toast({ title: `Ciclo ${nextNumber} generato — CAP DI SPESA RAGGIUNTO`, description: `Campagna in pausa. Totale cappato a ${formatCurrency(spendCap)}`, variant: "destructive" });
      } else {
        toast({ title: `Ciclo ${nextNumber} generato`, description: `Da ricevere: ${formatCurrency(totalAmount)}` });
      }

      qc.invalidateQueries({ queryKey: ["campaign-cycles", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
      qc.invalidateQueries({ queryKey: ["client-payments"] });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Cicli di Pagamento</CardTitle>
        <Button size="sm" onClick={handleGenerateNextCycle} disabled={generating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generazione..." : "Genera Prossimo Ciclo"}
        </Button>
      </CardHeader>
      <CardContent>
        {cycles.isLoading ? (
          <Skeleton className="h-24" />
        ) : !(cycles.data ?? []).length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessun ciclo di pagamento generato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ciclo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead className="text-right">Fisso (€)</TableHead>
                <TableHead className="text-right">Views <CappedBadge /></TableHead>
                <TableHead className="text-right">CPM (€)</TableHead>
                <TableHead className="text-right">Totale (€)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cycles.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    Ciclo {c.cycleNumber}
                    {c.isLastCycle && <Badge variant="secondary" className="ml-2 text-xs">Post-campagna</Badge>}
                  </TableCell>
                  <TableCell>
                    {new Date(c.startDate).toLocaleDateString("it-IT")} — {new Date(c.endDate).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell className="text-right">{c.payment ? formatCurrency(c.payment.fixedAmount) : "—"}</TableCell>
                  <TableCell className="text-right">{c.payment ? formatViews(c.payment.cpmViews) : "—"}</TableCell>
                  <TableCell className="text-right">{c.payment ? formatCurrency(c.payment.cpmAmount) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{c.payment ? formatCurrency(c.payment.totalAmount) : "—"}</TableCell>
                  <TableCell>
                    {c.payment ? (
                      c.payment.isPaid ? (
                        <Badge className="bg-success/20 text-success border-success/30">✅ Pagato</Badge>
                      ) : c.payment.isOverdue ? (
                        <Badge variant="destructive">🔴 Scaduto</Badge>
                      ) : (
                        <Badge variant="secondary">⏳ In attesa</Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Delete Campaign Modal ── */
function DeleteCampaignModal({ open, onOpenChange, campaign }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  campaign: { id: string; name: string };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const canDelete = confirmed && nameInput === campaign.name;

  const mutation = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("client_payments").delete().eq("campaign_id", campaign.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("payment_cycles").delete().eq("campaign_id", campaign.id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("campaign_creators").delete().eq("campaign_id", campaign.id);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("tiktok_accounts").update({ campaign_id: null }).eq("campaign_id", campaign.id);
      if (e4) throw e4;
      // Delete notifications
      await supabase.from("notifications").delete().eq("campaign_id", campaign.id);
      const { error: e5 } = await supabase.from("campaigns").delete().eq("id", campaign.id);
      if (e5) throw e5;
    },
    onSuccess: () => {
      toast({ title: "Campagna eliminata" });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      qc.invalidateQueries({ queryKey: ["active-campaigns-count"] });
      navigate("/dashboard/campaigns");
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setConfirmed(false); setNameInput(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-destructive">Elimina Campagna</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare la campagna <strong>{campaign.name}</strong>? Questa azione è irreversibile e cancellerà i cicli di pagamento e scollegherà creator e account dalla campagna.
          </p>
          <div className="flex items-center gap-2">
            <Checkbox id="confirm-delete" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <label htmlFor="confirm-delete" className="text-sm">Ho capito che questa azione è irreversibile</label>
          </div>
          <div className="grid gap-1.5">
            <Label>Scrivi "<strong>{campaign.name}</strong>" per confermare</Label>
            <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder={campaign.name} />
          </div>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={!canDelete || mutation.isPending}>
            {mutation.isPending ? "Eliminazione..." : "Elimina definitivamente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Creator Table with Contract info ── */
function CreatorTableWithContracts({ campaignId, creators, isCompleted, onAddCreator, navigate }: {
  campaignId: string;
  creators: ReturnType<typeof useCampaignCreators>;
  isCompleted: boolean;
  onAddCreator: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: contractCampaigns } = useQuery({
    queryKey: ["contract-campaigns-for-campaign", campaignId],
    queryFn: async () => {
      const { data: links } = await supabase.from("contract_campaigns" as any).select("contract_id").eq("campaign_id", campaignId);
      if (!links?.length) return [];
      const contractIds = (links as any[]).map((l) => l.contract_id);
      const { data: contracts } = await supabase.from("contracts" as any).select("id, name").in("id", contractIds);
      // Get contract-creator links
      const { data: ccLinks } = await supabase.from("contract_creators" as any).select("contract_id, creator_id").in("contract_id", contractIds);
      return { contracts: contracts as any[] ?? [], creatorLinks: ccLinks as any[] ?? [] };
    },
  });

  const contractsByCreator = new Map<string, { id: string; name: string }>();
  if (contractCampaigns && !Array.isArray(contractCampaigns)) {
    const { contracts, creatorLinks } = contractCampaigns;
    const contractMap = new Map((contracts ?? []).map((c: any) => [c.id, c as { id: string; name: string }]));
    (creatorLinks ?? []).forEach((l: any) => {
      const contract = contractMap.get(l.contract_id);
      if (contract) contractsByCreator.set(l.creator_id, contract);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Creator</CardTitle>
        {!isCompleted && (
          <Button size="sm" onClick={onAddCreator}>+ Aggiungi Creator</Button>
        )}
      </CardHeader>
      <CardContent>
        {creators.isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !creators.data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nessun creator associato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contratto</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Oggi</TableHead>
                <TableHead className="text-right">Settimana</TableHead>
                <TableHead className="text-right">Mese</TableHead>
                <TableHead className="text-right">Views Totali</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {creators.data.map((c) => {
                const contract = contractsByCreator.get(c.creatorId);
                return (
                  <TableRow key={c.creatorId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {contract ? (
                        <span className="cursor-pointer hover:underline text-primary" onClick={() => navigate(`/dashboard/contracts/${contract.id}`)}>
                          {contract.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.accountUsername}</TableCell>
                    <TableCell className="text-right">{c.todayVideos}</TableCell>
                    <TableCell className="text-right">{c.weekVideos}</TableCell>
                    <TableCell className="text-right">{c.monthVideos}</TableCell>
                    <TableCell className="text-right">{formatViews(c.totalViews)}</TableCell>
                    <TableCell>
                      {c.alertLevel === "green" ? (
                        <Badge className="bg-success/20 text-success border-success/30">🟢 In regola</Badge>
                      ) : c.alertLevel === "yellow" ? (
                        <Badge className="bg-warning/20 text-warning border-warning/30">🟡 Attenzione</Badge>
                      ) : (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30">🔴 A rischio</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/creators/${c.creatorId}`)}>
                        Apri
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { role } = useAuth();

  const campaignId = id!;
  const { data: campaign, isLoading: campLoading } = useCampaignDetail(campaignId);
  const kpi = useCampaignKpi(campaignId);
  const margin = useCampaignMargin(campaignId);
  const creators = useCampaignCreators(campaignId);
  const accounts = useCampaignAccounts(campaignId);
  const alerts = useCampaignAlerts(campaignId);
  const cycles = useCampaignCycles(campaignId);

  const [editOpen, setEditOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status aggiornato" });
      qc.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  if (campLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-muted-foreground py-8">Campagna non trovata.</p>;
  }

  const isCompleted = campaign.status === "completed";
  const kpiLoading = kpi.isLoading || margin.isLoading;
  const campAny = campaign as any;
  const videoViewsCap = campAny.video_views_cap as number | null;
  const monthlySpendCap = campAny.monthly_spend_cap as number | null;

  // Compute all cycles spend for progress bars
  const allCyclesWithSpend = (cycles.data ?? [])
    .filter((c) => c.payment != null)
    .map((c) => {
      const p = c.payment!;
      return {
        label: p.cycleLabel,
        spend: p.totalAmount,
        percent: monthlySpendCap && monthlySpendCap > 0 ? Math.min(100, (p.totalAmount / monthlySpendCap) * 100) : 0,
        isCurrent: c === (cycles.data ?? []).at(-1),
      };
    });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/campaigns" onClick={(e) => { e.preventDefault(); navigate("/dashboard/campaigns"); }}>
              Campagne
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator><ChevronRight className="h-4 w-4" /></BreadcrumbSeparator>
          <BreadcrumbItem><BreadcrumbPage>{campaign.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Completed banner */}
      {isCompleted && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3">
            <p className="text-sm text-warning">Campagna conclusa — dati in sola lettura</p>
          </CardContent>
        </Card>
      )}

      {/* Spend cap banner */}
      <SpendCapBanner campaign={campaign} campaignId={campaignId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <Badge className={statusColor[campaign.status] ?? ""}>{statusLabel[campaign.status] ?? campaign.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Modifica
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Cambia Status</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {["active", "paused", "completed"].map((s) => (
                <DropdownMenuItem key={s} onClick={() => statusMutation.mutate(s)}>
                  {statusLabel[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {campaign && editOpen && (
        <EditCampaignModal open={editOpen} onOpenChange={setEditOpen} campaign={campaign as any} />
      )}

      {/* ── SEZIONE 1: Condizioni Campagna ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <CardTitle className="text-base font-semibold">Condizioni</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {kpiLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <StatItem label="CPM Cliente" value={formatCurrency(campaign.client_cpm ?? 0)} sub="per 1.000 views" />
                <StatItem label="Fisso / Creator" value={formatCurrency(campaign.client_fixed_per_creator ?? 0)} sub="al mese" />
                <StatItem label="Creator previsti" value={String(campAny.planned_creators ?? 1)} />
                <StatItem label="Durata" value={`${format(new Date(campaign.start_date), "dd/MM/yy")} → ${campaign.end_date ? format(new Date(campaign.end_date), "dd/MM/yy") : "∞"}`} />
                <StatItem label="Cap per video" value={videoViewsCap != null ? `${formatViews(videoViewsCap)}` : "—"} sub={videoViewsCap != null ? "views max" : "nessun limite"} />
                <StatItem label="Cap di spesa" value={monthlySpendCap != null ? formatCurrency(monthlySpendCap) : "—"} sub={monthlySpendCap != null ? "per ciclo" : "nessun limite"} />
              </div>

              {/* Spend progress bar */}
              {monthlySpendCap != null && allCyclesWithSpend.length > 0 && (
                <div className="space-y-3">
                  {allCyclesWithSpend.map((cycle, idx) => (
                    <div key={idx} className={cn("rounded-lg p-4", cycle.isCurrent ? "bg-secondary/50" : "bg-secondary/30")}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {cycle.isCurrent ? "Spesa ciclo corrente" : cycle.label}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{formatCurrency(cycle.spend)}</span>
                          <span className="text-xs text-muted-foreground">/ {formatCurrency(monthlySpendCap)}</span>
                          {cycle.percent >= 100 && <Badge variant="destructive" className="text-xs">CAP</Badge>}
                        </div>
                      </div>
                      <Progress
                        value={cycle.percent}
                        className={cn("h-2", cycle.percent >= 90 && "bg-destructive/20")}
                      />
                    </div>
                  ))}
                </div>
              )}

              {campaign.notes && (
                <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">{campaign.notes}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── SEZIONE 2: Stato Campagna ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <CardTitle className="text-base font-semibold">Stato</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {kpiLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <StatItem label="Views totali" value={formatViews(kpi.data?.totalViews ?? 0)} accent />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center">
                  Views contate {videoViewsCap != null && <CappedBadge variant="icon" />}
                </p>
                <p className="text-lg font-bold">{formatViews(kpi.data?.monthViews ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{videoViewsCap != null ? `cap ${formatViews(videoViewsCap)}/video` : "senza cap"}</p>
              </div>
              <StatItem label="Video / mese" value={String(kpi.data?.todayVideos ?? 0)} />
              <StatItem label="Entrata / mese" value={formatCurrency(margin.data?.revenue ?? 0)} accent />
              <StatItem label="Margine / mese" value={formatCurrency(margin.data?.margin ?? 0)} sub={`costo: ${formatCurrency(margin.data?.cost ?? 0)}`} />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Creator attivi</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{kpi.data?.creatorCount ?? 0}</p>
                  <span className="text-xs text-muted-foreground">/ {campAny.planned_creators ?? 1}</span>
                  {(() => {
                    const planned = campAny.planned_creators ?? 1;
                    const actual = kpi.data?.creatorCount ?? 0;
                    return actual >= planned
                      ? <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5">✓</Badge>
                      : <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5">-{planned - actual}</Badge>;
                  })()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (alerts.data?.length ?? 0) > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Alert Creator — Proiezione mensile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.data!.map((a) => (
              <div key={a.creatorName} className="flex items-center gap-2 text-sm">
                <span className={a.alertLevel === "red" ? "text-destructive" : "text-warning"}>
                  {a.alertLevel === "red" ? "🔴 Critico" : "🟡 Attenzione"}
                </span>
                <span className="font-semibold">{a.creatorName}</span>
                <span className="text-muted-foreground">— {a.videosSoFar}/{a.totalRequired} video nel mese</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-2 py-4">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm text-success">Tutti i creator sono in regola questo mese ✓</span>
          </CardContent>
        </Card>
      )}

      {/* Creator Table */}
      <CreatorTableWithContracts
        campaignId={campaignId}
        creators={creators}
        isCompleted={isCompleted}
        onAddCreator={() => setAddCreatorOpen(true)}
        navigate={navigate}
      />

      <AddCreatorModal open={addCreatorOpen} onOpenChange={setAddCreatorOpen} campaignId={campaignId} />

      {/* Account Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !accounts.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun account associato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Video Oggi</TableHead>
                  <TableHead className="text-right">Views Totali</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.data.map((a) => (
                  <TableRow key={a.accountId}>
                    <TableCell className="font-medium">@{a.username}</TableCell>
                    <TableCell>{a.creatorName}</TableCell>
                    <TableCell className="text-right">{a.todayVideos}</TableCell>
                    <TableCell className="text-right">{formatViews(a.totalViews)}</TableCell>
                    <TableCell>
                      {a.isOnTrack ? (
                        <span className="text-success">✅ In regola</span>
                      ) : (
                        <span className="text-warning">⚠️ Sotto minimo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounts/${a.accountId}`)}>
                        Apri
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Payment Cycles */}
      <CyclesSection campaignId={campaignId} campaign={campaign as any} cycles={cycles} />

      {/* Delete Campaign (admin only) */}
      {role === "admin" && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium">Zona pericolosa</p>
              <p className="text-xs text-muted-foreground">Elimina questa campagna e tutti i dati collegati</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Elimina Campagna
            </Button>
          </CardContent>
        </Card>
      )}
      {campaign && deleteOpen && (
        <DeleteCampaignModal open={deleteOpen} onOpenChange={setDeleteOpen} campaign={campaign} />
      )}
    </div>
  );
}
