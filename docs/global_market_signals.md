# 🌐 Plan de Implementare și Documentație — Semnale Piețe Globale (Global Market Signals)

Documentație tehnică și de arhitectură pentru modulul **Global Market Signals** (Futures SUA, Japonia & Curs Valutar USD/JPY), cu evaluare de impact (Pozitiv / Neutru / Negativ), pagină dedicată în aplicația mobilă și alertare automată pe Discord la ora 08:00 (ora României).

---

## 1. Obiectiv și Prezentare Generală

Modulul monitorizează și analizează în timp real **8 indicatori-cheie ai piețelor financiare internaționale** înainte de deschiderea burselor europene și înainte de ședința oficială BNR:
1. **S&P 500 Futures (ES / ES=F)**
2. **Nasdaq 100 Futures (NQ / NQ=F)**
3. **Dow Jones Futures (YM / YM=F)**
4. **Nikkei 225 Futures pe CME (NKD / NKD=F)**
5. **Nikkei 225 Futures pe Osaka/JPX (1321.T)**
6. **TOPIX Futures / Indice Larg (1306.T)**
7. **Bursa din Tokyo / TSE Spot (^N225)**
8. **Cursul USD/JPY (JPY=X)**

Modulul determină **impactul direcțional** (Pozitiv / Neutru / Negativ) asupra sentimentului global de risc (*Risk-On* vs. *Risk-Off*), impactul asupra piețelor emergente (EM) și presiunea exercitată asupra leului românesc (RON), prezentând datele într-un ecran dedicat în aplicația mobilă și trimițând automat un raport matinal pe canalul `#trading` la ora **08:00**.

---

## 2. Ce Înseamnă Fiecare Impact (Pozitiv, Neutru, Negativ)

Fiecare indicator este evaluat în raport cu modul în care mișcarea sa afectează **apetitul global pentru risc (Risk-On / Risk-Off)** și, prin extensie, **piețele emergente și leul românesc (RON)**:

| Indicator | Simbol | Orar (ora RO) | 🟢 POZITIV (Risk-On) | ⚪ NEUTRU (Echilibru) | 🔴 NEGATIV (Risk-Off) |
|---|---|---|---|---|---|
| **S&P 500 Futures** | `ES=F` | Luni 01:00 → Vineri 23:00 (CME Globex) | Variație `> +0.25%`. Indică optimism la deschiderea Wall Street; capitalul curge spre active de risc (inclusiv EM & RON). | Variație între `-0.25%` și `+0.25%`. Consolidare, fără efect direcțional. | Variație `< -0.25%`. Prudență/panică pe piața americană; retragere de capital din active de risc (presiune pe RON). |
| **Nasdaq 100 Futures** | `NQ=F` | Luni 01:00 → Vineri 23:00 (CME Globex) | Sectorul tech și companiile de creștere cresc; semnal de apetit speculativ ridicat la nivel mondial. | Piața tech evoluează în interval restrâns. | Corecție în sectorul tech; duce frecvent la rotații defensive spre numerar/obligațiuni. |
| **Dow Jones Futures** | `YM=F` | Luni 01:00 → Vineri 23:00 (CME Globex) | Companiile industriale și economia clasică performează; sănătate ciclică solidă. | Fără mișcări semnificative. | Slăbiciune în sectoarele economice consacrate americane. |
| **Nikkei 225 CME Futures** | `NKD=F` | 01:00 → (CME Globex, USD/JPY) | Primul semnal nocturn: investitorii globali cumpără Japonia; deschidere asiatică optimistă. | Stabilitate înainte de deschiderea Tokyo. | Semnal timpuriu de scădere în Asia, cu efect de cascadă spre Europa. |
| **Nikkei 225 Osaka Futures** | `1321.T` | 01:45 → (Osaka Exchange, JPX) | Futures locale pe JPX pornesc pe plus cu 15 min înainte de deschiderea spot; investitorii locali confirmă direcția pozitivă. | Deschidere neutră pe piața futures locală. | Presiune la vânzare pe contractele locale din Japonia. |
| **TOPIX Futures / Indice Larg** | `1306.T` | 02:00 – 08:30 (JPX) | Creșterea este pe bază largă (cuprinde cele ~2000 companii, nu doar giganții din Nikkei). | Piața largă fără direcție. | Slăbiciune generalizată pe întreaga economie niponă. |
| **Bursa din Tokyo TSE Spot** | `^N225` | 02:00 – 08:30 (Pauză 04:30–05:30) | Sesiunea oficială spot închide pe verde; setează tonul de creștere pentru deschiderea burselor europene de la 10:00 (ora RO). | Piața spot oscilează în jurul cotației de deschidere. | Scăderi pe piața spot la Tokyo; deschiderea europeană preia frecvent tendința negativă. |
| **Cursul USD/JPY** | `JPY=X` | Duminică ~00:00 → Vineri 23:00 | **USD/JPY crește** (yen mai slab): carry-trade activ, investitorii vând yeni pentru active de randament mai mare; favorabil EM. | USD/JPY stabil. | **USD/JPY scade** (yen mai puternic): *flight-to-safety*, yenul e căutat ca monedă de refugiu; aversiune la risc pe piețele globale. |

---

## 3. Arhitectura Tehnică

```
┌────────────────────────────────────────────────────────┐
│             Yahoo Finance & Finnhub APIs               │
│   (ES=F, NQ=F, YM=F, NKD=F, 1321.T, 1306.T, ^N225, JPY=X)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│        globalSignalsService.ts (Backend)               │
│  - evaluateGlobalSignals()                             │
│  - Scoring agregat (US 45%, JP Fut 20%, JP Spot 15%, FX 20%) │
│  - Evaluare calitativă & generare concluzii narative   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐
│   Node.js Scheduler    │      │ Express API Endpoints  │
│   (08:00 București)    │      │ GET /api/global-signals│
│  Automat pe Discord    │      │ POST /api/global-signals/discord │
│      (#trading)        │      │ GET /api/cron/global-signals │
└────────────────────────┘      └────────────┬───────────┘
                                             │
                                             ▼
                                ┌────────────────────────┐
                                │ Mobile / Web Frontend  │
                                │   Tab: "🌐 Piețe"      │
                                │  GlobalSignalsScreen   │
                                └────────────────────────┘
```

---

## 4. Algoritmul de Scoring și Ponderile Categoriilor

### 4.1 Praguri de Decizie
- **Futures & Indici:**
  - `changePercent >= +0.25%` ➔ **🟢 POZITIV**
  - `changePercent <= -0.25%` ➔ **🔴 NEGATIV**
  - Altfel ➔ **⚪ NEUTRU**
  - La variații peste `±1.00%` scorul este maximizat la `±1.0`.
- **Forex (USD/JPY):**
  - `changePercent >= +0.15%` ➔ **🟢 POZITIV** (yen slab / carry-trade activ)
  - `changePercent <= -0.15%` ➔ **🔴 NEGATIV** (yen puternic / refugiu defensiv)
  - Altfel ➔ **⚪ NEUTRU**

### 4.2 Ponderile Categoriilor în Scorul Global
$$\text{Scor Global} = 0.45 \times \text{Scor}_{\text{US Futures}} + 0.20 \times \text{Scor}_{\text{JP Futures}} + 0.15 \times \text{Scor}_{\text{JP Spot}} + 0.20 \times \text{Scor}_{\text{USD/JPY}}$$

- $\text{Scor} > +0.15$: **Risk-On (Pozitiv)**
- $\text{Scor} < -0.15$: **Risk-Off (Negativ)**
- $-0.15 \le \text{Scor} \le +0.15$: **Echilibru / Neutru**

---

## 5. Automatizarea Trimiterii pe Discord (#trading) la Ora 08:00

1. **Scheduler Intern (Node.js):**
   - Funcția `startGlobalSignalsScheduler()` verifică ora la fiecare 25 de secunde conform fusului orar al României (`Europe/Bucharest`).
   - La `08:00` dimineața trimite automat notificarea completă către canalul `#trading` folosind `DISCORD_TRADING_WEBHOOK_URL`.
2. **Endpoint-uri Cron Externe:**
   - `GET /api/cron/global-signals?secret=...` permite apelarea dintr-un cron extern (ex. Cron-Job.org sau Render Cron Job).
   - `POST /api/trigger-global-signals-webhook` permite declanșarea manuală oricând din interfață sau teste.

---

## 6. Fișiere Modificate și Create

| Componentă | Cale Fișier | Rol |
|---|---|---|
| **Backend Service** | `backend/src/services/globalSignalsService.ts` | Preluare date, evaluare impact, formatare Discord, scheduler 08:00 |
| **Backend Types** | `backend/src/types.ts` | Interfețe TypeScript (`GlobalMarketSignal`, `GlobalSignalsResult` etc.) |
| **Backend API** | `backend/src/index.ts` | Rute `/api/global-signals`, pornire automată scheduler în `app.listen` |
| **Mobile Types** | `mobile/src/api/types.ts` | Mirror tipuri TypeScript pentru aplicația mobilă |
| **Mobile API Client** | `mobile/src/api/client.ts` | Funcțiile `fetchGlobalSignals()` și `triggerGlobalSignalsDiscordAlert()` |
| **Mobile Hook** | `mobile/src/hooks/useGlobalSignals.ts` | State management, auto-reload, reîmprospătare și declanșare Discord |
| **Mobile Screen** | `mobile/src/screens/GlobalSignalsScreen.tsx` | Ecran dedicat complet cu Hero Banner, carduri de instrumente și legendă |
| **Mobile Navigation** | `mobile/App.tsx` | Adăugarea tab-ului `🌐 Piețe` în bara de navigație și comutatorul principal |
| **Mobile Theme** | `mobile/src/theme/colors.ts` | Ajustări de paletă de culori compatibile cu Dark/Light theme |

---

## 7. Verificare și Testare

- Compilare backend: `npm run build` (fără erori TypeScript).
- Teste backend: `npm test` (20/20 teste trecute cu succes).
- Validare tipuri mobile: `npx tsc --noEmit` (0 erori).
- Toate cele 8 simboluri returnează date live valide.
