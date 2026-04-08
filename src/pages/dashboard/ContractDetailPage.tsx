import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Trash2, ChevronRight, ChevronLeft, Pencil, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatViews } from "@/lib/format";
import {
  useContractDetail, useContractCampaigns, useContractCreators,
  useActiveCampaignsForSelect, useActiveCreatorsForSelect,
} from "@/hooks/useContractData";

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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusColor: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  completed: "bg-muted text-muted-foreground border-border",
};

/* ── Add Campaign Modal ── */
function AddCampaignModal({ open, onOpenChange, contractId, existingCampaignIds }: {
  open: boolean; onOpenChange: (v: boolean) => void; contractId: string; existingCampaignIds: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: campaigns } = useActiveCampaignsForSelect();
  const [selectedId, setSelectedId] = useState("");
  const available = (campaigns ?? []).filter((c) => !existingCampaignIds.includes(c.id));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Seleziona una campagna");
      const { error } = await supabase.from("contract_campaigns" as any).insert({
        contract_id: contractId,
        campaign_id: selectedId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campagna aggiunta al contratto" });
      qc.invalidateQueries({ queryKey: ["contract-campaigns", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-creators", contractId] });
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
        <DialogHeader><DialogTitle>Aggiungi Campagna</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Seleziona campagna" /></SelectTrigger>
            <SelectContent>
              {available.map((c) => (
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

/* ── Add Creator Modal ── */
function AddCreatorModal({ open, onOpenChange, contractId, existingCreatorIds }: {
  open: boolean; onOpenChange: (v: boolean) => void; contractId: string; existingCreatorIds: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: creators } = useActiveCreatorsForSelect();
  const [selectedId, setSelectedId] = useState("");
  const available = (creators ?? []).filter((c) => !existingCreatorIds.includes(c.id));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Seleziona un creator");
      const { error } = await supabase.from("contract_creators" as any).insert({
        contract_id: contractId,
        creator_id: selectedId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator aggiunto al contratto" });
      qc.invalidateQueries({ queryKey: ["contract-creators", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-list"] });
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
              {available.map((c) => (
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

/* ── Edit Contract Modal ── */
function EditContractModal({ open, onOpenChange, contract }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  contract: { id: string; creator_fixed: number; creator_cpm: number; min_videos_per_day: number; name: string; type: string; is_active: boolean };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixed, setFixed] = useState(String(contract.creator_fixed));
  const [cpm, setCpm] = useState(String(contract.creator_cpm));
  const [minVpd, setMinVpd] = useState(String(contract.min_videos_per_day));
  const [name, setName] = useState(contract.name);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contracts").update({
        name,
        creator_fixed: parseFloat(fixed) || 0,
        creator_cpm: parseFloat(cpm) || 0,
        min_videos_per_day: isNaN(parseInt(minVpd)) ? 1 : parseInt(minVpd),
      }).eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contratto aggiornato" });
      qc.invalidateQueries({ queryKey: ["contract-detail", contract.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Modifica Contratto</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fisso mensile (€)</Label>
            <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>CPM (€)</Label>
            <Input type="number" step="0.01" value={cpm} onChange={(e) => setCpm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Min video/giorno</Label>
            <Input type="number" step="1" value={minVpd} onChange={(e) => setMinVpd(e.target.value)} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const contractId = id!;

  const { data: contract, isLoading: contractLoading } = useContractDetail(contractId);
  const campaigns = useContractCampaigns(contractId);
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);
  const creators = useContractCreators(contractId, selectedPeriod);

  const crData = creators.data;
  const creatorRows = crData?.creators ?? [];

  const [addCampOpen, setAddCampOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deleteContract = useMutation({
    mutationFn: async () => {
      // Delete related links first, then the contract
      await supabase.from("contract_campaigns" as any).delete().eq("contract_id", contractId);
      await supabase.from("contract_creators" as any).delete().eq("contract_id", contractId);
      const { error } = await supabase.from("contracts" as any).delete().eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contratto eliminato" });
      qc.invalidateQueries({ queryKey: ["contract-list"] });
      navigate("/dashboard/contracts");
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  const removeCampaign = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("contract_campaigns" as any).delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campagna rimossa" });
      qc.invalidateQueries({ queryKey: ["contract-campaigns", contractId] });
    },
  });

  const removeCreator = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("contract_creators" as any).delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator rimosso" });
      qc.invalidateQueries({ queryKey: ["contract-creators", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-list"] });
    },
  });

  const updateAccountCampaign = useMutation({
    mutationFn: async ({ accountId, campaignId }: { accountId: string; campaignId: string | null }) => {
      const { error } = await supabase
        .from("tiktok_accounts")
        .update({ campaign_id: campaignId })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Account aggiornato" });
      qc.invalidateQueries({ queryKey: ["contract-creators", contractId] });
    },
  });

  if (contractLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /></div>;
  }

  if (!contract) {
    return <p className="text-muted-foreground py-8">Contratto non trovato.</p>;
  }

  const typeLabel: Record<string, string> = { solo_cpm: "Solo CPM", premium: "Premium", custom: "Custom" };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/contracts" onClick={(e) => { e.preventDefault(); navigate("/dashboard/contracts"); }}>
              Contratti
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator><ChevronRight className="h-4 w-4" /></BreadcrumbSeparator>
          <BreadcrumbItem><BreadcrumbPage>{contract.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{contract.name}</h1>
        <Badge variant="secondary">{typeLabel[contract.type] ?? contract.type}</Badge>
        <Badge variant={contract.is_active ? "default" : "secondary"}>
          {contract.is_active ? "Attivo" : "Inattivo"}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" /> Modifica
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-1 h-4 w-4" /> Elimina
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il contratto?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione è irreversibile. Verranno rimossi tutti i collegamenti a campagne e creator di questo contratto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteContract.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Contract conditions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Condizioni</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Fisso mensile</p>
              <p className="text-lg font-bold">{formatCurrency(Number(contract.creator_fixed))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">CPM</p>
              <p className="text-lg font-bold">{formatCurrency(Number(contract.creator_cpm))}</p>
              <p className="text-xs text-muted-foreground">per 1.000 views</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Min video/giorno</p>
              <p className="text-lg font-bold">{contract.min_videos_per_day}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Campagne collegate</CardTitle>
          <Button size="sm" onClick={() => setAddCampOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Aggiungi Campagna
          </Button>
        </CardHeader>
        <CardContent>
          {campaigns.isLoading ? <Skeleton className="h-24" /> : !campaigns.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna campagna collegata</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/campaigns/${c.campaignId}`)}>
                      {c.name}
                    </TableCell>
                    <TableCell>{c.clientName}</TableCell>
                    <TableCell>
                      {new Date(c.startDate).toLocaleDateString("it-IT")}
                      {c.endDate ? ` — ${new Date(c.endDate).toLocaleDateString("it-IT")}` : " → ∞"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] ?? ""}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeCampaign.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Creator Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Performance Creator</CardTitle>
            {crData && (
              <p className="text-sm text-muted-foreground mt-1">{crData.periodLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Period navigator */}
            <Button
              variant="outline"
              size="icon"
              disabled={!crData || (selectedPeriod ?? crData.currentPeriod) <= 1}
              onClick={() => setSelectedPeriod((prev) => (prev ?? crData!.currentPeriod) - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              Periodo {selectedPeriod ?? crData?.currentPeriod ?? 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={!crData || (selectedPeriod ?? crData.currentPeriod) >= crData.maxPeriod}
              onClick={() => setSelectedPeriod((prev) => (prev ?? crData!.currentPeriod) + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setAddCreatorOpen(true)} className="ml-2">
              <Plus className="mr-1 h-4 w-4" /> Aggiungi Creator
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {creators.isLoading ? <Skeleton className="h-24" /> : !creatorRows.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun creator assegnato</p>
          ) : (
            <div className="space-y-4">
              {creatorRows.map((cr) => (
                <div key={cr.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}>
                      {cr.name}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => removeCreator.mutate(cr.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {/* KPIs grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="bg-muted/50 rounded-md p-2.5">
                      <p className="text-[11px] text-muted-foreground uppercase">Video</p>
                      <p className="text-sm font-bold">{cr.videoCount} / {cr.target}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5">
                      <p className="text-[11px] text-muted-foreground uppercase">Views</p>
                      <p className="text-sm font-bold">{formatViews(cr.totalViews)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5">
                      <p className="text-[11px] text-muted-foreground uppercase">Fisso</p>
                      <p className="text-sm font-bold">
                        {formatCurrency(cr.fixedAmount)}{" "}
                        <span>{cr.fixedEarned ? "✅" : "❌"}</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5">
                      <p className="text-[11px] text-muted-foreground uppercase">CPM ({formatCurrency(cr.cpmRate)})</p>
                      <p className="text-sm font-bold">{formatCurrency(cr.cpmAmount)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5">
                      <p className="text-[11px] text-muted-foreground uppercase">Subtotale</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(cr.subtotal)}</p>
                    </div>
                  </div>

                  {/* Accounts */}
                  {cr.accounts.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Campagna assegnata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cr.accounts.map((acc) => (
                          <TableRow key={acc.accountId}>
                            <TableCell className="font-medium">@{acc.username}</TableCell>
                            <TableCell>
                              <Select
                                value={acc.campaignId ?? "__none__"}
                                onValueChange={(v) => updateAccountCampaign.mutate({
                                  accountId: acc.accountId,
                                  campaignId: v === "__none__" ? null : v,
                                })}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Nessuna" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Nessuna</SelectItem>
                                  {(campaigns.data ?? []).map((c) => (
                                    <SelectItem key={c.campaignId} value={c.campaignId}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCampaignModal
        open={addCampOpen}
        onOpenChange={setAddCampOpen}
        contractId={contractId}
        existingCampaignIds={(campaigns.data ?? []).map((c) => c.campaignId)}
      />
      <AddCreatorModal
        open={addCreatorOpen}
        onOpenChange={setAddCreatorOpen}
        contractId={contractId}
        existingCreatorIds={creatorRows.map((c) => c.creatorId)}
      />
      {contract && (
        <EditContractModal
          open={editOpen}
          onOpenChange={setEditOpen}
          contract={contract}
        />
      )}
    </div>
  );
}
