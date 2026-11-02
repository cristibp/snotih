const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { test } = require('node:test');
const { AxiosError } = require('axios');
const { splitDiscordContent, sendRatesWebhook, describeWebhookError } = require('../dist/services/webhookService');

async function mockWebhook(t, respond) {
  const received = [];
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const multipart = req.headers['content-type'].startsWith('multipart/form-data; boundary=');
      let payload;
      let file;
      if (multipart) {
        const form = await new Response(body, { headers: req.headers }).formData();
        payload = JSON.parse(form.get('payload_json'));
        file = form.get('files[0]');
      } else {
        payload = JSON.parse(body.toString());
      }
      const request = { payload, file, multipart, headers: req.headers };
      received.push(request);
      const status = respond?.(request, received.length) ?? (payload.content.length > 2000 ? 400 : 204);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(status === 204 ? undefined : JSON.stringify({ code: 50035, message: 'Invalid Form Body' }));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { received, url: `http://127.0.0.1:${server.address().port}/api/webhooks/123/test-token` };
}

test('splitting preserves all text, line breaks and emoji at the limit', () => {
  for (const content of ['', 'x'.repeat(2000), 'x'.repeat(2001), 'x'.repeat(1999) + '📊', 'Raport valutar 📊\n'.repeat(400)]) {
    const parts = splitDiscordContent(content);
    assert.equal(parts.join(''), content);
    assert.ok(parts.every(part => part.length <= 2000));
    assert.ok(parts.every(part => !/[\uD800-\uDBFF]$/.test(part)));
    assert.ok(parts.every(part => !/^[\uDC00-\uDFFF]/.test(part)));
  }
});

test('long Discord report uses valid multipart, then JSON, preserving the chart and proxy header', async t => {
  const { url, received } = await mockWebhook(t);
  const content = '📊 Curs valutar: 4.9750 RON\n'.repeat(220);
  const chart = Buffer.from([137, 80, 78, 71]);
  const result = await sendRatesWebhook(url, { content, flags: 4, textSummary: content }, chart, { 'x-proxy-secret': 'test-secret' });
  assert.deepEqual(result, { chartAttached: true, webhookStatus: 204 });
  assert.ok(received.length > 1);
  assert.equal(received.map(r => r.payload.content).join(''), content);
  assert.equal(received[0].file.name, 'chart.png');
  assert.equal(received[0].file.type, 'image/png');
  assert.deepEqual(Buffer.from(await received[0].file.arrayBuffer()), chart);
  assert.ok(received.slice(1).every(r => !r.multipart));
  assert.ok(received.every(r => r.payload.content.length <= 2000 && r.headers['x-proxy-secret'] === 'test-secret'));
});

test('multipart rejection retries only the first part as JSON and delivers the full report', async t => {
  const { url, received } = await mockWebhook(t, r => r.multipart ? 400 : 204);
  const content = 'Raport\n'.repeat(600);
  const result = await sendRatesWebhook(url, { content }, Buffer.from('chart'), {});
  assert.deepEqual(result, { chartAttached: false, webhookStatus: 204 });
  assert.equal(received[0].payload.content, received[1].payload.content);
  assert.equal(received.slice(1).map(r => r.payload.content).join(''), content);
});

test('no-chart reports also obey the limit on a versioned Discord route', async t => {
  const { url, received } = await mockWebhook(t);
  const content = 'x'.repeat(4500);
  const result = await sendRatesWebhook(url.replace('/api/', '/api/v10/'), { content }, null, {});
  assert.equal(result.chartAttached, false);
  assert.equal(received.length, 3);
  assert.ok(received.every(r => !r.multipart));
  assert.equal(received.map(r => r.payload.content).join(''), content);
});

test('generic webhooks retain the complete JSON payload in one request', async t => {
  const { url, received } = await mockWebhook(t, () => 204);
  const payload = { content: 'x'.repeat(4500), currentRate: { eurRonBnr: 4.97 } };
  await sendRatesWebhook(url.replace('/api/webhooks/123/test-token', '/receiver'), payload, null, {});
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].payload, payload);
});

for (const withChart of [false, true]) {
  test(`proxy /webhooks route splits a 2523-character report ${withChart ? 'with' : 'without'} a chart`, async t => {
    const { url, received } = await mockWebhook(t);
    const content = 'x'.repeat(2523);
    const result = await sendRatesWebhook(
      url.replace('/api/webhooks/', '/webhooks/') + '?wait=true',
      { content, textSummary: content },
      withChart ? Buffer.from('chart') : null,
      { 'x-proxy-secret': 'test-secret' }
    );
    assert.equal(result.chartAttached, withChart);
    assert.equal(result.webhookStatus, 204);
    assert.equal(received.length, 2);
    assert.deepEqual(received.map(r => r.payload.content.length), [2000, 523]);
    assert.equal(received.map(r => r.payload.content).join(''), content);
    assert.equal(received[0].multipart, withChart);
    assert.equal(received[1].multipart, false);
    assert.ok(received.every(r => r.headers['x-proxy-secret'] === 'test-secret'));
  });
}

test('proxy /webhooks route also splits the JSON fallback after a chart rejection', async t => {
  const { url, received } = await mockWebhook(t, r => r.multipart ? 400 : undefined);
  const content = 'x'.repeat(2523);
  const result = await sendRatesWebhook(url.replace('/api/webhooks/', '/webhooks/'), { content }, Buffer.from('chart'), {});
  assert.equal(result.chartAttached, false);
  assert.deepEqual(received.map(r => r.payload.content.length), [2000, 2000, 523]);
  assert.equal(received.slice(1).map(r => r.payload.content).join(''), content);
});

test('failed continuation propagates without replaying successful messages', async t => {
  const { url, received } = await mockWebhook(t, (_r, count) => count > 1 ? 400 : 204);
  await assert.rejects(sendRatesWebhook(url, { content: 'x'.repeat(4500) }, Buffer.from('chart'), {}));
  assert.equal(received.length, 2);
});

test('diagnostics include upstream validation errors without Axios credentials', () => {
  const data = { code: 50035, message: 'Invalid Form Body', errors: { content: { _errors: [{ message: 'Must be 2000 or fewer in length.' }] } } };
  const error = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', { url: 'secret-url', headers: { 'x-proxy-secret': 'secret-value' } }, {}, { status: 400, data });
  const details = describeWebhookError(error);
  assert.equal(details.status, 400);
  assert.deepEqual(details.errors, data.errors);
  assert.equal(details.code, 50035);
  assert.ok(!JSON.stringify(details).includes('secret'));
});
