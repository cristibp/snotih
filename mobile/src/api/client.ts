import { ExchangeRates, HistoryEntry, MonthlyStat } from './types';

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
