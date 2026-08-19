# Curs Valutar - Backend (Render) + Mobile (Expo/React Native)

Proiect complet TypeScript pentru monitorizarea zilnica a cursului EUR/RON (BNR)
si EUR/USD, cu notificari push catre o aplicatie mobila.

```
curs-valutar/
├── backend/   -> Express + TypeScript, deploy pe Render
└── mobile/    -> React Native + Expo + TypeScript
```

---

## 1. Backend - rulare locala

```bash
cd backend
npm install
cp .env.example .env    # editeaza CRON_SECRET
npm run dev              # porneste pe http://localhost:3000
```

Test rapid:

```bash
curl "http://localhost:3000/api/fetch-rates?secret=CRON_SECRET_UL_TAU"
curl http://localhost:3000/api/rates
```

## 2. Deploy pe Render

1. Pune folderul `backend/` intr-un repo Git (GitHub/GitLab).
2. In dashboard-ul Render: **New +** → **Web Service** → conecteaza repo-ul.
3. Setari:
   - **Root Directory**: `backend` (daca repo-ul contine si `mobile/`)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Adauga variabila de mediu `CRON_SECRET` cu o valoare secreta a ta (Environment → Add Environment Variable).
5. Deploy. Render iti va da un URL de forma `https://numele-tau.onrender.com`.

> Nota: pe planul Free, Render "adoarme" serviciul dupa perioade de inactivitate,
> iar primul request dupa "somn" poate dura 30-60s. De asemenea, discul e efemer:
> `data/rates.json` si `data/tokens.json` se pot pierde la redeploy sau restart.
> Pentru productie serioasa, ia in calcul un plan platit cu disk persistent sau
> o baza de date externa (ex: Upstash Redis, Postgres).

## 3. Configurare Cron-Job.org

Cron-Job.org va apela endpoint-ul `/api/fetch-rates` in fiecare zi lucratoare la 13:00.

1. Creeaza cont gratuit pe https://cron-job.org
2. **Create cronjob**:
   - **Title**: `Fetch curs valutar`
   - **URL**: `https://numele-tau.onrender.com/api/fetch-rates?secret=CRON_SECRET_UL_TAU`
   - **Schedule** → **Custom**:
     - Days: Monday, Tuesday, Wednesday, Thursday, Friday
     - Time: `13:00` (seteaza timezone-ul contului pe `Europe/Bucharest`)
   - Salveaza.
3. Poti trimite secretul si ca header in loc de query param, daca preferi:
   **Advanced** → **Request headers** → adauga `x-cron-secret: CRON_SECRET_UL_TAU`
   (si scoate `?secret=...` din URL).
4. Testeaza manual din interfata Cron-Job.org ("Execute now") si verifica in
   log-urile Render ca request-ul a ajuns si a returnat `200 OK`.

## 4. Aplicatia mobila - rulare locala

```bash
cd mobile
npm install
npx expo start
```

Inainte de a rula:

- In `src/api/client.ts`, seteaza `API_BASE_URL` cu URL-ul real de pe Render.
- In `app.json`, seteaza `extra.eas.projectId` cu ID-ul proiectului tau Expo
  (necesar pentru `getExpoPushTokenAsync` in build-uri standalone/EAS).
- Notificarile push functioneaza doar pe device fizic (nu in simulator/emulator).

Scaneaza codul QR cu aplicatia **Expo Go** de pe telefon pentru a testa rapid.

## 5. Fluxul complet

1. Utilizatorul deschide aplicatia mobila → i se cere permisiunea de notificari
   → token-ul Expo e trimis catre `POST /api/register-token`.
2. In fiecare zi lucratoare la 13:00, Cron-Job.org apeleaza
   `GET /api/fetch-rates` pe backend.
3. Backend-ul ia cursul EUR/RON de la BNR si EUR/USD de la Frankfurter.app,
   salveaza rezultatul (ultimul curs + istoric complet), recalculeaza
   minimul/maximul pe luna curenta si trimite o notificare push tuturor
   token-urilor inregistrate.
4. Aplicatia mobila afiseaza mereu ultimele date prin `GET /api/rates`,
   istoricul complet in doua grafice (`GET /api/history`) si minimul/maximul
   pe fiecare luna (`GET /api/stats`), fie la deschidere, fie prin
   Pull-to-Refresh.

## 6. Endpoint-uri API

| Metoda | Ruta                  | Descriere                                                        |
|--------|-----------------------|-------------------------------------------------------------------|
| GET    | `/api/rates`           | Ultimul curs cunoscut (EUR/RON, EUR/USD)                          |
| GET    | `/api/history`         | Toate valorile inregistrate pana acum, o intrare pe zi            |
| GET    | `/api/stats`           | Minim/maxim (valoare + data) pentru fiecare curs, grupat pe luna  |
| POST   | `/api/register-token`  | Inregistreaza un ExpoPushToken pentru notificari                  |
| GET    | `/api/fetch-rates`     | Trigger protejat prin secret; actualizeaza toate datele de mai sus, apelat de Cron-Job.org |
| GET    | `/api/backfill-month`  | Trigger manual protejat prin secret; extrage datele lipsa pentru luna curenta |
| GET    | `/api/rsi/status`      | Returneaza valorile RSI curente si preturile pentru lista activa de simboluri |
| GET/POST | `/api/rsi/check`     | Verifica RSI si trimite alerte Discord pe `#trading` pentru RSI <= 40 (🔵 <=40, 🟠 <=35, 🔴 <=30) |
| GET    | `/api/rsi/symbols`     | Returneaza configuratia curenta de simboluri (active, suprascrise, default) |
| POST   | `/api/rsi/symbols`     | Suprascrie lista de simboluri din frontend |
| POST   | `/api/rsi/symbols/reset` | Reseteaza lista de simboluri la valorile default din `.env` |

Datele sunt persistate in `backend/data/` in fisiere JSON: `rates.json`, `history.json`, `tokens.json`, `monthlyStats.json` si `rsiSymbols.json`.

## 7. Backfill automat pentru luna curenta

Daca la un moment dat (prima rulare, redeploy pe Render care sterge discul,
sau inceputul unei luni noi) istoricul nu contine inca nicio zi din luna
curenta, backend-ul completeaza automat toate zilele lucratoare de la 1 ale
lunii pana azi, folosind:

- **arhiva anuala BNR** (`https://curs.bnr.ro/files/xml/years/nbrfxratesYYYY.xml`)
  pentru EUR/RON,
- **seria temporala Frankfurter.app** pentru EUR/USD.

Acest backfill se declanseaza automat:
- la pornirea serverului (`app.listen`),
- la fiecare apel al `/api/fetch-rates` (verificarea e ieftina - iese imediat
  daca luna curenta are deja date, deci nu incetineste fetch-ul zilnic).

Poti si sa-l declansezi manual, de exemplu ca sa verifici imediat dupa un
redeploy pe Render:

```bash
curl "https://numele-tau.onrender.com/api/backfill-month?secret=CRON_SECRET_UL_TAU"
```

Raspuns exemplu:
```json
{ "backfilled": true, "addedDays": 8, "month": "2026-07" }
```

Nota: daca luna curenta are deja cel putin o zi in istoric, backfill-ul nu
face nimic (`"backfilled": false`) - nu suprascrie datele existente. Daca
vrei sa refaci complet istoricul unei luni, sterge intrarile respective din
`data/history.json` inainte de a apela endpoint-ul.
