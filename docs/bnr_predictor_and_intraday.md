# Documentație: Predictor Curs BNR 13:00, Medie Intraday RON/EUR și Piață Monetară

Acest document descrie arhitectura, fundamentarea matematică, relevanța la ore matinale (ex. **10:12 AM**) și specificațiile tehnice pentru modulele introduse în aplicația **Snoti / Curs Valutar**:

1. **Media sesiunii interbancare RON / EUR** (intervalul 13:00 ziua precedentă → 09:00 ziua curentă).
2. **Predictorul direcției cursului BNR de la ora 13:00** (pe baza monedelor regionale CEE EUR/PLN & EUR/HUF, evoluției overnight EUR/USD și condițiilor de lichiditate ROBOR/IRCC).
3. **Analiza pieței monetare și a lichidității interbancare** (ROBOR 3M/6M/1M/ON, IRCC, corelate cu rata de politică monetară a BNR).
4. **Integrarea în notificările Discord existente** (păstrând 100% din informațiile anterioare).
5. **Integrarea în aplicația mobilă** (React Native / Expo).

---

## 1. Context și Necesitate de Business

Banca Națională a României (BNR) publică zilnic în jurul orei **13:00 (EET/EEST)** cursul de schimb oficial de referință. Acest curs nu este stabilit printr-o tranzacție unică, ci reprezintă o medie a cotațiilor transmise de principalele bănci comerciale între orele **11:00 și 11:30**.

Înainte de publicarea oficială de la ora 13:00:
- Actorii economici doresc să anticipeze dacă leul se va deprecia sau aprecia față de euro pentru a decide momentul optim al plăților sau schimburilor valutare.
- În fereastra **10:12 AM**, cursul BNR afișat oficial este încă cel stabilit în ședința precedentă ("curs în vigoare").
- Prin urmare, la ora 10:12 AM utilizatorul primește:
  1. Cursul oficial **în vigoare** la acea oră (cel din ziua anterioară).
  2. Toate comparațiile istorice (ieri, 30 de zile, luna trecută, grafic).
  3. **Media sesiunii interbancare din noapte (13:00 precedent → 09:00 azi)**, reflectând nivelul real la care s-a tranzacționat leul.
  4. **Prognoza matinală pentru fixingul de la ora 13:00**, indicând direcția probabilă (Creștere / Scădere / Stabilitate) și gradul de încredere.

---

## 2. Modelul Matematic și Algoritmul de Predicție (`predictorService.ts`)

Predictorul agregă trei semnale fundamentale de piață ponderate, ajustate ulterior printr-un factor de volatilitate/lichiditate derivat din piața monetară (ROBOR/IRCC):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             SCORE DE PREDICTOR (%)                               │
│                                                                                  │
│   Score = [ 0.60 × CEE_Change + 0.25 × EURUSD_Change + 0.15 × Drift_RON ]        │
│                                                                                  │
│   Score_Final = Score × Liquidity_Damping_Factor                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Ponderile Factorilor

| Indicator | Pondere | Fereastră Temporală | Justificare Economică |
| :--- | :---: | :---: | :--- |
| **Monede CEE (EUR/PLN & EUR/HUF)** | **60%** | 09:00 → 11:30 (sau ora curentă, ex. 10:12) | **Corelație regională puternică**: Zlotul polonez (PLN) și forintul maghiar (HUF) sunt cele mai lichide monede emergente din Europa Centrală și de Est (CEE). Fluxurile de capital instituțional tratează adesea regiunea CEE ca un bloc agregat. Deprecierea PLN și HUF față de EUR în orele dimineții semnalează ieșiri de capital din regiune, generând o presiune directă de depreciere și asupra leului (EUR/RON crește). |
| **EUR/USD Overnight** | **25%** | Închidere sesiune precedentă (22:00) → 09:00 | **Sentimentul global de risc (Risk-On / Risk-Off)**: Dolarul american este activul de refugiu global. O scădere peste noapte a perechii EUR/USD (aprecierea USD) indică o aversiune globală la risc, ceea ce determină retrageri din monedele emergente precum leul. |
| **EUR/RON Intraday Drift** | **15%** | 09:00 → Ora curentă vs. Ultimul fixing BNR | **Tensiunea interbancară locală spot**: Compară cotația spot curentă de pe piața interbancară cu ultimul fixing oficial al BNR. O abatere pozitivă arată că băncile cotează deja la niveluri mai mari decât fixingul anterior. |

### 2.2. Influența Pieței Monetare și a Lichidității (ROBOR / IRCC)

Banca Națională a României operează un regim de flotare controlată (*managed float*). În cadrul acestui regim, condițiile de lichiditate din sistemul bancar influențează capacitatea băncilor de a lua poziții speculative pe deprecierea leului:

- **Excedent de lichiditate (`excess`)**:
  - Când ROBOR 3M este apropiat de facilitatea de depozit (ex. ~5.50% - 6.00% la o dobândă cheie de 6.50%), sistemul bancar are surplus de fonduri plasate la BNR.
  - BNR are un control ridicat asupra cursului, iar intervențiile sau stabilitatea sunt dominante.
  - Se aplică un coeficient de temperare: **$0.85\times$** (volatilitate redusă, mișcări mici de curs).
- **Tensiune / Deficit de lichiditate (`deficit` / `tension`)**:
  - Când ROBOR crește semnificativ peste rata de politică monetară, băncile au nevoie de lichiditate.
  - Costul de finanțare în lei crește, volatilitatea pe FX se amplifică.
  - Se aplică un coeficient de amplificare: **$1.15\times$**.

### 2.3. Clasificarea Direcției și Calculul Nivelului de Încredere

După calcularea scorului final ponderat:
- **`Creștere probabilă` (🔼)** dacă $\text{Score} > +0.05\%$
- **`Scădere probabilă` (🔽)** dacă $\text{Score} < -0.05\%$
- **`Stabilitate / Variație neutră` (⏸️)** dacă $-0.05\% \le \text{Score} \le +0.05\%$

**Nivelul de încredere (Confidence Score)** pornește de la o bază de 50% și crește cumulativ până la un plafon de 95%:
- **+20%** dacă direcția EUR/PLN coincide cu cea a EUR/HUF (convergență CEE).
- **+15%** dacă direcția overnight a EUR/USD confirmă semnalul CEE.
- **+10%** dacă drift-ul interbancar local EUR/RON confirmă semnalul.
- **Ajustare suplimentară proportională** cu magnitudinea variațiilor procentuale absolute.

---

## 3. Media Sesiunii Interbancare RON / EUR (`intradayService.ts`)

La solicitarea explicită, sistemul monitorizează și calculează media ponderată a cotațiilor interbancare din intervalul:
> **Ziua anterioară, ora 13:00 (EET) $\longrightarrow$ Ziua curentă, ora 09:00 (EET)**

### Caracteristici de Calcul:
1. **Fus Orar**: Toate calculele sunt ancorate la `Europe/Bucharest` (ținând cont automat de trecerea la ora de vară/iarnă EET/EEST).
2. **Lumânări Intraday**: Preluare de date la rezoluție de 5 sau 15 minute prin intermediul `EURRON=X` (Yahoo Finance / interbancar).
3. **Cotație Dublă**:
   - `avgEurRon`: Valoarea directă standard (ex: `4.9765 lei/EUR`).
   - `avgRonEur`: Valoarea inversă solicitată (ex: $1 / 4.9765 = \mathbf{0.20093\text{ EUR/leu}}$).
4. **Statistici de Sesie**: Sunt expuse și valorile de `high`, `low` și numărul de lumânări procesate (`sampleCount`).

---

## 4. Relevanța Notificării la Ora 10:12 AM

Când notificarea este programată la ora **10:12 AM** (înainte de fixingul de la 13:00), sistemul este proiectat să fie 100% pertinent:

| Date Analizate | Situație la Ora 10:12 AM | Grad de Relevanță |
| :--- | :--- | :---: |
| **Media 13:00 → 09:00** | **Finalizată 100%**. Intervalul s-a încheiat la ora 09:00. | **Maximă (100%)** |
| **EUR/USD Overnight** | **Finalizat 100%**. Sesiunea overnight s-a încheiat odată cu deschiderea europeană. | **Maximă (100%)** |
| **Monede CEE (09:00 → 10:12)** | **Fereastră activă de ~72 minute**. Piețele din Varșovia (WSE), Budapesta (BSE) și marile centre bancare din Londra/Frankfurt sunt deschise de la ora 09:00. Primele 60-90 de minute stabilesc direcția zilei pentru monedele emergente europene. | **Ridicată (~75%)** |
| **ROBOR / IRCC** | Se utilizează cotațiile în vigoare din ședința anterioară (BNR publică noul ROBOR la ora 11:00). Pentru stabilitate monetară, această valoare este pe deplin relevantă. | **Ridicată (90%)** |

### Adaptare Dinamică a Notificării la 10:12 AM:
- Dacă request-ul are loc înainte de 13:00 (cum este cazul orei 10:12), antetul notificării menționează explicit:
  `🔔 Curs Valutar BNR [PROGNOZĂ MATINALĂ - Înainte de fixingul de la 13:00]`
- Cursul de schimb afișat este etichetat ca:
  `EUR/RON: 4.9772 lei (în vigoare din ședința anterioară)`
- Fereastra CEE din raport indică exact intervalul analizat:
  `CEE Morning (09:00 → 10:10): EUR/PLN +0.12%, EUR/HUF +0.25%`

---

## 5. Structura Notificării Discord

Notificarea Discord păstrează **toate informațiile anterioare**, la care se adaugă noile secțiuni informative:

```text
🔔 Curs Valutar BNR [PROGNOZĂ MATINALĂ - Înainte de fixingul de la 13:00]
📅 Marți, 27 Octombrie 2026, 10:12

Cursuri oficiale în vigoare:
💶 EUR/RON: 4.9765 lei (în vigoare din ședința anterioară)
💵 EUR/USD: 1.0842 (în vigoare din ședința anterioară)

📈 Variație față de ziua precedentă:
EUR/RON: +0.0012 lei (+0.02%)
EUR/USD: -0.0020 (-0.18%)

📊 Trend pe ultimele 30 de zile:
EUR/RON: +0.0085 lei (+0.17%)
EUR/USD: -0.0150 (-1.37%)

📅 Variație față de luna trecută:
Minim: 4.9720 lei | Maxim: 4.9785 lei

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔮 PROGNOZĂ FIXING BNR 13:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Direcție estimată: 🔼 Creștere probabilă
• Grad de încredere: 78%
• Semnal CEE (09:00 → 10:10): EUR/PLN: +0.14%, EUR/HUF: +0.22%
• EUR/USD Overnight: -0.18%
• Factor monetar: Excedent lichiditate (ROBOR 3M: 5.58%)
• Notă: Presiune moderată de depreciere în regiune; BNR poate tempera variația.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MEDIE INTERBANCARĂ RON / EUR (13:00 → 09:00)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Curs mediu EUR/RON: 4.9768 lei
• Curs mediu RON/EUR: 0.2009 EUR/leu
• Interval sesiune: Min 4.9750 lei — Max 4.9782 lei (24 lumânări)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 PIAȚA MONETARĂ & LICHIDITATE BNR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ROBOR 3M: 5.58% | ROBOR 6M: 5.68%
• ROBOR O/N: 5.42% | IRCC: 5.99%
• Stare piață: Excedent de lichiditate

[Fișier atașat: chart.png cu graficul evoluției pe 30 de zile]
```

---

## 6. Arhitectura Backend & Endpoint-uri API

### 6.1. Servicii Create / Modificate

1. **[`intradayService.ts`](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/services/intradayService.ts)**:
   - Interoghează datele intraday pentru `EURRON=X`, `EURPLN=X`, `EURHUF=X`, `EURUSD=X`.
   - Filtrează și calculează media sesiunii 13:00 ziua precedentă → 09:00 ziua curentă în fusul orar `Europe/Bucharest`.
   - Calculează variațiile procentuale pe ferestre temporale dinamice (09:00 → ora curentă).
   - Implementează sistem de cache pe disc (`backend/data/cache_intraday_*.json`) și fallback-uri sintetice reziliente la limitări de rețea.

2. **[`moneyMarketService.ts`](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/services/moneyMarketService.ts)**:
   - Colectează valorile ROBOR (3M, 6M, 1M, O/N) și IRCC.
   - Determină starea lichidității sistemului (`excess` / `deficit` / `balanced`).
   - Persistă datele în `backend/data/moneyMarket.json`.

3. **[`predictorService.ts`](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/services/predictorService.ts)**:
   - Evaluează modelul de predicție combinând datele intraday cu cele monetare.
   - Generează structura `BnrPredictorResult` și secțiunea formatată pentru Discord (`formatPredictorDiscordSection`).

### 6.2. Endpoint-uri API Disponibile

| Metodă | Rută | Descriere |
| :--- | :--- | :--- |
| `GET` | `/api/prediction` | Returnează prognoza completă pentru fixingul de la ora 13:00 (direcție, încredere, indicatori CEE, EUR/USD, ROBOR). |
| `GET` | `/api/intraday-average` | Returnează media sesiunii interbancare RON/EUR și EUR/RON (13:00 precedent → 09:00 azi). |
| `GET` | `/api/money-market` | Returnează indicii ROBOR, IRCC și evaluarea lichidității BNR. |
| `POST` | `/api/trigger-prediction-webhook` | Trimite pe Discord o notificare dedicată cu prognoza matinală. |
| `POST` | `/api/trigger-webhook` | Trimite raportul complet zilnic (cursuri, comparații istorice, grafic, predicție și medie sesiune). |

---

## 7. Integrarea în Aplicația Mobilă (`mobile/`)

În ecranul principal ([`HomeScreen.tsx`](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/screens/HomeScreen.tsx)):
- A fost adăugat hook-ul reactiv [`useMarketPredictor.ts`](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/hooks/useMarketPredictor.ts).
- A fost implementată componenta modernă [`PredictorCard.tsx`](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/components/PredictorCard.tsx):
  - **Badge vizual colorat**:
    - 🟢 Verde pentru *Creștere probabilă*
    - 🔵 Albastru pentru *Scădere probabilă*
    - ⚪ Gri pentru *Stabilitate*
  - **Bară de progres a nivelului de încredere (Confidence %)**.
  - **Semnalele CEE ale dimineții** (EUR/PLN și EUR/HUF) și variația overnight a EUR/USD.
  - **Media sesiunii interbancare**: Afișează atât cursul direct `EUR/RON`, cât și cotația inversă `RON/EUR`.
  - **Indicatorii ROBOR & IRCC** cu starea lichidității din sistem.
  - Suport complet pentru Pull-to-Refresh și teme Light / Dark.

---

## 8. Configurare Cron Recomandată

Dacă folosiți un serviciu precum **Cron-Job.org**:

### Scenariul 1: Notificare Matinală Unică la 10:12 AM
- **Rulare**: Luni - Vineri la ora **10:12** (`Europe/Bucharest`).
- **Endpoint**: `POST https://snoti.onrender.com/api/trigger-webhook` (cu `x-cron-secret` sau `?secret=...`).
- **Comportament**: Generează raportul complet cu cursurile în vigoare, toate comparațiile istorice, graficul de evoluție pe 30 de zile, prognoza matinală pentru ora 13:00 și media sesiunii 13:00 → 09:00.

### Scenariul 2 (Optim): Dublu Cron (Prognoză Matinală + Fixing Oficial)
1. **Cron 1 (10:12 AM)**:
   - `POST https://snoti.onrender.com/api/trigger-prediction-webhook`
   - Trimite alerta matinală pe Discord pentru pregătirea operațiunilor zilei.
2. **Cron 2 (13:05 PM)**:
   - `GET https://snoti.onrender.com/api/fetch-rates`
   - Preia noul curs oficial BNR publicat la 13:00, trimite push pe aplicația mobilă și webhook-ul Discord cu noul curs confirmat.
