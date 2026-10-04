import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Eraser, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CompanyLogo } from '@/components/companies/CompanyLogo';
import { useI18n } from '@/i18n';
import { activeDays, campTotals, effectiveSlots, paint, type AllocationCampaign, type AllocationRow } from '@/lib/allocation';
import type { Group, Premium } from '@/hooks/useAllocation';
import { AllocationGroups } from './AllocationGroups';

const colors = ['bg-allocation-one','bg-allocation-two','bg-allocation-three','bg-allocation-four','bg-allocation-five'];
const tally = (n: number) => new Intl.NumberFormat('it-IT').format(n);
type Props = {
  week: string; campaigns: AllocationCampaign[]; creators: Premium[]; rows: AllocationRow[]; previous: AllocationRow[];
  accounts: Set<string>; groups: Group[]; auto: boolean; writable: boolean; busy: boolean;
  onRows: (rows: AllocationRow[]) => void; onAuto: (value: boolean) => void;
  onTier: (id: string, tier: string | null) => Promise<void>;
  onTarget: (id: string, target: number) => Promise<void>;
  onConfigure: (id: string, slots: number) => Promise<void>;
  onCreateGroup: (name: string, ids: string[]) => Promise<void>;
  onUpdateGroup: (id: string, patch: { name?: string; creator_ids?: string[] }) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
};

function contractSection(names: string[]) {
  if (names.some(n => /premium/i.test(n))) return 'Premium';
  if (names.some(n => /^ve$/i.test(n.trim()))) return 'VE';
  if (names.some(n => /finanz|\bfz\b/i.test(n))) return 'Finanz';
  return 'Senza contratto';
}

export function AllocationBoard(p: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);
  const [error, setError] = useState('');
  const [capacities, setCapacities] = useState<Record<string,number>>({});
  const [targets, setTargets] = useState<Record<string,string>>({});
  const available = p.campaigns.filter(c => activeDays(c, p.week) > 0);
  const residual = available.find(c => c.is_residual)?.id ?? null;
  const activeCampaign = available.find(c => c.id === active);
  const chosen = activeCampaign && (!activeCampaign.is_residual || !p.auto) ? activeCampaign.id : null;
  const total = p.rows.filter(r => !r.paused).reduce((n, r) => n + r.slots.length, 0);
  const totals = available.map(c => campTotals(p.rows, c, p.week, residual, p.auto));
  const idle = p.rows.reduce((n, r) => n + effectiveSlots(r, residual, p.auto).filter(s => !s).length, 0);
  const changes = p.rows.filter(r => { const prev = p.previous.find(x => x.creator_id === r.creator_id); return prev && (prev.paused !== r.paused || JSON.stringify(prev.slots) !== JSON.stringify(r.slots)); });
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    p.rows.forEach(r => effectiveSlots(r, residual, p.auto).forEach(id => map.set(id ?? 'idle', (map.get(id ?? 'idle') ?? 0) + 1)));
    return map;
  }, [p.rows, residual, p.auto]);
  const doAction = async (action: () => Promise<void>) => {
    setError(''); setGroupBusy(true);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : t('Operazione non riuscita')); }
    finally { setGroupBusy(false); }
  };
  const apply = (creatorId: string, index: number) => {
    if (!chosen || !p.writable || p.busy) return;
    const targets = selected.length ? selected : [creatorId];
    p.onRows(p.rows.map(r => targets.includes(r.creator_id) && !r.paused && index < r.slots.length ? { ...r, slots: paint(r.slots, index, chosen) } : r));
  };
  const clearSlots = (ids: string[]) => {
    if (!p.writable || p.busy) return;
    p.onRows(p.rows.map(r => ids.includes(r.creator_id) ? { ...r, slots: r.slots.map(() => null) } : r));
  };
  const sections = ['Premium','VE','Finanz','Senza contratto'].map(name => ({ name, creators: p.creators.filter(c => contractSection(c.contracts) === name).sort((a, b) => {
    const position = (c: Premium) => {
      const row = p.rows.find(r => r.creator_id === c.id);
      return row && !row.paused ? 0 : row ? 1 : 2;
    };
    return position(a) - position(b) || a.name.localeCompare(b.name);
  }) }));

  return <div className="space-y-6">
    <section className="space-y-3" aria-label={t('Distribuzione capacità')}>
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-sm text-allocation-ink"><strong className="text-xl tabular-nums">{tally(total)}</strong> {t('slot al giorno')}</span>
        <div className="flex h-5 flex-1 overflow-hidden rounded bg-allocation-mist" role="img" aria-label={t('Distribuzione capacità')}>
          {available.map((c, i) => <div key={c.id} title={`${c.name}: ${counts.get(c.id) ?? 0}`} className={`${colors[i % colors.length]} h-full border-r border-allocation-paper/50 transition-[width] duration-200`} style={{ width: total ? `${100 * (counts.get(c.id) ?? 0) / total}%` : '0%' }} />)}
          {idle > 0 && <div className="h-full bg-allocation-mist" title={`${idle} ${t('slot fermi')}`} style={{ width: total ? `${100 * idle / total}%` : '0%' }} />}
        </div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label={t('Campagne della settimana')}>
      {available.map((c, i) => {
        const data = totals[i]; const blocked = c.is_residual && p.auto;
        const monthlyTarget = c.target_monthly_videos ?? (c.is_residual ? null : c.min_monthly_videos);
        const status = data.target === null ? t('Residuo') : data.videos === 0 ? t('Vuota') : data.videos < data.target * .98 ? t('Sotto target') : data.videos > data.target * 1.08 ? t('Sopra target') : t('In linea');
        return <div key={c.id} className={`relative min-w-0 overflow-hidden rounded-md border bg-surface ${active === c.id ? 'border-allocation-ink ring-1 ring-allocation-ink' : 'border-allocation-mist'}`}><span aria-hidden="true" className={`absolute inset-y-0 left-0 z-10 w-1 ${colors[i % colors.length]}`}/><Button variant="outline" disabled={blocked || !p.writable} onClick={() => setActive(active === c.id ? null : c.id)} aria-pressed={active === c.id} className={`h-auto min-h-28 w-full flex-col items-stretch gap-2 whitespace-normal rounded-none border-0 bg-surface p-3 pl-4 text-left text-allocation-ink disabled:opacity-80 hover:!bg-allocation-paper hover:!text-allocation-ink ${active === c.id ? 'bg-allocation-paper' : ''}`}>
          <span className="flex min-w-0 items-center gap-2"><CompanyLogo name={c.name} logoUrl={c.logo_url} className="h-9 w-9 border-allocation-mist bg-surface" imageClassName="p-0.5"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{c.name}</span><span className="block truncate text-xs font-normal text-allocation-ink/75">{c.client_name}</span></span></span>
          <span className="text-xl font-bold tabular-nums">{tally(data.videos)} <span className="text-sm font-normal text-allocation-ink/75">/ {data.target === null ? '—' : tally(data.target)} {t('video/settimana')}</span></span>
          <span className="h-1 w-full bg-allocation-mist"><span className={`block h-full ${colors[i % colors.length]}`} style={{ width: `${data.target ? Math.min(100, 100 * data.videos / data.target) : 100}%` }}/></span>
          <span className="text-xs font-normal text-allocation-ink/75">{status} · {monthlyTarget === null ? '—' : tally(monthlyTarget)} {t('video/mese')}</span>
        </Button>{p.writable && <label className={`flex items-center justify-between gap-2 pb-3 pl-4 pr-3 text-xs text-allocation-ink ${active === c.id ? 'bg-allocation-paper' : ''}`}><span>{t('Obiettivo mensile')}</span><Input type="number" min={0} step={1} aria-label={`${t('Obiettivo mensile')} ${c.name}`} className="h-7 w-20 border-allocation-mist bg-allocation-paper px-1 text-right text-allocation-ink" value={targets[c.id] ?? String(monthlyTarget ?? 0)} onChange={event => setTargets(prev => ({...prev, [c.id]: event.target.value}))} onBlur={() => { const value = targets[c.id]; if (value !== undefined && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) !== monthlyTarget) doAction(async () => { await p.onTarget(c.id, Number(value)); setTargets(prev => { const next = {...prev}; delete next[c.id]; return next; }); }); else setTargets(prev => { const next = {...prev}; delete next[c.id]; return next; }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>}</div>;
      })}
    </section>


    <AllocationGroups week={p.week} groups={p.groups} creators={p.creators} rows={p.rows} campaigns={p.campaigns} colors={colors} sectionOf={c => contractSection(c.contracts)} writable={p.writable} busy={p.busy} onRows={p.onRows} onCreate={p.onCreateGroup} onUpdate={p.onUpdateGroup} onDelete={p.onDeleteGroup}/>

    <div className="space-y-7">
      {sections.map(section => <section key={section.name} aria-label={`${t('Contratto')} ${section.name}`}>
        <div className="mb-3 flex items-center justify-between border-b border-allocation-mist pb-2"><h2 className="text-base font-semibold">{section.name === 'Senza contratto' ? t(section.name) : section.name}</h2><div className="flex items-center gap-2">{p.writable && section.creators.length > 0 && <Button size="sm" variant="ghost" className="h-7 text-xs text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" disabled={p.busy} onClick={() => clearSlots(section.creators.map(c => c.id))}><Eraser className="mr-1 h-3 w-3"/>{t('Svuota contratto')}</Button>}<span className="text-xs text-allocation-ink/75">{section.creators.length} {t('creator')}</span></div></div>
        {section.creators.length === 0 ? <p className="py-3 text-sm text-allocation-ink/75">{t('Nessun creator in questa sezione')}</p> : <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {section.creators.map((c, index) => {
            const row = c.status === 'active' ? p.rows.find(r => r.creator_id === c.id) : undefined;
            const inactive = !row || row.paused;
            const previous = section.creators[index - 1];
            const previousRow = previous && p.rows.find(r => r.creator_id === previous.id);
            const groupStart = index === 0 || (inactive && previousRow && !previousRow.paused);
            const slots = row ? effectiveSlots(row, residual, p.auto) : [];
            const unique = [...new Set(slots.filter((s): s is string => Boolean(s)))];
            const missing = unique.filter(id => !p.accounts.has(`${c.id}:${id}`));
            const picked = selected.includes(c.id);
            return <Fragment key={c.id}>{groupStart && <h3 className={`col-span-full text-xs font-semibold text-allocation-ink/75 ${index > 0 ? 'border-t border-allocation-mist pt-3' : ''}`}>{inactive ? t('Inattivi') : t('Attivi')}</h3>}<div className={`min-w-0 rounded-md border bg-surface p-3 transition-colors ${picked ? 'border-allocation-ink ring-1 ring-allocation-ink' : 'border-allocation-mist'} ${row?.paused ? 'opacity-60' : ''}`}>
              <div className="flex min-w-0 items-center gap-1">
                <Button title={t('Cambia tier')} aria-label={`${t('Cambia tier')} ${c.name}`} variant="outline" size="sm" disabled={!p.writable || groupBusy || !row} className="h-7 w-7 shrink-0 border-allocation-mist p-0 text-xs text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" onClick={() => doAction(() => p.onTier(c.id, c.tier === 'A' ? 'B' : c.tier === 'B' ? 'C' : 'A'))}>{c.tier ?? '·'}</Button>
                <Button variant="ghost" className="h-8 min-w-0 flex-1 justify-start truncate px-1 text-xs font-semibold text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" title={c.name} onClick={() => setSelected(picked ? selected.filter(id => id !== c.id) : [...selected, c.id])}>{c.name}</Button>
                {row && <Button variant="ghost" size="icon" title={t('Svuota creator')} aria-label={`${t('Svuota creator')} ${c.name}`} disabled={!p.writable || p.busy || !row.slots.some(Boolean)} className="h-7 w-7 shrink-0 text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" onClick={() => clearSlots([c.id])}><Eraser className="h-3 w-3"/></Button>}
                {row && <Button variant="ghost" size="icon" title={row.paused ? t('Riattiva') : t('Metti in pausa')} aria-label={`${row.paused ? t('Riattiva') : t('Metti in pausa')} ${c.name}`} disabled={!p.writable || p.busy} className="h-7 w-7 shrink-0 text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" onClick={() => p.onRows(p.rows.map(r => r.creator_id === c.id ? {...r,paused:!r.paused} : r))}>{row.paused ? <Play className="h-3 w-3"/> : <Pause className="h-3 w-3"/>}</Button>}
              </div>
              {c.contracts.length > 1 && <div className="mt-1 text-[11px] text-allocation-ink/75">{c.contracts.join(' · ')}</div>}
              {row ? <>
                <div className="mt-3 flex gap-1.5">{row.slots.map((id, index) => {
                  const effective = slots[index]; const colorIndex = available.findIndex(x => x.id === effective);
                  return <button key={index} type="button" title={`${c.name} · ${t('slot')} ${index + 1}: ${available.find(x => x.id === effective)?.name ?? t('Libero')}`} aria-label={`${c.name} ${t('slot')} ${index + 1}`} disabled={row.paused || !chosen || !p.writable || p.busy} onClick={() => apply(c.id, index)} className={`h-7 min-w-0 flex-1 rounded-sm border p-0 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-85 ${effective ? `${colorIndex >= 0 ? colors[colorIndex % colors.length] : 'bg-allocation-mist'} border-transparent` : 'border-allocation-mist bg-allocation-paper'}`}/>;
                })}</div>
                <div className="mt-2 flex justify-between gap-1 text-[11px] text-allocation-ink/75"><span>{row.paused ? t('In pausa') : `${unique.length} ${t('account')}`}</span>{!row.paused && missing.length > 0 && <span className="flex items-center gap-0.5 text-allocation-signal" title={missing.map(id => available.find(x => x.id === id)?.name).join(', ')}><AlertTriangle className="h-3 w-3"/>{missing.length} {t('mancanti')}</span>}</div>
              </> : <div className="mt-3 flex items-center gap-2 border-t border-allocation-mist pt-2 text-xs"><span className="flex-1 text-allocation-ink/75">{c.status === 'active' ? t('Capacità da impostare') : t('Non attivo')}</span>{c.status === 'active' && p.writable && <><Input type="number" min={1} max={12} aria-label={`${t('Slot al giorno')} ${c.name}`} className="h-8 w-14 border-allocation-mist bg-allocation-paper px-1 text-center" value={capacities[c.id] ?? 5} onChange={e => setCapacities(prev => ({...prev,[c.id]:Number(e.target.value)}))}/><Button size="sm" variant="outline" className="h-8 border-allocation-ink text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" disabled={groupBusy || p.busy || (capacities[c.id] ?? 5) < 1 || (capacities[c.id] ?? 5) > 12} onClick={() => doAction(() => p.onConfigure(c.id, capacities[c.id] ?? 5))}>{t('Attiva')}</Button></>}</div>}
            </div></Fragment>;
          })}
        </div>}
      </section>)}
    </div>

    <section className="border-t border-allocation-mist pt-2"><Button variant="ghost" className="w-full justify-between text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" onClick={() => setDiffOpen(!diffOpen)}>{t('Confronto con la settimana precedente')} · {changes.length}<ChevronDown className={`h-4 w-4 ${diffOpen ? 'rotate-180' : ''}`}/></Button>{diffOpen && <div className="p-3 text-xs">{changes.length === 0 ? t('Nessuna modifica rispetto alla settimana precedente') : changes.map(r => { const prev = p.previous.find(x => x.creator_id === r.creator_id); const names = (row: AllocationRow | undefined) => row?.paused ? t('In pausa') : row ? [...new Set(effectiveSlots(row, residual, p.auto).map(id => available.find(c => c.id === id)?.name ?? t('Libero')))].join(', ') : '—'; return <p key={r.creator_id} className="border-b py-2"><strong>{p.creators.find(c => c.id === r.creator_id)?.name}</strong> · {names(prev)} → {names(r)}</p>; })}</div>}</section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
