import axios from 'axios';
import { MarketQuote } from '../types';
import { watchlistConfig } from '../config/watchlistConfig';

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

interface CacheEntry {
  quote: MarketQuote;
  cachedAt: number;
}

// In-memory cache pentru cotatii
const quoteMemoryCache = new Map<string, CacheEntry>();

/**
 * Reseteaza cache-ul din memorie (util pentru teste)
 */
export function resetQuoteCache(): void {
  quoteMemoryCache.clear();
}

/**
 * Fetch cotatie prin Finnhub (sursa primara).
 */
export async function fetchFinnhubQuote(symbol: string): Promise<MarketQuote | null> {
  const apiKey = watchlistConfig.finnhubApiKey;
  if (!apiKey) {
    return null; // Finnhub API Key nu este configurat
  }

  const cleanSym = symbol.trim().toUpperCase();

  // Finnhub gratuit nu suporta indici cu ^ (ex: ^VVIX) sau contracte futures (=F)
  if (cleanSym.startsWith('^') || cleanSym.includes('=')) {
    return null;
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanSym)}&token=${encodeURIComponent(apiKey)}`;
    const res = await axios.get(url, {
      timeout: watchlistConfig.httpTimeoutMs,
      headers: HTTP_HEADERS,
    });

    const data = res.data;
    // Daca Finnhub returneaza c == 0 sau date vide (frecvent pentru ETF-uri europene pe cont free)
    if (!data || typeof data.c !== 'number' || data.c <= 0) {
      return null;
    }

    const price = data.c;
    const change = data.d ?? 0;
    const changePercent = data.dp ?? 0;
    const high = data.h ?? price;
    const low = data.l ?? price;
    const open = data.o ?? price;
    const previousClose = data.pc ?? price - change;
    const timestamp = data.t ? data.t * 1000 : Date.now();

    return {
      symbol: cleanSym,
      price,
      change,
      changePercent,
      high,
      low,
      open,
      previousClose,
      currency: cleanSym.includes('.DE') || cleanSym.includes('.AS') || cleanSym.includes('.PA') ? 'EUR' : 'USD',
      timestamp,
      source: 'finnhub',
    };
  } catch (err: any) {
    // In caz de 429 (rate limit), 403 sau timeout -> lasam fallback-ul pe Yahoo
    return null;
  }
}

/**
 * Fetch cotatie prin Yahoo Finance Chart API (sursa fallback).
 */
export async function fetchYahooQuote(symbol: string): Promise<MarketQuote | null> {
  const cleanSym = symbol.trim().toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSym)}?interval=1d&range=1d`;
    const res = await axios.get(url, {
      timeout: watchlistConfig.httpTimeoutMs + 2000,
      headers: HTTP_HEADERS,
    });

    const result = res.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const price = meta.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price) || price <= 0) {
      return null;
    }

    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
    const high = meta.regularMarketDayHigh ?? price;
    const low = meta.regularMarketDayLow ?? price;
    const open = meta.regularMarketDayOpen ?? price;
    const timestamp = meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now();
    const currency = meta.currency || (cleanSym.includes('.') ? 'EUR' : 'USD');
    const name = meta.shortName || meta.longName || cleanSym;

    return {
      symbol: cleanSym,
      name,
      price,
      change: Number(change.toFixed(4)),
      changePercent: Number(changePercent.toFixed(2)),
      high,
      low,
      open,
      previousClose,
      currency,
      timestamp,
      source: 'yahoo',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Obtine cotatia pentru un simbol cu caching si logica primar (Finnhub) -> fallback (Yahoo).
 */
export async function getQuoteForSymbol(symbol: string, forceRefresh: boolean = false): Promise<MarketQuote> {
  const cleanSym = symbol.trim().toUpperCase();
  const now = Date.now();

  // 1. Verificam cache-ul din memorie (daca nu s-a cerut refresh fortat)
  const cached = quoteMemoryCache.get(cleanSym);
  if (!forceRefresh && cached && now - cached.cachedAt < watchlistConfig.cacheTtlMs) {
    return {
      ...cached.quote,
      source: 'cached',
      cachedAt: cached.cachedAt,
    };
  }

  // 2. Incercam Finnhub (sursa primara)
  let quote = await fetchFinnhubQuote(cleanSym);

  // 3. Daca Finnhub a esuat, incercam Yahoo Finance (fallback)
  if (!quote) {
    quote = await fetchYahooQuote(cleanSym);
  }

  // 4. Daca am obtinut o cotatie valida, o salvam in cache
  if (quote) {
    quoteMemoryCache.set(cleanSym, {
      quote,
      cachedAt: now,
    });
    return quote;
  }

  // 5. Daca ambele au esuat, dar avem date vechi in cache, le returnam marcate ca stale
  if (cached) {
    return {
      ...cached.quote,
      source: 'cached',
      cachedAt: cached.cachedAt,
      stale: true,
    };
  }

  // 6. Altfel returnam obiect de eroare
  return {
    symbol: cleanSym,
    price: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    open: 0,
    previousClose: 0,
    currency: 'USD',
    timestamp: now,
    source: 'yahoo',
    error: 'Cotatie indisponibila',
  };
}

/**
 * Obtine cotatiile pentru o lista de simboluri in paralel.
 */
export async function getQuotesForSymbols(
  symbols: string[],
  forceRefresh: boolean = false
): Promise<Record<string, MarketQuote>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const results: Record<string, MarketQuote> = {};

  const quotePromises = uniqueSymbols.map(async (sym) => {
    try {
      const q = await getQuoteForSymbol(sym, forceRefresh);
      results[sym] = q;
    } catch (e) {
      results[sym] = {
        symbol: sym,
        price: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        currency: 'USD',
        timestamp: Date.now(),
        source: 'yahoo',
        error: 'Eroare la fetch cotatie',
      };
    }
  });

  await Promise.all(quotePromises);
  return results;
}
