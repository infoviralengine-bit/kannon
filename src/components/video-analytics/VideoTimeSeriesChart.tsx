import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatViews } from "@/lib/format";
import type { DayBreakdown } from "@/hooks/useVideoAnalytics";

export function VideoTimeSeriesChart({ data }: { data: DayBreakdown[] }) {
  const chartData = data.map((d) => ({
    label: new Date(d.day).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    views: Number(d.total_views),
    videos: Number(d.video_count),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Andamento views per giorno</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 320 }}>
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nessun dato nel periodo
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} interval="preserveStartEnd" />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatViews(Number(v))} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                formatter={(v: any, name) => (name === "Views" ? formatViews(Number(v)) : v)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="views" name="Views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="videos" name="Video" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}