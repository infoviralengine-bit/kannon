import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountList } from "@/hooks/useAccountData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { cleanUsername } from "@/lib/utils";
import { TikTokLink } from "@/components/TikTokLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, RefreshCw, Loader2, ChevronDown, ChevronRight, User, Video, Eye } from "lucide-react";
import { useScrapingStatus, useStartScraping, useImportDataset } from "@/hooks/useVideoAnalytics";
import { ScrapingStatusBanner } from "@/components/scraping/ScrapingStatusBanner";

export default function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const {
    accounts, creators, campaigns, isLoading,
    getCreatorVideosToday, getAccountTotalViews,
  } = useAccountList();

  const [datasetIdInput, setDatasetIdInput] = useState("");
  const [showDatasetDialog, setShowDatasetDialog] = useState(false);

  const { data: scrapeLog } = useScrapingStatus();
  const startScraping = useStartScraping();
  const importDataset = useImportDataset();
  // Treat logs older than 5 min as stale: ScrapingStatusBanner auto-recovers them,
  // and we don't want the UI permanently locked if the poller died.
  const isRunning =
    scrapeLog?.status === "running" &&
    (!scrapeLog.started_at ||
      Date.now() - new Date(scrapeLog.started_at).getTime() < 5 * 60 * 1000);

  function handleScrapeNow() {
    // Scope the run to the currently selected campaign filter (if any).
    const scoped = campaignFilter !== "all" ? campaignFilter : null;
    startScraping.mutate(scoped, {
      onSuccess: () =>
        toast({
          title: scoped ? "Scraping campagna avviato" : "Scraping avviato",
          description: "Stato in tempo reale nel banner in alto.",
        }),
      onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
    });
  }

  function handleImportDataset() {
    if (!datasetIdInput.trim()) return;
    setShowDatasetDialog(false);
    importDataset.mutate(datasetIdInput.trim(), {
      onSuccess: () =>
        toast({ title: "Import avviato", description: "Stato in tempo reale nel banner in alto." }),
      onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
    });
    setDatasetIdInput("");
  }

  const [open, setOpen] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; username: string } | null>(null);

  const [username, setUsername] = useState("");
  const accountType = "creator";
  const [creatorId, setCreatorId] = useState<string>("");
  const [campaignId, setCampaignId] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        username,
        account_type: accountType,
      };
      if (accountType === "creator") {
        payload.creator_id = creatorId;
        payload.campaign_id = campaignId;
      }
      const { error } = await supabase.from("tiktok_accounts").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok_accounts"] });
      toast({ title: "Account creato con successo" });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await supabase.from("videos").delete().eq("tiktok_account_id", accountId);
      const { error } = await supabase.from("tiktok_accounts").delete().eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok_accounts"] });
      toast({ title: "Account eliminato" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setUsername("");
    setCreatorId("");
    setCampaignId("");
  };

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const creatorAccounts = accounts.filter((a) => a.account_type === "creator");

  // Group creator accounts by creator
  const accountsByCreator = new Map<string, typeof creatorAccounts>();
  creatorAccounts.forEach((a) => {
    const cid = a.creator_id ?? "_unassigned";
    const list = accountsByCreator.get(cid) ?? [];
    list.push(a);
    accountsByCreator.set(cid, list);
  });

  // Sort creators alphabetically
  const sortedCreatorGroups = Array.from(accountsByCreator.entries())
    .map(([cid, accs]) => ({
      creatorId: cid,
      creatorName: cid === "_unassigned" ? "Non assegnato" : (creators.find((c) => c.id === cid)?.name ?? "Sconosciuto"),
      accounts: accs,
      totalViews: accs.reduce((s, a) => s + getAccountTotalViews(a.id), 0),
      totalVideosToday: accs.reduce((s, a) => s + getCreatorVideosToday(a.id), 0),
    }))
    .sort((a, b) => a.creatorName.localeCompare(b.creatorName));

  // Filter by campaign
  const filteredCreatorGroups = campaignFilter === "all"
    ? sortedCreatorGroups
    : sortedCreatorGroups
        .map((g) => ({
          ...g,
          accounts: g.accounts.filter((a) => a.campaign_id === campaignFilter),
        }))
        .filter((g) => g.accounts.length > 0);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScrapingStatusBanner />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <Button variant="outline" onClick={handleScrapeNow} disabled={isRunning}>
                {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {isRunning ? "Scraping..." : "🔄 Scrapa Ora"}
              </Button>
              <Dialog open={showDatasetDialog} onOpenChange={setShowDatasetDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={isRunning}>📥 Importa Dataset</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importa da Dataset Apify</DialogTitle>
                    <DialogDescription>
                      Incolla il Dataset ID di una run completata manualmente su Apify. Lo trovi nella pagina della run sotto "Default dataset".
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Dataset ID</Label>
                      <Input
                        placeholder="es. abc123XYZ..."
                        value={datasetIdInput}
                        onChange={(e) => setDatasetIdInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleImportDataset} disabled={!datasetIdInput.trim()}>
                      Importa
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nuovo Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo Account</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Username TikTok</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
                </div>
                {accountType === "creator" && (
                  <>
                    <div>
                      <Label>Creator associato</Label>
                      <Select value={creatorId} onValueChange={setCreatorId}>
                        <SelectTrigger><SelectValue placeholder="Seleziona creator" /></SelectTrigger>
                        <SelectContent>
                          {creators.filter((c) => c.status === "active").sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Campagna</Label>
                      <Select value={campaignId} onValueChange={setCampaignId}>
                        <SelectTrigger><SelectValue placeholder="Seleziona campagna" /></SelectTrigger>
                        <SelectContent>
                          {activeCampaigns.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button
                  className="w-full"
                  disabled={!username || !creatorId || !campaignId}
                  onClick={() => createMutation.mutate()}
                >
                  Crea Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtra campagna" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le campagne</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredCreatorGroups.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun account creator trovato.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredCreatorGroups.map((group) => (
              <CreatorGroup
                key={group.creatorId}
                group={group}
                campaigns={campaigns}
                getVideosToday={getCreatorVideosToday}
                getTotalViews={getAccountTotalViews}
                navigate={navigate}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Account</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare <strong>@{cleanUsername(deleteTarget?.username)}</strong>? Verranno eliminati anche tutti i video associati. Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Creator Group (collapsible card per creator) ── */

function CreatorGroup({ group, campaigns, getVideosToday, getTotalViews, navigate, onDelete }: {
  group: {
    creatorId: string;
    creatorName: string;
    accounts: any[];
    totalViews: number;
    totalVideosToday: number;
  };
  campaigns: any[];
  getVideosToday: (id: string) => number;
  getTotalViews: (id: string) => number;
  navigate: (path: string) => void;
  onDelete: (target: { id: string; username: string }) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{group.creatorName}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">{group.accounts.length} account</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" /> {group.totalVideosToday} oggi</span>
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatViews(group.totalViews)}</span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Username</TableHead>
                  <TableHead>Campagna</TableHead>
                  <TableHead className="text-right">Video oggi</TableHead>
                  <TableHead className="text-right">Views totali</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.accounts.map((a: any) => {
                  const campaign = campaigns.find((c: any) => c.id === a.campaign_id);
                  const videosToday = getVideosToday(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium pl-6"><TikTokLink username={a.username} /></TableCell>
                      <TableCell>{campaign?.name || "—"}</TableCell>
                      <TableCell className="text-right">{videosToday}</TableCell>
                      <TableCell className="text-right">{formatViews(getTotalViews(a.id))}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounts/${a.id}`)}>Apri</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete({ id: a.id, username: a.username })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

