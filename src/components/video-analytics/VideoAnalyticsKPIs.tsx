import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Film, BarChart3, Heart, Clock } from "lucide-react";
import { formatViews } from "@/lib/format";
import type { VideoAnalyticsKPI, WindowStats } from "@/hooks/useVideoAnalytics";

export function VideoAnalyticsKPIs({
  kpi,
  windowStats,
}: {
  kpi: VideoAnalyticsKPI;
  windowStats: WindowStats;
}) {
  const cards = [
    {
      icon: Eye,
      label: "Views totali",
      value: formatViews(kpi.total_views),
      hint: `${formatViews(kpi.total_raw_views)} raw`,
    },
    {
      icon: Film,
      label: "Video totali",
      value: kpi.total_videos.toLocaleString("it-IT"),
      hint: "nel periodo",
    },
    {
      icon: BarChart3,
      label: "Avg views/video",
      value: formatViews(kpi.avg_views_per_video),
      hint: "media per video",
    },
    {
      icon: Heart,
      label: "Engagement",
      value: `${Number(kpi.avg_engagement_pct).toFixed(2)}%`,
      hint: `${formatViews(kpi.total_likes)} like · ${formatViews(kpi.total_comments)} commenti`,
    },
    {
      icon: Clock,
      label: "Finestre aperte",
      value: (windowStats.open_count + windowStats.closing_count).toLocaleString("it-IT"),
      hint: `${windowStats.closing_count} in chiusura · ${windowStats.closed_count} chiuse`,
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