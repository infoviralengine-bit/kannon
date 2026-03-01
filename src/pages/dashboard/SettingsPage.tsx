import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, EyeOff, Shield, Users, Cpu } from "lucide-react";
import PaymentsE2ETest from "@/components/PaymentsE2ETest";
import CampaignSimulation3Months from "@/components/CampaignSimulation3Months";

type AppUser = { id: string; full_name: string; email: string; role: string; created_at: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  team: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  creator: "bg-green-600/20 text-green-400 border-green-600/30",
  client: "bg-orange-600/20 text-orange-400 border-orange-600/30",
};

export default function SettingsPage() {
  const { role, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);

  // New user modal
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", password: "", role: "team", creator_id: "", campaign_id: "" });
  const [creating, setCreating] = useState(false);

  // Edit role modal
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCreatorId, setEditCreatorId] = useState("");
  const [editCampaignId, setEditCampaignId] = useState("");

  // Apify
  const [showApiKey, setShowApiKey] = useState(false);

  // Saving flags
  const [savingEcon, setSavingEcon] = useState(false);
  const [savingApify, setSavingApify] = useState(false);

  useEffect(() => {
    if (role !== null && role !== "admin") {
      toast({ title: "Accesso non autorizzato", variant: "destructive" });
      navigate("/dashboard");
    }
  }, [role]);

  useEffect(() => {
    if (role === "admin") loadAll();
  }, [role]);

  async function callManageUsers(body: any) {
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [usersRes, settingsRes, creatorsRes, campaignsRes] = await Promise.all([
        callManageUsers({ action: "list_users" }),
        supabase.from("settings").select("key, value"),
        supabase.from("creators").select("id, name"),
        supabase.from("campaigns").select("id, name"),
      ]);

      setUsers(usersRes.users || []);

      const map: Record<string, string> = {};
      (settingsRes.data || []).forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);

      setCreators(creatorsRes.data || []);
      setCampaigns(campaignsRes.data || []);
    } catch (e: any) {
      toast({ title: "Errore caricamento", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function handleCreateUser() {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast({ title: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await callManageUsers({ action: "create_user", ...newUser });
      toast({ title: "Utente creato con successo" });
      setShowNewUser(false);
      setNewUser({ full_name: "", email: "", password: "", role: "team", creator_id: "", campaign_id: "" });
      loadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
    setCreating(false);
  }

  async function handleUpdateRole() {
    if (!editingUser) return;
    try {
      await callManageUsers({
        action: "update_role",
        user_id: editingUser.id,
        role: editRole,
        creator_id: editRole === "creator" ? editCreatorId : undefined,
        campaign_id: editRole === "client" ? editCampaignId : undefined,
      });
      toast({ title: "Ruolo aggiornato" });
      setEditingUser(null);
      loadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  async function handleDisable(userId: string) {
    try {
      await callManageUsers({ action: "disable_user", user_id: userId });
      toast({ title: "Utente disabilitato" });
      loadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  async function saveSetting(key: string, value: string) {
    await supabase.from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
  }

  async function handleSaveEconomics() {
    setSavingEcon(true);
    try {
      await Promise.all([
        saveSetting("client_cpm_default", settings.client_cpm_default || "2.00"),
        saveSetting("creator_fixed_default", settings.creator_fixed_default || "200.00"),
        saveSetting("creator_cpm_default", settings.creator_cpm_default || "0.50"),
        saveSetting("creator_monthly_fixed_default", settings.creator_monthly_fixed_default || "200.00"),
        saveSetting("creator_min_videos_default", settings.creator_min_videos_default || "5"),
      ]);
      toast({ title: "Impostazioni salvate" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
    setSavingEcon(false);
  }

  async function handleSaveApify() {
    setSavingApify(true);
    try {
      await Promise.all([
        saveSetting("apify_api_key", settings.apify_api_key || ""),
        saveSetting("apify_frequency", settings.apify_frequency || "every_2_hours"),
      ]);
      toast({ title: "Configurazione Apify salvata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
    setSavingApify(false);
  }

  if (role !== "admin") return null;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>

      {/* SECTION 1 — USER MANAGEMENT */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Gestione Utenti</CardTitle>
              <CardDescription>Crea, modifica e disabilita utenti della piattaforma</CardDescription>
            </div>
          </div>
          <Button onClick={() => setShowNewUser(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nuovo Utente
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Data creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROLE_COLORS[u.role] || ""}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingUser(u);
                        setEditRole(u.role);
                        setEditCreatorId("");
                        setEditCampaignId("");
                      }}
                    >
                      Modifica ruolo
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDisable(u.id)}>
                      Disabilita
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 2 — DEFAULT ECONOMICS */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Condizioni Economiche Default</CardTitle>
              <CardDescription>Questi valori vengono precompilati quando crei una nuova campagna o un nuovo creator.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>CPM Cliente default (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.client_cpm_default || ""}
                onChange={(e) => setSettings({ ...settings, client_cpm_default: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fisso per Creator default (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.creator_fixed_default || ""}
                onChange={(e) => setSettings({ ...settings, creator_fixed_default: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CPM Creator default (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.creator_cpm_default || ""}
                onChange={(e) => setSettings({ ...settings, creator_cpm_default: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fisso Mensile Creator default (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={settings.creator_monthly_fixed_default || ""}
                onChange={(e) => setSettings({ ...settings, creator_monthly_fixed_default: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimo video/giorno Creator</Label>
              <Input
                type="number"
                step="1"
                value={settings.creator_min_videos_default || ""}
                onChange={(e) => setSettings({ ...settings, creator_min_videos_default: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-6" onClick={handleSaveEconomics} disabled={savingEcon}>
            {savingEcon ? "Salvataggio..." : "Salva Impostazioni"}
          </Button>
        </CardContent>
      </Card>

      {/* SECTION 3 — APIFY */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Configurazione Apify</CardTitle>
              <CardDescription>Configura l'integrazione per lo scraping automatico dei dati TikTok.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Apify API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={settings.apify_api_key || ""}
                  onChange={(e) => setSettings({ ...settings, apify_api_key: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frequenza aggiornamento</Label>
              <Select
                value={settings.apify_frequency || "every_2_hours"}
                onValueChange={(v) => setSettings({ ...settings, apify_frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every_2_hours">Ogni 2 ore</SelectItem>
                  <SelectItem value="every_6_hours">Ogni 6 ore</SelectItem>
                  <SelectItem value="every_12_hours">Ogni 12 ore</SelectItem>
                  <SelectItem value="every_24_hours">Ogni 24 ore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={handleSaveApify} disabled={savingApify}>
              {savingApify ? "Salvataggio..." : "Salva Configurazione"}
            </Button>
            <Button
              variant="outline"
              onClick={() => toast({ title: "Configurazione salvata", description: "La connessione verrà attivata nella prossima fase di sviluppo." })}
            >
              Testa Connessione
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            L'integrazione Apify verrà attivata nella fase successiva. Per ora puoi salvare la tua API key.
          </p>
        </CardContent>
      </Card>

      {/* SECTION 4 — E2E TEST */}
      <PaymentsE2ETest />

      {/* NEW USER MODAL */}
      <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Utente</DialogTitle>
            <DialogDescription>Crea un nuovo utente nella piattaforma</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password temporanea *</Label>
              <Input type="text" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v, creator_id: "", campaign_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newUser.role === "creator" && (
              <div className="space-y-2">
                <Label>Collega a Creator</Label>
                <Select value={newUser.creator_id} onValueChange={(v) => setNewUser({ ...newUser, creator_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona creator..." /></SelectTrigger>
                  <SelectContent>
                    {creators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newUser.role === "client" && (
              <div className="space-y-2">
                <Label>Collega a Campagna</Label>
                <Select value={newUser.campaign_id} onValueChange={(v) => setNewUser({ ...newUser, campaign_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona campagna..." /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewUser(false)}>Annulla</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Creazione..." : "Crea Utente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT ROLE MODAL */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Ruolo</DialogTitle>
            <DialogDescription>Cambia il ruolo di {editingUser?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nuovo ruolo</Label>
              <Select value={editRole} onValueChange={(v) => { setEditRole(v); setEditCreatorId(""); setEditCampaignId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRole === "creator" && (
              <div className="space-y-2">
                <Label>Collega a Creator</Label>
                <Select value={editCreatorId} onValueChange={setEditCreatorId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {creators.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editRole === "client" && (
              <div className="space-y-2">
                <Label>Collega a Campagna</Label>
                <Select value={editCampaignId} onValueChange={setEditCampaignId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Annulla</Button>
            <Button onClick={handleUpdateRole}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
