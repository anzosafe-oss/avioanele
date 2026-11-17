# Avioanele v1.1.0

Joc pentru 2–4 piloți, cu adversar automat. Interfață GitHub Pages, backend Supabase MyGames.

După confirmarea flotelor, piloții formează un singur circuit de atac. La eliminare, atacatorul moștenește ținta și radarul descoperit de adversar. Turele păstrează ordinea participanților, independent de circuit. Piloții eliminați pot urmări partida.

Flotele sunt private pe server; browserul primește flota proprie și informațiile autorizate de pe radar. Camerele expiră după 24 ore de inactivitate. Partidele deja începute cu regulile vechi continuă până la final.

Publicare: GitHub Pages, main, director rădăcină. Secretul service_role există numai în Supabase, niciodată în client sau repository.

Detalii și teste: [IMPLEMENTATION-v1.1.0.md](IMPLEMENTATION-v1.1.0.md).
