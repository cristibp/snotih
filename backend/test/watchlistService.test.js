const assert = require('node:assert/strict');
const { test } = require('node:test');
const axios = require('axios');
const { parseWatchlistCsv, loadWatchlistSymbols } = require('../dist/services/watchlistCsvLoader');
const {
  getQuoteForSymbol,
  getQuotesForSymbols,
  resetQuoteCache,
  searchMarketSymbols,
  resetSearchCache,
} = require('../dist/services/marketQuoteService');
const {
  fetchWatchlistCandles,
  resetHistoryCache,
} = require('../dist/services/marketHistoryService');

test('parseWatchlistCsv correctly extracts symbols from Yahoo Finance CSV export and plain tickers', () => {
  const sampleCsv = `Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume
# Comment line
EMIM.AS,40.95,2026/11/20,17:36 CET,-2.084999,41.825,41.99,41.025,102630
^VVIX,138.03,2026/11/20,16:15 EST,19.659996,128.39,146.55,118.94,0
aapl,228.50,2026/11/20,16:00 EST,2.50,226.00,229.00,225.50,50000000

// Another comment
LNK=F,8.5,2026/11/20,16:58 EST,0.18,8.955,8.97,8.295,18
DLR
DLR
`;
  const result = parseWatchlistCsv(sampleCsv);
  assert.equal(result.length, 5); // EMIM.AS, ^VVIX, AAPL, LNK=F, DLR (deduplicated)
  assert.equal(result[0].symbol, 'EMIM.AS');
  assert.equal(result[0].category, 'ETF');
  assert.equal(result[1].symbol, '^VVIX');
  assert.equal(result[1].category, 'Index');
  assert.equal(result[2].symbol, 'AAPL');
  assert.equal(result[2].category, 'Stock');
  assert.equal(result[3].symbol, 'LNK=F');
  assert.equal(result[3].category, 'Future');
  assert.equal(result[4].symbol, 'DLR');
});

test('loadWatchlistSymbols loads real watchlist.csv from disk', () => {
  const symbols = loadWatchlistSymbols();
  assert.ok(symbols.length > 50, `Expected > 50 symbols, got ${symbols.length}`);
  const symbolsSet = new Set(symbols.map((s) => s.symbol));
  assert.ok(symbolsSet.has('EMIM.AS'), 'Must contain EMIM.AS');
  assert.ok(symbolsSet.has('VWCE.DE'), 'Must contain VWCE.DE');
  assert.ok(symbolsSet.has('DLR'), 'Must contain plain symbol DLR');
});

test('marketQuoteService caches results in memory', async () => {
  resetQuoteCache();

  // Test caching logic by requesting a real quote or fallback
  const quote1 = await getQuoteForSymbol('AAPL');
  assert.ok(quote1);
  assert.equal(quote1.symbol, 'AAPL');

  // Second call must return from cache
  const quote2 = await getQuoteForSymbol('AAPL');
  assert.equal(quote2.source, 'cached');
  assert.equal(quote2.symbol, 'AAPL');
  assert.equal(quote2.price, quote1.price);
});

test('forceRefresh bypasses memory cache for quotes and history', async () => {
  resetQuoteCache();
  resetHistoryCache();

  const originalAxiosGet = axios.get;
  let quoteCallCount = 0;
  let historyCallCount = 0;

  axios.get = async (url) => {
    if (url.includes('range=1d&interval=1d') || url.includes('interval=1d&range=1d')) {
      quoteCallCount += 1;
      const price = quoteCallCount === 1 ? 150 : 152.5;
      return {
        data: {
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: price,
                  chartPreviousClose: 148,
                  regularMarketDayHigh: 153,
                  regularMarketDayLow: 149,
                  regularMarketDayOpen: 149.5,
                  regularMarketTime: 1700000000,
                  currency: 'USD',
                  shortName: 'Test Corp',
                },
              },
            ],
          },
        },
      };
    }

    historyCallCount += 1;
    const closePrice = historyCallCount === 1 ? 150 : 152.5;
    return {
      data: {
        chart: {
          result: [
            {
              meta: { currency: 'USD', chartPreviousClose: 148 },
              timestamp: [1700000000, 1700000300],
              indicators: {
                quote: [
                  {
                    open: [149, 150],
                    high: [151, closePrice],
                    low: [148.5, 149.5],
                    close: [150, closePrice],
                    volume: [1000, 1200],
                  },
                ],
              },
            },
          ],
        },
      },
    };
  };

  try {
    const q1 = await getQuoteForSymbol('TEST');
    assert.equal(q1.price, 150);
    assert.equal(q1.source, 'yahoo');

    const qCached = await getQuoteForSymbol('TEST');
    assert.equal(qCached.source, 'cached');
    assert.equal(qCached.price, 150);
    assert.equal(quoteCallCount, 1);

    const qForced = await getQuoteForSymbol('TEST', true);
    assert.equal(qForced.source, 'yahoo');
    assert.equal(qForced.price, 152.5);
    assert.equal(quoteCallCount, 2);

    const h1 = await fetchWatchlistCandles('TEST', '1d', '5m');
    assert.equal(h1.candles[1].close, 150);
    assert.equal(historyCallCount, 1);

    const hCached = await fetchWatchlistCandles('TEST', '1d', '5m');
    assert.equal(hCached.candles[1].close, 150);
    assert.equal(historyCallCount, 1);

    const hForced = await fetchWatchlistCandles('TEST', '1d', '5m', true);
    assert.equal(hForced.candles[1].close, 152.5);
    assert.equal(historyCallCount, 2);
  } finally {
    axios.get = originalAxiosGet;
    resetQuoteCache();
    resetHistoryCache();
  }
});

test('marketQuoteService fallback to Yahoo works for European tickers (e.g. VWCE.DE)', async () => {
  resetQuoteCache();
  const quote = await getQuoteForSymbol('VWCE.DE');
  assert.ok(quote);
  assert.equal(quote.symbol, 'VWCE.DE');
  assert.ok(quote.price > 0, `Expected price > 0, got ${quote.price}`);
  assert.ok(quote.source === 'yahoo' || quote.source === 'finnhub' || quote.source === 'cached');
});

test('searchMarketSymbols returns deduplicated normalized metadata and caches results', async () => {
  resetSearchCache();
  const originalAxiosGet = axios.get;
  let searchCalls = 0;

  axios.get = async (url) => {
    searchCalls += 1;
    assert.ok(url.includes('/v1/finance/search?q=NVDA'));
    return {
      data: {
        quotes: [
          { symbol: 'nvda', shortname: 'NVIDIA Corp', exchDisp: 'NASDAQ', quoteType: 'EQUITY' },
          { symbol: 'NVDA', shortname: 'Duplicate NVDA', exchDisp: 'NASDAQ', quoteType: 'EQUITY' },
          { symbol: 'NVDL', shortname: 'GraniteShares 2x Long NVDA', exchDisp: 'NASDAQ', quoteType: 'ETF' },
        ],
      },
    };
  };

  try {
    const res1 = await searchMarketSymbols('NVDA');
    assert.equal(res1.length, 2);
    assert.equal(res1[0].symbol, 'NVDA');
    assert.equal(res1[0].name, 'NVIDIA Corp');
    assert.equal(res1[0].category, 'Stock');
    assert.equal(res1[1].symbol, 'NVDL');
    assert.equal(res1[1].category, 'ETF');
    assert.equal(searchCalls, 1);

    const res2 = await searchMarketSymbols('nvda');
    assert.equal(res2.length, 2);
    assert.equal(searchCalls, 1);
  } finally {
    axios.get = originalAxiosGet;
    resetSearchCache();
  }
});
