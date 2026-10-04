import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { activeDays, campTotals, effectiveSlots, paint, type AllocationCampaign, type AllocationRow } from '@/lib/allocation';
import type { Group, Premium } from '@/hooks/useAllocation';

const paintColor = ['bg-info','bg-warning','bg-success','bg-primary','bg-accent'];
const borderColor = ['border-info','border-warning','border-success','border-primary','border-accent'];
export const allocationColor = (index: number) => paintColor[index % paintColor.length];
const tally = (n: number) => new Intl.NumberFormat('it-IT').format(n);

type Props = {
  week: string; campaigns: AllocationCampaign[]; creators: Premium[]; rows: AllocationRow[]; previous: AllocationRow[];
  accounts: Set<string>; groups: Group[]; auto: boolean; writable: boolean; busy: boolean;
  onRows: (next: AllocationRow[]) => void; onAuto: (value: boolean) => void;
  onTier: (id: string, tier: string | null) => Promise<void>;
  onCreateGroup: (name: string, ids: string[]) => Promise<void>;
  onUpdateGroup: (id: string, patch: { name?: string; creator_ids?: string[] }) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
};

export function AllocationBoard(p: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);
  const [error, setError] = useState('');
  const available = p.campaigns.filter(c => activeDays(c,p.week)>0);
  const residual = available.find(c => c.is_residual)?.id ?? null;
  const activeCampaign = available.find(c => c.id === active);
  const chosen = activeCampaign && (!activeCampaign.is_residual || !p.auto) ? activeCampaign.id : null;
  const total = p.rows.filter(r => !r.paused).reduce((n,r) => n + r.slots.length,0);
  const totals = available.map(c => campTotals(p.rows,c,p.week,residual,p.auto));
  const idle = p.rows.reduce((n,r) => n + effectiveSlots(r,residual,p.auto).filter(s => !s).length,0);
  const risk = available.find(c => c.priority === 1 && !c.is_residual && activeDays(c,p.week)>0 && (campTotals(p.rows,c,p.week,residual,p.auto).videos < (campTotals(p.rows,c,p.week,residual,p.auto).target ?? 0)));
  const inverted = p.rows.filter(r => !r.paused && (p.creators.find(c=>c.id===r.creator_id)?.tier === 'A') && !effectiveSlots(r,residual,p.auto).includes(available.find(c=>c.priority===1)?.id ?? '')).length;
  const changes = p.rows.filter(r => {
    const prev = p.previous.find(x => x.creator_id === r.creator_id);
    return prev && (prev.paused !== r.paused || JSON.stringify(prev.slots) !== JSON.stringify(r.slots));
  });
  const doAction = async (action: () => Promise<void>) => {
    setError(''); setGroupBusy(true);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : t('Operazione non riuscita')); }
    finally { setGroupBusy(false); }
  };
  const segment = (id: string | null) => {
    if (!id) return 'bg-destructive/40';
    const idx = available.findIndex(c => c.id === id);
    return idx < 0 ? 'bg-muted' : allocationColor(idx);
  };
  const counts = useMemo(() => {
    const map = new Map<string,number>();
    p.rows.forEach(r => effectiveSlots(r,residual,p.auto).forEach(id => map.set(id ?? 'idle',(map.get(id ?? 'idle') ?? 0)+1)));
    return map;
  },[p.rows,residual,p.auto]);
  const select = (ids: string[]) => setSelected(ids);
  const apply = (creatorId: string, index: number) => {
    if (!chosen || !p.writable || p.busy) return;
    const targets = selected.length ? selected : [creatorId];
    p.onRows(p.rows.map(r => targets.includes(r.creator_id) && !r.paused && index < r.slots.length ? { ...r, slots: paint(r.slots,index,chosen) } : r));
  };
  const groupList = p.groups.map(g => (
    <Button key={g.id} size="sm" variant="outline" onClick={() => select(g.creator_ids.filter(id => p.creators.some(c => c.id === id)))}>{g.name}</Button>
  ));

  return <div className="space-y-4">
    {(risk || inverted>0) && <div className="flex flex-wrap gap-x-5 gap-y-1 border-l-2 border-warning pl-3 text-xs text-warning"><AlertTriangle className="h-4 w-4"/>{risk && <span>{risk.name}: {t('obiettivo settimanale a rischio')}</span>}{inverted>0 && <span>{inverted} {t('creator tier A non assegnati alla priorità principale')}</span>}</div>}
    <section className="space-y-2" aria-label={t('Distribuzione capacità')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><div><strong className="text-xl">{tally(total)}</strong> {t('slot al giorno')} <span className="text-muted-foreground">· {tally(available.reduce((n,c,i) => n + totals[i].videos,0))} {t('video nella settimana')}</span></div><span className={idle ? 'text-destructive font-semibold' : 'text-muted-foreground'}>{idle ? `${tally(idle)} ${t('slot fermi')}` : t('Nessuno slot fermo')}</span></div>
      <div className="flex h-8 w-full overflow-hidden rounded-sm bg-muted" role="img" aria-label={t('Distribuzione capacità')}>
        {available.map((c,i) => <div key={c.id} title={`${c.name}: ${counts.get(c.id) ?? 0}`} className={`${allocationColor(i)} flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-xs font-bold text-primary-foreground transition-[width] duration-200`} style={{ width: total ? `${100*(counts.get(c.id) ?? 0)/total}%` : '0%' }}>{(counts.get(c.id) ?? 0)>6 ? c.name : ''}</div>)}
        {idle > 0 && <div className="h-full bg-destructive/50" title={`${idle} ${t('slot fermi')}`} style={{ width: total ? `${100*idle/total}%` : '0%' }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{available.map((c,i) => <span key={c.id} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${allocationColor(i)}`} />{c.name} {tally(counts.get(c.id) ?? 0)}</span>)}</div>
    </section>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label={t('Campagne della settimana')}>
      {available.map((c,i) => {
        const data = totals[i]; const status = data.target === null ? t('Residuo') : data.videos === 0 ? t('Vuota') : data.videos < data.target*0.98 ? t('Sotto target') : data.videos > data.target*1.08 ? t('Sopra target') : t('In linea');
        const blocked = c.is_residual && p.auto;
        return <Button key={c.id} variant="outline" disabled={blocked || !p.writable} onClick={() => setActive(c.id)} className={`h-auto min-h-28 w-full flex-col items-stretch gap-1 whitespace-normal border-t-4 p-3 text-left disabled:opacity-75 ${borderColor[i%borderColor.length]} ${active===c.id ? 'ring-2 ring-ring' : ''}`}>
          <span className="flex items-center justify-between gap-2 text-sm font-bold">{c.name} <span className="text-xs font-normal text-muted-foreground">{data.days} {t('giorni')}</span></span>
          <span className="truncate text-xs text-muted-foreground">{c.client_name}</span>
          <span className="text-lg font-bold tabular-nums">{tally(data.videos)} {data.target !== null && <span className="text-sm font-normal text-muted-foreground">/ {tally(data.target)}</span>}</span>
          <span className="relative h-1.5 w-full bg-muted"><span className={`absolute inset-y-0 left-0 ${allocationColor(i)}`} style={{ width: `${data.target ? Math.min(100,100*data.videos/data.target) : 100}%` }}/></span>
          <span className={`text-xs ${status===t('Vuota') || status===t('Sotto target') ? 'text-destructive' : 'text-muted-foreground'}`}>{status} · {data.accounts} {t('account richiesti')}</span>
        </Button>;
      })}
    </section>

    <section className="space-y-2 border-y border-border py-3" aria-label={t('Selezione creator')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">{selected.length} {t('selezionati')}</span>
        {[{label:t('Tutti'),ids:p.creators.filter(c=>!p.rows.find(r=>r.creator_id===c.id)?.paused).map(c=>c.id)},...(['A','B','C'] as const).map(tier=>({label:tier,ids:p.creators.filter(c=>c.tier===tier).map(c=>c.id)})),{label:t('Con slot liberi'),ids:p.rows.filter(r=>!r.paused && r.slots.some(s=>!s)).map(r=>r.creator_id)},{label:t('Nessuno'),ids:[]}].map(item => <Button size="sm" variant="outline" key={item.label} onClick={() => select(item.ids)}>{item.label}</Button>)}
        <span className="h-5 border-l border-border mx-1"/>{groupList}
        <div className="ml-auto flex items-center gap-2"><Switch checked={p.auto} onCheckedChange={p.onAuto} disabled={!p.writable || p.busy || !residual} aria-label={t('Residuo automatico')} /><span className="text-xs">{t('Residuo automatico')}</span></div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label={t('Creator premium')}>
      {p.creators.map(c => {
        const row = p.rows.find(r=>r.creator_id===c.id); if (!row) return null;
        const slots = effectiveSlots(row,residual,p.auto);
        const unique = [...new Set(slots.filter((s): s is string => Boolean(s)))];
        const missing = unique.filter(id => !p.accounts.has(`${c.id}:${id}`));
        const picked = selected.includes(c.id);
        return <div key={c.id} className={`min-w-0 rounded-md border bg-card p-2.5 ${picked ? 'border-primary ring-1 ring-primary' : 'border-border'} ${row.paused ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-1">
            <Button title={t('Cambia tier')} aria-label={`${t('Cambia tier')} ${c.name}`} variant="outline" size="sm" disabled={!p.writable || groupBusy} className="h-6 w-6 shrink-0 p-0 text-xs" onClick={() => doAction(() => p.onTier(c.id,c.tier==='A'?'B':c.tier==='B'?'C':'A'))}>{c.tier ?? '·'}</Button>
            <Button variant="ghost" className="h-7 min-w-0 flex-1 justify-start truncate px-1 text-xs" title={c.name} onClick={() => setSelected(picked?selected.filter(id=>id!==c.id):[...selected,c.id])}>{c.name}</Button>
            <Button variant="ghost" size="icon" title={row.paused?t('Riattiva'):t('Metti in pausa')} aria-label={`${row.paused?t('Riattiva'):t('Metti in pausa')} ${c.name}`} disabled={!p.writable || p.busy} className="h-7 w-7 shrink-0" onClick={() => p.onRows(p.rows.map(r=>r.creator_id===c.id?{...r,paused:!r.paused}:r))}>{row.paused?<Play/>:<Pause/>}</Button>
          </div>
          <div className="mt-2 flex gap-1">{row.slots.map((id,index) => <Button key={index} title={`${c.name} · ${t('slot')} ${index+1}: ${available.find(x=>x.id===slots[index])?.name ?? t('Libero')}`} aria-label={`${c.name} ${t('slot')} ${index+1}`} variant="ghost" disabled={row.paused || !chosen || !p.writable || p.busy} onClick={() => apply(c.id,index)} className={`h-6 min-w-0 flex-1 rounded-sm p-0 disabled:opacity-60 ${slots[index] ? segment(slots[index]) : 'bg-muted border border-destructive/40'}`}/>)}</div>
          <div className="mt-2 flex justify-between gap-1 text-xs text-muted-foreground"><span>{row.paused?t('In pausa'):`${unique.length} ${t('account')}`}</span>{!row.paused && missing.length>0 && <span className="flex items-center gap-0.5 text-destructive" title={missing.map(id=>available.find(c=>c.id===id)?.name).join(', ')}><AlertTriangle className="h-3 w-3"/>{missing.length} {t('mancanti')}</span>}</div>
        </div>;
      })}
    </section>

    <div className="space-y-2">
      <div className="rounded-md border bg-card"><Button variant="ghost" className="w-full justify-between" onClick={() => setGroupsOpen(!groupsOpen)}>{t('Gruppi')} <ChevronDown className={groupsOpen?'rotate-180':''}/></Button>{groupsOpen && <div className="space-y-3 border-t p-3">
        {p.writable && <div className="flex flex-wrap gap-2"><Input className="max-w-56" value={groupName} placeholder={t('Nome gruppo')} onChange={e=>setGroupName(e.target.value)}/><Button disabled={!groupName.trim() || groupBusy} onClick={() => doAction(async()=>{await p.onCreateGroup(groupName.trim(),selected);setGroupName('');})}><Plus/> {t('Crea gruppo')}</Button></div>}
        {p.groups.length===0 && <p className="text-xs text-muted-foreground">{t('Nessun gruppo')}</p>}
        {p.groups.map(g => <div key={g.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs"><strong>{g.name}</strong><span className="text-muted-foreground">{g.creator_ids.length} {t('creator')}</span>{p.writable && <><Button variant="outline" size="sm" onClick={() => { const name=window.prompt(t('Rinomina gruppo'),g.name)?.trim(); if(name && name!==g.name) doAction(()=>p.onUpdateGroup(g.id,{name})); }}>{t('Rinomina')}</Button><Button variant="outline" size="sm" disabled={!selected.length} onClick={()=>doAction(()=>p.onUpdateGroup(g.id,{creator_ids:[...new Set([...g.creator_ids,...selected])]}))}>{t('Aggiungi selezionati')}</Button><Button variant="outline" size="sm" disabled={!selected.length} onClick={()=>doAction(()=>p.onUpdateGroup(g.id,{creator_ids:g.creator_ids.filter(id=>!selected.includes(id))}))}>{t('Rimuovi selezionati')}</Button><Button variant="ghost" size="icon" title={t('Elimina gruppo')} onClick={()=>{if(window.confirm(t('Eliminare il gruppo?'))) doAction(()=>p.onDeleteGroup(g.id));}}><Trash2/></Button></>}
          <div className="basis-full flex flex-wrap gap-1">{g.creator_ids.map(id=><span key={id} className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5">{p.creators.find(c=>c.id===id)?.name ?? id}{p.writable && <Button variant="ghost" size="icon" className="h-4 w-4" title={t('Rimuovi membro')} onClick={()=>doAction(()=>p.onUpdateGroup(g.id,{creator_ids:g.creator_ids.filter(x=>x!==id)}))}>×</Button>}</span>)}</div></div>)}
      </div>}</div>
      <div className="rounded-md border bg-card"><Button variant="ghost" className="w-full justify-between" onClick={() => setDiffOpen(!diffOpen)}>{t('Confronto con la settimana precedente')} · {changes.length} <ChevronDown className={diffOpen?'rotate-180':''}/></Button>{diffOpen && <div className="border-t p-3 text-xs">{changes.length===0 ? t('Nessuna modifica rispetto alla settimana precedente') : changes.map(r=> { const prev=p.previous.find(x=>x.creator_id===r.creator_id); const names=(row:AllocationRow | undefined)=>row?.paused?t('In pausa'):row ? [...new Set(effectiveSlots(row,residual,p.auto).map(id=>available.find(c=>c.id===id)?.name ?? t('Libero')))].join(', ') : '—'; return <p key={r.creator_id} className="border-b py-2"><strong>{p.creators.find(c=>c.id===r.creator_id)?.name}</strong> · {names(prev)} → {names(r)}</p>; })}</div>}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  </div>;
}