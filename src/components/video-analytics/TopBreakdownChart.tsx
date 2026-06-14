import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatViews } from "@/lib/format";

export function TopBreakdownChart({
  title,
  data,
  nameKey,
  limit = 5,
}: {
  title: string;
  data: Array<Record<string, any> & { total_views: number; video_count: number }>;
  nameKey: string;
  limit?: number;
}) {
  const top = data.slice(0, limit).map((d) => ({
    ...d,
    _name: d[nameKey] ?? "—",
    total_views: Number(d.total_views),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent style={{ height: 280 }}>
        {top.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Nessun dato
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={(v) => formatViews(Number(v))} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="_name" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                formatter={(v: any) => formatViews(Number(v))}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Bar dataKey="total_views" name="Views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}