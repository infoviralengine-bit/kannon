import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientBriefCard } from "./ClientBriefCard";
import { ClientCommentsDrawer } from "./ClientCommentsDrawer";
import { ClientChangeRequestDialog } from "./ClientChangeRequestDialog";
import {
  formatDateIt,
  weekdayIndexMon,
  addDays,
  toISODate,
} from "@/components/content-calendar/_helpers";
import { useClientCampaignBriefs } from "@/hooks/useClientBriefs";
import type { PortalBrief } from "@/hooks/useClientBriefs";

function mondayOf(d: Date): Date {
  return addDays(d, -weekdayIndexMon(d));
}

export function ClientBriefsList() {
  const { data, isLoading } = useClientCampaignBriefs();
  const [commentBrief, setCommentBrief] = useState<PortalBrief | null>(null);
  const [crBrief, setCrBrief] = useState<PortalBrief | null>(null);

  const weeks = useMemo(() => {
    const map = new Map<string, PortalBrief[]>();
    for (const b of data ?? []) {
      const wk = toISODate(mondayOf(new Date(b.planned_publish_date)));
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk)!.push(b);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nessun contenuto da revisionare al momento.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeks.map(([weekStart, briefs]) => {
        const start = new Date(weekStart);
        return (
          <div key={weekStart} className="space-y-2">
            <h3 className="text-sm font-semibold">
              Settimana del {formatDateIt(start)} {" - "} {formatDateIt(addDays(start, 6))}
            </h3>
            <div className="space-y-3">
              {briefs.map((b) => (
                <ClientBriefCard key={b.id} brief={b} onComment={setCommentBrief} onChangeRequest={setCrBrief} />
              ))}
            </div>
          </div>
        );
      })}

      <ClientCommentsDrawer brief={commentBrief} open={!!commentBrief} onOpenChange={(o) => !o && setCommentBrief(null)} />
      <ClientChangeRequestDialog brief={crBrief} open={!!crBrief} onOpenChange={(o) => !o && setCrBrief(null)} />
    </div>
  );
}
