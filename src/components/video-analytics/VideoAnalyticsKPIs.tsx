import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Film, BarChart3, Heart, Clock } from "lucide-react";
import { formatViews } from "@/lib/format";
import type { VideoAnalyticsKPI, WindowStats } from "@/hooks/useVideoAnalytics";
import { useI18n } from "@/i18n";

export function VideoAnalyticsKPIs({
  kpi,
  windowStats,
}: {
  kpi: VideoAnalyticsKPI;
  windowStats: WindowStats;
}) {
  const { t } = useI18n();
  const cards = [
    {
      icon: Eye,
      label: t("Views totali"),
      value: formatViews(kpi.total_views),
      hint: t("{n} raw", { n: formatViews(kpi.total_raw_views) }),
    },
    {
      icon: Film,
      label: t("Video totali"),
      value: kpi.total_videos.toLocaleString("it-IT"),
      hint: t("nel periodo"),
    },
    {
      icon: BarChart3,
      label: t("Avg views/video"),
      value: formatViews(kpi.avg_views_per_video),
      hint: t("media per video"),
    },
    {
      icon: Heart,
      label: t("Engagement"),
      value: `${Number(kpi.avg_engagement_pct).toFixed(2)}%`,
      hint: t("{likes} like · {comments} commenti", { likes: formatViews(kpi.total_likes), comments: formatViews(kpi.total_comments) }),
    },
    {
      icon: Clock,
      label: t("Finestre aperte"),
      value: (windowStats.open_count + windowStats.closing_count).toLocaleString("it-IT"),
      hint: t("{closing} in chiusura · {closed} chiuse", { closing: windowStats.closing_count, closed: windowStats.closed_count }),
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value}</p>
              {c.hint && <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}