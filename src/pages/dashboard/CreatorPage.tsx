import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { useCreatorTable } from "@/hooks/useCreatorData";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const statusColor: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground border-border",
};
const statusLabel: Record<string, string> = {
  active: "Attivo",
  inactive: "Inattivo",
};

const alertBadge = {
  green: { className: "bg-success/20 text-success border-success/30", label: "🟢 In regola" },
  yellow: { className: "bg-warning/20 text-warning border-warning/30", label: "🟡 Attenzione" },
  red: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "🔴 A rischio" },
};

function CreateCreatorModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpm, setCpm] = useState("0.50");
  const [fixed, setFixed] = useState("200.00");
  const [minVideos, setMinVideos] = useState("5");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name) throw new Error("Il nome è obbligatorio");
      const { error } = await supabase.from("creators").insert({
        name,
        email: email || null,
        phone: phone || null,
        creator_cpm: parseFloat(cpm) || 0.5,
        creator_fixed: parseFloat(fixed) || 200,
        min_videos_per_day: parseInt(minVideos) || 5,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator creato con successo" });
      qc.invalidateQueries({ queryKey: ["creator-table"] });
      qc.invalidateQueries({ queryKey: ["active-creators-count"] });
      onOpenChange(false);
      setName(""); setEmail(""); setPhone(""); setCpm("0.50"); setFixed("200.00"); setMinVideos("5");
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuovo Creator</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Es. Mario Rossi" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Telefono</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+39..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>CPM Creator (€)</Label>
              <Input type="number" step="0.01" value={cpm} onChange={e => setCpm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fisso mensile (€)</Label>
              <Input type="number" step="0.01" value={fixed} onChange={e => setFixed(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Min video/giorno</Label>
              <Input type="number" value={minVideos} onChange={e => setMinVideos(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Creazione..." : "Crea Creator"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CreatorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const { data: creators, isLoading } = useCreatorTable(selectedYear, selectedMonth);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  function prevMonth() {
    if (selectedMonth === 0) { setSelectedYear(y => y - 1); setSelectedMonth(11); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (selectedMonth === 11) { setSelectedYear(y => y + 1); setSelectedMonth(0); }
    else setSelectedMonth(m => m + 1);
  }

  const deleteMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      // Delete related data first, then the creator
      const { data: accounts } = await supabase.from("tiktok_accounts").select("id").eq("creator_id", creatorId);
      if (accounts?.length) {
        const accountIds = accounts.map(a => a.id);
        await supabase.from("videos").delete().in("tiktok_account_id", accountIds);
        await supabase.from("outreach_stats").delete().in("tiktok_account_id", accountIds);
        await supabase.from("tiktok_accounts").delete().eq("creator_id", creatorId);
      }
      await supabase.from("campaign_creators").delete().eq("creator_id", creatorId);
      await supabase.from("creator_payments").delete().eq("creator_id", creatorId);
      await supabase.from("payments").delete().eq("creator_id", creatorId);
      const { error } = await supabase.from("creators").delete().eq("id", creatorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Creator eliminato" });
      qc.invalidateQueries({ queryKey: ["creator-table"] });
      qc.invalidateQueries({ queryKey: ["active-creators-count"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast({ title: "Errore eliminazione", description: e.message, variant: "destructive" });
    },
  });

  const filtered = (creators ?? []).filter(c => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Creator</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuovo Creator
        </Button>
      </div>

      <CreateCreatorModal open={modalOpen} onOpenChange={setModalOpen} />

      <div className="flex gap-2">
        {(["all", "active", "inactive"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "Tutti" : f === "active" ? "Attivi" : "Inattivi"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun creator trovato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Campagne attive</TableHead>
                  <TableHead className="text-right">Views totali</TableHead>
                  <TableHead className="text-right">Video mese</TableHead>
                  <TableHead>Obiettivo mensile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.activeCampaigns}</TableCell>
                    <TableCell className="text-right">{formatViews(c.totalViews)}</TableCell>
                    <TableCell className="text-right">{c.monthVideos} / {c.monthlyTarget}</TableCell>
                    <TableCell>
                      <Badge className={alertBadge[c.alertLevel].className}>
                        {alertBadge[c.alertLevel].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[c.status] ?? ""}>{statusLabel[c.status] ?? c.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/creators/${c.id}`)}>Apri</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Creator</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare <strong>{deleteTarget?.name}</strong>? Verranno eliminati anche tutti i video, account TikTok, pagamenti e associazioni alle campagne. Questa azione è irreversibile.
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
