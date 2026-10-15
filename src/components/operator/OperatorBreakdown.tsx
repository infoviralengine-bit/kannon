import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";
import type { Breakdown } from "@/hooks/useOperatorData";

/** Ranked list with a proportional bar: views, video count and average per video. */
export function OperatorBreakdown({ title, rows, limit = 10, prefix = "" }: { title: string; rows: Breakdown[]; limit?: number; prefix?: string }) {
  const { t } = useI18n();
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((r) => Number(r.views)));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {top.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("Nessun dato")}</p>}
        {top.map((r, i) => (
          <div key={`${r.id ?? r.name}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{i + 1}. {prefix}{r.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{formatViews(Number(r.views))}</span>
                {" · "}{t("{n} video", { n: formatViews(Number(r.videos)) })}
                {" · "}{t("media {n}", { n: formatViews(Number(r.avg_views)) })}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(r.views) / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
