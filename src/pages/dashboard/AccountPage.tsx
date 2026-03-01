import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccountList } from "@/hooks/useAccountData";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

export default function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    accounts, creators, campaigns, isLoading,
    getCreatorVideosToday, getAccountTotalViews,
    getOutreachToday, getOutreachMonth,
  } = useAccountList();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  const [username, setUsername] = useState("");
  const [accountType, setAccountType] = useState<string>("");
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

  const resetForm = () => {
    setUsername("");
    setAccountType("");
    setCreatorId("");
    setCampaignId("");
  };

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const creatorAccounts = accounts.filter((a) => a.account_type === "creator");
  const outreachAccounts = accounts.filter((a) => a.account_type === "outreach");
  const filteredCreatorAccounts = campaignFilter === "all"
    ? creatorAccounts
    : creatorAccounts.filter((a) => a.campaign_id === campaignFilter);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account TikTok</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuovo Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Account TikTok</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Username TikTok</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" />
              </div>
              <div>
                <Label>Tipo Account</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger><SelectValue placeholder="Seleziona tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="outreach">Outreach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {accountType === "creator" && (
                <>
                  <div>
                    <Label>Creator associato</Label>
                    <Select value={creatorId} onValueChange={setCreatorId}>
                      <SelectTrigger><SelectValue placeholder="Seleziona creator" /></SelectTrigger>
                      <SelectContent>
                        {creators.filter((c) => c.status === "active").map((c) => (
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
                disabled={!username || !accountType || (accountType === "creator" && (!creatorId || !campaignId))}
                onClick={() => createMutation.mutate()}
              >
                Crea Account
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">Tutti ({accounts.length})</TabsTrigger>
            <TabsTrigger value="creator">Creator ({creatorAccounts.length})</TabsTrigger>
            <TabsTrigger value="outreach">Outreach ({outreachAccounts.length})</TabsTrigger>
          </TabsList>
          {tab === "creator" && (
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtra campagna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le campagne</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="all">
          {accounts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun account TikTok. Crea il primo!</CardContent></Card>
          ) : (
            <div className="space-y-6">
              {creatorAccounts.length > 0 && <CreatorTable accounts={creatorAccounts} creators={creators} campaigns={campaigns} getVideosToday={getCreatorVideosToday} getTotalViews={getAccountTotalViews} navigate={navigate} />}
              {outreachAccounts.length > 0 && <OutreachTable accounts={outreachAccounts} getOutreachToday={getOutreachToday} getOutreachMonth={getOutreachMonth} navigate={navigate} />}
            </div>
          )}
        </TabsContent>

        <TabsContent value="creator">
          {filteredCreatorAccounts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun account creator trovato.</CardContent></Card>
          ) : (
            <CreatorTable accounts={filteredCreatorAccounts} creators={creators} campaigns={campaigns} getVideosToday={getCreatorVideosToday} getTotalViews={getAccountTotalViews} navigate={navigate} />
          )}
        </TabsContent>

        <TabsContent value="outreach">
          {outreachAccounts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun account outreach trovato.</CardContent></Card>
          ) : (
            <OutreachTable accounts={outreachAccounts} getOutreachToday={getOutreachToday} getOutreachMonth={getOutreachMonth} navigate={navigate} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreatorTable({ accounts, creators, campaigns, getVideosToday, getTotalViews, navigate }: any) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Campagna</TableHead>
            <TableHead className="text-right">Video oggi</TableHead>
            <TableHead className="text-right">Views totali</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a: any) => {
            const creator = creators.find((c: any) => c.id === a.creator_id);
            const campaign = campaigns.find((c: any) => c.id === a.campaign_id);
            const videosToday = getVideosToday(a.id);
            const min = creator?.min_videos_per_day || 5;
            const ok = videosToday >= min;
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">@{a.username}</TableCell>
                <TableCell>{creator?.name || "—"}</TableCell>
                <TableCell>{campaign?.name || "—"}</TableCell>
                <TableCell className="text-right">{videosToday}</TableCell>
                <TableCell className="text-right">{formatViews(getTotalViews(a.id))}</TableCell>
                <TableCell>
                  <Badge variant={ok ? "default" : "destructive"}>
                    {ok ? "✅" : "⚠️"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounts/${a.id}`)}>Apri</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function OutreachTable({ accounts, getOutreachToday, getOutreachMonth, navigate }: any) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead className="text-right">DM oggi</TableHead>
            <TableHead className="text-right">Risposte oggi</TableHead>
            <TableHead className="text-right">Tasso risposta %</TableHead>
            <TableHead className="text-right">DM mese</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a: any) => {
            const { dm, replies } = getOutreachToday(a.id);
            const rate = dm > 0 ? ((replies / dm) * 100).toFixed(1) : "0.0";
            const dmMonth = getOutreachMonth(a.id);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">@{a.username}</TableCell>
                <TableCell className="text-right">{dm}</TableCell>
                <TableCell className="text-right">{replies}</TableCell>
                <TableCell className="text-right">{rate}%</TableCell>
                <TableCell className="text-right">{formatViews(dmMonth)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/accounts/${a.id}`)}>Apri</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
