import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Eye, TrendingUp, Video, DollarSign, Users, AlertTriangle, CheckCircle2,
  ChevronRight, Pencil, CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatViews, formatCurrency } from "@/lib/format";
import {
  useCampaignDetail, useCampaignKpi, useCampaignMargin,
  useCampaignCreators, useCampaignAccounts, useCampaignAlerts,
  useAllCreatorsForSelect,
} from "@/hooks/useCampaignData";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

function KpiCard({ icon: Icon, label, value, loading }: {
  icon: React.ElementType; label: string; value: string; loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{value}</p>}
      </CardContent>
    </Card>
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name || !clientName || !startDate) throw new Error("Compila i campi obbligatori");
      const { error } = await supabase.from("campaigns").update({
        name,
        client_name: clientName,
        client_cpm: parseFloat(clientCpm) || 2,
        client_fixed_per_creator: parseFloat(clientFixed) || 200,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        notes: notes || null,
      }).eq("id", campaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campagna aggiornata" });
      qc.invalidateQueries({ queryKey: ["campaign-detail", campaign.id] });
      qc.invalidateQueries({ queryKey: ["campaign-table"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const campaignId = id!;
  const { data: campaign, isLoading: campLoading } = useCampaignDetail(campaignId);
  const kpi = useCampaignKpi(campaignId);
  const margin = useCampaignMargin(campaignId);
  const creators = useCampaignCreators(campaignId);
  const accounts = useCampaignAccounts(campaignId);
  const alerts = useCampaignAlerts(campaignId);

  const [editOpen, setEditOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);

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
        <EditCampaignModal open={editOpen} onOpenChange={setEditOpen} campaign={campaign} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={Eye} label="Views Totali" value={formatViews(kpi.data?.totalViews ?? 0)} loading={kpiLoading} />
        <KpiCard icon={TrendingUp} label="Views Mese" value={formatViews(kpi.data?.monthViews ?? 0)} loading={kpiLoading} />
        <KpiCard icon={Video} label="Video Oggi" value={String(kpi.data?.todayVideos ?? 0)} loading={kpiLoading} />
        <KpiCard icon={DollarSign} label="Margine Mese" value={formatCurrency(margin.data?.margin ?? 0)} loading={kpiLoading} />
        <KpiCard icon={Users} label="Creator Attivi" value={String(kpi.data?.creatorCount ?? 0)} loading={kpiLoading} />
        <KpiCard icon={DollarSign} label="Entrata Mese" value={formatCurrency(margin.data?.revenue ?? 0)} loading={kpiLoading} />
      </div>

      {/* Economic conditions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Condizioni Economiche</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">CPM Cliente</p>
              <p className="font-semibold">{formatCurrency(campaign.client_cpm ?? 0)} / 1.000 views</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fisso per Creator</p>
              <p className="font-semibold">{formatCurrency(campaign.client_fixed_per_creator ?? 0)} / mese</p>
            </div>
            <div>
              <p className="text-muted-foreground">Data inizio</p>
              <p className="font-semibold">{format(new Date(campaign.start_date), "dd/MM/yyyy")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Data fine</p>
              <p className="font-semibold">{campaign.end_date ? format(new Date(campaign.end_date), "dd/MM/yyyy") : "—"}</p>
            </div>
          </div>
          {campaign.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-muted-foreground text-sm mb-1">Note</p>
                <p className="text-sm">{campaign.notes}</p>
              </div>
            </>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Creator</CardTitle>
          {!isCompleted && (
            <Button size="sm" onClick={() => setAddCreatorOpen(true)}>+ Aggiungi Creator</Button>
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
                  <TableHead>Account TikTok</TableHead>
                  <TableHead className="text-right">Oggi</TableHead>
                  <TableHead className="text-right">Settimana</TableHead>
                  <TableHead className="text-right">Mese</TableHead>
                  <TableHead className="text-right">Views Totali</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {creators.data.map((c) => (
                  <TableRow key={c.creatorId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddCreatorModal open={addCreatorOpen} onOpenChange={setAddCreatorOpen} campaignId={campaignId} />

      {/* Account Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account TikTok</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !accounts.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun account TikTok associato.</p>
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
    </div>
  );
}
