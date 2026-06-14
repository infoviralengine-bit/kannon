import { BriefCard } from "./BriefCard";
import { WeekHeader } from "./WeekHeader";
import { WEEKDAY_LABELS, weekdayIndexMon } from "./_helpers";
import type { Brief, CalendarWeek } from "@/hooks/useContentCalendar";

export function ContentCalendarGrid({
  weeks,
  campaignId,
  onOpenBrief,
}: {
  weeks: CalendarWeek[];
  campaignId: string;
  onOpenBrief: (brief: Brief) => void;
}) {
  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nessun brief nel periodo selezionato. Crea il primo con "+ Nuovo brief".
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeks.map((week) => {
        const byDay: Brief[][] = [[], [], [], [], [], [], []];
        for (const b of week.briefs) {
          const idx = weekdayIndexMon(new Date(b.planned_publish_date));
          byDay[idx].push(b);
        }
        return (
          <div key={week.week_start} className="space-y-2">
            <WeekHeader weekStart={week.week_start} briefs={week.briefs} campaignId={campaignId} />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={label} className="space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 text-center">
                    {label}
                  </div>
                  <div className="space-y-1.5 min-h-[40px]">
                    {byDay[i].map((b) => (
                      <BriefCard key={b.id} brief={b} onClick={() => onOpenBrief(b)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
