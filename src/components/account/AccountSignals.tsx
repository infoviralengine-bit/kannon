import { useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useAccountSignals } from '@/hooks/useAccountSignals';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import { formatViews } from '@/lib/format';
const severity = ['', 'text-signal-light border-signal-light', 'text-signal-medium border-signal-medium', 'text-signal-high border-signal-high'];
export function AccountSignals({ accountId, creatorId, username }: { accountId?: string; creatorId?: string; username?: string }) {
 const { t } = useI18n();
 const [open, setOpen] = useState(false);
 const [tier, setTier] = useState(0);
 const query = useAccountSignals();
 const scoped = Boolean(accountId || creatorId || username);
 const signals = (query.data ?? []).filter(s => (!accountId || s.account_id === accountId) && (!creatorId || s.creator_id === creatorId) && (!username || s.username.replace(/^@+/, '') === username.replace(/^@+/, '')));
 const highest = Math.max(0, ...signals.map(s => s.tier));
 if (scoped && !signals.length) return null;
 const filtered = signals.filter(s => !tier || s.tier === tier);
 return <Dialog open={open} onOpenChange={setOpen}>
  <Button variant="outline" size="sm" className={`shrink-0 gap-1.5 ${severity[highest] ?? ''}`} title={t('Account segnalati')} aria-label={t('Account segnalati')} onClick={() => setOpen(true)}>
   <AlertTriangle className="h-4 w-4" />{scoped ? <span>{highest}</span> : <><span className="hidden sm:inline">{t('Account segnalati')}</span><span>{query.isError ? '?' : query.isLoading ? '…' : formatViews(signals.length)}</span></>}
  </Button>
  <DialogContent aria-describedby={undefined} className="max-h-[85vh] max-w-2xl overflow-y-auto">
   <DialogHeader><DialogTitle>{t('Account segnalati')}</DialogTitle></DialogHeader>
   <div className="flex flex-wrap gap-2">{[0,1,2,3].map(n => <Button key={n} size="sm" variant={tier === n ? 'secondary' : 'outline'} onClick={() => setTier(n)}>{n === 0 ? t('Tutti') : t('Livello {n}', { n })}</Button>)}<Button size="icon" variant="ghost" aria-label={t('Ricarica')} onClick={() => query.refetch()}><RefreshCw className="h-4 w-4"/></Button></div>
   {query.isLoading && <p>{t('Caricamento...')}</p>}
   {query.isError && <p role="alert" className="text-destructive">{t('Segnali non disponibili')}</p>}
   {!query.isLoading && !query.isError && !filtered.length && <p className="text-muted-foreground">{t('Nessun account segnalato')}</p>}
   {filtered.map(s => <section key={s.account_id} className="border-b border-border pb-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">@{s.username.replace(/^@+/, '')}</h3><span className={severity[s.tier]}>{t('Livello {n}', { n: s.tier })} · {formatViews(s.low_count)} {t('video sotto 50 views')}</span></div>
    {s.campaign_name && <p className="text-sm text-muted-foreground">{s.campaign_name}</p>}
    <div className="mt-2 divide-y divide-border">{s.videos.map(v => <a key={v.id} href={`https://www.tiktok.com/@${encodeURIComponent(s.username.replace(/^@+/, ''))}/video/${encodeURIComponent(v.tiktok_video_id)}`} target="_blank" rel="noopener" className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"><span>{new Date(v.published_at).toLocaleDateString('it-IT', { timeZone: 'UTC' })}</span><span className="flex items-center gap-2">{formatViews(v.views)} views <ExternalLink className="h-3 w-3"/></span></a>)}</div>
   </section>)}
  </DialogContent>
 </Dialog>;
}
