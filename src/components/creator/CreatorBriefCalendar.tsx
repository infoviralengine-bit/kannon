import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CreatorBriefCard } from "./CreatorBriefCard";
import {
  WEEKDAY_LABELS,
  STATUS_META,
  formatDateIt,
  weekdayIndexMon,
  addDays,
  toISODate,
} from "@/components/content-calendar/_helpers";
import { useCreatorAssignedBriefs } from "@/hooks/useCreatorBriefs";
import type { PortalBrief } from "@/hooks/useClientBriefs";

function mondayOf(d: Date): Date {
  return addDays(d, -weekdayIndexMon(d));
}

export function CreatorBriefCalendar() {
  const { data, isLoading } = useCreatorAssignedBriefs();
  const [selected, setSelected] = useState<PortalBrief | null>(null);

  const weeks = useMemo(() => {
    const map = new Map<string, PortalBrief[]>();
    for (const b of data ?? []) {
      const wk = toISODate(mondayOf(new Date(b.planned_publish_date)));
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk)!.push(b);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nessun contenuto in calendario.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeks.map(([weekStart, briefs]) => {
        const byDay: PortalBrief[][] = [[], [], [], [], [], [], []];
        for (const b of briefs) byDay[weekdayIndexMon(new Date(b.planned_publish_date))].push(b);
        const start = new Date(weekStart);
        return (
          <div key={weekStart} className="space-y-2">
            <h3 className="text-sm font-semibold">
              Settimana del {formatDateIt(start)} {" - "} {formatDateIt(addDays(start, 6))}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={label} className="space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 text-center">{label}</div>
                  <div className="space-y-1.5 min-h-[40px]">
                    {byDay[i].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelected(b)}
                        className="w-full text-left rounded-md border border-border bg-card p-2 hover:border-primary/50 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{formatDateIt(b.planned_publish_date)}</span>
                          <span className={`h-2 w-2 rounded-full ${STATUS_META[b.status].dot}`} />
                        </div>
                        <p className="text-xs font-medium leading-tight line-clamp-2">{b.title || b.copy_text.split("\n")[0]}</p>
                        {b.format_name && <Badge variant="secondary" className="text-[9px]">{b.format_name}</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Dettaglio contenuto</SheetTitle></SheetHeader>
          {selected && <div className="mt-4"><CreatorBriefCard brief={selected} /></div>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
