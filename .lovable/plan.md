# Cicli di pagamento pre-generati e aggiornati dallo scraping

## Come funzionerà
- **Cicli di 30 giorni** dalla data di inizio della campagna, creati tutti subito fino alla data di fine.
- Ogni ciclo ha il **fisso** già calcolato (l'ultimo ciclo resta solo CPM, come oggi) e un **CPM che si aggiorna** a ogni scraping.
- **Views del ciclo** = views totali dei video pubblicati **fino all'ultimo giorno del ciclo** − views già pagate nei cicli precedenti. Nel primo ciclo sono semplicemente le views totali.
- I video pubblicati dopo la fine del ciclo non entrano nel suo conteggio, anche se lo scraping avviene dopo (esempio: ciclo chiuso il 5 novembre, scraping il 7: i video del 6 e 7 novembre vanno al ciclo successivo).
- Un ciclo **pagato si blocca**: views e importo vengono congelati e diventano la base "già pagata" per i cicli seguenti.
- Il **cap per video** e il **tetto mensile di spesa** restano applicati come oggi.

## Casi particolari
- **Cambio date della campagna**: i cicli pagati non cambiano mai. I cicli non pagati vengono ricalcolati; quelli che cadono dopo la nuova data di fine vengono rimossi.
- **Campagne senza data di fine**: vengono creati il ciclo in corso e il successivo, e se ne aggiunge uno nuovo man mano.
- **Campagne ToT (fisso diviso in due metà)**: mantengono la loro logica attuale e non vengono toccate.
- **Campagne esistenti**: si creano solo i cicli mancanti, senza modificare cicli e pagamenti già registrati.
- **Importi corretti a mano** (override): restano invariati, come oggi.
- **Nota**: le views in più dei video *vecchi*, se rilevate da uno scraping fatto dopo la fine del ciclo, finiscono nel ciclo che si sta chiudendo. È coerente con la regola "totali − già pagate": nessuna view viene contata due volte.

## Cosa vedrai
- Nella scheda campagna e in Finance > Da ricevere compaiono subito tutti i cicli futuri, ognuno con il mese di riferimento.
- I cicli in corso o chiusi ma non pagati mostrano l'etichetta **"Stima, si aggiorna con lo scraping"** e la data dell'ultimo aggiornamento.
- Il pulsante manuale "Genera prossimo ciclo" viene rimosso, perché non serve più.

## Dettagli tecnici
- Nuova funzione SQL `sync_campaign_cycles(campaign_id)` (SECURITY DEFINER, solo staff o service role): crea o riallinea `payment_cycles` e `client_payments` per le campagne `standard_lagged`, rimuove i cicli futuri non pagati oltre la data di fine, non tocca mai le righe `is_paid = true`.
- Nuova funzione SQL `recalc_campaign_cycle_cpm(campaign_id)`: per ogni ciclo non pagato, in ordine, calcola views effettive (con cap per video) dei video pubblicati `<= cycle_end_date` − (views già pagate + views dei cicli non pagati precedenti), poi aggiorna `cpm_views`, `cpm_amount`, `total_amount` e `views_snapshot_at`, rispettando il tetto mensile e gli override.
- Quando un pagamento viene segnato come pagato, un trigger congela `views_paid_cumulative` con il valore corrente del ciclo.
- Trigger su `campaigns` (inserimento e cambio di date, stato o tariffe) → `sync_campaign_cycles`.
- `scrape-tiktok`, alla fine dell'importazione, esegue il ricalcolo per le campagne toccate dallo scraping (anche dopo "Importa dataset"); la funzione verrà ridistribuita e verificata dai log.
- `usePaymentsData` legge i valori salvati invece di ricalcolarli al momento, così Finance, scheda campagna e scheda cliente mostrano gli stessi numeri.
- Backfill una tantum per le campagne esistenti; prima di applicarlo ti mostro l'anteprima dei cicli che verranno creati.
- Test Vitest per la sequenza dei cicli e il calcolo del residuo; aggiornamento di CLAUDE.md.
