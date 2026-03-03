import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatViews, formatCurrency } from "@/lib/format";
import {
  useCreatorDetail, useCreatorKpi, useCreatorPayoff,
  useCreatorAccounts, useCreatorCampaigns,
} from "@/hooks/useCreatorData";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Edit Modal ── */
function EditCreatorModal({ open, onOpenChange, creator }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  creator: { id: string; name: string; email: string | null; phone: string | null };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(creator.name);
  const [email, setEmail] = useState(creator.email ?? "");
  const [phone, setPhone] = useState(creator.phone ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("creators").update({
        name, email: email || null, phone: phone || null,
      }).eq("id", creator.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator aggiornato" });
      qc.invalidateQueries({ queryKey: ["creator-detail", creator.id] });
      qc.invalidateQueries({ queryKey: ["creator-kpi", creator.id] });
      qc.invalidateQueries({ queryKey: ["creator-payoff"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Modifica Creator</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Telefono</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Detail Page ── */
export default function CreatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: creator, isLoading } = useCreatorDetail(id!);
  const { data: kpi } = useCreatorKpi(id!);
  const { data: accounts } = useCreatorAccounts(id!);
  const { data: campaigns } = useCreatorCampaigns(id!);

  const now = new Date();
  const [payoffYear, setPayoffYear] = useState(now.getFullYear());
  const [payoffMonth, setPayoffMonth] = useState(now.getMonth());
  const { data: payoff } = useCreatorPayoff(id!, payoffYear, payoffMonth);

  const [editOpen, setEditOpen] = useState(false);

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("creators").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status aggiornato" });
      qc.invalidateQueries({ queryKey: ["creator-detail", id] });
    },
  });

  if (isLoading) return <div className="space-y-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!creator) return <p className="text-muted-foreground">Creator non trovato.</p>;

  const statusBadge = creator.status === "active"
    ? "bg-success/20 text-success border-success/30"
    : "bg-muted text-muted-foreground border-border";

  const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/dashboard/creators")} className="hover:text-foreground transition-colors">Creator</button>
        <span>/</span>
        <span className="text-foreground">{creator.name}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/creators")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{creator.name}</h1>
          <Badge className={statusBadge}>{creator.status === "active" ? "Attivo" : "Inattivo"}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Modifica
          </Button>
          <Select value={creator.status} onValueChange={v => statusMutation.mutate(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Attivo</SelectItem>
              <SelectItem value="inactive">Inattivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {creator && <EditCreatorModal open={editOpen} onOpenChange={setEditOpen} creator={creator} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Video oggi", value: kpi?.todayVideos ?? 0 },
          { label: "Video settimana", value: kpi?.weekVideos ?? 0 },
          { label: "Video mese", value: kpi?.monthVideos ?? 0 },
          { label: "Views totali", value: formatViews(kpi?.totalViews ?? 0) },
          { label: "Views mese", value: formatViews(kpi?.monthViews ?? 0) },
          { label: "Campagne attive", value: kpi?.activeCampaigns ?? 0 },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payoff */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Payoff Mese</CardTitle>
            <div className="flex gap-2">
              <Select value={String(payoffMonth)} onValueChange={v => setPayoffMonth(parseInt(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(payoffYear)} onValueChange={v => setPayoffYear(parseInt(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {payoff ? (
            !payoff.contracts?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun contratto assegnato a questo creator.</p>
            ) : (
              <>
                {payoff.contracts.map((pc) => (
                  <div key={pc.contractId} className="space-y-3 border-b border-border pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{pc.contractName}</span>
                      <Badge className="bg-success/20 text-success border-success/30">✅ Fisso maturato</Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs">Fisso</span>
                      <span className="text-sm font-semibold">{formatCurrency(pc.creatorFixed)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">CPM maturato</span>
                      <span className="text-sm font-semibold">{formatCurrency(pc.cpmAmount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatViews(pc.monthViews)} views × {formatCurrency(pc.creatorCpm)} / 1.000 = {formatCurrency(pc.cpmAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      {pc.windowOpen} video finestra aperta — {pc.windowClosed} finestra chiusa
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Subtotale</span>
                      <span className="text-sm font-bold">{formatCurrency(pc.total)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm font-semibold">Totale mese</span>
                  <span className="text-lg font-bold">{formatCurrency(payoff.grandTotal)}</span>
                </div>
              </>
            )
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          {!accounts ? (
            <Skeleton className="h-16 w-full" />
          ) : !accounts.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun account collegato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Campagna</TableHead>
                  <TableHead className="text-right">Video oggi</TableHead>
                  <TableHead className="text-right">Views totali</TableHead>
                  
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.accountId}>
                    <TableCell className="font-medium">@{a.username}</TableCell>
                    <TableCell><Badge variant="outline">{a.accountType === "creator" ? "Creator" : "Outreach"}</Badge></TableCell>
                    <TableCell>{a.campaignName}</TableCell>
                    <TableCell className="text-right">{a.todayVideos}</TableCell>
                    <TableCell className="text-right">{formatViews(a.totalViews)}</TableCell>
                    
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounts/${a.accountId}`)}>Apri</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campagne collegate</CardTitle>
        </CardHeader>
        <CardContent>
          {!campaigns ? (
            <Skeleton className="h-16 w-full" />
          ) : !campaigns.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna campagna collegata.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campagna</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data inizio</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.campaignId}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.clientName}</TableCell>
                    <TableCell>{c.startDate}</TableCell>
                    <TableCell className="text-right">{formatViews(c.views)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/campaigns/${c.campaignId}`)}>Apri</Button>
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
