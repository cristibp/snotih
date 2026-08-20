# Implementation Plan: Trading RSI Monitoring, Tiered Discord Alerts, and Frontend Watchlist Management

## Overview
Implement an automated RSI (Relative Strength Index) tracking and alert system for a configured list of ETF symbols (defaulting to `WEBN` and `IWDA`), with multi-tier alerts sent to a dedicated Discord `#trading` channel based on RSI thresholds:
- **🔵 Blue**: RSI $\le 40$ (Approaching Oversold / Watch)
- **🟠 Orange**: RSI $\le 35$ (Significantly Oversold)
- **🔴 Red**: RSI $\le 30$ (Critically Oversold)

The symbols list will be configured via environment variables in `.env` (`DEFAULT_RSI_SYMBOLS`), and can be viewed and overridden in a dedicated frontend page/screen, which persists overrides on the backend.

---

## User Review Required

> [!IMPORTANT]
> - Default ETF symbols: `WEBN.DE` and `IWDA.AS` (with smart symbol resolver that automatically handles unadorned `WEBN` and `IWDA`).
> - Discord `#trading` webhook URL will be configured via environment variable `TRADING_WEBHOOK_URL` in `backend/.env`.
> - All RSI alerts are sent to the `#trading` webhook with corresponding Discord embed colors:
>   - RSI $\le 30$: Red (`#EF4444` / `0xEF4444`)
>   - RSI $\le 35$: Orange (`#F97316` / `0xF97316`)
>   - RSI $\le 40$: Blue (`#3B82F6` / `0x3B82F6`)

---

## Proposed Changes

### Backend (`backend/`)

#### [NEW] [rsiService.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/services/rsiService.ts)
- Implement Yahoo Finance daily historical price fetcher for arbitrary symbols/ETFs with smart suffix fallback (`.DE`, `.AS`, `.L`, `.PA`).
- Implement 14-period Wilder's RSI calculation algorithm on historical closes.
- Implement threshold evaluator:
  - RSI $\le 30 \implies$ level `red`, color `0xEF4444`
  - RSI $\le 35 \implies$ level `orange`, color `0xF97316`
  - RSI $\le 40 \implies$ level `blue`, color `0x3B82F6`
  - RSI $> 40 \implies$ level `none` (no alert)
- Implement Discord notification sender targeting the `#trading` webhook with custom embed formatting matching the color tier.

#### [NEW] [rsiStore.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/services/rsiStore.ts)
- Persist custom symbol list overrides in `backend/data/rsiSymbols.json`.
- Manage reading and writing overridden symbols vs fallback to `process.env.DEFAULT_RSI_SYMBOLS || 'WEBN.DE,IWDA.AS'`.
- Provide functions: `getActiveSymbols()`, `saveOverriddenSymbols(symbols)`, `resetToEnvSymbols()`.

#### [MODIFY] [types.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/types.ts)
- Add types for RSI check results, threshold levels (`'blue' | 'orange' | 'red' | 'none'`), symbol config, and alert payload.

#### [MODIFY] [index.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/src/index.ts)
- Add new endpoints:
  - `GET /api/rsi/check`: Checks RSI for all active symbols, triggers Discord notifications for symbols reaching $\le 40$, returns results with current values, RSI, and alert statuses.
  - `GET /api/rsi/symbols`: Returns active symbols, whether they are overridden, and default env symbols.
  - `POST /api/rsi/symbols`: Overrides active symbols list from frontend.
  - `POST /api/rsi/symbols/reset`: Resets active symbols to environment variable defaults.
  - `GET /api/rsi/status`: Returns current RSI and prices without sending Discord alerts (for frontend live display).

#### [MODIFY] [.env.example](file:///Users/cristianbatusel/IdeaProjects/snotih/backend/.env.example)
- Add `DEFAULT_RSI_SYMBOLS=WEBN.DE,IWDA.AS`
- Add `TRADING_WEBHOOK_URL=https://discord.com/api/webhooks/...`

---

### Frontend (`mobile/`)

#### [NEW] [TradingScreen.tsx](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/screens/TradingScreen.tsx)
- Modern, clean screen for RSI tracking & symbol management:
  - **Live Watchlist**: Cards for each tracked ETF showing symbol name, current price, RSI-14 value, badge indicator (🔵 Blue $\le 40$, 🟠 Orange $\le 35$, 🔴 Red $\le 30$, 🟢 Neutral $> 40$).
  - **Symbols Configuration & Override**:
    - Manage watchlist symbols (add symbol, delete symbol, view current source: ENV vs Overridden).
    - Save changes to backend.
    - "Reset to ENV Defaults" button.
  - **Manual Trigger**: "Verifică RSI & Trimite Alerte Discord" button to run immediate check and notify `#trading`.
  - **Visual Legend**: Explains color thresholds and oversold levels.

#### [MODIFY] [App.tsx](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/App.tsx)
- Add clean top Navigation / Tab selector between:
  - 💶 **Curs Valutar** (`HomeScreen`)
  - 📈 **Trading (RSI)** (`TradingScreen`)

#### [MODIFY] [client.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/api/client.ts) & [types.ts](file:///Users/cristianbatusel/IdeaProjects/snotih/mobile/src/api/types.ts)
- Add API client methods for RSI status, check/trigger, getting symbols, updating symbols, and resetting symbols.

---

## Verification Plan

### Automated Tests & Type Checks
- Run TypeScript compiler checks in both `backend` and `mobile`:
  ```bash
  cd /Users/cristianbatusel/IdeaProjects/snotih/backend && npm run build
  cd /Users/cristianbatusel/IdeaProjects/snotih/mobile && npm run typecheck
  ```
- Run integration tests on endpoints:
  - `GET /api/rsi/symbols`
  - `POST /api/rsi/symbols`
  - `GET /api/rsi/check` (verify RSI calculation accuracy and Discord payload formatting)
  - `POST /api/rsi/symbols/reset`

### Manual Verification
- Test symbol resolution for `WEBN`, `IWDA`, `WEBN.DE`, `IWDA.AS`.
- Verify RSI calculation with real Yahoo Finance chart data.
- Verify Discord alert payload structure (embed color, fields, values).
- Test frontend tab switching, live RSI cards, symbol override editing and resetting in the browser/mobile view.
