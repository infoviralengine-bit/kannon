import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Archive, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatViews } from "@/lib/format";
import { BriefFormDialog } from "./BriefFormDialog";
import {
  useContentInsights,
  useChangeBriefStatus,
  type BriefInput,
} from "@/hooks/useContentCalendar";

export default function InsightsTab({ campaignId }: { campaignId: string }) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data, isLoading } = useContentInsights(period, campaignId);
  const changeStatus = useChangeBriefStatus();
  const [template, setTemplate] = useState<Partial<BriefInput> | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const topFormats = (data?.top_formats_week ?? []) as any[];
  const cross = (data?.cross_creator_same_brief ?? []) as any[];
  const winners = (data?.winners_and_losers?.winners ?? []) as any[];
  const losers = (data?.winners_and_losers?.losers ?? []) as any[];

  const createSimilar = (b: any) => {
    setTemplate({ format_id: b.format_id ?? null, title: b.title ?? "" });
    setFormOpen(true);
  };

  const archive = (b: any) => {
    changeStatus.mutate(
      { id: b.brief_id, status: "archived" },
      {
        onSuccess: () => toast({ title: "Brief archiviato" }),
        onError: (e: any) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(["7d", "30d", "90d"] as const).map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>{p}</Button>
        ))}
      </div>

      {isLoading && <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>}
      {!isLoading && (
        <>
      {/* Top format */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top format del periodo</CardTitle></CardHeader>
        <CardContent>
          {topFormats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun dato nel periodo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-center">Brief</TableHead>
                  <TableHead className="text-center">Video</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Eng. %</TableHead>
                  <TableHead className="text-right">Delta views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topFormats.map((f) => (
                  <TableRow key={f.format_id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-center">{f.brief_count}</TableCell>
                    <TableCell className="text-center">{f.video_count}</TableCell>
                    <TableCell className="text-right">{formatViews(f.total_views)}</TableCell>
                    <TableCell className="text-right">{Number(f.avg_engagement_pct).toFixed(1)}%</TableCell>
                    <TableCell className="text-right"><Delta value={f.delta_views_pct} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cross creator */}
      <Card>
        <CardHeader><CardTitle className="text-base">Stesso brief, creator diversi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {cross.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun brief con piu creator nel periodo.</p>
          ) : (
            cross.map((b) => (
              <div key={b.brief_id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{b.brief_title || "Brief"}</p>
                    {b.format_name && <Badge variant="secondary" className="text-[10px] mt-0.5">{b.format_name}</Badge>}
                  </div>
                  {b.uplift_pct != null && (
                    <Badge className="bg-primary/10 text-primary">+{Number(b.uplift_pct).toFixed(0)}% uplift</Badge>
                  )}
                </div>
                <Table>
                  <TableBody>
                    {(b.creators ?? []).map((c: any) => (
                      <TableRow key={c.creator_id}>
                        <TableCell className="py-1.5">{c.creator_name ?? "Sconosciuto"}</TableCell>
                        <TableCell className="py-1.5 text-center text-muted-foreground">{c.video_count} video</TableCell>
                        <TableCell className="py-1.5 text-right">{formatViews(c.total_views)}</TableCell>
                        <TableCell className="py-1.5 text-right text-muted-foreground">{Number(c.avg_engagement_pct).toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Winners / losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Da replicare</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {winners.length === 0 && <p className="text-sm text-muted-foreground">Nessun winner.</p>}
            {winners.map((b) => (
              <div key={b.brief_id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.title || "Brief"}</p>
                  <p className="text-xs text-muted-foreground">{formatViews(b.total_views)} views, {Number(b.avg_engagement_pct).toFixed(1)}%</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => createSimilar(b)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />Crea simile
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Da ripensare</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {losers.length === 0 && <p className="text-sm text-muted-foreground">Nessun brief sotto soglia.</p>}
            {losers.map((b) => (
              <div key={b.brief_id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.title || "Brief"}</p>
                  <p className="text-xs text-muted-foreground">{formatViews(b.total_views)} views, {Number(b.avg_engagement_pct).toFixed(1)}%</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => archive(b)} disabled={changeStatus.isPending}>
                  <Archive className="h-3.5 w-3.5 mr-1" />Archivia
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
        </>
      )}

      <BriefFormDialog open={formOpen} onOpenChange={setFormOpen} campaignId={campaignId} template={template} />
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground inline-flex items-center"><Minus className="h-3 w-3" /></span>;
  if (value >= 0) return <span className="text-emerald-600 inline-flex items-center justify-end"><ArrowUp className="h-3 w-3" />{value.toFixed(0)}%</span>;
  return <span className="text-red-500 inline-flex items-center justify-end"><ArrowDown className="h-3 w-3" />{Math.abs(value).toFixed(0)}%</span>;
}
