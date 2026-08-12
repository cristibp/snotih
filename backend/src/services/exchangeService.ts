import axios from 'axios';
import { readRates, readHistory } from './rateStore';
import { fetchBnrEurUsd } from './bnrService';

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

/**
 * Preia cursul EUR/USD incercand mai multe surse in ordine:
 *  1. Frankfurter API direct (api.frankfurter.dev)
 *  2. Frankfurter API legacy (api.frankfurter.app)
 *  3. Open Exchange Rates API (open.er-api.com)
 *  4. Fawaz Ahmed Currency API CDN (cdn.jsdelivr.net)
 *  5. Calculat direct din XML BNR (EUR/RON / USD/RON)
 *  6. Cache-ul local din rateStore / history (fallback final)
 */
export async function fetchEurUsd(): Promise<number> {
  // 1. Frankfurter API direct
  try {
    const response = await axios.get('https://api.frankfurter.dev/v1/latest', {
      params: { from: 'EUR', to: 'USD' },
      timeout: 5000,
      headers: HTTP_HEADERS,
    });
    const rate = response.data?.rates?.USD;
    if (typeof rate === 'number' && !isNaN(rate)) {
      return rate;
    }
  } catch (err: any) {
    console.warn('[ExchangeService] Incercare 1 (api.frankfurter.dev) esuata:', err?.message || err);
  }

  // 2. Frankfurter API legacy
  try {
    const response = await axios.get('https://api.frankfurter.app/latest', {
      params: { from: 'EUR', to: 'USD' },
      timeout: 5000,
      headers: HTTP_HEADERS,
    });
    const rate = response.data?.rates?.USD;
    if (typeof rate === 'number' && !isNaN(rate)) {
      return rate;
    }
  } catch (err: any) {
    console.warn('[ExchangeService] Incercare 2 (api.frankfurter.app) esuata:', err?.message || err);
  }

  // 3. Open Exchange Rate API (open.er-api.com)
  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/EUR', {
      timeout: 5000,
      headers: HTTP_HEADERS,
    });
    const rate = response.data?.rates?.USD;
    if (typeof rate === 'number' && !isNaN(rate)) {
      return parseFloat(rate.toFixed(4));
    }
  } catch (err: any) {
    console.warn('[ExchangeService] Incercare 3 (open.er-api.com) esuata:', err?.message || err);
  }

  // 4. Fawaz Ahmed Currency API
  try {
    const response = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json', {
      timeout: 5000,
      headers: HTTP_HEADERS,
    });
    const rate = response.data?.eur?.usd;
    if (typeof rate === 'number' && !isNaN(rate)) {
      return parseFloat(rate.toFixed(4));
    }
  } catch (err: any) {
    console.warn('[ExchangeService] Incercare 4 (currency-api) esuata:', err?.message || err);
  }

  // 5. Calculat din BNR XML (EUR/RON / USD/RON)
  try {
    const bnrCalculated = await fetchBnrEurUsd();
    if (bnrCalculated && !isNaN(bnrCalculated)) {
      console.log('[ExchangeService] Curs EUR/USD obținut din calcul BNR XML:', bnrCalculated);
      return bnrCalculated;
    }
  } catch (err: any) {
    console.warn('[ExchangeService] Incercare 5 (BNR EUR/USD) esuata:', err?.message || err);
  }

  // 6. Cache local (rateStore / history)
  const cachedRates = readRates();
  if (cachedRates?.eurUsdYahoo) {
    console.warn('[ExchangeService] Toate API-urile externe au esuat. Se foloseste valoarea din cache:', cachedRates.eurUsdYahoo);
    return cachedRates.eurUsdYahoo;
  }

  const history = readHistory();
  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    if (lastEntry.eurUsdYahoo) {
      console.warn('[ExchangeService] Se foloseste valoarea din ultimul istoric:', lastEntry.eurUsdYahoo);
      return lastEntry.eurUsdYahoo;
    }
  }

  throw new Error('Cursul EUR/USD nu a putut fi preluat din nicio sursa externa si nici din cache-ul local.');
}

export interface DatedUsdRate {
  /** YYYY-MM-DD */
  date: string;
  eurUsdYahoo: number;
}

/**
 * Preia cursurile EUR/USD pentru un interval de date (inclusiv), incercand endpoint-urile Frankfurter.
 */
export async function fetchEurUsdRange(startDate: string, endDate: string): Promise<DatedUsdRate[]> {
  const urls = [
    `https://api.frankfurter.dev/v1/${startDate}..${endDate}`,
    `https://api.frankfurter.app/${startDate}..${endDate}`,
  ];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        params: { from: 'EUR', to: 'USD' },
        timeout: 10000,
        headers: HTTP_HEADERS,
      });

      const ratesByDate = response.data?.rates as Record<string, { USD: number }> | undefined;
      if (ratesByDate) {
        return Object.entries(ratesByDate)
          .map(([date, value]) => ({ date, eurUsdYahoo: value.USD }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch (err: any) {
      console.warn(`[ExchangeService] Fetch range ${startDate}..${endDate} de la ${url} a esuat:`, err?.message || err);
    }
  }

  return [];
}
