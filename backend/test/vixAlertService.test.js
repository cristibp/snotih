const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluateVixThreshold, sendTradingDiscordAlert } = require('../dist/services/rsiService');

test('evaluateVixThreshold: normal levels do not trigger alert', () => {
  const res = evaluateVixThreshold(18.5, 3.2, 1.1);
  assert.equal(res.thresholdSurpassed, false);
  assert.equal(res.colorHex, '#10B981');
  assert.equal(res.reasons.length, 0);
  assert.ok(res.message.includes('VIX în parametri normali'));
});

test('evaluateVixThreshold: triggers alert when VIX > 35', () => {
  const res = evaluateVixThreshold(36.2, 5.0, 2.0);
  assert.equal(res.thresholdSurpassed, true);
  assert.equal(res.colorHex, '#EF4444');
  assert.ok(res.reasons.some((r) => r.includes('prag > 35')));
});

test('evaluateVixThreshold: triggers alert when daily increase >= 20%', () => {
  const res = evaluateVixThreshold(26.0, 22.5, 3.0);
  assert.equal(res.thresholdSurpassed, true);
  assert.equal(res.colorHex, '#EF4444');
  assert.ok(res.reasons.some((r) => r.includes('Creștere zilnică VIX: +22.50%')));
});

test('evaluateVixThreshold: triggers alert when hourly increase >= 20%', () => {
  const res = evaluateVixThreshold(28.0, 15.0, 21.4);
  assert.equal(res.thresholdSurpassed, true);
  assert.equal(res.colorHex, '#EF4444');
  assert.ok(res.reasons.some((r) => r.includes('Creștere orară VIX: +21.40%')));
});

test('evaluateVixThreshold: triggers alert with multiple reasons when both > 35 and >= 20%', () => {
  const res = evaluateVixThreshold(38.5, 26.2, 22.1);
  assert.equal(res.thresholdSurpassed, true);
  assert.equal(res.reasons.length, 3);
  assert.ok(res.reasons.some((r) => r.includes('> 35')));
  assert.ok(res.reasons.some((r) => r.includes('zilnică')));
  assert.ok(res.reasons.some((r) => r.includes('orară')));
});

test('sendTradingDiscordAlert: fails gracefully when no webhook or no alerts triggered', async () => {
  const resNoUrl = await sendTradingDiscordAlert('', [], undefined);
  assert.equal(resNoUrl.success, false);

  const vixNormal = {
    symbol: '^VIX',
    name: 'CBOE Volatility Index',
    currentPrice: 16.5,
    previousClose: 16.0,
    changePercent: 3.1,
    thresholdSurpassed: false,
    reasons: [],
    colorHex: '#10B981',
    colorInt: 0x10B981,
    message: 'Normal',
    lastUpdated: new Date().toISOString(),
  };

  const resNoAlerts = await sendTradingDiscordAlert('https://discord.com/api/webhooks/test', [], vixNormal);
  assert.equal(resNoAlerts.success, false);
  assert.equal(resNoAlerts.error, 'No webhook URL or no triggered alerts.');
});
