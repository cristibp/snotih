const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const axios = require('axios');
const { getPriceEarnings, resetFundamentalsCache } = require('../dist/services/marketFundamentalsService');
const { getQuoteForSymbol, resetQuoteCache } = require('../dist/services/marketQuoteService');
const { watchlistConfig } = require('../dist/config/watchlistConfig');

const originalGet = axios.get;
const originalNow = Date.now;
const originalApiKey = watchlistConfig.finnhubApiKey;

function response(observations) {
  return { data: { timeseries: { result: [{ trailingPeRatio: observations }], error: null } } };
}

function observation(asOfDate, raw) {
  return { asOfDate, reportedValue: { raw } };
}

beforeEach(() => {
  resetFundamentalsCache();
  resetQuoteCache();
  watchlistConfig.finnhubApiKey = '';
});

afterEach(() => {
  axios.get = originalGet;
  Date.now = originalNow;
  watchlistConfig.finnhubApiKey = originalApiKey;
});

test('uses the latest trailing P/E by date and preserves its reporting date', async () => {
  axios.get = async (url, config) => {
    assert.ok(url.endsWith('/AAPL'));
    assert.equal(config.params.type, 'trailingPeRatio');
    return response([
      observation('2025-02-01', 28.75),
      observation('2025-01-01', 22),
      observation('2099-01-01', 99),
    ]);
  };
  assert.deepEqual(await getPriceEarnings(' aapl '), {
    peRatio: 28.75,
    peRatioAsOf: '2025-02-01',
  });
});

test('missing, non-positive and invalid latest P/E values never fall back to an older positive ratio', async () => {
  const invalidValues = [null, undefined, 0, -12, NaN, Infinity, '25.4'];
  for (const [index, raw] of invalidValues.entries()) {
    axios.get = async () => response([
      observation('2025-01-01', 20),
      observation('2025-02-01', raw),
    ]);
    assert.equal((await getPriceEarnings(`TEST${index}`)).peRatio, null);
  }
});

test('caches missing fundamentals and skips indices and futures', async () => {
  let calls = 0;
  axios.get = async () => {
    calls += 1;
    return response([]);
  };
  assert.deepEqual(await getPriceEarnings('SPY'), { peRatio: null });
  assert.deepEqual(await getPriceEarnings('spy'), { peRatio: null });
  assert.deepEqual(await getPriceEarnings('^VIX'), { peRatio: null });
  assert.deepEqual(await getPriceEarnings('GC=F'), { peRatio: null });
  assert.deepEqual(await getPriceEarnings(''), { peRatio: null });
  assert.equal(calls, 1);
});

test('concurrent requests for one symbol share a fundamentals request', async () => {
  let calls = 0;
  let resolveRequest;
  axios.get = () => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  };
  const first = getPriceEarnings('AAPL');
  const second = getPriceEarnings('aapl');
  resolveRequest(response([observation('2025-02-01', 25)]));
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
});

test('refreshes fundamentals after six hours and retains the dated value during a temporary outage', async () => {
  let now = Date.UTC(2025, 2, 1);
  Date.now = () => now;
  let calls = 0;
  axios.get = async () => {
    calls += 1;
    if (calls === 2) throw new Error('Temporary outage');
    return response([observation('2025-02-01', calls === 1 ? 25 : 26)]);
  };
  const first = await getPriceEarnings('AAPL');
  now += 60 * 60 * 1000;
  assert.deepEqual(await getPriceEarnings('AAPL'), first);
  assert.equal(calls, 1);
  now += 5 * 60 * 60 * 1000;
  assert.deepEqual(await getPriceEarnings('AAPL'), first);
  assert.equal(calls, 2);
  assert.deepEqual(await getPriceEarnings('AAPL'), first);
  now += 5 * 60 * 1000;
  assert.equal((await getPriceEarnings('AAPL')).peRatio, 26);
  assert.equal(calls, 3);
});

test('provider errors are retried after five minutes instead of being cached as missing fundamentals', async () => {
  let now = Date.UTC(2025, 2, 1);
  Date.now = () => now;
  let calls = 0;
  axios.get = async () => {
    calls += 1;
    return calls === 1
      ? { data: { timeseries: { result: null, error: { code: 'Unauthorized' } } } }
      : response([observation('2025-02-01', 25)]);
  };
  assert.deepEqual(await getPriceEarnings('AAPL'), { peRatio: null });
  assert.deepEqual(await getPriceEarnings('AAPL'), { peRatio: null });
  assert.equal(calls, 1);
  now += 5 * 60 * 1000;
  assert.equal((await getPriceEarnings('AAPL')).peRatio, 25);
});

test('a fundamentals failure does not discard a valid quote', async () => {
  axios.get = async (url) => {
    if (url.includes('/fundamentals-timeseries/')) throw new Error('Rate limited');
    assert.ok(url.includes('/v8/finance/chart/AAPL'));
    return { data: { chart: { result: [{ meta: { regularMarketPrice: 150 } }] } } };
  };
  const quote = await getQuoteForSymbol('AAPL');
  assert.equal(quote.price, 150);
  assert.equal(quote.peRatio, null);
  assert.equal(quote.error, undefined);
});
