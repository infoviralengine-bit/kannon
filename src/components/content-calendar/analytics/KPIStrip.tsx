import { Card, CardContent } from "@/components/ui/card";
import { Eye, Users, FileText, Activity, CalendarCheck, Trophy } from "lucide-react";
import { formatViews } from "@/lib/format";
import { TrendBadge, num } from "./_shared";

export function KPIStrip({ data }: { data: any }) {
  const d = data ?? {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      <Kpi icon={<Eye className="h-4 w-4" />} label="Views" value={formatViews(num(d.totalViews))}
        trend={<TrendBadge current={num(d.totalViews)} prev={num(d.prevTotalViews)} />} />
      <Kpi icon={<Users className="h-4 w-4" />} label="Creator attivi" value={String(num(d.activeCreators))}
        trend={<TrendBadge current={num(d.activeCreators)} prev={num(d.prevActiveCreators)} />} />
      <Kpi icon={<FileText className="h-4 w-4" />} label="Contenuti" value={String(num(d.publishedContent))}
        trend={<TrendBadge current={num(d.publishedContent)} prev={num(d.prevPublishedContent)} />} />
      <Kpi icon={<Activity className="h-4 w-4" />} label="Engagement" value={`${num(d.avgEngagementRate).toFixed(1)}%`} />
      <Kpi icon={<CalendarCheck className="h-4 w-4" />} label="Brief nel periodo" value={String(num(d.briefs_count_in_period))} />
      <Kpi icon={<Trophy className="h-4 w-4" />} label="Brief winner" value={String(num(d.briefs_winner_count))} />
    </div>
  );
}

function Kpi({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <p className="text-xl font-semibold">{value}</p>
        {trend && <div>{trend}</div>}
      </CardContent>
    </Card>
  );
}
