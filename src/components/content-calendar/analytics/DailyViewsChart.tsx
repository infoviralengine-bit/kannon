import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatViews } from "@/lib/format";
import { arr } from "./_shared";

export function DailyViewsChart({ data }: { data: any }) {
  const points = useMemo(() => {
    return arr<Record<string, unknown>>(data?.dailyViews).map((row) => {
      let total = 0;
      for (const [k, v] of Object.entries(row)) {
        if (k !== "date" && typeof v === "number") total += v;
      }
      return { date: String(row.date ?? ""), total };
    });
  }, [data]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Views pubblicate per giorno</CardTitle></CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun dato.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="viewsGradientCC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                fontSize={11}
              />
              <YAxis tickFormatter={(v) => formatViews(Number(v))} fontSize={11} width={56} />
              <Tooltip
                formatter={(v) => [formatViews(Number(v)), "Views"]}
                labelFormatter={(v) => new Date(v).toLocaleDateString("it-IT")}
              />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#viewsGradientCC)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
