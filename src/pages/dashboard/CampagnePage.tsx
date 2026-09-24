import { useState } from "react";
import { useI18n } from "@/i18n";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyOptions } from "@/hooks/useCompanies";
import { CompanyLogo } from "@/components/companies/CompanyLogo";

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
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const { data: companyOptions = [] } = useCompanyOptions();
  const [clientCpm, setClientCpm] = useState("2.00");
  const [clientFixed, setClientFixed] = useState("0.00");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [notes, setNotes] = useState("");
  const [minMonthlyVideos, setMinMonthlyVideos] = useState("0");
  const [videoViewsCap, setVideoViewsCap] = useState("");
  const [monthlySpendCap, setMonthlySpendCap] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name || !companyId || !startDate) throw new Error(t("Compila i campi obbligatori"));
      const startStr = format(startDate, "yyyy-MM-dd");
      const parsedViewsCap = videoViewsCap.trim() ? parseInt(videoViewsCap) : null;
      const parsedSpendCap = monthlySpendCap.trim() ? parseFloat(monthlySpendCap) : null;
      const fixedVal = isNaN(parseFloat(clientFixed)) ? 0 : parseFloat(clientFixed);
      const { data: newCamp, error } = await supabase.from("campaigns").insert({
        name,
        client_name: companyOptions.find((c) => c.id === companyId)?.legal_name ?? "",
        company_id: companyId,
        client_cpm: isNaN(parseFloat(clientCpm)) ? 0 : parseFloat(clientCpm),
        client_fixed: fixedVal,
        start_date: startStr,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        notes: notes || null,
        min_monthly_videos: isNaN(parseInt(minMonthlyVideos)) ? 0 : parseInt(minMonthlyVideos),
        video_views_cap: parsedViewsCap,
        monthly_spend_cap: parsedSpendCap,
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
      const fixedTotal = fixedVal;
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
      toast({ title: t("Campagna creata"), description: t("Ciclo 1 generato automaticamente.") });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      qc.invalidateQueries({ queryKey: ["active-campaigns-count"] });
      onOpenChange(false);
      setName(""); setCompanyId(""); setClientCpm("2.00"); setClientFixed("0.00");
      setStartDate(undefined); setEndDate(undefined); setNotes(""); setMinMonthlyVideos("0");
      setVideoViewsCap(""); setMonthlySpendCap("");
    },
    onError: (e: Error) => {
      toast({ title: t("Errore"), description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Nuova Campagna")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>{t("Nome campagna *")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Es. Campagna Estate")} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Cliente *")}</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder={t("Seleziona un cliente")} />
              </SelectTrigger>
              <SelectContent>
                {companyOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CompanyLogo name={c.name} logoUrl={c.logo_url} className="h-6 w-6" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("I clienti si creano nella sezione Clienti.")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("CPM Cliente (€)")}</Label>
              <Input type="number" step="0.01" value={clientCpm} onChange={(e) => setClientCpm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Fisso mensile (€, totale campagna)")}</Label>
              <Input type="number" step="0.01" value={clientFixed} onChange={(e) => setClientFixed(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("Data inizio *")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : t("Seleziona")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" locale={it} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Data fine")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : t("Opzionale")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" locale={it} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Video minimi al mese")}</Label>
            <Input type="number" min="0" step="1" value={minMonthlyVideos} onChange={(e) => setMinMonthlyVideos(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("Cap views per video")}</Label>
              <Input type="number" min="0" step="1" value={videoViewsCap} onChange={(e) => setVideoViewsCap(e.target.value)} placeholder={t("es. 100000 — vuoto = nessun cap")} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("Cap di spesa per ciclo (€)")}</Label>
              <Input type="number" min="0" step="0.01" value={monthlySpendCap} onChange={(e) => setMonthlySpendCap(e.target.value)} placeholder={t("es. 5000 — vuoto = nessun cap")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("Note")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Note opzionali...")} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t("Creazione...") : t("Crea Campagna")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CampagnePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: campaigns, isLoading } = useCampaignTable();
  const { role } = useAuth();
  const isTeam = role === "team";
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = (campaigns ?? []).filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Campagne")}</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("Nuova Campagna")}
        </Button>
      </div>

      <CreateCampaignModal open={modalOpen} onOpenChange={setModalOpen} />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">{t("Tutte")}</TabsTrigger>
          <TabsTrigger value="active">{t("Attive")}</TabsTrigger>
          <TabsTrigger value="paused">{t("In pausa")}</TabsTrigger>
          <TabsTrigger value="completed">{t("Concluse")}</TabsTrigger>
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
              {filter === "all" ? t("Nessuna campagna trovata.") : t("Nessuna campagna {status}.", { status: t(statusLabel[filter] ?? "").toLowerCase() })}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Campagna")}</TableHead>
                  <TableHead>{t("Cliente")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead className="text-right">{t("Views Totali")}</TableHead>
                  {!isTeam && <TableHead className="text-right">{t("Revenue Mese")}</TableHead>}
                  <TableHead className="text-right">{t("Creator")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CompanyLogo name={c.companyName ?? c.name} logoUrl={c.companyLogoUrl} className="h-8 w-8" />
                        <span>{c.companyName ?? c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] ?? ""}>{t(statusLabel[c.status] ?? c.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatViews(c.totalViews)}</TableCell>
                    {!isTeam && <TableCell className="text-right">{formatCurrency(c.revenue)}</TableCell>}
                    <TableCell className="text-right">{c.creatorCount}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}>
                        {t("Apri")}
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
