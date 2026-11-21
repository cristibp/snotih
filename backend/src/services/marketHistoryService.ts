import axios from 'axios';
import { CandlePoint, WatchlistHistoryResponse } from '../types';
import { watchlistConfig } from '../config/watchlistConfig';

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

interface HistoryCacheEntry {
  data: WatchlistHistoryResponse;
  cachedAt: number;
}

const historyCache = new Map<string, HistoryCacheEntry>();

export function resetHistoryCache(): void {
  historyCache.clear();
}

/**
 * Obtine lumanarile / seria istorica pentru un simbol si interval dat.
 */
export async function fetchWatchlistCandles(
  symbol: string,
  range: string = '1d',
  interval: string = '5m'
): Promise<WatchlistHistoryResponse> {
  const cleanSym = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSym}_${range}_${interval}`;
  const now = Date.now();

  const cached = historyCache.get(cacheKey);
  if (cached && now - cached.cachedAt < watchlistConfig.historyCacheTtlMs) {
    return cached.data;
  }

  // Mapare intervale optime
  let resolvedRange = range;
  let resolvedInterval = interval;

  if (range === '1d') {
    resolvedInterval = '5m';
  } else if (range === '5d') {
    resolvedInterval = '15m';
  } else if (range === '1mo' || range === '1m') {
    resolvedRange = '1mo';
    resolvedInterval = '1d';
  } else if (range === '1y') {
    resolvedRange = '1y';
    resolvedInterval = '1d';
  } else if (range === 'all') {
    resolvedRange = '5y';
    resolvedInterval = '1wk';
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}?range=${resolvedRange}&interval=${resolvedInterval}`;

  try {
    const res = await axios.get(url, {
      timeout: watchlistConfig.httpTimeoutMs + 3000,
      headers: HTTP_HEADERS,
    });

    const result = res.data?.chart?.result?.[0];
    if (!result) {
      throw new Error(`Lipsesc date istorice pentru ${cleanSym}`);
    }

    const meta = result.meta || {};
    const timestamps = (result.timestamp as number[]) || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = (quote.open as (number | null)[]) || [];
    const highs = (quote.high as (number | null)[]) || [];
    const lows = (quote.low as (number | null)[]) || [];
    const closes = (quote.close as (number | null)[]) || [];
    const volumes = (quote.volume as (number | null)[]) || [];

    const candles: CandlePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i] * 1000;
      const c = closes[i];
      if (c == null || isNaN(c) || c <= 0) continue;

      const o = opens[i] != null && !isNaN(opens[i]!) ? opens[i]! : c;
      const h = highs[i] != null && !isNaN(highs[i]!) ? highs[i]! : Math.max(o, c);
      const l = lows[i] != null && !isNaN(lows[i]!) ? lows[i]! : Math.min(o, c);
      const v = volumes[i] != null && !isNaN(volumes[i]!) ? volumes[i]! : 0;

      candles.push({
        timestamp: ts,
        open: Number(o.toFixed(4)),
        high: Number(h.toFixed(4)),
        low: Number(l.toFixed(4)),
        close: Number(c.toFixed(4)),
        volume: v,
      });
    }

    const response: WatchlistHistoryResponse = {
      symbol: cleanSym,
      currency: meta.currency || (cleanSym.includes('.') ? 'EUR' : 'USD'),
      range: resolvedRange,
      interval: resolvedInterval,
      candles,
      previousClose: meta.chartPreviousClose ?? meta.previousClose,
    };

    historyCache.set(cacheKey, {
      data: response,
      cachedAt: now,
    });

    return response;
  } catch (err: any) {
    console.warn(`[marketHistoryService] Eroare la fetch candles pentru ${cleanSym}:`, err?.message || err);
    return {
      symbol: cleanSym,
      currency: cleanSym.includes('.') ? 'EUR' : 'USD',
      range: resolvedRange,
      interval: resolvedInterval,
      candles: [],
      previousClose: undefined,
    };
  }
}
