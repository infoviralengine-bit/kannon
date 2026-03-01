import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Trash2, ChevronRight } from "lucide-react";
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
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

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

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const contractId = id!;

  const { data: contract, isLoading: contractLoading } = useContractDetail(contractId);
  const campaigns = useContractCampaigns(contractId);
  const creators = useContractCreators(contractId);

  const [addCampOpen, setAddCampOpen] = useState(false);
  const [addCreatorOpen, setAddCreatorOpen] = useState(false);

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

      {/* Creators */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Creator assegnati</CardTitle>
          <Button size="sm" onClick={() => setAddCreatorOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Aggiungi Creator
          </Button>
        </CardHeader>
        <CardContent>
          {creators.isLoading ? <Skeleton className="h-24" /> : !creators.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessun creator assegnato</p>
          ) : (
            <div className="space-y-4">
              {creators.data.map((cr) => (
                <div key={cr.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/dashboard/creators/${cr.creatorId}`)}>
                        {cr.name}
                      </span>
                      <Badge variant="secondary">{cr.monthVideos} video/mese</Badge>
                      <span className="text-sm text-muted-foreground">CPM: {formatCurrency(cr.cpmAmount)}</span>
                      <Badge variant={cr.fixedEarned ? "default" : "destructive"}>
                        Fisso {cr.fixedEarned ? "✅" : "❌"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeCreator.mutate(cr.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
        existingCreatorIds={(creators.data ?? []).map((c) => c.creatorId)}
      />
    </div>
  );
}
