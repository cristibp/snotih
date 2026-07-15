import axios from 'axios';

/**
 * Preia cursul EUR/USD de la Frankfurter.app - un API gratuit, fara autentificare,
 * bazat pe datele Bancii Centrale Europene.
 * Alternativa: Yahoo Finance (necesita un endpoint neoficial si e mai putin stabil).
 */
export async function fetchEurUsd(): Promise<number> {
  const response = await axios.get('https://api.frankfurter.app/latest', {
    params: { from: 'EUR', to: 'USD' },
    timeout: 10000,
  });

  const rate = response.data?.rates?.USD;

  if (rate === undefined) {
    throw new Error('Cursul EUR/USD nu a fost gasit in raspunsul Frankfurter.app');
  }

  return parseFloat(rate);
}

export interface DatedUsdRate {
  /** YYYY-MM-DD */
  date: string;
  eurUsdYahoo: number;
}

/**
 * Preia cursurile EUR/USD pentru un interval de date (inclusiv), folosind
 * endpoint-ul de serie temporala al Frankfurter.app. Folosit pentru backfill.
 */
export async function fetchEurUsdRange(startDate: string, endDate: string): Promise<DatedUsdRate[]> {
  const response = await axios.get(`https://api.frankfurter.app/${startDate}..${endDate}`, {
    params: { from: 'EUR', to: 'USD' },
    timeout: 15000,
  });

  const ratesByDate = response.data?.rates as Record<string, { USD: number }> | undefined;

  if (!ratesByDate) {
    return [];
  }

  return Object.entries(ratesByDate)
    .map(([date, value]) => ({ date, eurUsdYahoo: value.USD }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
