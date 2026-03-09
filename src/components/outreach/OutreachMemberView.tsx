import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Send, MessageSquare, TrendingUp, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  useOutreachAccounts,
  useAddOutreachAccount,
  useToggleOutreachAccount,
  useOutreachTemplates,
  useOutreachStats,
  useLogOutreachStats,
} from "@/hooks/useOutreachData";
import { format } from "date-fns";

export function OutreachMemberView() {
  const { data: accounts = [], isLoading: loadingAccounts } = useOutreachAccounts();
  const { data: templates = [] } = useOutreachTemplates();
  const { data: stats = [] } = useOutreachStats();
  const addAccount = useAddOutreachAccount();
  const toggleAccount = useToggleOutreachAccount();
  const logStats = useLogOutreachStats();

  const [newUsername, setNewUsername] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // Log form state
  const [logAccountId, setLogAccountId] = useState("");
  const [logTemplateId, setLogTemplateId] = useState("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logDmSent, setLogDmSent] = useState("");
  const [logReplies, setLogReplies] = useState("");

  // Filters
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");

  const activeAccounts = accounts.filter(a => a.is_active);

  const filteredStats = useMemo(() => {
    let s = stats;
    if (filterAccount !== "all") s = s.filter(x => x.tiktok_account_id === filterAccount);
    if (filterTemplate !== "all") s = s.filter(x => x.template_id === filterTemplate);
    return s;
  }, [stats, filterAccount, filterTemplate]);

  const totalDm = filteredStats.reduce((s, x) => s + (x.dm_sent ?? 0), 0);
  const totalReplies = filteredStats.reduce((s, x) => s + (x.replies_received ?? 0), 0);
  const responseRate = totalDm > 0 ? ((totalReplies / totalDm) * 100).toFixed(1) : "0";

  const handleAddAccount = async () => {
    if (!newUsername.trim()) return;
    try {
      await addAccount.mutateAsync(newUsername.trim());
      toast.success("Account aggiunto");
      setNewUsername("");
      setAddOpen(false);
    } catch {
      toast.error("Errore nell'aggiunta dell'account");
    }
  };

  const handleLog = async () => {
    if (!logAccountId || !logDmSent) return;
    try {
      await logStats.mutateAsync({
        tiktok_account_id: logAccountId,
        date: logDate,
        dm_sent: Number(logDmSent),
        replies_received: Number(logReplies) || 0,
        template_id: logTemplateId || null,
      });
      toast.success("Dati registrati");
      setLogDmSent("");
      setLogReplies("");
      setLogOpen(false);
    } catch {
      toast.error("Errore nella registrazione");
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalDm.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">DM inviati</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReplies.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Risposte ricevute</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{responseRate}%</p>
                <p className="text-xs text-muted-foreground">Tasso di risposta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Registra DM</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registra attività giornaliera</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Account TikTok</Label>
                <Select value={logAccountId} onValueChange={setLogAccountId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona account" /></SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={logTemplateId} onValueChange={setLogTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Nessun template" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>DM inviati</Label>
                  <Input type="number" min="0" value={logDmSent} onChange={e => setLogDmSent(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Risposte</Label>
                  <Input type="number" min="0" value={logReplies} onChange={e => setLogReplies(e.target.value)} placeholder="0" />
                </div>
              </div>
              <Button onClick={handleLog} disabled={!logAccountId || !logDmSent} className="w-full">
                Salva
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Smartphone className="h-4 w-4 mr-1" /> Aggiungi Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo account TikTok</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input placeholder="username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              </div>
              <Button onClick={handleAddAccount} disabled={!newUsername.trim()} className="w-full">
                Aggiungi
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Separator orientation="vertical" className="h-6" />

        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Tutti gli account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli account</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTemplate} onValueChange={setFilterTemplate}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Tutti i template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i template</SelectItem>
            {templates.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Accounts Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">I tuoi account</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun account. Aggiungine uno per iniziare.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">@{acc.username}</span>
                    {!acc.is_active && <Badge variant="secondary" className="text-xs">Disattivato</Badge>}
                  </div>
                  <Switch
                    checked={acc.is_active ?? true}
                    onCheckedChange={(checked) => toggleAccount.mutate({ id: acc.id, is_active: checked })}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Attività recente</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
          ) : (
            <div className="space-y-2">
              {filteredStats.slice(0, 30).map(s => {
                const acc = accounts.find(a => a.id === s.tiktok_account_id);
                const tpl = templates.find(t => t.id === s.template_id);
                const rate = s.dm_sent > 0 ? ((s.replies_received / s.dm_sent) * 100).toFixed(0) : "0";
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20">{format(new Date(s.date), "dd/MM/yyyy")}</span>
                      <span className="text-sm text-foreground">@{acc?.username ?? "?"}</span>
                      {tpl && <Badge variant="outline" className="text-xs">{tpl.name}</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-foreground">{s.dm_sent} DM</span>
                      <span className="text-foreground">{s.replies_received} risposte</span>
                      <span className="text-primary font-medium">{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
