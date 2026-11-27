import {
  ExchangeRates,
  HistoryEntry,
  MonthlyStat,
  RsiCheckResponse,
  RsiStatusResponse,
  RsiSymbolsConfig,
  AlertCheckResponse,
  AlertsStatusResponse,
  BnrPredictorResult,
  IntradayAverageResult,
  MoneyMarketData,
  YieldCurveStatusResponse,
  WatchlistSymbolMeta,
  MarketQuote,
  WatchlistQuotesResponse,
  WatchlistHistoryResponse,
  FavoriteList,
  FavoriteListsFile,
} from './types';

// Inlocuieste cu URL-ul real oferit de Render dupa deployment.
const API_BASE_URL = 'https://snoti.onrender.com';

export async function fetchLatestRates(): Promise<ExchangeRates> {
  const response = await fetch(`${API_BASE_URL}/api/rates`);

  if (!response.ok) {
    throw new Error(`Nu s-au putut obtine cursurile (status ${response.status})`);
  }

  return (await response.json()) as ExchangeRates;
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/history`);

  if (!response.ok) {
    throw new Error(`Nu s-a putut obtine istoricul (status ${response.status})`);
  }

  return (await response.json()) as HistoryEntry[];
}

export async function fetchMonthlyStats(): Promise<MonthlyStat[]> {
  const response = await fetch(`${API_BASE_URL}/api/stats`);

  if (!response.ok) {
    throw new Error(`Nu s-au putut obtine statisticile lunare (status ${response.status})`);
  }

  return (await response.json()) as MonthlyStat[];
}

export async function registerPushToken(token: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/register-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(`Inregistrarea token-ului a esuat (status ${response.status})`);
  }
}

/**
 * Preia configuratia curenta de simboluri (active, suprascrise, default).
 */
export async function fetchAlertSymbols(): Promise<RsiSymbolsConfig> {
  const response = await fetch(`${API_BASE_URL}/api/alerts/symbols`);

  if (!response.ok) {
    const fallback = await fetch(`${API_BASE_URL}/api/rsi/symbols`);
    if (!fallback.ok) {
      throw new Error(`Eroare la preluarea simbolurilor (status ${response.status})`);
    }
    return (await fallback.json()) as RsiSymbolsConfig;
  }

  return (await response.json()) as RsiSymbolsConfig;
}
export const fetchRsiSymbols = fetchAlertSymbols;

/**
 * Suprascrie lista de simboluri din frontend.
 */
export async function updateAlertSymbols(symbols: string[]): Promise<RsiSymbolsConfig> {
  let response = await fetch(`${API_BASE_URL}/api/alerts/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });

  if (!response.ok) {
    response = await fetch(`${API_BASE_URL}/api/rsi/symbols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    });
    if (!response.ok) {
      throw new Error(`Eroare la salvarea simbolurilor (status ${response.status})`);
    }
  }

  const data = await response.json();
  return data.config as RsiSymbolsConfig;
}
export const updateRsiSymbols = updateAlertSymbols;

/**
 * Reseteaza lista de simboluri la valorile default din variabilele de mediu.
 */
export async function resetAlertSymbols(): Promise<RsiSymbolsConfig> {
  let response = await fetch(`${API_BASE_URL}/api/alerts/symbols/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    response = await fetch(`${API_BASE_URL}/api/rsi/symbols/reset`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Eroare la resetarea simbolurilor (status ${response.status})`);
    }
  }

  const data = await response.json();
  return data.config as RsiSymbolsConfig;
}
export const resetRsiSymbols = resetAlertSymbols;

/**
 * Preia starea curenta a alertelor (RSI + VIX, fara notificari Discord).
 */
export async function fetchAlertsStatus(): Promise<AlertsStatusResponse> {
  let response = await fetch(`${API_BASE_URL}/api/alerts/status`);

  if (!response.ok) {
    response = await fetch(`${API_BASE_URL}/api/rsi/status`);
    if (!response.ok) {
      throw new Error(`Eroare la preluarea stării alertelor (status ${response.status})`);
    }
  }

  return (await response.json()) as AlertsStatusResponse;
}
export const fetchRsiStatus = fetchAlertsStatus;

/**
 * Declanșează verificarea alertelor (RSI + VIX) și trimiterea notificărilor Discord către #trading.
 */
export async function triggerAlertsCheck(webhookUrl?: string): Promise<AlertCheckResponse> {
  let response = await fetch(`${API_BASE_URL}/api/alerts/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
  });

  if (!response.ok) {
    response = await fetch(`${API_BASE_URL}/api/rsi/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
    });
    if (!response.ok) {
      throw new Error(`Eroare la rularea verificării de alerte (status ${response.status})`);
    }
  }

  return (await response.json()) as AlertCheckResponse;
}
export const triggerRsiCheck = triggerAlertsCheck;

/**
 * Preia predictia curenta pentru cursul BNR de la ora 13:00.
 */
export async function fetchPrediction(date?: string): Promise<BnrPredictorResult> {
  const url = date ? `${API_BASE_URL}/api/prediction?date=${encodeURIComponent(date)}` : `${API_BASE_URL}/api/prediction`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea predictiei (status ${response.status})`);
  }

  return (await response.json()) as BnrPredictorResult;
}

/**
 * Preia media sesiunii interbancare RON / EUR (13:00 precedent -> 09:00 azi).
 */
export async function fetchIntradayAverage(date?: string): Promise<IntradayAverageResult> {
  const url = date ? `${API_BASE_URL}/api/intraday-average?date=${encodeURIComponent(date)}` : `${API_BASE_URL}/api/intraday-average`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea mediei intraday (status ${response.status})`);
  }

  return (await response.json()) as IntradayAverageResult;
}

/**
 * Preia datele din piata monetara (ROBOR 3M, 6M, IRCC, lichiditate).
 */
export async function fetchMoneyMarket(): Promise<MoneyMarketData> {
  const response = await fetch(`${API_BASE_URL}/api/money-market`);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea datelor pietei monetare (status ${response.status})`);
  }

  return (await response.json()) as MoneyMarketData;
}

/**
 * Preia starea indicatorului compus de risc de recesiune (Recession Proximity Indicator).
 */
export async function fetchYieldCurveStatus(
  forceRefresh: boolean = false,
  days: number = 30
): Promise<YieldCurveStatusResponse> {
  const queryParams = new URLSearchParams();
  if (forceRefresh) queryParams.set('refresh', 'true');
  if (days) queryParams.set('days', days.toString());

  const url = `${API_BASE_URL}/api/macro/yield-curve/status?${queryParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea indicatorului de recesiune (status ${response.status})`);
  }

  return (await response.json()) as YieldCurveStatusResponse;
}

/**
 * Forteaza recalcularea si actualizarea indicatorului de recesiune pe server.
 */
export async function refreshYieldCurveStatus(days: number = 30): Promise<YieldCurveStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/macro/yield-curve/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });

  if (!response.ok) {
    throw new Error(`Eroare la actualizarea fortata a indicatorului de recesiune (status ${response.status})`);
  }

  return (await response.json()) as YieldCurveStatusResponse;
}

/**
 * Preluare catalog complet de simboluri din watchlist.csv.
 */
export async function fetchWatchlistSymbols(): Promise<WatchlistSymbolMeta[]> {
  const response = await fetch(`${API_BASE_URL}/api/watchlist/symbols`);
  if (!response.ok) {
    throw new Error(`Nu s-au putut prelua simbolurile watchlist (status ${response.status})`);
  }
  const data = await response.json();
  return data.symbols as WatchlistSymbolMeta[];
}

/**
 * Cauta actiuni, ETF-uri si indici online pentru adaugare in watchlist.
 */
export async function searchWatchlistSymbols(query: string): Promise<WatchlistSymbolMeta[]> {
  const clean = query.trim();
  if (!clean) return [];
  const response = await fetch(
    `${API_BASE_URL}/api/watchlist/search?q=${encodeURIComponent(clean)}`
  );
  if (!response.ok) {
    throw new Error(`Eroare la cautarea simbolurilor (status ${response.status})`);
  }
  const data = await response.json();
  return (data.symbols || []) as WatchlistSymbolMeta[];
}

/**
 * Preluare cotatii in timp real pentru o lista de simboluri (cu Finnhub primary + Yahoo fallback).
 */
export async function fetchWatchlistQuotes(
  symbols?: string[],
  forceRefresh: boolean = false
): Promise<WatchlistQuotesResponse> {
  const params: string[] = [];
  if (symbols && symbols.length > 0) {
    params.push(`symbols=${encodeURIComponent(symbols.join(','))}`);
  }
  if (forceRefresh) {
    params.push('refresh=true');
  }
  const queryParam = params.length > 0 ? `?${params.join('&')}` : '';
  const response = await fetch(`${API_BASE_URL}/api/watchlist/quotes${queryParam}`);
  if (!response.ok) {
    throw new Error(`Nu s-au putut prelua cotatiile watchlist (status ${response.status})`);
  }
  return (await response.json()) as WatchlistQuotesResponse;
}

/**
 * Preluare serii/lumanari istorice pentru graficul simbolului activ.
 */
export async function fetchWatchlistHistory(
  symbol: string,
  range: string = '1d',
  interval: string = '5m',
  forceRefresh: boolean = false,
  includeVolume: boolean = false
): Promise<WatchlistHistoryResponse> {
  const refreshParam = forceRefresh ? '&refresh=true' : '';
  const volumeParam = includeVolume ? '&includeVolume=true' : '';
  const response = await fetch(
    `${API_BASE_URL}/api/watchlist/history/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}${refreshParam}${volumeParam}`
  );
  if (!response.ok) {
    throw new Error(`Nu s-au putut prelua datele istorice pentru ${symbol} (status ${response.status})`);
  }
  return (await response.json()) as WatchlistHistoryResponse;
}

/**
 * Preia analiza si evaluarea semnalelor pietelor globale (Futures US & JP, TOPIX, USD/JPY).
 */
export async function fetchGlobalSignals(): Promise<import('./types').GlobalSignalsResult> {
  const response = await fetch(`${API_BASE_URL}/api/global-signals`);
  if (!response.ok) {
    throw new Error(`Eroare la preluarea semnalelor globale (status ${response.status})`);
  }
  return (await response.json()) as import('./types').GlobalSignalsResult;
}

/**
 * Declanșează trimiterea raportului semnalelor globale către canalul Discord #trading.
 */
export async function triggerGlobalSignalsDiscordAlert(webhookUrl?: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/trigger-global-signals-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
  });

  if (!response.ok) {
    throw new Error(`Trimiterea pe Discord a eșuat (status ${response.status})`);
  }
  return await response.json();
}

// ─── Multi-Favorite Lists (GitHub-backed) ───

/**
 * Preia toate listele de favorite.
 */
export async function fetchFavoriteLists(forceRefresh: boolean = false): Promise<FavoriteListsFile> {
  const query = forceRefresh ? '?refresh=true' : '';
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists${query}`);
  if (!response.ok) {
    throw new Error(`Eroare la preluarea listelor de favorite (status ${response.status})`);
  }
  return (await response.json()) as FavoriteListsFile;
}

/**
 * Preia o singura lista de favorite dupa ID.
 */
export async function fetchFavoriteList(listId: string): Promise<FavoriteList> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists/${encodeURIComponent(listId)}`);
  if (!response.ok) {
    throw new Error(`Eroare la preluarea listei "${listId}" (status ${response.status})`);
  }
  return (await response.json()) as FavoriteList;
}

/**
 * Creeaza o lista noua de favorite.
 */
export async function createFavoriteList(params: {
  name: string;
  symbols?: string[];
  icon?: string;
  color?: string;
}): Promise<FavoriteList> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Eroare la crearea listei (status ${response.status})`);
  }
  return (await response.json()) as FavoriteList;
}

/**
 * Actualizeaza o lista existenta (metadata si/sau simboluri).
 */
export async function updateFavoriteList(
  listId: string,
  patch: Partial<Pick<FavoriteList, 'name' | 'icon' | 'color' | 'symbols'>>
): Promise<FavoriteList> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists/${encodeURIComponent(listId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`Eroare la actualizarea listei "${listId}" (status ${response.status})`);
  }
  return (await response.json()) as FavoriteList;
}

/**
 * Sterge o lista de favorite.
 */
export async function deleteFavoriteList(listId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as any)?.error || `Eroare la stergerea listei (status ${response.status})`);
  }
}

/**
 * Adauga simboluri la o lista (fara duplicate).
 */
export async function addSymbolsToFavoriteList(listId: string, symbols: string[]): Promise<FavoriteList> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists/${encodeURIComponent(listId)}/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!response.ok) {
    throw new Error(`Eroare la adaugarea simbolurilor (status ${response.status})`);
  }
  return (await response.json()) as FavoriteList;
}

/**
 * Sterge simboluri dintr-o lista.
 */
export async function removeSymbolsFromFavoriteList(listId: string, symbols: string[]): Promise<FavoriteList> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/lists/${encodeURIComponent(listId)}/symbols`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!response.ok) {
    throw new Error(`Eroare la stergerea simbolurilor (status ${response.status})`);
  }
  return (await response.json()) as FavoriteList;
}

/**
 * Seteaza lista implicita.
 */
export async function setDefaultFavoriteList(listId: string): Promise<{ success: boolean; defaultListId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/favorites/default`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listId }),
  });
  if (!response.ok) {
    throw new Error(`Eroare la setarea listei implicite (status ${response.status})`);
  }
  return await response.json();
}

