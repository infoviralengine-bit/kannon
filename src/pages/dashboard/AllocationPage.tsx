import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAllocationActions, useAllocationBase, useAllocationWeek } from '@/hooks/useAllocation';
import { AllocationBoard } from '@/components/allocation/AllocationBoard';
import { monday, shiftWeek, type AllocationRow } from '@/lib/allocation';
import { ROLES } from '@/lib/roles';

function dateLabel(week: string) {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start.getTime() + 5*86400000);
  const fmt = new Intl.DateTimeFormat('it-IT',{ day:'numeric',month:'short',timeZone:'UTC' });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export default function AllocationPage() {
  useEffect(() => {
    const id = 'allocation-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, []);
  const { t } = useI18n();
  const { toast } = useToast();
  const { role } = useAuth();
  const writable = role === ROLES.ADMIN || role === ROLES.TEAM;
  const [week, setWeek] = useState(() => monday(new Date()));
  const base = useAllocationBase();
  const creators = base.data?.creators ?? [];
  const configured = creators.filter(c => c.daily_slots > 0 && c.status === 'active');
  const campaigns = base.data?.campaigns ?? [];
  const query = useAllocationWeek(week,configured,campaigns,writable);
  const actions = useAllocationActions();
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ rows, auto, version: 0, week });
  useEffect(() => {
    if (!query.data) return;
    setRows(query.data.rows);
    setAuto(query.data.week.residual_auto);
    latest.current = { rows: query.data.rows, auto: query.data.week.residual_auto, version: query.data.week.version, week };
  },[query.data,week]);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); },[week]);

  const queueSave = () => {
    const snapshot = { ...latest.current };
    setBusy(true);
    const job = writeChain.current.catch(() => undefined).then(async () => {
      try {
        const newVersion = await actions.save({ week_start: snapshot.week, version: latest.current.version, residual_auto: snapshot.auto }, snapshot.rows, snapshot.auto);
        latest.current.version = newVersion;
        setError('');
      } catch (e) {
        const text = e instanceof Error ? e.message : t('Salvataggio non riuscito');
        setError(text);
        toast({ title: t('Salvataggio non riuscito'), description: text, variant: 'destructive' });
        await query.refetch();
        throw e;
      } finally { setBusy(false); }
    });
    writeChain.current = job;
    return job;
  };
  const persist = (nextRows: AllocationRow[], nextAuto: boolean) => {
    if (!writable || navigating) return;
    latest.current = { ...latest.current, rows: nextRows, auto: nextAuto };
    setRows(nextRows); setAuto(nextAuto); setError('');
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { pending.current = null; void queueSave().catch(() => undefined); }, 250);
  };
  const go = async (target: string) => {
    if (target === week || navigating) return;
    setNavigating(true);
    try {
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
        await queueSave();
      } else {
        await writeChain.current;
      }
      setWeek(target);
    } catch {
      // Stay on this week so the unsaved plan can be reviewed or retried.
    } finally { setNavigating(false); }
  };
  const weeks = Array.from({ length: 8 }, (_,i) => shiftWeek(monday(new Date()),i));

  if (!writable && role !== ROLES.CAMPAIGN_MANAGER) return <p className="p-6 text-destructive">{t('Accesso non consentito')}</p>;
  return <div className="allocation-workspace mx-auto w-full max-w-[1500px] min-h-screen space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Allocation</h1><p className="text-xs text-allocation-ink/60">{t('Settimana')} {dateLabel(week)} · {new Date(`${week}T00:00:00Z`).getUTCFullYear()}</p></div>
      <div className="flex flex-wrap items-center gap-1"><Button variant="outline" size="icon" className="border-allocation-mist bg-surface text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" title={t('Settimana precedente')} onClick={()=>go(shiftWeek(week,-1))}><ChevronLeft/></Button>{weeks.map(w=><Button key={w} variant="outline" size="sm" className={w===week?'border-allocation-ink bg-allocation-ink text-allocation-paper hover:!bg-allocation-ink/85 hover:!text-allocation-paper':'border-allocation-mist bg-surface text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink'} onClick={()=>go(w)}>{new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${w}T00:00:00Z`))}</Button>)}<Button variant="outline" size="icon" className="border-allocation-mist bg-surface text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" title={t('Settimana successiva')} onClick={()=>go(shiftWeek(week,1))}><ChevronRight/></Button><Button variant="ghost" size="icon" className="text-allocation-ink hover:!bg-allocation-mist hover:!text-allocation-ink" title={t('Ricarica')} onClick={()=>query.refetch()}><RotateCcw/></Button></div>
    </header>
    {(base.isLoading || query.isLoading) && <p className="text-sm text-muted-foreground">{t('Caricamento...')}</p>}
    {(base.error || query.error) && <p role="alert" className="text-sm text-destructive">{(base.error ?? query.error)?.message}</p>}
    {!base.isLoading && !creators.length && <p className="text-sm text-muted-foreground">{t('Nessun creator disponibile')}</p>}
    {query.data && <AllocationBoard key={week} week={week} campaigns={campaigns} creators={creators} rows={rows} previous={query.data.previous} accounts={base.data?.accounts ?? new Set()} groups={base.data?.groups ?? []} auto={auto} writable={writable} busy={busy || navigating} onRows={next=>persist(next,auto)} onAuto={next=>persist(rows,next)} onTier={actions.tier} onTarget={actions.target} onConfigure={actions.configure} onCreateGroup={actions.createGroup} onUpdateGroup={actions.updateGroup} onDeleteGroup={actions.deleteGroup}/>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {busy && <span className="text-xs text-muted-foreground">{t('Salvataggio in corso...')}</span>}
  </div>;
}