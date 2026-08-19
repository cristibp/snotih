import {
  ExchangeRates,
  HistoryEntry,
  MonthlyStat,
  RsiCheckResponse,
  RsiStatusResponse,
  RsiSymbolsConfig,
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
 * Preia configuratia curenta de simboluri RSI (active, suprascrise, default).
 */
export async function fetchRsiSymbols(): Promise<RsiSymbolsConfig> {
  const response = await fetch(`${API_BASE_URL}/api/rsi/symbols`);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea simbolurilor (status ${response.status})`);
  }

  return (await response.json()) as RsiSymbolsConfig;
}

/**
 * Suprascrie lista de simboluri RSI din frontend.
 */
export async function updateRsiSymbols(symbols: string[]): Promise<RsiSymbolsConfig> {
  const response = await fetch(`${API_BASE_URL}/api/rsi/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });

  if (!response.ok) {
    throw new Error(`Eroare la salvarea simbolurilor (status ${response.status})`);
  }

  const data = await response.json();
  return data.config as RsiSymbolsConfig;
}

/**
 * Reseteaza lista de simboluri la valorile default din variabilele de mediu.
 */
export async function resetRsiSymbols(): Promise<RsiSymbolsConfig> {
  const response = await fetch(`${API_BASE_URL}/api/rsi/symbols/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Eroare la resetarea simbolurilor (status ${response.status})`);
  }

  const data = await response.json();
  return data.config as RsiSymbolsConfig;
}

/**
 * Preia starea curenta a indicatorilor RSI pentru lista activa de simboluri (fara alerte Discord).
 */
export async function fetchRsiStatus(): Promise<RsiStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/rsi/status`);

  if (!response.ok) {
    throw new Error(`Eroare la preluarea valorilor RSI (status ${response.status})`);
  }

  return (await response.json()) as RsiStatusResponse;
}

/**
 * Declanșează verificarea RSI și trimiterea alertelor Discord către #trading.
 */
export async function triggerRsiCheck(webhookUrl?: string): Promise<RsiCheckResponse> {
  const url = `${API_BASE_URL}/api/rsi/check`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookUrl ? { webhookUrl } : {}),
  });

  if (!response.ok) {
    throw new Error(`Eroare la rularea verificarii RSI (status ${response.status})`);
  }

  return (await response.json()) as RsiCheckResponse;
}
