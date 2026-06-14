import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentCalendarGrid } from "./ContentCalendarGrid";
import { BriefDetailDrawer } from "./BriefDetailDrawer";
import { BriefFormDialog } from "./BriefFormDialog";
import { toISODate } from "./_helpers";
import { useContentCalendar, type Brief } from "@/hooks/useContentCalendar";

type RangeKey = "current" | "previous" | "last90";

const RANGE_LABELS: Record<RangeKey, string> = {
  current: "Mese corrente",
  previous: "Mese precedente",
  last90: "Ultimi 90 giorni",
};

function computeRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  if (key === "current") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toISODate(from), to: toISODate(to) };
  }
  if (key === "previous") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toISODate(from), to: toISODate(to) };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  const to = new Date(now);
  to.setDate(to.getDate() + 30);
  return { from: toISODate(from), to: toISODate(to) };
}

export default function CalendarTab({ campaignId }: { campaignId: string }) {
  const [range, setRange] = useState<RangeKey>("current");
  const { from, to } = useMemo(() => computeRange(range), [range]);
  const { data, isLoading } = useContentCalendar(campaignId, from, to);

  const [selected, setSelected] = useState<Brief | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brief | null>(null);

  const allBriefs = useMemo(() => (data?.weeks ?? []).flatMap((w) => w.briefs), [data]);
  const kpis = useMemo(() => {
    const by = (s: string) => allBriefs.filter((b) => b.status === s).length;
    return {
      total: allBriefs.length,
      draft: by("draft"),
      in_review: by("in_review"),
      approved: by("approved"),
      winners: allBriefs.filter((b) => b.is_winner).length,
    };
  }, [allBriefs]);

  const openBrief = (b: Brief) => {
    setSelected(b);
    setDrawerOpen(true);
  };
  const openEdit = (b: Brief) => {
    setEditing(b);
    setDrawerOpen(false);
    setFormOpen(true);
  };
  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => setRange(k)}>
              {RANGE_LABELS[k]}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />Nuovo brief
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi label="Tot brief" value={kpis.total} />
        <Kpi label="Bozze" value={kpis.draft} />
        <Kpi label="In revisione" value={kpis.in_review} />
        <Kpi label="Approvati" value={kpis.approved} />
        <Kpi label="Winner" value={kpis.winners} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <ContentCalendarGrid weeks={data?.weeks ?? []} campaignId={campaignId} onOpenBrief={openBrief} />
      )}

      <BriefDetailDrawer brief={selected} open={drawerOpen} onOpenChange={setDrawerOpen} onEdit={openEdit} />
      <BriefFormDialog open={formOpen} onOpenChange={setFormOpen} campaignId={campaignId} brief={editing} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
