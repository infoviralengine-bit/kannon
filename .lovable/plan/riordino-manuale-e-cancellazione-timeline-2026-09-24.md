# Riordino manuale e cancellazione timeline

## Obiettivo
- Rendere gli elementi della timeline trascinabili verticalmente tramite una maniglia dedicata.
- Salvare l’ordine scelto, così resta invariato dopo il refresh.
- Aggiungere un’azione cestino su ogni elemento con richiesta di conferma.
- Conservare le date originali degli eventi: il riordino non modificherà la data dichiarata.

## Interfaccia
- Il trascinamento sarà disponibile nella vista “Tutto”, dove l’ordine globale è comprensibile.
- Durante un filtro specifico gli elementi restano consultabili, ma non riordinabili.
- Ogni riga avrà una maniglia di trascinamento e un cestino discreti, accessibili anche da tastiera.
- La cancellazione mostrerà una conferma con il nome dell’elemento.

## Dati e sicurezza
- Aggiungere una tabella dedicata all’ordine della timeline, separata dagli eventi originali.
- Applicare accesso staff-only coerente con lead e clienti esistenti, con RLS e grant espliciti.
- Il trascinamento aggiornerà solo le posizioni, non timestamp o contenuto.
- La cancellazione eliminerà il record sorgente corretto; per i file rimuoverà anche l’eventuale file archiviato.

## Dettagli tecnici
- Usare una libreria drag-and-drop accessibile per puntatore, touch e tastiera.
- Gestire attività, documenti, task completati e appunti attraverso mutation dedicate.
- Aggiornare immediatamente la lista durante il trascinamento e riallinearla ai dati salvati in caso di errore.
- Mantenere le traduzioni IT/EN per conferme, errori e comandi.

## Verifica
- Verificare trascinamento, persistenza dopo refresh, filtri e cancellazione per ogni tipo di evento.
- Verificare che le date mostrate non cambino dopo il riordino.
- Eseguire controllo TypeScript e test esistenti.
