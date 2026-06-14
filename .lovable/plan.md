# Plan: Pagina Finance

## 1. Database

### Nuova tabella `financial_entries`
Campi: `type` (revenue/cost/invoice_in/invoice_out), `category`, `description`, `amount`, `currency` (default EUR), `date`, `due_date`, `status` (expected/confirmed/received/paid/overdue), `campaign_id` → campaigns, `creator_id` → creators, `brand_name` (testo libero, derivato da `campaigns.client_name` quando collegato), `invoice_number`, `notes`, timestamps.

GRANT: solo `authenticated` + `service_role`. RLS: solo admin (`has_role(auth.uid(),'admin')`) ALL.

### Settings
Riuso tabella `settings` esistente per:
- `finance_cash_in_bank` (numero) — valore corrente
- `finance_cash_updated_at` (timestamp)

### RPC `get_finance_dashboard(p_period text)`
SECURITY DEFINER, admin-only. Restituisce JSON aggregato con:
- KPI cash (cash_in_bank, burn_mensile, runway, cash_atteso)
- Ricavi: MTD, MoM%, top brand, pipeline weighted, serie mensile 6 mesi, dettaglio per campagna (unione `client_payments` + `financial_entries`)
- Costi: per categoria (creator dai `creator_payments` + manuali), trend mensile
- Margini: per campagna e per creator (revenue − costo)
- Forecast: 90 giorni, 3 scenari (pessimistico/base/ottimistico) basati su entries confermate + pipeline weighted
- Liste: flussi previsti, fatture, scadute

Burn = media costi confermati ultimi 3 mesi. Runway = cash / burn.

## 2. Routing & Sidebar
- Sostituire `FinancePage` da ComingSoon a nuova `FinancePage` reale in `src/pages/dashboard/FinancePage.tsx`.
- `ProtectedRoute` wrapper specifico per `/dashboard/finance` con `allowedRoles=['admin']`, oppure check interno alla pagina.
- Sidebar: mostrare la voce Finance solo per admin (filtro su `AppSidebar`).

## 3. Componenti UI (`src/components/finance/`)
- `FinanceHeader.tsx` — titolo + period toggle (mese/3m/6m/anno)
- `AddEntryDialog.tsx` — form unificato (entrata/uscita/fattura) con zod validation
- `CashTab.tsx` — 4 KPI card + tabelle flussi previsti + fatture; dialog per aggiornare cash in bank
- `RevenueTab.tsx` — 4 KPI + tabella per campagna + bar chart 6 mesi
- `CostsTab.tsx` — 5 KPI + tabella categorie + line chart trend
- `MarginsTab.tsx` — 3 KPI + tabelle margine campagna/creator con highlight rosso su negativi
- `ForecastTab.tsx` — line chart 3 scenari 90gg + alert runway <3 mesi

## 4. Data layer
- `src/hooks/useFinanceData.ts` — React Query, chiama RPC `get_finance_dashboard` con period selezionato
- `src/hooks/useFinancialEntries.ts` — CRUD su `financial_entries` con invalidation
- `src/lib/finance.ts` — helper calcoli locali (formatCurrency già esiste)

## 5. Edge cases gestiti
- Cash non impostato → card mostra "Non impostato" + CTA
- Storico insufficiente → forecast mostra solo mese corrente con nota
- Margine negativo → testo rosso + icona warning
- Runway <3 mesi nello scenario pessimistico → alert rosso in cima al tab Forecast

## 6. Dettagli tecnici
- Recharts (già usato) per grafici
- Italian locale per importi/date (`formatCurrency`, `it-IT`)
- Realtime invalidation su `financial_entries` via hook esistente
- Memoria: aggiungere `mem://features/finance-page` riassuntiva
