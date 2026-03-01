import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import { useContractList, useActiveCampaignsForSelect } from "@/hooks/useContractData";

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
import { Checkbox } from "@/components/ui/checkbox";

const typeLabel: Record<string, string> = {
  solo_cpm: "Solo CPM",
  premium: "Premium",
  custom: "Custom",
};

function NewContractModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: campaigns } = useActiveCampaignsForSelect();
  const [name, setName] = useState("");
  const type = "custom";
  const [fixed, setFixed] = useState("0");
  const [cpm, setCpm] = useState("0.50");
  const [minVpd, setMinVpd] = useState("5");
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Inserisci il nome del contratto");
      const { data: contract, error } = await supabase
        .from("contracts" as any)
        .insert({
          name: name.trim(),
          type,
          creator_fixed: parseFloat(fixed) || 0,
          creator_cpm: parseFloat(cpm) || 0.5,
          min_videos_per_day: parseInt(minVpd) || 5,
        })
        .select()
        .single();
      if (error) throw error;

      if (selectedCampaigns.length) {
        const rows = selectedCampaigns.map((cid) => ({
          contract_id: (contract as any).id,
          campaign_id: cid,
        }));
        const { error: e2 } = await supabase.from("contract_campaigns" as any).insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast({ title: "Contratto creato" });
      qc.invalidateQueries({ queryKey: ["contract-list"] });
      onOpenChange(false);
      setName(""); setFixed("0"); setCpm("0.50"); setMinVpd("5"); setSelectedCampaigns([]);
    },
    onError: (e: Error) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuovo Contratto</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Nome contratto *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='es. "Contratto FZ"' />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Fisso mensile (€)</Label>
              <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>CPM (€)</Label>
              <Input type="number" step="0.01" value={cpm} onChange={(e) => setCpm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Min video/giorno</Label>
              <Input type="number" min="1" value={minVpd} onChange={(e) => setMinVpd(e.target.value)} />
            </div>
          </div>
          {(campaigns ?? []).length > 0 && (
            <div className="grid gap-1.5">
              <Label>Campagne incluse</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {(campaigns ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedCampaigns.includes(c.id)}
                      onCheckedChange={() => toggleCampaign(c.id)}
                    />
                    <span className="text-sm">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Creazione..." : "Crea Contratto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useContractList();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Contratti</h1>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuovo Contratto
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun contratto creato
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Campagne</TableHead>
                <TableHead className="text-right">Creator</TableHead>
                <TableHead className="text-right">Fisso (€)</TableHead>
                <TableHead className="text-right">CPM (€)</TableHead>
                <TableHead className="text-right">Min video/g</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/contracts/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabel[c.type] ?? c.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.campaignCount}</TableCell>
                  <TableCell className="text-right">{c.creatorCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.creatorFixed)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.creatorCpm)}</TableCell>
                  <TableCell className="text-right">{c.minVideosPerDay}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? "Attivo" : "Inattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Apri</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <NewContractModal open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
