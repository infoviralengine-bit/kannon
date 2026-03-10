import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEntry } from "@/hooks/useCreatorPortal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  calendar: CalendarEntry[];
  locked: boolean;
}

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export default function CreatorCalendar({ calendar, locked }: Props) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<CalendarEntry | null>(null);

  const grid = useMemo(() => {
    const firstDay = new Date(month.year, month.month, 1);
    const lastDay = new Date(month.year, month.month + 1, 0);
    const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalDays = lastDay.getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [month]);

  const entriesByDay = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();
    calendar.forEach((e) => {
      const d = new Date(e.scheduled_for);
      if (d.getFullYear() === month.year && d.getMonth() === month.month) {
        const day = d.getDate();
        map.set(day, [...(map.get(day) ?? []), e]);
      }
    });
    return map;
  }, [calendar, month]);

  if (locked) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center space-y-2">
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-semibold">🔒 Disponibile dopo il warmup</p>
          <p className="text-sm text-muted-foreground">
            Il tuo calendario di pubblicazione sarà visibile qui una volta completato il warmup.
          </p>
        </CardContent>
      </Card>
    );
  }

  const prevMonth = () => setMonth((m) => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
  const nextMonth = () => setMonth((m) => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" /> Quando pubblicare
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Rispetta le date — la costanza è la chiave per crescere.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold">{MONTHS[month.month]} {month.year}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-px">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {grid.map((day, i) => {
              const entries = day ? entriesByDay.get(day) ?? [] : [];
              const isToday = day && month.year === new Date().getFullYear() && month.month === new Date().getMonth() && day === new Date().getDate();
              return (
                <div
                  key={i}
                  className={`min-h-[60px] rounded-md p-1 text-xs border border-transparent ${
                    day ? "bg-secondary/30" : ""
                  } ${isToday ? "ring-1 ring-primary/50" : ""}`}
                >
                  {day && (
                    <>
                      <span className={`text-[11px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                      <div className="space-y-0.5 mt-0.5">
                        {entries.map((e) => (
                          <button
                            key={e.id}
                            className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                            onClick={() => setSelected(e)}
                          >
                            {e.contentTitle ?? "Pubblicazione"}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.contentTitle ?? "Pubblicazione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Data:</span> {selected?.scheduled_for ? new Date(selected.scheduled_for).toLocaleDateString("it-IT") : "—"}</p>
            {selected?.accountUsername && <p><span className="text-muted-foreground">Account:</span> @{selected.accountUsername}</p>}
            <p><span className="text-muted-foreground">Stato:</span> <Badge variant="outline">{selected?.status}</Badge></p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
