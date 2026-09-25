# Revisione Finance e pagamenti CPM

## Obiettivo
Semplificare la home Finance, rendere più chiara la sezione Da ricevere e mostrare sempre il mese reale associato a ogni ciclo. La logica automatica di scraping e generazione pagamenti non verrà modificata.

## Modifiche

### Home Finance
- Rimuovere la scheda **Cash in bank**.
- Rinominare **Burn mensile** in **Costi fissi mensili**.
- Rimuovere la scheda **Runway**.
- Mantenere **Cash atteso / Expected cash**.
- Lasciare invariati forecast e dati sottostanti, intervenendo solo sulla home richiesta.

### Da ricevere
- Mostrare inizialmente solo i pagamenti delle campagne attive.
- Aggiungere una barra laterale destra con selezione multipla delle campagne in pausa o concluse.
- Le campagne selezionate verranno aggiunte alla vista senza nascondere quelle attive.
- Totali, filtri di stato e raggruppamenti useranno solo le campagne attualmente visibili.

### Periodi e mesi
- Affiancare a ogni **Periodo N** il mese di riferimento derivato dalle date reali del ciclo.
- Per intervalli su due mesi, mostrare entrambi, per esempio: **Periodo 7 · settembre–ottobre 2026**.
- Applicare la stessa regola nelle viste dei pagamenti cliente e creator dove compare il numero del periodo.
- Conservare il dettaglio con le date esatte del ciclo.

### Revisione della logica CPM
- Non introdurre automazioni nuove, come richiesto.
- Documentare chiaramente nel risultato finale il comportamento attuale:
  - lo scraping avviene ogni giorno, separatamente dai cicli;
  - la creazione del ciclo e del pagamento è manuale;
  - il CPM mostrato per il primo pagamento non pagato è `views totali effettive - massimo cumulativo delle views già pagate`;
  - i pagamenti già segnati come ricevuti restano congelati;
  - più pagamenti non pagati non dividono le views: il residuo va al primo;
  - campagne in pausa o concluse possono continuare a essere ricalcolate e gli account attivi continuano a essere scrappati.
- Evidenziare i punti fragili e proporre, senza implementarla, una futura procedura manuale affidabile: avvio scraping, verifica completamento, chiusura ciclo e salvataggio snapshot.

## Verifica
- Controllare compilazione e test esistenti.
- Verificare la pagina Finance su desktop, inclusa apertura della barra destra, selezione multipla e testi IT/EN.
