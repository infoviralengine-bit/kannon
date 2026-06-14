import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateCash } from "@/hooks/useFinanceData";
import { toast } from "@/hooks/use-toast";

export function CashEditDialog({ current, trigger }: { current: number | null; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(current?.toString() ?? "");
  const { mutateAsync, isPending } = useUpdateCash();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value);
    if (!isFinite(n) || n < 0) {
      toast({ title: "Importo non valido", variant: "destructive" });
      return;
    }
    try {
      await mutateAsync(n);
      toast({ title: "Cash aggiornato" });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Aggiorna Cash in bank</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Importo corrente (€)</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "..." : "Salva"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}