import { CompanyLogo } from '@/components/companies/CompanyLogo';
import { useI18n } from '@/i18n';
import type { AllocationCampaign } from '@/lib/allocation';

const DAY = 86_400_000;
const colors = ['bg-allocation-one', 'bg-allocation-two', 'bg-allocation-three', 'bg-allocation-four', 'bg-allocation-five'];
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
const label = (time: number) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(time);
const month = (time: number) => new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' }).format(time);

export function AllocationCampaignStrip({ week, campaigns }: { week: string; campaigns: AllocationCampaign[] }) {
  const { t } = useI18n();
  // Keep the horizon fixed around the selected week; long-running campaigns cannot stretch the scale.
  const start = date(week) - 30 * DAY;
  const end = date(week) + 91 * DAY;
  const span = end - start;
  const visible = campaigns.filter(c => c.status === 'active' && date(c.start_date) <= end && (!c.end_date || date(c.end_date) >= start));
  const ticks: number[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= end) {
    if (cursor.getTime() >= start) ticks.push(cursor.getTime());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const weekLeft = Math.max(0, Math.min(100, (date(week) - start) / span * 100));

  if (!visible.length) return null;

  return <section aria-label={t('Durata campagne')} className="border-y border-allocation-mist py-3">
    <div className="mb-2 flex items-baseline justify-between gap-2"><h2 className="text-xs font-semibold text-allocation-ink">{t('Durata campagne')}</h2><span className="text-[11px] text-allocation-ink/75">{t('Settimana selezionata')}: {label(date(week))}</span></div>
      <div className="space-y-1">
        <div className="flex h-4 items-center"><div className="w-40 shrink-0"/><div className="relative h-full flex-1 text-[10px] text-allocation-ink/75"><span className="absolute left-0">{month(start)}</span>{ticks.map(tick => <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick - start) / span * 100}%` }}>{month(tick)}</span>)}<span className="absolute right-0">{month(end)}</span></div></div>
        {visible.map((c, i) => {
          const first = date(c.start_date);
          const last = c.end_date ? date(c.end_date) : end;
          const left = Math.max(0, (Math.max(first, start) - start) / span * 100);
          const right = Math.min(100, (Math.min(last, end) - start) / span * 100);
          return <div key={c.id} className="flex h-8 items-center gap-2">
            <div className="flex w-40 shrink-0 items-center gap-2 overflow-hidden"><CompanyLogo name={c.name} logoUrl={c.logo_url} className="!h-6 !w-6 border-allocation-mist bg-surface"/><span className="truncate text-xs font-medium text-allocation-ink" title={c.name}>{c.name}</span></div>
            <div className="relative h-6 flex-1 bg-allocation-mist/50" title={`${c.name}: ${label(first)} – ${c.end_date ? label(last) : t('Continuativa')}`}>
              {ticks.map(tick => <span key={tick} className="absolute inset-y-0 w-px bg-allocation-mist" style={{ left: `${(tick - start) / span * 100}%` }}/ >)}
              <span className={`absolute top-2 h-2 rounded-sm ${colors[i % colors.length]}`} style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }} />
              {first >= start && first <= end && <span className={`absolute top-1.5 h-3 w-1 rounded-sm ${colors[i % colors.length]}`} style={{ left: `${left}%` }} title={`${t('Inizio')}: ${label(first)}`} />}
              {c.end_date && last >= start && last <= end && <span className={`absolute top-1.5 h-3 w-1 rounded-sm ${colors[i % colors.length]}`} style={{ left: `${right}%` }} title={`${t('Fine')}: ${label(last)}`} />}
              <span className="absolute inset-y-0 w-px bg-allocation-ink/75" style={{ left: `${weekLeft}%` }} title={t('Settimana selezionata')} />
            </div>
          </div>;
        })}
      </div>
  </section>;
}