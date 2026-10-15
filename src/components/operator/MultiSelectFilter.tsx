import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";

type Option = { id: string; label: string };

export function MultiSelectFilter({
  label, options, value, onChange,
}: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
          {label}
          {value.length > 0 && <span className="rounded bg-primary/15 px-1.5 text-primary">{value.length}</span>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cerca...")} className="mb-2 h-8 text-xs" />
        <div className="max-h-64 space-y-0.5 overflow-auto">
          {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t("Nessun risultato")}</p>}
          {filtered.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
              <Checkbox checked={value.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 h-7 w-full text-xs" onClick={() => onChange([])}>
            {t("Azzera")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
