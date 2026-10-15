import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatViews } from "@/lib/format";
import { useI18n } from "@/i18n";

const DAY = 86_400_000;

type Point = { date: string; videos: number; views: number };

/** Daily views area chart; fills missing days with zero between from and to. */
export function OperatorViewsChart({ daily, from, to, height = 320 }: { daily: Point[]; from: string; to: string; height?: number }) {
  const { t } = useI18n();
  const points = useMemo(() => {
    const map = new Map(daily.map((d) => [d.date, d]));
    const out: { label: string; views: number; videos: number }[] = [];
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    for (let ms = start; ms <= end; ms += DAY) {
      const iso = new Date(ms).toISOString().slice(0, 10);
      const d = map.get(iso);
      const dt = new Date(ms);
      out.push({
        label: `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`,
        views: Number(d?.views ?? 0),
        videos: Number(d?.videos ?? 0),
      });
    }
    return out;
  }, [daily, from, to]);

  const interval = points.length <= 14 ? 1 : points.length <= 31 ? 3 : Math.ceil(points.length / 10);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="opViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={interval} />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number, name: string) => [formatViews(Number(v)), name === "views" ? t("Views") : t("Video")]}
        />
        <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#opViews)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
