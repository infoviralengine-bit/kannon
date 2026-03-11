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
import { Plus, Users, Cpu, Trash2, Webhook } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SystemTest from "@/components/SystemTest";
import ScrapingLogsSection from "@/components/ScrapingLogsSection";

type AppUser = { id: string; full_name: string; email: string; role: string; created_at: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-600/20 text-purple-400 border-purple-600/30",
  team: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  creator: "bg-green-600/20 text-green-400 border-green-600/30",
  client: "bg-orange-600/20 text-orange-400 border-orange-600/30",
  outreach: "bg-teal-600/20 text-teal-400 border-teal-600/30",
  closer: "bg-pink-600/20 text-pink-400 border-pink-600/30",
  campaign_manager: "bg-indigo-600/20 text-indigo-400 border-indigo-600/30",
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

  // Delete user
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);

  const [savingApify, setSavingApify] = useState(false);
  const [connectingCalendly, setConnectingCalendly] = useState(false);

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

  async function handleDeleteUser() {
    if (!deletingUser) return;
    try {
      await callManageUsers({ action: "delete_user", user_id: deletingUser.id });
      toast({ title: "Utente eliminato definitivamente" });
      setDeletingUser(null);
      loadAll();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
      setDeletingUser(null);
    }
  }

  async function saveSetting(key: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Il valore non può essere vuoto");
    
    // Validate based on setting type
    const numericKeys = ["client_cpm_default", "creator_cpm_default", "creator_fixed_default", "creator_monthly_fixed_default"];
    if (numericKeys.includes(key)) {
      const num = parseFloat(trimmed);
      if (isNaN(num) || num < 0) throw new Error("Il valore deve essere un numero positivo");
    }
    if (key === "creator_min_videos_default") {
      const num = parseInt(trimmed);
      if (isNaN(num) || num < 0 || num > 100) throw new Error("Min video deve essere tra 0 e 100");
    }
    if (key === "apify_api_key" && trimmed.length < 10) {
      throw new Error("La chiave API sembra troppo corta");
    }
    
    await supabase.from("settings").update({ value: trimmed, updated_at: new Date().toISOString() }).eq("key", key);
  }

  async function handleSaveApify() {
    setSavingApify(true);
    try {
      await saveSetting("apify_frequency", settings.apify_frequency || "every_2_hours");
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
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingUser(u)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 2 — APIFY */}
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
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Gestita tramite Supabase Secrets
              </div>
              <p className="text-xs text-muted-foreground">
                La chiave è configurata come variabile d'ambiente sicura. Per modificarla, vai nelle{" "}
                <a href={`https://supabase.com/dashboard/project/ceknjgwzxexxzckcqjmq/settings/functions`} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  impostazioni Edge Functions
                </a> di Supabase.
              </p>
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

      {/* SECTION 3 — CALENDLY */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Webhook className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Calendly</CardTitle>
              <CardDescription>Connetti Calendly per ricevere automaticamente le prenotazioni nella sezione Closer.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Personal Access Token Calendly</Label>
              <Input
                type="password"
                value={settings.calendly_pat || ""}
                onChange={(e) => setSettings({ ...settings, calendly_pat: e.target.value })}
                placeholder="Inserisci il tuo Personal Access Token"
              />
              <p className="text-xs text-muted-foreground">
                Ottienilo da{" "}
                <a href="https://calendly.com/integrations/api_webhooks" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  Calendly → Integrazioni → API & Webhooks
                </a>
              </p>
            </div>

            {settings.calendly_connected === "true" && (
              <div className="flex items-center gap-2 rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-400">
                ✅ Calendly connesso — webhook attivo
              </div>
            )}

            <div className="space-y-2">
              <Label>Webhook URL (configurato automaticamente)</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://ceknjgwzxexxzckcqjmq.supabase.co/functions/v1/calendly-webhook`}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://ceknjgwzxexxzckcqjmq.supabase.co/functions/v1/calendly-webhook`);
                    toast({ title: "URL copiato" });
                  }}
                >
                  Copia
                </Button>
              </div>
            </div>

            <Button
              disabled={connectingCalendly}
              onClick={async () => {
                const pat = (settings.calendly_pat || "").trim();
                if (!pat || pat.length < 10) {
                  toast({ title: "Inserisci un token valido", variant: "destructive" });
                  return;
                }
                setConnectingCalendly(true);
                try {
                  const { data, error } = await supabase.functions.invoke("connect-calendly", {
                    body: { personal_access_token: pat },
                  });
                  if (error) throw new Error(error.message);
                  if (data?.error) throw new Error(data.error);

                  // Mark as connected in settings
                  await supabase.from("settings").upsert(
                    { key: "calendly_connected", value: "true", updated_at: new Date().toISOString() },
                    { onConflict: "key" }
                  );
                  setSettings({ ...settings, calendly_connected: "true" });

                  toast({ title: data?.message || "Calendly connesso ✅" });
                } catch (e: any) {
                  toast({ title: "Errore", description: e.message, variant: "destructive" });
                }
                setConnectingCalendly(false);
              }}
            >
              {connectingCalendly ? "Connessione in corso..." : "Connetti Calendly"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4 — SCRAPING LOGS */}
      <ScrapingLogsSection />

      {/* SECTION 5 — SYSTEM TEST */}
      <SystemTest />

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
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="campaign_manager">Campaign Manager</SelectItem>
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
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                  <SelectItem value="campaign_manager">Campaign Manager</SelectItem>
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
      {/* DELETE USER CONFIRM */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo utente?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare definitivamente <strong>{deletingUser?.full_name}</strong> ({deletingUser?.email}).
              Questa azione è irreversibile: verranno rimossi profilo, ruolo e account di autenticazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
