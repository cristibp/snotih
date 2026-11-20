# Indicator de Risc de Recesiune (Recession Proximity Indicator) & Tab Recesiune

Acest document detaliază arhitectura, modelul cantitativ, implementarea backend (fără bază de date) și integrarea în aplicația mobilă a noului modul de analiză a curbei randamentelor Trezoreriei SUA (**10Y–2Y** și **10Y–3M**).

---

## 1. Structura Fișierelor

```
backend/
├── src/
│   ├── config/
│   │   └── macroConfig.ts             # Configurație centralizată (URL-uri FRED, TTL, ponderi, praguri bps)
│   ├── services/
│   │   ├── macroParser.ts             # Parser pur CSV în memorie & aliniere serii cronologice
│   │   ├── macroCalculator.ts         # Motor cantitativ (SMA5, delta 20z/60z, regimuri, scor 0-100)
│   │   └── macroService.ts            # Ingestie, cache în memorie cu TTL, mutex deduplicare, snapshot & alertare
│   ├── types.ts                       # Tipuri DTO pentru serii, regimuri și răspuns API
│   └── index.ts                       # Rutele GET /api/macro/yield-curve/status și POST /refresh
└── test/
    └── macroService.test.js           # Teste unitare complete (parser, metrici, regimuri, scor, cache)

mobile/
├── src/
│   ├── api/
│   │   ├── types.ts                   # DTO-uri pentru clientul mobil
│   │   └── client.ts                  # Apeluri fetchYieldCurveStatus & refreshYieldCurveStatus
│   ├── hooks/
│   │   └── useYieldCurve.ts           # Hook React pentru state, auto-fetch și pull-to-refresh
│   └── screens/
│       └── RecessionScreen.tsx        # Ecran dedicat: gauge scor 0-100, regim, spread-uri bps, istoric
└── App.tsx                            # SegmentedControl cu 3 tab-uri persistate (Curs, RSI, Recesiune)
```

---

## 2. Configurația Centralizată (`backend/src/config/macroConfig.ts`)

Toate pragurile economice, ferestrele rulante, URL-urile FRED și ponderile sunt externalizate într-o structură tipizată:

- **Surse date (FRED CSV fără cheie API)**:
  - `T10Y2Y`: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y`
  - `T10Y3M`: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y3M`
  - `DGS10`, `DGS2`, `DGS3MO`: pentru diferențierea *bull* vs. *bear steepening*
- **Cache TTL**: 6 ore (`6 * 60 * 60 * 1000` ms), configurabil prin `MACRO_CACHE_TTL_MS`.
- **Fereastră rulantă**: 400 de zile lucrătoare (`MACRO_ROLLING_WINDOW_DAYS`).
- **Ponderi calcul scor**:
  - `T10Y3M`: **40%**
  - `T10Y2Y`: **25%**
  - Convergență, dezinversare & viteză *steepening* (`delta_20d_10y3m`): **35%**
- **Prag alertă**: Scor ≥ **70/100**.

---

## 3. Logica Matematică & Implementarea Backend

### A. Parser CSV în Memorie & Curățare Date (`macroParser.ts`)
- **Fără bază de date**: Parsare directă a răspunsurilor HTTP într-un `Map<string, number>`.
- **Filtrare**: Sunt eliminate antetul (`observation_date`), zilele libere/nelucrătoare marcate cu `.`, rândurile goale sau `NaN`.
- **Conversie unitate**: Din puncte procentuale în puncte de bază (`bps = val * 100`).
- **Aliniere temporală**: Seriile `T10Y2Y` și `T10Y3M` sunt intersectate pe date comune (`YYYY-MM-DD`), sortate crescător și tăiate la fereastra utilă de 400 de zile lucrătoare.

### B. Metrici Derivate (`macroCalculator.ts`)
Pentru fiecare zi lucrătoare din fereastră se determină:
- `sma5_10y2y` și `sma5_10y3m`: Media mobilă pe ultimele 5 zile lucrătoare.
- `delta_20d_10y3m` și `delta_60d_10y3m`: Variația spread-ului față de acum 20, respectiv 60 de zile lucrătoare.
- `is_inverted_2y` (`sma5_10y2y < 0`) și `is_inverted_3m` (`sma5_10y3m < 0`).
- `days_since_last_inversion_3m` și `days_since_last_inversion_2y`: Zile lucrătoare de la ultima valoare negativă (`0` dacă este inversată astăzi, `null` dacă nu există în fereastră).
- `steepening_type`:
  - `BULL_STEEPENER`: Spread-ul crește (`delta_20d > 5 bps`), iar ratele pe termen scurt scad mai accentuat decât cele lungi (relaxare monetară / tăieri de dobândă de urgență ale Fed).
  - `BEAR_STEEPENER`: Spread-ul crește, dar prin avansul rapid al randamentelor pe termen lung (așteptări inflaționiste / primă de risc pe emisiuni mari de datorie).
  - `NEUTRAL`: Panta curbei este stabilă (|delta| ≤ 5 bps) sau în comprimare.

### C. Clasificarea în Regimuri Macro
1. **`UNINVERSION_CRITICAL` (Regim 3):**
   - Trecere din `< 0` în `>= 0` pe `T10Y3M` (confirmată pe `SMA5 >= 0` sau 3 zile consecutive pozitive);
   - Istoric de inversare în ultimele 252 de zile lucrătoare (`days_since_last_inversion_3m <= 252`);
   - *Steepening* pozitiv activ (`delta_20d_10y3m > 0`).
   - *Explicație quant:* Istoric, recesiunile americane debutează la scurt timp după dezinversarea curbei, pe fondul scăderii forțate a dobânzilor de politică monetară.
2. **`INVERTED` (Regim 2):**
   - `sma5_10y2y < 0` și/sau `sma5_10y3m < 0`.
3. **`FLATTENING` (Regim 1):**
   - Cel puțin un spread în intervalul `[0, 25]` bps fără inversare activă sau curba în consolidare după ieșirea din inversare.
4. **`NORMAL` (Regim 0):**
   - Ambele spread-uri `> 25 bps` și fără nicio inversare în ultimele 180 de zile lucrătoare.

### D. Calculul Scorului Compus (0–100)
- **Sub-scor 3M (pondere 40%)**:
  - Inversiune adâncă: 65 – 90 puncte.
  - Dezinversat recent (< 252 zile): 75 – 85 puncte în zona de ieșire critică.
  - Normal (> 25 bps fără istoric recent): scade spre 5 puncte.
- **Sub-scor 2Y (pondere 25%)**:
  - Inversat: 70 – 90 puncte.
  - Aplatizat: 20 – 35 puncte.
  - Normal: 5 – 20 puncte.
- **Sub-scor Steepening & Dezinversare (pondere 35%)**:
  - În `UNINVERSION_CRITICAL`: Bază 80 + bonus viteză de steepening (`delta_20d * 0.3`, până la +15) + bonus de 5 puncte pentru `BULL_STEEPENER` (atingând până la 100 puncte).
  - În `INVERTED`: 50 – 80 puncte în funcție de convergența spre zero.
  - În `FLATTENING`: 30 – 50 puncte.
  - În `NORMAL`: 10 puncte.

### E. Cache, Mutex și Alertare (`macroService.ts`)
- **Single-flight Promise Mutex**: Oricâte apeluri paralele sosesc simultan pe durata expirării cache-ului, doar o singură cerere HTTP către FRED este executată, restul așteptând rezultatul aceleiași promisiuni.
- **Toleranță la căderi (Fallback)**: Dacă FRED dă timeout sau eroare, serviciul servește automat cache-ul in-memory existent sau ultimul snapshot salvat pe disc în `backend/data/recession-cache.json`.
- **Alertare tranziții**: La schimbarea regimului sau la depășirea pragului critic de scor (≥ 70), se generează alerte în log și opțional pe webhook-ul Discord configurat (`DISCORD_WEBHOOK_URL`).

---

## 4. Endpoint-uri REST Expuse

### `GET /api/macro/yield-curve/status`
Parametri opționali de query:
- `refresh=true`: Forțează re-fetch din FRED ignorând TTL-ul cache-ului.
- `days=30`: Numărul de observații returnate în matricea `history`.

**Exemplu răspuns JSON:**
```json
{
  "score": 13,
  "regime": "NORMAL",
  "regimeNumber": 0,
  "regimeLabel": "Normal (Condiții Standard)",
  "description": "Curba are o pantă sănătoasă (> 25 bps) fără inversiuni în ultimele 180 de zile. Risc minim de recesiune.",
  "current": {
    "date": "2026-11-19",
    "t10y2y_bps": 28,
    "t10y3m_bps": 70,
    "sma5_10y2y": 28.2,
    "sma5_10y3m": 76.2,
    "delta_20d_10y3m": -18,
    "delta_60d_10y3m": -13,
    "is_inverted_2y": false,
    "is_inverted_3m": false,
    "days_since_last_inversion_2y": null,
    "days_since_last_inversion_3m": 273,
    "steepening_type": "NEUTRAL"
  },
  "components": {
    "score3m": 11,
    "score2y": 19,
    "scoreSteepening": 10,
    "weight3m": 0.4,
    "weight2y": 0.25,
    "weightSteepening": 0.35
  },
  "history": [ ... ],
  "lastUpdated": "2026-11-20T18:44:06.123Z",
  "cached": false
}
```

### `POST /api/macro/yield-curve/refresh`
Recalculează imediat datele și reîmprospătează snapshot-ul.

---

## 5. Implementarea Interfeței Mobile (React Native / Expo)

1. **Tab Navigation (`mobile/App.tsx`)**:
   - Selectorul conține acum trei opțiuni:
     - 💶 **Curs**
     - 📈 **RSI**
     - 📉 **Recesiune**
   - Tab-ul activ este salvat și persistat în `AsyncStorage` / `localStorage`.
2. **Hook dedicat (`mobile/src/hooks/useYieldCurve.ts`)**:
   - Gestionează descărcarea asincronă, stările de `isLoading`, `isRefreshing`, erori și pull-to-refresh.
3. **Ecran dedicat (`mobile/src/screens/RecessionScreen.tsx`)**:
   - **Score Card & Progres Bar**: Scor vizibil de la 0 la 100, codat pe culori:
     - `0 – 25`: Verde (Risc Minim)
     - `25 – 50`: Galben (Risc Moderat / Aplatizare)
     - `50 – 70`: Portocaliu (Avertizare Activă / Inversare)
     - `70 – 100`: Roșu (Critic / Risc Iminent de Recesiune)
   - **Regime Banner**: Evidențiază regimul activ și consecințele macroeconomice.
   - **Grid KPI**: Spread 10Y–3M, Spread 10Y–2Y, SMA5, viteza de steepening pe 20 și 60 de zile, numărul de zile de la ultima inversare și nivelul ratelor de bază.
   - **Indicator Steepening**: Afișează dacă curba se accentuează prin *Bull Steepener* 🐂 (tăieri Fed) sau *Bear Steepener* 🐻.
   - **Descompunerea Ponderilor**: 40% 10Y-3M, 25% 10Y-2Y, 35% Steepening.
   - **Tabel Istoric**: Ultimele 10 sesiuni de tranzacționare raportate de FRED.
   - **Card Educațional Quant**: Explică rolul dezinversării ca semnal principal de recesiune.
   - Compatibilitate automată cu modurile **Dark** și **Light** prin `ThemeContext`.

---

## 6. Testare & Verificare

- **Backend tests (`npm test`)**: 16 teste trecute cu succes (0 erori), acoperind parsarea CSV, ferestrele mobile, tranzițiile de regim, ponderile compuse și comportamentul de cache cu TTL.
- **Mobile typecheck (`npm run typecheck`)**: Compilare TypeScript fără erori pe toate componentele și hook-urile noi.
