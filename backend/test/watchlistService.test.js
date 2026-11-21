const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseWatchlistCsv, loadWatchlistSymbols } = require('../dist/services/watchlistCsvLoader');
const {
  getQuoteForSymbol,
  getQuotesForSymbols,
  resetQuoteCache,
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

test('marketQuoteService fallback to Yahoo works for European tickers (e.g. VWCE.DE)', async () => {
  resetQuoteCache();
  const quote = await getQuoteForSymbol('VWCE.DE');
  assert.ok(quote);
  assert.equal(quote.symbol, 'VWCE.DE');
  assert.ok(quote.price > 0, `Expected price > 0, got ${quote.price}`);
  assert.ok(quote.source === 'yahoo' || quote.source === 'finnhub' || quote.source === 'cached');
});
