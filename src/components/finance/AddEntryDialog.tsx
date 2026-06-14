import { useState, useEffect } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCreateEntry, FinancialEntryInput } from "@/hooks/useFinanceData";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  type: z.enum(["revenue", "cost", "invoice_in", "invoice_out"]),
  category: z.string().max(50).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  amount: z.number().positive("Importo > 0").max(99999999),
  date: z.string(),
  due_date: z.string().optional().nullable(),
  status: z.enum(["expected", "confirmed", "received", "paid"]),
  campaign_id: z.string().uuid().optional().nullable(),
  creator_id: z.string().uuid().optional().nullable(),
  brand_name: z.string().max(100).optional().nullable(),
  invoice_number: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export function AddEntryDialog({ defaultType }: { defaultType?: FinancialEntryInput["type"] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FinancialEntryInput["type"]>(defaultType ?? "revenue");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<FinancialEntryInput["status"]>("expected");
  const [campaignId, setCampaignId] = useState<string>("");
  const [creatorId, setCreatorId] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);

  const { mutateAsync, isPending } = useCreateEntry();

  useEffect(() => {
    if (!open) return;
    supabase.from("campaigns").select("id, name").order("name").then(({ data }) => setCampaigns(data ?? []));
    supabase.from("creators").select("id, name").order("name").then(({ data }) => setCreators(data ?? []));
  }, [open]);

  const reset = () => {
    setType(defaultType ?? "revenue"); setCategory(""); setDescription(""); setAmount("");
    setDate(new Date().toISOString().slice(0, 10)); setDueDate(""); setStatus("expected");
    setCampaignId(""); setCreatorId(""); setBrand(""); setInvoiceNumber(""); setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = schema.parse({
        type, category: category || null, description: description || null,
        amount: Number(amount), date, due_date: dueDate || null, status,
        campaign_id: campaignId || null, creator_id: creatorId || null,
        brand_name: brand || null, invoice_number: invoiceNumber || null, notes: notes || null,
      });
      await mutateAsync(parsed as FinancialEntryInput);
      toast({ title: "Voce aggiunta", description: "La voce è stata registrata." });
      reset(); setOpen(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message ?? "Impossibile salvare", variant: "destructive" });
    }
  };

  const isInvoice = type === "invoice_in" || type === "invoice_out";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Aggiungi</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuova voce</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Entrata</SelectItem>
                  <SelectItem value="cost">Uscita</SelectItem>
                  <SelectItem value="invoice_out">Fattura emessa</SelectItem>
                  <SelectItem value="invoice_in">Fattura ricevuta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expected">Previsto</SelectItem>
                  <SelectItem value="confirmed">Confermato</SelectItem>
                  <SelectItem value="received">Ricevuto</SelectItem>
                  <SelectItem value="paid">Pagato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Importo (€)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category || "_none"} onValueChange={(v) => setCategory(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nessuna</SelectItem>
                  <SelectItem value="creator_pay">Pagamento creator</SelectItem>
                  <SelectItem value="operator_pay">Pagamento operator</SelectItem>
                  <SelectItem value="tool">Tool</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="brand_fee">Brand fee</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>Scadenza</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Descrizione</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </div>
            <div>
              <Label>Campagna</Label>
              <Select value={campaignId || "_none"} onValueChange={(v) => setCampaignId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nessuna</SelectItem>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Creator</Label>
              <Select value={creatorId || "_none"} onValueChange={(v) => setCreatorId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nessuno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nessuno</SelectItem>
                  {creators.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
            </div>
            {isInvoice && (
              <div>
                <Label>N. fattura</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} maxLength={50} />
              </div>
            )}
            <div className="col-span-2">
              <Label>Note</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvataggio..." : "Salva"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}