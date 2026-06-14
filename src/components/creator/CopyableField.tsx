import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function CopyableField({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: copyLabel ?? "Copiato" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          Copia
        </Button>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm">{value}</p>
    </div>
  );
}
