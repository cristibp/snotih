import axios from 'axios';
import { watchlistConfig } from '../config/watchlistConfig';

interface PriceEarnings {
  peRatio: number | null;
  peRatioAsOf?: string;
}

interface CacheEntry {
  data: PriceEarnings;
  expiresAt: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<PriceEarnings>>();

export function resetFundamentalsCache(): void {
  cache.clear();
}

/** Latest reported trailing P/E, cached independently of live prices. */
export async function getPriceEarnings(symbol: string): Promise<PriceEarnings> {
  const cleanSym = symbol.trim().toUpperCase();
  if (!cleanSym || cleanSym.startsWith('^') || cleanSym.includes('=')) {
    return { peRatio: null };
  }

  const cached = cache.get(cleanSym);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const inFlight = pending.get(cleanSym);
  if (inFlight) return inFlight;

  const request = fetchPriceEarnings(cleanSym, cached?.data);
  pending.set(cleanSym, request);
  try {
    return await request;
  } finally {
    pending.delete(cleanSym);
  }
}

async function fetchPriceEarnings(symbol: string, previous?: PriceEarnings): Promise<PriceEarnings> {
  try {
    const now = Date.now();
    const response = await axios.get(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`,
      {
        params: {
          type: 'trailingPeRatio',
          period1: Math.floor(now / 1000) - 366 * 86400,
          period2: Math.floor(now / 1000),
        },
        timeout: watchlistConfig.httpTimeoutMs,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      }
    );

    const series = response.data?.timeseries;
    if (series?.error || !Array.isArray(series?.result)) {
      throw new Error('Invalid fundamentals response');
    }

    const today = new Date(now).toISOString().slice(0, 10);
    const observations = series.result.flatMap((entry: { trailingPeRatio?: unknown }) =>
      Array.isArray(entry?.trailingPeRatio) ? entry.trailingPeRatio : []
    );
    // Select the latest date before checking the value: a loss-making company
    // must not inherit a positive P/E from an older reporting period.
    const latest = observations
      .filter((entry: any) =>
        typeof entry?.asOfDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.asOfDate) &&
        entry.asOfDate <= today
      )
      .sort((a: any, b: any) => b.asOfDate.localeCompare(a.asOfDate))[0];
    const raw = latest?.reportedValue?.raw;
    const data: PriceEarnings = {
      peRatio: typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null,
      ...(latest ? { peRatioAsOf: latest.asOfDate } : {}),
    };
    cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    // Fundamentals outages must not turn a valid live quote into an error.
    const data = previous ?? { peRatio: null };
    cache.set(symbol, { data, expiresAt: Date.now() + RETRY_TTL_MS });
    return data;
  }
}
