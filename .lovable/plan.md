
# Piano — Punto 2 (Realtime) + Punto 3 (Alert estesi)

## Premessa: "Albert" = Alert, low profile

Centro alert visibile **solo** a `admin`, `team`, `campaign_manager`. UI minimale: una piccola campanella nella topbar con badge contatore non-letti, popover con lista compatta, niente toast invasivi né banner full-width. Stile coerente con dark theme luxury.

---

## Parte 2 — Real-time & freschezza dati

### Frontend
- Nuovo hook `src/hooks/useRealtimeInvalidation.ts` montato in `DashboardLayout`. Sottoscrive Supabase Realtime su:
  - `videos` (INSERT/UPDATE) → invalida query `["campaign-manager"]`, `["videos"]`, `["dashboard"]`
  - `scraping_logs` (INSERT) → invalida `["scraping-logs"]` + aggiorna badge globale
  - `notifications` (INSERT WHERE `user_id = auth.uid()`) → invalida `["notifications"]`
- Throttle a 5s per evitare invalidazioni a raffica durante scraping.
- Nuovo componente `src/components/topbar/LastUpdateBadge.tsx`: mostra "Aggiornato Xm fa" (relativo, italiano) con tooltip data esatta. Si basa sul `MAX(run_at)` di `scraping_logs` con stato `success`. Visibile solo a admin/team/campaign_manager.

### Backend
- Abilitare publication realtime su `videos`, `scraping_logs`, `notifications` (migration `ALTER PUBLICATION supabase_realtime ADD TABLE ...`).
- `videos` ha già REPLICA IDENTITY DEFAULT — sufficiente per gli eventi che usiamo.

---

## Parte 3 — Alert estesi (low profile)

### Schema DB
- Estendere il `type` di `notifications` con nuovi valori (text libero già, basta convenzione):
  - `inactive_creator` — creator senza video pubblicati da ≥ N giorni
  - `viral_video` — video con views > soglia in 24h
  - `expiring_contract` — contratto scade tra 7 giorni
  - `cycle_to_close` — payment_cycle con `cycle_end_date` ≤ oggi senza payments
- Aggiungere colonne opzionali a `notifications`:
  - `severity text` (`info` | `warning` | `critical`)
  - `link text` (deep link in app, es. `/dashboard/creators/:id`)
  - `meta jsonb` (payload per UI: views, names, ecc.)

### Funzione di generazione alert
- Nuova edge function `generate-alerts` (chiamata da pg_cron ogni ora) che:
  1. Trova creator attivi senza video negli ultimi 5 giorni → notifica admin+team+campaign_manager.
  2. Trova video pubblicati nelle ultime 24h con views > 50.000 → notifica campaign_manager+admin.
  3. Trova contratti `is_active=true` con campagne in scadenza tra 7gg → notifica admin+team.
  4. Trova `payment_cycles` con `cycle_end_date ≤ CURRENT_DATE` senza client_payments associati → notifica admin+team.
  - Dedup: prima di insert verifica che non esista già notifica stesso `type` + stessa risorsa nelle ultime 24h (chiave logica via `meta->>'ref'`).
  - Distribuzione: una riga per ogni user destinatario, filtrata per ruolo.
- Schedulazione via `pg_cron` ogni ora (vault secret + cron job creato con SQL diretto, non migration).

### UI Notifiche
- `src/components/notifications/NotificationBell.tsx` — campanella in topbar (visibile solo per i 3 ruoli). Badge piccolo con count non-letti. Click → popover compatto.
- `src/components/notifications/NotificationList.tsx` — lista compatta: icona per `severity`, testo `message` su una riga, "Xm fa", click → `link` + mark as read.
- "Segna tutte come lette" in fondo.
- `src/hooks/useNotifications.ts` — fetch + realtime + `markAsRead`.
- Niente toast popup automatici per non essere invasivi (eccezione: `severity='critical'` mostra un solo toast minimale).

---

## File toccati

```text
supabase/migrations/<ts>_alerts_and_realtime.sql       (nuovo: realtime pub, colonne notifications)
supabase/functions/generate-alerts/index.ts            (nuovo)
src/hooks/useRealtimeInvalidation.ts                   (nuovo)
src/hooks/useNotifications.ts                          (nuovo)
src/components/topbar/LastUpdateBadge.tsx              (nuovo)
src/components/notifications/NotificationBell.tsx      (nuovo)
src/components/notifications/NotificationList.tsx      (nuovo)
src/components/DashboardLayout.tsx                     (monta bell + badge + hook realtime)
```

Più una SQL eseguita con `psql`/insert per creare il cron `generate-alerts` (non in migration perché contiene service role key).

## Cosa NON cambia
- RLS esistente di `notifications` (già scoped a user_id)
- Logica esistente spend-cap notifications: continua a funzionare e appare nello stesso bell.
- Nessuna modifica a Campaign Manager / scraping (già fatti).
