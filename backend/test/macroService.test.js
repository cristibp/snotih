const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseFredCsv, alignFredSeries } = require('../dist/services/macroParser');
const {
  calculateYieldCurveMetrics,
  determineRegime,
  calculateRecessionScore,
} = require('../dist/services/macroCalculator');
const { defaultMacroConfig } = require('../dist/config/macroConfig');
const {
  getYieldCurveStatus,
  resetMacroMemoryCache,
  getMacroPreviousRegime,
  setMacroPreviousRegime,
} = require('../dist/services/macroService');

test('parseFredCsv parses valid rows, converts to bps, and ignores headers and holidays (.)', () => {
  const csv = `observation_date,T10Y2Y
1976-06-01,0.68
1976-06-02,0.71
1976-06-03,.
1976-06-04,-0.25
1976-06-05,
invalid_date,0.85
`;
  const result = parseFredCsv(csv);
  assert.equal(result.size, 3);
  assert.equal(result.get('1976-06-01'), 68);
  assert.equal(result.get('1976-06-02'), 71);
  assert.equal(result.get('1976-06-04'), -25);
  assert.equal(result.has('1976-06-03'), false); // '.' filtrat
  assert.equal(result.has('1976-06-05'), false); // rand gol filtrat
});

test('alignFredSeries aligns dates, sorts chronologically, and limits window', () => {
  const map2y = new Map([
    ['2024-01-01', 10],
    ['2024-01-02', 20],
    ['2024-01-03', 30],
    ['2024-01-04', 40],
  ]);
  const map3m = new Map([
    ['2024-01-02', 25],
    ['2024-01-03', 35],
    ['2024-01-04', 45],
    ['2024-01-05', 55],
  ]);

  const aligned = alignFredSeries(map2y, map3m, undefined, undefined, undefined, 2);
  assert.equal(aligned.length, 2); // limitat la 2
  assert.equal(aligned[0].date, '2024-01-03');
  assert.equal(aligned[0].t10y2y_bps, 30);
  assert.equal(aligned[0].t10y3m_bps, 35);
  assert.equal(aligned[1].date, '2024-01-04');
});

test('calculateYieldCurveMetrics computes SMA5, deltas, inversion days and steepening type', () => {
  const rawPoints = [];
  // Cream 30 de zile simulate
  for (let i = 0; i < 30; i++) {
    const day = String(i + 1).padStart(2, '0');
    // Primele 10 zile inversate (-30 bps), apoi urca la +20 bps
    const val = i < 10 ? -30 : (i - 10) * 3;
    rawPoints.push({
      date: `2024-05-${day}`,
      t10y2y_bps: val,
      t10y3m_bps: val,
      dgs10: 4.5,
      dgs2: 4.5 - val / 100,
      dgs3mo: 4.5 - val / 100,
    });
  }

  const metrics = calculateYieldCurveMetrics(rawPoints, defaultMacroConfig);
  assert.equal(metrics.length, 30);

  // Ziua 0 (inversat)
  assert.equal(metrics[0].is_inverted_3m, true);
  assert.equal(metrics[0].days_since_last_inversion_3m, 0);

  // Ultima zi (index 29)
  const last = metrics[29];
  assert.equal(last.is_inverted_3m, false);
  // Ultima zi inversata a fost index 9. Distanta = 29 - 9 = 20 zile
  assert.equal(last.days_since_last_inversion_3m, 20);
  assert.ok(last.delta_20d_10y3m > 0, 'delta_20d_10y3m should be positive');
  assert.equal(last.steepening_type, 'BULL_STEEPENER');
});

test('determineRegime correctly identifies NORMAL, FLATTENING, INVERTED and UNINVERSION_CRITICAL', () => {
  const config = defaultMacroConfig;

  // 1. NORMAL
  const normalObs = {
    date: '2024-01-10',
    t10y2y_bps: 45,
    t10y3m_bps: 50,
    sma5_10y2y: 45,
    sma5_10y3m: 50,
    delta_20d_10y3m: 5,
    delta_60d_10y3m: 10,
    is_inverted_2y: false,
    is_inverted_3m: false,
    days_since_last_inversion_2y: null,
    days_since_last_inversion_3m: null,
    steepening_type: 'NEUTRAL',
  };
  const regNormal = determineRegime(normalObs, [normalObs], config);
  assert.equal(regNormal.regime, 'NORMAL');
  assert.equal(regNormal.regimeNumber, 0);

  // 2. FLATTENING
  const flatteningObs = {
    ...normalObs,
    sma5_10y2y: 12,
    sma5_10y3m: 18,
    t10y2y_bps: 12,
    t10y3m_bps: 18,
  };
  const regFlattening = determineRegime(flatteningObs, [flatteningObs], config);
  assert.equal(regFlattening.regime, 'FLATTENING');
  assert.equal(regFlattening.regimeNumber, 1);

  // 3. INVERTED
  const invertedObs = {
    ...normalObs,
    sma5_10y2y: -15,
    sma5_10y3m: -30,
    t10y2y_bps: -15,
    t10y3m_bps: -30,
    is_inverted_2y: true,
    is_inverted_3m: true,
  };
  const regInverted = determineRegime(invertedObs, [invertedObs], config);
  assert.equal(regInverted.regime, 'INVERTED');
  assert.equal(regInverted.regimeNumber, 2);

  // 4. UNINVERSION_CRITICAL
  // Spread >= 0, inversare in ultimele 252 zile (ex. 15 zile), delta 20d > 0
  const uninversionObs = {
    ...normalObs,
    sma5_10y2y: 10,
    sma5_10y3m: 15,
    t10y2y_bps: 10,
    t10y3m_bps: 15,
    days_since_last_inversion_3m: 15,
    delta_20d_10y3m: 45,
  };
  const regUninversion = determineRegime(uninversionObs, [uninversionObs, uninversionObs, uninversionObs], config);
  assert.equal(regUninversion.regime, 'UNINVERSION_CRITICAL');
  assert.equal(regUninversion.regimeNumber, 3);
});

test('calculateRecessionScore respects weights and produces high danger score on UNINVERSION_CRITICAL', () => {
  const config = defaultMacroConfig;

  // Uninversion critical observation
  const obs = {
    date: '2024-01-10',
    t10y2y_bps: 15,
    t10y3m_bps: 20,
    sma5_10y2y: 15,
    sma5_10y3m: 20,
    delta_20d_10y3m: 35,
    delta_60d_10y3m: 60,
    is_inverted_2y: false,
    is_inverted_3m: false,
    days_since_last_inversion_2y: 20,
    days_since_last_inversion_3m: 10,
    steepening_type: 'BULL_STEEPENER',
  };

  const { score, components } = calculateRecessionScore(obs, 'UNINVERSION_CRITICAL', config);
  assert.ok(score >= 70, `Score should be >= 70 for UNINVERSION_CRITICAL, got ${score}`);
  assert.equal(components.weight3m, 0.40);
  assert.equal(components.weight2y, 0.25);
  assert.equal(components.weightSteepening, 0.35);

  // Normal observation
  const normalObs = {
    ...obs,
    sma5_10y2y: 80,
    sma5_10y3m: 100,
    t10y2y_bps: 80,
    t10y3m_bps: 100,
    days_since_last_inversion_2y: null,
    days_since_last_inversion_3m: null,
    steepening_type: 'NEUTRAL',
  };
  const normalResult = calculateRecessionScore(normalObs, 'NORMAL', config);
  assert.ok(normalResult.score < 25, `Score should be < 25 for NORMAL, got ${normalResult.score}`);
});

test('getYieldCurveStatus caches in memory with TTL and serves subsequent calls from cache', async () => {
  resetMacroMemoryCache();

  // Testam obtinerea starii
  const status1 = await getYieldCurveStatus(false, 30);
  assert.ok(status1);
  assert.ok(typeof status1.score === 'number');
  assert.ok(['NORMAL', 'FLATTENING', 'INVERTED', 'UNINVERSION_CRITICAL'].includes(status1.regime));
  assert.ok(status1.current);
  assert.ok(status1.history.length <= 30);

  // Al doilea apel ar trebui sa vina din cache in-memory
  const status2 = await getYieldCurveStatus(false, 10);
  assert.equal(status2.cached, true);
  assert.equal(status2.history.length, 10);
  assert.equal(status2.score, status1.score);
});
