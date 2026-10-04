import { useState } from 'react';
import { Eraser, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CompanyLogo } from '@/components/companies/CompanyLogo';
import { useI18n } from '@/i18n';
import { activeDays, type AllocationCampaign, type AllocationRow, type Slot } from '@/lib/allocation';
import type { Group, Premium } from '@/hooks/useAllocation';

type Props = {
  week: string; groups: Group[]; creators: Premium[]; rows: AllocationRow[]; campaigns: AllocationCampaign[];
  colors: string[]; sectionOf: (c: Premium) => string; writable: boolean; busy: boolean; picked: string | null;
  onRows: (rows: AllocationRow[]) => void;
  onCreate: (name: string, ids: string[]) => Promise<void>;
  onUpdate: (id: string, patch: { name?: string; creator_ids?: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const btn = 'border-allocation-mist bg-surface text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink';

export function AllocationGroups(p: Props) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const available = p.campaigns.filter(c => activeDays(c, p.week) > 0);
  const color = (id: string | null) => { const i = available.findIndex(c => c.id === id); return i < 0 ? '' : p.colors[i % p.colors.length]; };
  const sections = ['Premium', 'VE', 'Senza contratto'].map(s => ({ s, list: p.creators.filter(c => p.sectionOf(c) === s) })).filter(x => x.list.length);

  const open = (g: Group | 'new') => {
    setEditing(g); setError('');
    setName(g === 'new' ? '' : g.name);
    setMembers(g === 'new' ? [] : g.creator_ids);
  };
  const submit = async () => {
    setSaving(true); setError('');
    try {
      if (editing === 'new') await p.onCreate(name.trim(), members);
      else if (editing) await p.onUpdate(editing.id, { name: name.trim(), creator_ids: members });
      setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : t('Operazione non riuscita')); }
    finally { setSaving(false); }
  };
  const toggle = (ids: string[], on: boolean) => setMembers(prev => on ? [...new Set([...prev, ...ids])] : prev.filter(id => !ids.includes(id)));

  // Fills from the end of the previous campaign's block up to `index`, keeping earlier campaigns intact.
  const fillRun = (slots: Slot[], index: number, picked: string, clear: boolean): Slot[] => {
    const next = [...slots];
    let start = index;
    while (start > 0 && (next[start - 1] === null || next[start - 1] === picked)) start--;
    if (clear) { for (let i = start; i <= index; i++) if (next[i] === picked) next[i] = null; return next; }
    for (let i = start; i <= index; i++) next[i] = picked;
    for (let i = index + 1; i < next.length && next[i] === picked; i++) next[i] = null;
    return next;
  };
  const assign = (ids: string[], index: number, picked: string, clear: boolean) => {
    if (!p.writable || p.busy) return;
    p.onRows(p.rows.map(r => ids.includes(r.creator_id) && !r.paused && index < r.slots.length ? { ...r, slots: fillRun(r.slots, index, picked, clear) } : r));
  };
  const clear = (ids: string[]) => { if (p.writable && !p.busy) p.onRows(p.rows.map(r => ids.includes(r.creator_id) && !r.paused ? { ...r, slots: r.slots.map(() => null) } : r)); };

  return <section className="border-t border-allocation-mist pt-5" aria-label={t('Gruppi')}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">{t('Gruppi')}</h2><p className="text-xs text-allocation-ink/75">{t('Scegli una campagna e clicca gli slot: la divisione vale per tutto il gruppo.')}</p></div>
      {p.writable && <Button className="h-9 bg-allocation-ink text-allocation-paper hover:!bg-allocation-ink/85 hover:!text-allocation-paper" onClick={() => open('new')}><Plus className="mr-1 h-4 w-4"/>{t('Nuovo gruppo')}</Button>}
    </div>
    {p.groups.length === 0 && <button type="button" disabled={!p.writable} onClick={() => open('new')} className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-allocation-mist bg-surface p-6 text-sm text-allocation-ink/75 hover:bg-allocation-paper"><Users className="h-5 w-5"/>{t('Nessun gruppo')} · {t('Crea il primo gruppo')}</button>}
    <div className="grid gap-3 lg:grid-cols-2">{p.groups.map(g => {
      const ids = g.creator_ids.filter(id => p.creators.some(c => c.id === id));
      const live = p.rows.filter(r => ids.includes(r.creator_id) && !r.paused);
      const width = Math.max(0, ...live.map(r => r.slots.length));
      const picked = p.picked;
      const videos = new Map<string, number>();
      live.forEach(r => r.slots.forEach(s => { if (s) videos.set(s, (videos.get(s) ?? 0) + 1); }));
      return <div key={g.id} className="space-y-3 rounded-md border border-allocation-mist bg-surface p-3 text-xs">
        <div className="flex items-center gap-2">
          <strong className="mr-auto truncate text-sm">{g.name}</strong>
          <span className="text-allocation-ink/75">{ids.length} {t('creator')}</span>
          {p.writable && <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-allocation-ink hover:!bg-allocation-mist" title={t('Modifica gruppo')} onClick={() => open(g)}><Pencil className="h-3.5 w-3.5"/></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-allocation-ink hover:!bg-allocation-mist" title={t('Svuota gruppo')} disabled={p.busy} onClick={() => clear(ids)}><Eraser className="h-3.5 w-3.5"/></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-allocation-ink hover:!bg-allocation-mist" title={t('Elimina gruppo')} onClick={() => { if (window.confirm(t('Eliminare il gruppo?'))) p.onDelete(g.id).catch(e => setError(e.message)); }}><Trash2 className="h-3.5 w-3.5"/></Button>
          </>}
        </div>
        <p className="truncate text-allocation-ink/75">{ids.map(id => p.creators.find(c => c.id === id)?.name).join(', ') || '—'}</p>
        {p.writable && width > 0 && <>
          <div className="flex gap-1">{Array.from({ length: width }, (_, i) => {
            const values = new Set(live.filter(r => i < r.slots.length).map(r => r.slots[i]));
            const same = values.size === 1 ? [...values][0] : undefined;
            return <button key={i} type="button" disabled={!picked || p.busy} title={same === undefined ? t('Misto') : same ? available.find(c => c.id === same)?.name : t('Libero')}
              onClick={() => { if (!picked) return; const filled = live.length > 0 && live.every(r => i < r.slots.length && r.slots[i] === picked && r.slots[i + 1] !== picked); assign(ids, i, picked, filled); }}
              className={`h-8 flex-1 rounded-sm border border-allocation-mist text-[10px] font-semibold disabled:cursor-not-allowed ${same ? `${color(same)} text-allocation-paper` : same === null ? 'bg-allocation-paper text-allocation-ink/60' : 'bg-[repeating-linear-gradient(45deg,hsl(var(--allocation-mist))_0_4px,transparent_4px_8px)] text-allocation-ink'}`}>{i + 1}</button>;
          })}</div>
          {!picked && <p className="text-allocation-ink/60">{t('Seleziona prima una campagna')}</p>}
          <div className="flex flex-wrap gap-3 text-allocation-ink/75">{available.filter(c => videos.get(c.id)).map(c => <span key={c.id}><span className={`mr-1 inline-block h-2 w-2 rounded-sm ${color(c.id)}`}/>{c.name}: {videos.get(c.id)} {t('slot al giorno')}</span>)}</div>
        </>}
      </div>;
    })}</div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}

    <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent className="allocation-workspace max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing === 'new' ? t('Nuovo gruppo') : t('Modifica gruppo')}</DialogTitle></DialogHeader>
        <Input autoFocus value={name} placeholder={t('Nome gruppo')} onChange={e => setName(e.target.value)}/>
        <div className="space-y-3">{sections.map(({ s, list }) => {
          const all = list.every(c => members.includes(c.id));
          return <div key={s}>
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold"><Checkbox checked={all} onCheckedChange={v => toggle(list.map(c => c.id), v === true)}/>{t(s)} · {t('Seleziona tutti')}</label>
            <div className="grid grid-cols-2 gap-1 pl-5">{list.map(c => <label key={c.id} className="flex items-center gap-2 text-sm"><Checkbox checked={members.includes(c.id)} onCheckedChange={v => toggle([c.id], v === true)}/><span className="truncate">{c.name}</span></label>)}</div>
          </div>;
        })}</div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter><span className="mr-auto text-xs text-muted-foreground">{members.length} {t('selezionati')}</span><Button disabled={!name.trim() || !members.length || saving} onClick={submit}>{editing === 'new' ? t('Crea gruppo') : t('Salva')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
