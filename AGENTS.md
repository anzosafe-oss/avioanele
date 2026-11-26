# AGENTS.md — avioanele

## Priorități permanente
- Prioritizează calitatea, stabilitatea și experiența utilizatorului înaintea economiei de tokeni.
- Păstrează coerența vizuală și funcțională cu ecosistemul MyApps și convențiile de design și comportament stabilite cu utilizatorul.
- Păstrează integral funcționalitățile existente care nu fac obiectul solicitării. Evită redesenările și refactorizările fără legătură cu sarcina.

## Analiză și reutilizare
- Citește acest fișier înaintea intervențiilor. Începe analiza în repository-ul curent, `anzosafe-oss/avioanele`, folosind fișierele și dependențele relevante.
- Accesul la alte repository-uri și proiecte Supabase este permis când este necesar pentru cerința curentă, verificarea unei dependențe sau coerența MyApps. Nu impune o aprobare separată doar pentru această consultare.
- Când utilizatorul face referire la altă aplicație, consultă implementarea reală a acesteia și reutilizează soluția validată, adaptând-o corect la Avioanele. Nu aproxima comportamentul doar din memorie sau din capturi.
- Evită investigațiile redundante și accesarea resurselor fără legătură cu sarcina, fără a compromite calitatea implementării și testării.
- Accesează în Supabase resursele relevante pentru intervenție; verifică identificatorii necunoscuți și nu expune secrete sau date private.

## Date și medii
- Datele demonstrative sunt permise exclusiv în preview și în mediile de testare; păstrează-le separate de producție.
- La prima publicare, aplicația LIVE trebuie să fie curată, fără date demonstrative. Nu introduce conturi, camere, evenimente sau alte înregistrări de exemplu în datele LIVE.
- La actualizările ulterioare, păstrează integral datele reale ale utilizatorilor. Nu reseta și nu goli datele pentru a obține o aplicație „curată”.
- Folosește medii izolate pentru teste care creează sau modifică date. Nu introduce date demonstrative în producție pentru verificare.

## Întreținere și compatibilitate
- Elimină fișierele și codul devenite inutile numai după verificarea dependențelor, inclusiv referințe dinamice, manifest, service worker, cache și configurația de publicare.
- Nu șterge resurse incerte, nu rescrie istoricul Git și nu transforma o intervenție punctuală într-o curățare generală nesolicitată.
- Verifică compatibilitatea cu iOS, Android și desktop și rulează testele relevante, inclusiv regresiile funcționalităților afectate.
- Raportează explicit verificările neexecutate și blocajele mediului. Nu declara teste sau verificări live reușite fără execuție reală.

## Livrare și publicare
- Pregătește modificările aplicației pe o ramură separată și prezintă un rezultat concret, verificabil.
- Actualizează versiunea aplicației la publicarea modificărilor aplicației, respectând convențiile existente și sincronizarea componentelor afectate.
- Publică în producție numai cu acordul explicit al utilizatorului. Aprobarea implementării sau a unui preview nu autorizează automat publicarea LIVE.
- Raportează concis fișierele modificate, rezultatele testelor, limitările și deciziile relevante.
