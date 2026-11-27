const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const axios = require('axios');
const { fetchWatchlistVolumeSummary, resetVolumeCache } = require('../dist/services/marketVolumeService');
const { watchlistConfig } = require('../dist/config/watchlistConfig');

const originalGet = axios.get;
const originalNow = Date.now;
const dates = ['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27'];
const timestamp = (date, time = '14:30:00') => Date.parse(`${date}T${time}Z`) / 1000;

function response(volumes, options = {}) {
  return { data: { chart: { result: [{
    meta: { exchangeTimezoneName: 'America/New_York', ...options.meta },
    timestamp: options.timestamps || dates.slice(-volumes.length).map((date) => timestamp(date)),
    indicators: { quote: [{ close: volumes.map(() => 150), volume: volumes }] },
  }] } } };
}

beforeEach(() => resetVolumeCache());
afterEach(() => {
  axios.get = originalGet;
  Date.now = originalNow;
});

test('compares the latest session with five previous trading sessions, excluding weekends and holidays', async () => {
  axios.get = async (url) => {
    assert.ok(url.endsWith('/AAPL?range=1mo&interval=1d'));
    return response([100, 200, 300, 400, 500, 600]);
  };
  const summary = await fetchWatchlistVolumeSummary(' aapl ');
  assert.deepEqual(summary.currentDay, { date: '2026-11-27', volume: 600 });
  assert.equal(summary.average5d, 300);
  assert.deepEqual(summary.daily, dates.slice(1).map((date, index) => ({ date, volume: (index + 2) * 100 })));
});

test('uses the live full-day total without adding it to the daily candle volume', async () => {
  axios.get = async () => response([100, 200, 300, 400, 500, 600], {
    meta: { regularMarketTime: timestamp('2026-11-27', '17:00:00'), regularMarketVolume: 700 },
  });
  const summary = await fetchWatchlistVolumeSummary('AAPL');
  assert.equal(summary.currentDay.volume, 700);
  assert.equal(summary.daily.at(-1).volume, 700);
  assert.equal(summary.average5d, 300);
});

test('a new session reported by live metadata is excluded from the five-day baseline', async () => {
  axios.get = async () => response([100, 200, 300, 400, 500], {
    timestamps: dates.slice(0, 5).map((date) => timestamp(date)),
    meta: { regularMarketTime: timestamp('2026-11-27'), regularMarketVolume: 25 },
  });
  const summary = await fetchWatchlistVolumeSummary('AAPL');
  assert.deepEqual(summary.currentDay, { date: '2026-11-27', volume: 25 });
  assert.equal(summary.average5d, 300);
});

test('labels sessions in the exchange timezone instead of UTC or the viewer timezone', async () => {
  axios.get = async () => response([100, 200, 300, 400, 500, 600], {
    timestamps: dates.map((date) => timestamp(date, '00:30:00')),
    meta: { exchangeTimezoneName: 'America/Los_Angeles' },
  });
  const summary = await fetchWatchlistVolumeSummary('TEST');
  assert.equal(summary.currentDay.date, '2026-11-26');
  assert.equal(summary.daily[0].date, '2026-11-19');
  assert.equal(summary.average5d, 300);
});

test('falls back to the exchange UTC offset for an unsupported timezone', async () => {
  axios.get = async () => response([600], {
    timestamps: [timestamp('2026-11-27', '23:30:00')],
    meta: { exchangeTimezoneName: 'invalid/timezone', gmtoffset: 9 * 3600 },
  });
  assert.equal((await fetchWatchlistVolumeSummary('TEST')).currentDay.date, '2026-11-28');
});

test('does not split a live overnight session into two days', async () => {
  axios.get = async () => response([600], {
    timestamps: [timestamp('2026-11-26', '23:00:00')],
    meta: {
      exchangeTimezoneName: 'America/New_York',
      regularMarketTime: timestamp('2026-11-27', '15:00:00'),
      regularMarketVolume: 700,
      currentTradingPeriod: { regular: {
        start: timestamp('2026-11-26', '23:00:00'), end: timestamp('2026-11-27', '22:00:00'),
      } },
    },
  });
  const summary = await fetchWatchlistVolumeSummary('TEST');
  assert.deepEqual(summary.daily, [{ date: '2026-11-26', volume: 700 }]);
  assert.equal(summary.average5d, null);
});

test('does not misrepresent fewer than five sessions or missing volumes as a five-day average', async () => {
  for (const volumes of [[100, 200, 300, 400, 500], [100, null, 300, 400, 500, 600]]) {
    axios.get = async () => response(volumes);
    assert.equal((await fetchWatchlistVolumeSummary('TEST', true)).average5d, null);
  }
});

test('keeps missing or invalid current volumes unavailable and preserves genuine zero volume', async () => {
  for (const invalid of [null, undefined, -1, NaN, Infinity, '600']) {
    axios.get = async () => response([100, 200, 300, 400, 500, invalid]);
    const summary = await fetchWatchlistVolumeSummary('TEST', true);
    assert.equal(summary.currentDay.volume, null);
    assert.equal(summary.average5d, 300);
  }
  axios.get = async () => response([0, 0, 0, 0, 0, 0]);
  const summary = await fetchWatchlistVolumeSummary('TEST', true);
  assert.equal(summary.average5d, 0);
  assert.equal(summary.currentDay.volume, 0);
});

test('sorts bars and does not double count duplicate daily totals', async () => {
  axios.get = async () => response([600, 100, 200, 300, 400, 500, 650], {
    timestamps: [timestamp(dates[5]), ...dates.slice(0, 5).map((date) => timestamp(date)), timestamp(dates[5], '17:00:00')],
  });
  const summary = await fetchWatchlistVolumeSummary('TEST');
  assert.equal(summary.daily.length, 5);
  assert.equal(summary.currentDay.volume, 650);
  assert.equal(summary.average5d, 300);
});

test('reuses recent volume data, expires it and bypasses the cache on refresh', async () => {
  let now = Date.parse('2026-11-27T17:00:00Z');
  Date.now = () => now;
  let calls = 0;
  axios.get = async () => {
    calls += 1;
    return response([100, 200, 300, 400, 500, calls * 600]);
  };
  assert.equal((await fetchWatchlistVolumeSummary('aapl')).currentDay.volume, 600);
  assert.equal((await fetchWatchlistVolumeSummary(' AAPL ')).currentDay.volume, 600);
  assert.equal(calls, 1);
  assert.equal((await fetchWatchlistVolumeSummary('AAPL', true)).currentDay.volume, 1200);
  now += watchlistConfig.historyCacheTtlMs;
  assert.equal((await fetchWatchlistVolumeSummary('AAPL')).currentDay.volume, 1800);
  assert.equal(calls, 3);
});

test('an unavailable volume provider returns no summary and can recover on the next request', async () => {
  axios.get = async () => { throw new Error('Test provider outage'); };
  assert.equal(await fetchWatchlistVolumeSummary('AAPL'), null);
  axios.get = async () => response([600]);
  assert.equal((await fetchWatchlistVolumeSummary('AAPL')).currentDay.volume, 600);
});
