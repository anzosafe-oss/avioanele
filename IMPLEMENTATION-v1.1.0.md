# Avioanele v1.1.0 — raport de implementare

Bază: `main`, commit `4c8e54086128558cba15cd534e0627a2001423be`.

## Fișiere de aplicație

- `server-game.js`: nume MIG atribuite pe server, locuri stabile, faza `targeting`, circuit unic, radar moștenit prin drepturi asupra istoricului original, spectatori, validarea turelor și cereri de atac idempotente.
- `index.html`: nume implicit gol pentru atribuirea MIG pe server, dropdown în faza de alegere, radar autorizat, indicator cu celule egale, tratarea conflictelor și versiune v1.1.0.
- `server-index.ts` rămâne identic: deja citește `revision` și salvează întregul JSON prin compare-and-swap. Nu este necesară schimbarea adaptorului anticipată în plan.
- `tests/`: teste automate de backend, DOM, invariabile de sursă și teste de browser pregătite.

Headerul, logo-urile, favicon-urile, toate stilurile preexistente, mecanismul pull-to-refresh, forma avioanelor, validarea poziționării și politica de țintire Copilot sunt păstrate. CSS nou este limitat la indicatorul cu celule.

## Backend și compatibilitate

Nu sunt necesare tabele, extensii, politici RLS, secrete sau migrări SQL noi. În etapa de implementare și testare locală nu au fost executate scrieri în Supabase sau publicări; livrarea se face separat, după confirmarea utilizatorului.

Camerele noi conțin `rulesVersion: 2`. În JSON se adaugă `selections`, `turnOrder`, `turnSeq`, `winnerId`, iar la participant: `slot`, `targetId`, `radarAccess` și `attackReceipts` (maximum 32 de confirmări recente). Istoricul `shots` nu este mutat și nu este duplicat.

`radarAccess[targetId]` este lista autorilor ale căror lovituri asupra acelei ținte pot fi consultate. Transferurile succesive reunesc aceste drepturi. API-ul calculează `radar` numai din coordonate deja atacate, cu autorul original. Nu returnează drepturile interne, tokenurile altor participanți sau pozițiile ascunse. Eliminatul primește radar gol și păstrează accesul la participanți, jurnal și rezultat.

Acțiune nouă: `POST /select-target`, cu `target` (ID sau `null` pentru ștergerea alegerii) și `revision`. `fire` cere pentru camerele v2 și `turnSeq`, `requestId`. Repetarea aceleiași cereri confirmate returnează starea curentă fără o a doua lovitură; cererile din ture vechi sunt respinse. La concurență, doar o versiune a întregii camere este salvată; conflictul este HTTP 409, iar clientul reîncarcă starea fără retrimitere automată.

Selecția pornește numai la cameră completă și flote confirmate. Un participant plecat în timpul selecției readuce camera în lobby, golește alegerile și permite înlocuirea locului, păstrând flotele deja confirmate. Plecarea explicită în joc reconectează circuitul și transferă radarul predecesorului. O absență temporară nu elimină jucătorul.

Partidele vechi deja pornite continuă cu regulile vechi. Lobby-urile vechi trec la v2 la următoarea mutație, păstrând numele, ID-urile și tokenurile existente. La publicarea viitoare, frontend-ul și Edge Function trebuie livrate coordonat; un client vechi aflat într-o cameră nouă v2 trebuie reîncărcat pentru noile câmpuri de protocol.

## Verificări executate

- **16/16 teste backend**, executate local cu handlerul real și un adaptor DB în memorie ce reproduce actualizarea condiționată pe `revision`.
- **4/4 teste DOM**, cu scriptul real din `index.html` și același handler backend: partidă completă cu patru participanți, radar moștenit în grilă, conflict de selecție, refresh, reluarea unui atac după pierderea răspunsului.
- **2/2 teste de sursă**: header/stiluri preexistente/branding/refresh/adaptor identice; geometrie, validare și politică Copilot identice.
- Sintaxa JavaScript și `git diff --check`: corecte.

Backend-ul acoperă partide complete cu 2/3/4 participanți, circuite separate respinse, selecții simultane, transfer miss/hit/kill, moștenire în lanț 4→3→2→1, ordinea turelor independentă, reconectare, spectatori, ținte neatribuite, atacuri duplicate/întârziate, eliminări simultane și Copilot.

**Limite:** nu au fost executate teste live în producție. Cele trei teste de browser au fost încercate, dar nu au ajuns la aplicație: Chromium este blocat de restricția `socket() ... Operation not permitted`; WebKit are biblioteci de sistem lipsă. Nu sunt declarate teste vizuale iOS/Android/desktop reușite. DOM nu înlocuiește verificarea vizuală pe dispozitive.

## Rulare teste

Fără dependențe de aplicație noi:

```sh
node --test tests/multiplayer.test.mjs tests/source.test.mjs
```

Testele DOM necesită `jsdom@26.1.0` ca instrument de test, instalat în afara proiectului:

```sh
npm install --prefix /tmp/avioanele-test-tools --no-save --no-audit --no-fund jsdom@26.1.0
NODE_PATH="/tmp/avioanele-test-tools/node_modules:$NODE_PATH" node --test tests/dom.test.mjs
```

Testele vizuale pregătite necesită Playwright și browserele/dependențele sale pe o gazdă compatibilă:

```sh
node --test tests/interface.test.mjs
```

Acestea verifică desktop Chromium, iPhone/WebKit și Android/Chromium simulate: flux UI complet, patru celule egale, poziția de jos, header nemișcat, radar moștenit, spectatori și refresh. Nu folosesc producția; răspunsurile API sunt generate de handlerul local și baza în memorie.
