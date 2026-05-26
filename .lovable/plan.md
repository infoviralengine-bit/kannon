## Obiettivo

Sostituire il PDF report Finanz Maggio 2026 con una versione **rigorosamente on-brand Kannon** secondo il Brandbook ufficiale: light editorial, palette 60/30/10 Black/Grey/Red, logo SVG fornito, Inter + Arkhip, layout magazine elegante.

## Specifiche brand (da Brandbook Kannon)

| Token | Valore |
|---|---|
| `--ink` | `#000000` (Kannon Black) |
| `--bg` | `#DFDFDF` (Soft Grey) |
| `--paper` | `#FFFFFF` |
| `--accent` | `#FF2727` (Signal Red) |
| Proporzione | 60% black · 30% grey · 10% red |
| Display | **Arkhip** (Google Fonts; fallback: Space Grotesk 700 uppercase tracking 0.04em) |
| Body | **Inter** Regular/Bold |
| Logo | `Black logo - no background.svg` (header chiaro) e `White logo - no background.svg` (header dark) — usati come SVG, non rasterizzati |
| Clear space | x = metà altezza simbolo |

## Struttura del PDF (3 pagine A4 portrait)

### Pagina 1 — Cover editoriale
- Fondo `#FFFFFF` con striscia top `#DFDFDF` h≈8mm
- Logo Kannon nero (SVG) in alto a sinistra, clear space rispettato
- Riga mono Inter Bold uppercase, tracking 0.18em, 9pt: `MONTHLY REPORT · MAGGIO 2026 · FINANZ`
- Headline gigante Arkhip uppercase, 72pt, line-height 0.95: `MAGGIO IN NUMERI`
- Sottotitolo Inter Regular 14pt grigio scuro: nome cliente "Finanz · Fintech app · iOS + Android"
- Blocco rosso `#FF2727` h≈4mm a tutta larghezza come accent rule
- 4 KPI sintetici in linea: Views totali · Video pubblicati · Creator attivi · CPM Spend (numeri Arkhip 32pt, label Inter mono 8pt uppercase)
- Footer: data emissione + periodo coperto + pagina, Inter 8pt uppercase tracking

### Pagina 2 — Performance
- Header compatto con logo piccolo + breadcrumb sezione: `02 · PERFORMANCE`
- Mini sparkline views/giorno su tutto Maggio (linea nera 1pt, riempimento `#FF2727` 8% opacity, asse minimal)
- Tabella "Top creator del mese" full-width Inter:
  - Header Inter Bold 9pt uppercase tracking 0.12em colore `#555`
  - Righe alternate `#FFFFFF` / `#FAFAFA` (soft grey più leggero per ariosità)
  - Colonne: @username, Video, Views, Δ vs aprile, Top video
  - Numeri tabulari, allineamento dx, accent rosso solo sulla colonna Δ positivi
- Striscia rossa h=2mm come separatore di sezione

### Pagina 3 — Top video, Insights, Billing
- `03 · HIGHLIGHTS`
- Lista Top 5 video: numero serif gigante Arkhip 40pt a sx, @username Inter Bold 13pt, views Inter Regular 11pt, link mono 8pt
- Sezione `04 · INSIGHTS` con 2-3 bullet generati automaticamente (top performer, trend settimanale, viral spike) — Inter 11pt, occhiello mono uppercase
- Sezione finale `05 · BILLING SUMMARY`:
  - Totale spend in Arkhip 56pt nero
  - Sotto, in rosso `#FF2727` Inter Bold 11pt uppercase: `PROSSIMA EMISSIONE · 9 GIUGNO 2026`
  - Breakdown su 2 colonne (Views totali · CPM rate · Subtotale · IVA · Totale) in Inter 10pt
- Footer con logo mini + `kannon.lovable.app · info@kannon.io`

## Implementazione tecnica

- Script Python in `/tmp/gen_kannon_report.py` usando **ReportLab** + **svglib** (per renderizzare il logo SVG vettoriale nel PDF)
- Font: download Inter da Google Fonts API + Arkhip da `https://fonts.cdnfonts.com/css/arkhip` (o fallback Space Grotesk 700 se Arkhip non scaricabile)
- Dati Finanz Maggio 2026 letti via `psql` dalle tabelle `videos` + `campaigns` + `creators` (stessa query del PDF v1)
- Numeri in formato italiano (`1.234,56 €`)
- Output: `/mnt/documents/report-finanz-maggio-2026-v2.pdf`

## QA (obbligatorio prima di consegna)

1. `pdftoppm -r 150` di tutte e 3 le pagine
2. Inspect con `code--view` di ogni JPG:
   - Logo nitido e non distorto, clear space rispettato
   - Nessun overflow testo
   - Margini omogenei (24mm)
   - Allineamento tabella perfetto
   - Contrasto testo/sfondo > AA
   - Niente glyph mancanti (Inter copre tutto, Arkhip è solo all-caps latin → check)
   - Proporzione colore 60/30/10 rispettata visivamente
3. Lista issue trovati + fix + re-render finché pulito
4. Riepilogo QA esplicito nel messaggio finale con artifact

## Note

- Niente modifiche al codice dell'app (questo è solo il test del template PDF, su richiesta dell'utente — la funzione "Genera & invia report mensili" + cron del 9 verrà costruita solo dopo l'approvazione visiva)
- Salvo il brand Kannon in `mem://style/kannon-brand` per future esportazioni PDF/email/asset client-facing