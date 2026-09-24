import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useI18n, t as t_ } from "@/i18n";

export function CopyableField({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: copyLabel ?? t_("Copiato") });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t_("Impossibile copiare"), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          {t("Copia")}
        </Button>
      </div>
      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm">{value}</p>
    </div>
  );
}
