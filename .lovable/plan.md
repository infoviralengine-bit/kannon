
# Piano

## 1. RPC Campaign Manager (sposta aggregazioni su DB)

**Nuova migration** — funzione `get_campaign_manager_data(p_period text)` SECURITY DEFINER che ritorna un singolo `jsonb` con: KPI (views/creator/content/CPM correnti e periodo precedente), campagne aggregate, daily views per campagna, lista video del periodo arricchita (username, creator, campaign, engagement, quality, viral velocity), allVideos compatti, creator ranking semplice e dettagliato, format stats per `content_tag`/durata, top 10 viral videos. Authorization check: `has_role(auth.uid(), 'admin'|'team'|'campaign_manager')`.

Indici aggiunti se mancanti:
- `videos(published_at desc)`
- `videos(tiktok_account_id, published_at desc)`

**Riscrittura `src/hooks/useCampaignManagerData.ts`** — sostituire le 4 query + paginazione + 200 righe di aggregazione JS con una sola `supabase.rpc('get_campaign_manager_data', { p_period: period })`. Tipi esposti (`CampaignManagerData`, `VideoItem`, ecc.) rimangono identici → nessuna pagina consumer va toccata.

Risultato: pagina Campaign Manager passa da ~3-5s di caricamento a <500ms, traffico ridotto del 95%+.

## 2. Fix `scrape-tiktok` — aggiornamento completo in un solo run

Due cause individuate nel codice attuale:

**A. Apify dataset fetch non paginato** (`/datasets/{id}/items?format=json` senza `limit`/`offset`). Per dataset grandi la risposta viene troncata → mancano video → devi rilanciare.
→ Loop `while` con `limit=1000&offset=N` finché la pagina è < limit.

**B. DB sequenziale per item**: oggi per ogni video = 1 SELECT + 1 INSERT/UPDATE in serie. Con 1000+ video sono migliaia di round-trip che esauriscono il tempo di esecuzione.
→ Refactor in 3 fasi bulk:
1. Una sola SELECT `videos WHERE tiktok_video_id IN (...)` (chunk da 500) per costruire la mappa "esistenti".
2. INSERT in batch da 200 per i nuovi.
3. UPDATE paralleli a chunk di 50 con `Promise.all` per gli esistenti (con la stessa logica di chiusura window CPM di oggi).
4. UPDATE singolo di `tiktok_accounts.last_scraped_at` con `.in('id', [...])`.

Log dettagliati limitati ai primi 200 item per non saturare `scraping_logs.error_message`.

## File modificati

```text
supabase/migrations/<timestamp>_campaign_manager_rpc.sql   (nuovo)
src/hooks/useCampaignManagerData.ts                        (riscritto)
supabase/functions/scrape-tiktok/index.ts                  (refactor fetch + bulk)
```

## Cosa NON cambia

- UI Campaign Manager identica
- Logica window CPM, cap views, `views_final` invariata
- RLS invariate; l'RPC verifica il ruolo internamente
- Nessuna modifica allo schema esistente (solo nuova funzione + indici)
