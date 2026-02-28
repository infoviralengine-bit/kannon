import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatViews, formatCurrency } from "@/lib/format";
import { useCampaignTable } from "@/hooks/useDashboardData";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

function CreateCampaignModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCpm, setClientCpm] = useState("2.00");
  const [clientFixed, setClientFixed] = useState("200.00");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [plannedCreators, setPlannedCreators] = useState("1");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name || !clientName || !startDate) throw new Error("Compila i campi obbligatori");
      const startStr = format(startDate, "yyyy-MM-dd");
      const numPlanned = Math.max(1, parseInt(plannedCreators) || 1);
      const { data: newCamp, error } = await supabase.from("campaigns").insert({
        name,
        client_name: clientName,
        client_cpm: parseFloat(clientCpm) || 2,
        client_fixed_per_creator: parseFloat(clientFixed) || 200,
        start_date: startStr,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        notes: notes || null,
        planned_creators: numPlanned,
      } as any).select().single();
      if (error) throw error;

      // Auto-generate Cycle 1
      const cycleEnd = new Date(startDate);
      cycleEnd.setDate(cycleEnd.getDate() + 30);
      const { data: cycle, error: cycleErr } = await supabase.from("payment_cycles").insert({
        campaign_id: newCamp.id,
        cycle_number: 1,
        cycle_start_date: startStr,
        cycle_end_date: format(cycleEnd, "yyyy-MM-dd"),
      }).select().single();
      if (cycleErr) throw cycleErr;

      // Create client payment for cycle 1 (fixed only, 0 CPM)
      const fixedPerCreator = parseFloat(clientFixed) || 200;
      const fixedTotal = fixedPerCreator * numPlanned;
      await supabase.from("client_payments").insert({
        campaign_id: newCamp.id,
        cycle_id: cycle.id,
        cycle_number: 1,
        due_date: startStr,
        fixed_amount: fixedTotal,
        cpm_views: 0,
        cpm_amount: 0,
        total_amount: fixedTotal,
      });

      return newCamp;
    },
    onSuccess: () => {
      toast({ title: "Campagna creata", description: "Ciclo 1 generato automaticamente." });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      qc.invalidateQueries({ queryKey: ["active-campaigns-count"] });
      onOpenChange(false);
      setName(""); setClientName(""); setClientCpm("2.00"); setClientFixed("200.00");
      setStartDate(undefined); setEndDate(undefined); setNotes(""); setPlannedCreators("1");
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova Campagna</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nome campagna *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Campagna Estate" />
          </div>
          <div className="grid gap-1.5">
            <Label>Nome cliente *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Es. Brand XYZ" />
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
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note opzionali..." />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Creazione..." : "Crea Campagna"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CampagnePage() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useCampaignTable();
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = (campaigns ?? []).filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campagne</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuova Campagna
        </Button>
      </div>

      <CreateCampaignModal open={modalOpen} onOpenChange={setModalOpen} />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Tutte</TabsTrigger>
          <TabsTrigger value="active">Attive</TabsTrigger>
          <TabsTrigger value="paused">In pausa</TabsTrigger>
          <TabsTrigger value="completed">Concluse</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {filter === "all" ? "Nessuna campagna trovata." : `Nessuna campagna ${statusLabel[filter]?.toLowerCase() ?? ""}.`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views Totali</TableHead>
                  <TableHead className="text-right">Margine Mese</TableHead>
                  <TableHead className="text-right">Creator</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.client_name}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] ?? ""}>{statusLabel[c.status] ?? c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatViews(c.totalViews)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.margin)}</TableCell>
                    <TableCell className="text-right">{c.creatorCount}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}>
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
    </div>
  );
}
