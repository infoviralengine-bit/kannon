import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BriefStatus } from "@/hooks/useContentCalendar";

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday-based weekday index: Mon=0 ... Sun=6 */
export function weekdayIndexMon(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function formatDateIt(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("it-IT", opts ?? { day: "numeric", month: "short" });
}

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export const STATUS_META: Record<BriefStatus, { label: string; dot: string; badge: string }> = {
  draft: { label: "Bozza", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" },
  in_review: { label: "In revisione", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600" },
  approved: { label: "Approvato", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-600" },
  archived: { label: "Archiviato", dot: "bg-slate-400", badge: "bg-slate-400/15 text-slate-500" },
};

/** Chips input: Enter or comma to add, X to remove. Strips leading '#'. */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  stripHash = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  stripHash?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    let v = raw.trim();
    if (stripHash) v = v.replace(/^#+/, "");
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {value.map((chip) => (
        <Badge key={chip} variant="secondary" className="gap-1">
          {stripHash ? `#${chip}` : chip}
          <button type="button" onClick={() => onChange(value.filter((c) => c !== chip))}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-6 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 min-w-[80px]"
      />
    </div>
  );
}
