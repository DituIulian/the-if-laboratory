# Publicare: GitHub → Netlify + Supabase

Aplicația este pregătită pentru publicare. În prezent, `config.js` nu conține un proiect Supabase: poți verifica jocul, clasele și rapoartele pe același calculator. Pentru sincronizarea telefoanelor trebuie să faci configurarea de mai jos. Nu există un cont de profesor predefinit.

## 1. Verifică local

Din PowerShell, în folderul proiectului:

```powershell
npm install
npm run dev
```

Deschide `http://localhost:4173/`. Dacă serverul rulează deja, folosește-l fără să pornești încă unul. Teacher permite crearea unei clase locale. Copiază codul ei, intră în joc, alege nume și emoji. Pentru clase locale, toate filele trebuie să fie în același browser; datele sunt în localStorage, nu în cookies.

Verificări automate:

```powershell
npm test
npm run build
```

Cu serverul și Google Chrome disponibile poți rula `node scripts/qa.mjs`, `node scripts/qa-journey.mjs` și `node scripts/qa-connected.mjs`. Ultimul verifică funcțiile SQL reale local, cu autentificarea Supabase simulată.

## 2. Creează și conectează Supabase

1. Intră în [Supabase Dashboard](https://supabase.com/dashboard), creează un proiect pe planul Free și alege o regiune europeană apropiată. Păstrează parola bazei de date separat.
2. Deschide **SQL Editor → New query**, copiază TOT fișierul `supabase/schema.sql` și apasă **Run**. Același script poate fi rulat și peste versiunea veche: adaugă arhivarea și rapoartele fără să șteargă istoricul.
3. În **Authentication → Sign In / Providers**, activează **Anonymous Sign-Ins**. Elevii primesc o identitate anonimă automată; nu au nevoie de email. Vezi [documentația autentificării anonime](https://supabase.com/docs/guides/auth/auth-anonymous).
4. În **Authentication → Users → Add user / Create new user**, creează contul tău de profesor cu email și parolă. Confirmă emailul din panou, dacă este necesar. Copiază UUID-ul utilizatorului.
5. Rulează în SQL Editor, înlocuind valoarea dintre ghilimele:

```sql
insert into public.lab_teachers(user_id)
values ('UUID-UL-CONTULUI-TAU')
on conflict do nothing;
```

6. Din setările proiectului copiază **Project URL** și **publishable key**. Este acceptată și cheia publică legacy `anon`. Nu folosi `service_role` sau `sb_secret_…`. [Despre cheile Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
7. Completează `config.js` pentru verificarea locală:

```js
window.LAB_CONFIG = {
  supabaseUrl: 'https://ID-PROIECT.supabase.co',
  supabaseKey: 'sb_publishable_CHEIA_TA'
};
```

URL-ul și cheia publishable sunt publice prin design. Parola profesorului, parola bazei de date și cheile secrete nu se scriu în acest fișier și nu se încarcă pe GitHub.

8. Reîncarcă pagina, intră în **Teacher**, autentifică-te cu emailul și parola create la pasul 4. Creează o clasă. Testează o echipă într-o fereastră privată sau alt browser, pentru a separa contul profesorului de elevi.

Nu trebuie activat Supabase Realtime. Mission control citește progresul la 5 secunde; echipele salvează la acțiuni și transmit un semnal de activitate la 10 secunde. Oprirea unei clase ajunge astfel și la echipele care nu apasă nimic, cât timp sunt conectate.

## 3. Încarcă sursele pe GitHub

Creează pe [GitHub](https://github.com/new) un repository gol, de exemplu `the-if-laboratory`. Poate fi privat. Nu adăuga automat README sau `.gitignore`, fiindcă proiectul le conține deja.

Din folderul proiectului:

```powershell
git init
git add .
git commit -m "Prepare The If Laboratory for classroom use"
git branch -M main
git remote add origin https://github.com/UTILIZATOR/the-if-laboratory.git
git push -u origin main
```

Înlocuiește `UTILIZATOR` cu numele contului tău. La autentificare, urmează fereastra GitHub/Git Credential Manager. Dacă Git solicită identitatea autorului, configurează `git config user.name "Numele tău"` și `git config user.email "Emailul GitHub"`, apoi repetă commitul.

`.gitignore` exclude `node_modules`, `dist`, rezultatele testelor și fișierele `.env`. Încarci sursele, inclusiv `assets`, `supabase`, `scripts`, `package.json`, `package-lock.json` și `netlify.toml`.

Alternativ, GitHub Desktop poate adăuga acest folder prin **Add local repository**, apoi **Publish repository**. [Ghidul GitHub pentru un proiect local](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## 4. Publică pe Netlify

1. În Netlify alege **Add new project → Import an existing project**, conectează GitHub și selectează repository-ul.
2. Setările sunt deja în `netlify.toml`: **Build command:** `npm run build`; **Publish directory:** `dist`; Node 22. Nu este necesar un server plătit.
3. Dacă nu vrei să completezi `config.js`, adaugă ambele variabile de build în Netlify: **SUPABASE_URL** și **SUPABASE_PUBLISHABLE_KEY**. Valorile trebuie să fie disponibile la build. Nu încărca doar un fișier `.env`: buildul folosește variabilele Netlify. [Variabile de mediu](https://docs.netlify.com/build/environment-variables/get-started/).
4. Apasă **Deploy**. Deschide adresa HTTPS primită, intră la **Teacher**, creează o sesiune și distribuie linkul/QR-ul generat ACOLO. Linkurile generate de pe localhost indică doar calculatorul local.
5. Testează două telefoane sau browsere independente: nume diferite, progres simultan, o greșeală, un răspuns corect, raportul și resetarea clasei.

[Ghidul Netlify pentru publicare din repository](https://docs.netlify.com/start/quickstarts/deploy-from-repository/).

După modificări:

```powershell
git add .
git commit -m "Update classroom activity"
git push
```

Netlify reconstruiește automat site-ul. Dacă modifici schema SQL, rulează separat versiunea actualizată în Supabase; Git push nu execută SQL-ul.

## 5. Folosirea la clasă și istoricul

- **Create class session**: nume precum „9A · Conditionals”, durată, cod și QR. Fiecare echipă își pornește timpul după briefing.
- **Open live board**: nume, emoji și progres aproape simultan. Poate fi proiectat pe tablă; echipele sunt ordonate alfabetic.
- **Learning report**: graficul greșelilor pe întrebări, varianta greșită aleasă cel mai des, cel mai rapid răspuns corect al fiecărei echipe, mediana pe întrebare și procentul corect din prima încercare. Apasă din nou pentru actualizare.
- **Fastest typical solution** cere minimum două echipe cu răspuns corect cronometrat. Timpul include discuția, reîncercările și pauzele. Rapiditatea singură nu dovedește că o întrebare a fost cea mai ușoară.
- **Close entry** blochează echipele noi, dar le lasă pe cele înscrise să continue.
- **Reset for another class** arhivează sesiunea veche, oprește echipele încă active și creează o sesiune NOUĂ, cu alt cod, nume și durată. Rezultatele vechi rămân în **History**, cu data creării și arhivării. Poți căuta după nume, cod sau dată.
- **End & archive** încheie clasa fără să creeze alta. **Export results** descarcă răspunsurile în CSV. Nu există un buton care șterge istoricul.

În Supabase istoricul este păstrat în baza de date și se vede de pe alt calculator după autentificare. Fără Supabase, istoricul rămâne doar în browserul folosit; nu șterge datele browserului dacă vrei să-l păstrezi. Sesiunile locale nu se transferă automat în Supabase.

## Înaintea primei ore

Verifică proiectul Supabase și conectarea de pe rețeaua școlii. Planul Free poate pune pe pauză proiectele inactive, iar autentificarea anonimă are limite pe IP; toate telefoanele școlii pot folosi același IP. Nu activa un abonament plătit pentru a testa aplicația. Tarifele și limitele serviciilor pot evolua; verifică panourile conturilor tale.

Publicarea efectivă și verificarea cu proiectul tău Supabase rămân de făcut după introducerea configurării. Testele locale nu confirmă automat configurația unui cont extern.
