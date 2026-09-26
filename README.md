# The If Laboratory

Escape room educativ în engleză, pentru B1+–B2. Proiect static fără framework și fără dependențe necesare la rularea locală. Publicare prin GitHub → Netlify; Supabase opțional pentru sesiuni de clasă.

**Ghidul complet de încărcare și contul profesorului: [DEPLOYMENT.md](DEPLOYMENT.md).**

## Verificare locală

Instalează Node.js 20 sau mai nou, apoi deschide un terminal în acest folder:

```sh
npm run dev
```

Deschide http://localhost:4173. Pentru telefon pe aceeași rețea Wi-Fi, folosește adresa IP locală a calculatorului cu portul 4173 (de exemplu `http://192.168.1.10:4173`). Windows poate cere să permiți accesul pentru Node pe rețeaua privată. localhost pe telefon se referă la telefon, nu la calculator.

Nu deschide index.html prin dublu click: modulele JavaScript au nevoie de serverul local.

- **Joc individual:** nume + emoji, briefing, 30 minute, toate camerele, rezultat și bonusuri. Nu trebuie cont.
- **Mission control:** echipele locale salvate în același browser; nu simulează echipe inexistente și nu sincronizează alte dispozitive.
- **Teacher:** clase locale, resetare, istoric și rapoarte. Cu Supabase, autentificare și date comune pentru telefoanele clasei.
- Poți avea jocul într-o filă și panoul local într-o altă filă. Creează o echipă nouă din pagina principală pentru a testa mai multe echipe locale. Echipa activă este reținută separat pe filă.

```sh
npm install
npm test
npm run build
node scripts/serve.mjs --dist
```

`npm install` este necesar doar pentru instrumentele de testare; jocul local și buildul nu au nevoie de biblioteci instalate. Testele de browser suplimentare se rulează cu serverul pornit și Google Chrome instalat: `node scripts/qa.mjs`, respectiv `node scripts/qa-connected.mjs`.

Ultima comandă se folosește după oprirea serverului inițial, deoarece utilizează același port.

## Conectarea Supabase Free

1. Creează un proiect **Free** în contul tău Supabase, preferabil într-o regiune apropiată. Păstrează parola bazei de date în contul tău, nu în repository.
2. În **SQL Editor**, execută fișierul `supabase/schema.sql` integral. Scriptul creează tabelele, politicile restrictive și funcțiile de acces.
3. În **Authentication → Sign In / Providers**, activează **Anonymous Sign-Ins**. Elevii primesc automat o identitate anonimă; nu completează email sau parolă. Verifică limitele de autentificare pentru rețeaua școlii înainte de oră, deoarece mai multe telefoane pot folosi aceeași adresă IP publică.
4. În **Authentication → Users**, folosește **Add user / Create new user** pentru contul tău de profesor: email și o parolă sigură. Confirmă emailul din panou dacă există această opțiune. Nu există un utilizator sau o parolă universală inclusă în proiect.
5. Copiază UUID-ul utilizatorului creat și execută în SQL Editor:

```sql
insert into public.lab_teachers(user_id)
values ('UUID-UL-UTILIZATORULUI-TAU')
on conflict do nothing;
```

6. Din setările API ale proiectului copiază **Project URL** și **publishable key** (sau cheia publică `anon` pentru proiectele mai vechi). Completează `config.js`:

```js
window.LAB_CONFIG = {
  supabaseUrl: 'https://PROIECTUL-TAU.supabase.co',
  supabaseKey: 'CHEIA-PUBLICA-PUBLISHABLE-SAU-ANON'
};
```

Aceste două valori sunt publice prin design; securitatea se bazează pe funcțiile autorizate și tabelele protejate. **Nu pune niciodată cheia secretă / service_role, parola profesorului sau parola bazei de date în cod ori GitHub.**

7. Reîncarcă site-ul local, intră la **Teacher**, autentifică-te și creează o sesiune. Vei primi codul, linkul și codul QR al sesiunii.
8. Pentru testul elevului folosește alt browser / o fereastră privată / un telefon. Astfel, contul profesorului și identitatea anonimă a echipei rămân separate.

Nu trebuie activată replicarea Supabase Realtime: panoul interoghează un rezumat la fiecare 5 secunde. Acest lucru reduce complexitatea și evită conexiuni persistente, păstrând progresul aproape simultan pentru o clasă.

## Publicare pe Netlify

1. Încarcă proiectul într-un repository GitHub. Nu încărca parole sau chei secrete.
2. Conectează repository-ul în Netlify. `netlify.toml` setează automat comanda `npm run build` și folderul `dist`.
3. Poți păstra setările publice în `config.js` sau poți seta în Netlify variabilele **SUPABASE_URL** și **SUPABASE_PUBLISHABLE_KEY**. Dacă folosești variabile, setează-le pe ambele; buildul le scrie în configurarea publică a site-ului.
4. Publică, apoi testează un profesor și două echipe de pe browsere diferite. Linkul/QR-ul generat local folosește adresa locală; după publicare, generează-l din pagina Netlify pentru a avea adresa publică.

## Cum se desfășoară lecția

- Introducere: aproximativ 3 minute; joc: 28–30 minute; recapitulare: 5–7 minute.
- Profesorul creează sesiunea și afișează linkul/QR-ul. Echipele aleg nume și emoji.
- Cronometrul fiecărei echipe pornește la finalul briefingului. Durata se stabilește la crearea sesiunii.
- Camerele se deschid liniar. Obiectele dezvăluie cifre; fragmentul de hartă adaugă ultima cifră a lacătului.
- La 3 răspunsuri greșite apare explicația; la 6 apare automat și indiciul. Solicitarea manuală a indiciului este disponibilă oricând. Numărul din rezultat este numărul puzzle-urilor pentru care s-a folosit indiciul, fără dublare.
- Fiecare răspuns greșit blochează toate răspunsurile timp de 15 secunde la prima greșeală, apoi 18, 21, 24…; se adaugă 3 secunde la fiecare greșeală a echipei, inclusiv la cifruri, lacăte și bonusuri. Schimbarea obiectului sau reîncărcarea paginii nu anulează pauza. Cronometrul misiunii continuă.
- Obiectele se activează la atingere. Răspunsurile corecte alimentează portalul; după rezolvarea tuturor obiectelor se dezvăluie cifrul hărții. Fragmentele recuperate completează un traseu interactiv și pot fi inspectate. Portalul devine activ când sunt îndeplinite toate condițiile camerei.
- Sunetele sunt sintetizate local, pornesc după interacțiune și pot fi oprite cu **Sound on/off**. Preferința se păstrează. Efectele respectă setarea sistemului pentru mișcare redusă.
- Șase ilustrații originale prezintă laboratorul din unghiuri diferite, cu PIP mutat și apropiere vizuală de portal. Fracture are robotul în dreapta. Între niveluri apare o tranziție de 4 secunde cu schimbarea cadrului și temă dramatică sintetizată local. Continue sau Escape sar tranziția.
- La fiecare două greșeli acumulate, Felix apare deasupra paginii timp de aproximativ 9 secunde, cu replică în engleză, buton de închidere și reafișare. Un răspuns corect nu anulează numărătoarea greșelilor. Dacă sunetul este activ și browserul are sinteză vocală, citește replica; textul rămâne disponibil indiferent de suportul vocal.
- Profesorul poate proiecta același joc sau Mission control. Panoul listează alfabetic echipele și arată camera, semnalele rezolvate, încercările, indiciile, timpul și ultima actualizare.
- Închiderea intrării nu oprește echipele deja înscrise. Reset for another class arhivează sesiunea și creează alta cu un cod nou. History păstrează data și rezultatele, iar Learning report afișează grafice și timpi. Exportul CSV include răspunsurile înregistrate.
- La expirare jocul se oprește și afișează finalul cu găini; recapitularea și bonusurile rămân disponibile.

## Fiabilitate și limite

- Supabase Free poate pune proiectul pe pauză după inactivitate. Verifică panoul și testează conectarea înainte de lecție, în special după vacanțe.
- Păstrează planurile Free și urmărește utilizarea în Supabase și Netlify. Nu sunt necesare servicii AI cu plată sau abonamente pentru joc.
- Progresul se salvează local la fiecare acțiune. Modificările se retrimit la reconectare. Dacă baza de date nu răspunde, jocul deja încărcat continuă, iar interfața arată că progresul este salvat local.
- Este necesară conexiunea pentru încărcarea inițială, autentificare, intrarea într-o sesiune și panoul comun. Nu este o aplicație complet offline; o reîncărcare fără internet poate eșua.
- Serverul fixează termenul limită. Un rezultat de evadare care ajunge la server abia după expirare este înregistrat ca timp expirat. Testează conexiunea înainte de clasă.
- Numai profesorii autorizați pot crea/modifica propriile sesiuni. O echipă poate salva doar propriul progres. Panoul comun este accesibil celor care au codul sesiunii și afișează doar pseudonime și progres, fără date de autentificare.
- Răspunsurile sunt în aplicația locală. Acesta este un instrument de învățare cooperativă, nu o platformă de examen rezistentă la inspectarea codului.
- Elevii folosesc pseudonime; nu este nevoie să salvezi nume complete. Ștergerea unei sesiuni din `lab_sessions` șterge automat echipele aferente. Exportă rezultatele pe care vrei să le păstrezi.
- Ștergerea datelor browserului pierde identitatea anonimă; reluarea aceleiași echipe de pe alt telefon nu este inclusă.

## Conținut și personalizare

- `content.js`: cele 13 puzzle-uri principale, 17 note bonus și recapitularea. Include Zero, First, Second, Third, ambele tipuri Mixed și inversiuni cu Should/Were/Had. Bonusurile acoperă alternativele la if și Unreal Past.
- `styles.css`: layout responsive, culori și tipografie.
- `app.js`: fluxuri elev/profesor, panou, salvare locală.
- `engine.js`: regulile jocului și calculul rezultatului.
- `backend.js`: autentificare și conexiune Supabase.
- `assets/room-*.webp`: șase cadre originale. `scenes.js` fixează poziția obiectelor interactive; `assets/ARTWORK.md` documentează generarea imaginilor.
- `classroom.js`, `teacher-ui.js`, `analytics.js`: sesiuni, arhivare, grafice, timpi și CSV.
- `assets/future-traveller.png`: Felix, personaj original generat cu instrumentul ImageGen integrat, pe fundal transparent. Prompt: “Full-body charming adult male time traveller, silver hair, mildly annoyed comical sigh, pointing at a wrist time device, teal and navy futuristic jumpsuit with amber trim, friendly painterly graphic-novel style, transparent background, no text.”
- `supabase/schema.sql`: schema completă și autorizarea operațiunilor.

## Starea verificării

Verificat local: traseul complet în Chrome, afișarea la 320/390 px și desktop, mesaje codificate, indiciile după 3/6 greșeli, refresh, bonusuri, finalul cu dinozaur și expirarea cronometrului. Testele automate verifică regulile, timpii, rapoartele și autorizarea bazei de date.

Fluxul conectat a fost verificat cu funcțiile SQL reale într-un PostgreSQL local (PGlite) și cu autentificarea/API-ul Supabase simulate: profesor, sesiune, QR, două echipe independente, panou actualizat, închiderea intrării, export CSV, resetare, oprirea echipelor și păstrarea istoricului. Acesta nu înlocuiește testul cu proiectul Supabase real, care necesită configurare și trebuie făcut înainte de prima oră.

Integrarea opțională WebMCP expune doar progresul vizibil al echipei în browserele compatibile. Nu este necesară pentru joc; în browserul Codex au fost verificate citirea progresului și respingerea unui argument invalid.

