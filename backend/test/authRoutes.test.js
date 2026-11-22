const test = require('node:test');
const assert = require('node:assert');
const { requireAuth } = require('../dist/routes/authRoutes');
const { sessionStore } = require('../dist/services/sessionStore');

test('requireAuth: rejects request with no session cookie and no authorization header', () => {
  const req = { cookies: {}, headers: {} };
  let statusCode = null;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
    clearCookie() {},
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);
  assert.strictEqual(statusCode, 401);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(jsonResponse.error, 'Unauthorized: no session token or cookie');
});

test('requireAuth: accepts valid token in Authorization Bearer header', () => {
  const email = 'alexandra.binca@gmail.com';

  const { rawToken } = sessionStore.createSession({
    email,
    deviceLabel: 'iPhone (Brave)',
    ipAddress: '127.0.0.1',
  });

  const req = {
    cookies: {},
    headers: {
      authorization: `Bearer ${rawToken}`,
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  const res = {
    status() { return this; },
    json() { return this; },
    clearCookie() {},
  };

  requireAuth(req, res, next);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.email, email);
  assert.strictEqual(req.user.role, 'user');
});

test('requireAuth: accepts valid token in snotih_session cookie', () => {
  const email = 'batusel.cristian@gmail.com';

  const { rawToken } = sessionStore.createSession({
    email,
    deviceLabel: 'Web Browser',
    ipAddress: '127.0.0.1',
  });

  const req = {
    cookies: {
      snotih_session: rawToken,
    },
    headers: {},
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  const res = {
    status() { return this; },
    json() { return this; },
    clearCookie() {},
  };

  requireAuth(req, res, next);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.email, email);
  assert.strictEqual(req.user.role, 'admin');
});

test('requireAuth: rejects invalid Bearer token', () => {
  const req = {
    cookies: {},
    headers: {
      authorization: 'Bearer invalid_non_existent_token_12345',
    },
  };
  let statusCode = null;
  let jsonResponse = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
    clearCookie() {},
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);
  assert.strictEqual(statusCode, 401);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(jsonResponse.error, 'Unauthorized: session invalid or expired');
});
