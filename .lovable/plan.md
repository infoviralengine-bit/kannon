# Cicli cliente coerenti con fisso, variabile e scadenze

## Risultato
- Useremo sempre la parola **ciclo** in tutta la sezione pagamenti.
- Bandi Map avrà data di fine **5 gennaio 2027**, tre mesi dopo l’avvio del 5 ottobre 2026.
- In **Da ricevere** sarà mostrato soltanto il primo ciclo ancora da incassare e il ciclo immediatamente successivo. Tutti gli altri restano pre-generati ma nascosti; quelli pagati restano negli archivi.
- Sotto “Ciclo 1”, “Ciclo 2”, ecc. comparirà soltanto il riferimento breve dei mesi, per esempio **ott–nov**.

## Regole dei pagamenti
- **Ciclo 1:** solo fisso, nessuna colonna o dettaglio CPM/Views; scadenza 7 giorni dopo l’avvio.
- **Cicli intermedi:** fisso più variabile maturata e non ancora pagata. Le views restano basate su totale fino alla chiusura del periodo meno cumulativo già pagato.
- **Accordi fisso + performance:** se il CPM è zero, CPM e views non vengono mostrati. La performance resta gestita separatamente secondo l’accordo cliente, senza inventare un calcolo automatico.
- **Ciclo finale:** solo variabile, creato quando la campagna è conclusa e la data dell’ultimo video è nota. Copre la maturazione fino a 30 giorni dopo quell’ultimo video e scade 7 giorni dopo tale maturazione.
- I cicli pagati e gli importi corretti manualmente non vengono modificati.

## Scadenze
- Il primo fisso scade 7 giorni dopo la data di avvio.
- I cicli successivi seguono lo stesso giorno di riferimento mensile, più 7 giorni di margine. Per Bandi Map: **12 ottobre, 12 novembre, 12 dicembre**.
- Il ciclo finale segue la data reale dell’ultimo video, non una data stimata.

## Interventi
- Aggiornare le funzioni del database che generano e ricalcolano cicli, mantenendo controlli ruolo, RLS e compatibilità con pagamenti già registrati.
- Riallineare Bandi Map e impostarne la data di fine, senza cambiare l’accordo a CPM zero.
- Aggiornare Finance e scheda campagna per terminologia, mesi abbreviati, colonne variabili condizionali e visibilità limitata a due cicli.
- Aggiornare le traduzioni inglesi e i test sulle date, sulla prima rata solo fissa e sulla selezione dei due cicli visibili.

## Verifica
- Controllare Bandi Map in italiano e inglese nella pagina Da ricevere.
- Verificare che il primo ciclo mostri solo 2.500 €, che il secondo mostri il fisso e nasconda CPM perché l’accordo è performance.
- Eseguire test, controllo dei tipi e verifica della compilazione.
