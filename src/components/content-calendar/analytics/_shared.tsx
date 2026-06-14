import { Badge } from "@/components/ui/badge";
import { Minus, ArrowUp, ArrowDown } from "lucide-react";

/** Percent change current vs previous period. */
export function trendPercent(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

export function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = trendPercent(current, prev);
  if (pct === 0)
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  if (pct > 0)
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <ArrowUp className="h-3 w-3" /> +{pct}%
      </span>
    );
  return (
    <span className="text-xs text-red-500 flex items-center gap-1">
      <ArrowDown className="h-3 w-3" /> {pct}%
    </span>
  );
}

export function ViralBadge({ velocity }: { velocity: number }) {
  if (velocity >= 100_000)
    return <Badge className="bg-red-500 text-white hover:bg-red-500/90">🔥 Virale</Badge>;
  if (velocity >= 50_000)
    return <Badge className="bg-orange-500 text-white hover:bg-orange-500/90">🚀 Esplodendo</Badge>;
  if (velocity >= 10_000)
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">⚡ In crescita</Badge>;
  return null;
}

export function DurationBadge({ sec }: { sec: number | null }) {
  if (sec === null) return <span className="text-xs text-muted-foreground">-</span>;
  if (sec <= 15) return <Badge variant="outline" className="text-xs">⚡ {sec}s</Badge>;
  if (sec <= 30) return <Badge variant="outline" className="text-xs">▶ {sec}s</Badge>;
  return <Badge variant="outline" className="text-xs">🎬 {sec}s</Badge>;
}

export const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);
export function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
