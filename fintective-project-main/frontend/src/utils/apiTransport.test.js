import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApiBase, createApiTransport} from './apiTransport.js';
import {fetchJsonWithApiKey, setCachedApiResponse, getCachedApiResponse} from './apiClient.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});
for (const [value, host, expected] of [
  ['', 'app.vercel.app', '/api'], ['', 'localhost', 'http://localhost:5000/api'],
  [' https://finance.test/ ', '', 'https://finance.test/api'],
  ['https://finance.test/api/', '', 'https://finance.test/api'],
  ['"https://finance.test"', '', 'https://finance.test/api'],
  ['/api/', '', '/api'], ['/', '', '/api'], ['/finance/api', '', '/finance/api'],
]) test(`API address normalizes ${JSON.stringify(value)} on ${host}`, () => assert.equal(normalizeApiBase(value, host), expected));

test('invalid API URLs cannot embed a credential or redirect to a protocol-relative host', () => {
  for (const value of ['//other.test/api','javascript:alert(1)','https://user:secret@finance.test','finance.test','https://finance.test/?token=x']) {
    assert.throws(() => normalizeApiBase(value));
  }
});

test('all callers share one in-flight GET but receive independently readable responses', async () => {
  let calls = 0;
  const request = createApiTransport({apiKey: 'synthetic-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.headers.get('X-API-Key'), 'synthetic-key');
    assert.equal(options.cache, 'no-store');
    return json([{id: calls}]);
  }});
  const [a, b] = await Promise.all([request('/api/transactions'), request('/api/transactions')]);
  assert.equal(calls, 1);
  assert.deepEqual(await a.json(), await b.json());
  await request('/api/transactions');
  assert.equal(calls, 2, 'completed results are not silently cached');
});

test('HTML 502 from a sleeping gateway is retried rather than mistaken for a routing error', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => ++calls === 1
    ? new Response('<html>Gateway</html>', {status: 502, headers: {'Content-Type': 'text/html'}}) : json([])});
  assert.deepEqual(await (await request('/api/transactions')).json(), []);
  assert.equal(calls, 2);
});

test('HTML 200 is a routing failure and is not repeatedly retried', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => {
    calls++;
    return new Response('<html>Frontend</html>', {headers: {'Content-Type': 'text/html'}});
  }});
  await assert.rejects(request('/api/transactions'), error => error.isHtml);
  assert.equal(calls, 1);
});

for (const status of [401,403]) test(`HTTP ${status} is not retried`, async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => { calls++; return json({error: 'Denied'}, status); }});
  await assert.rejects(request('/api/transactions', {retries: 3}), error => error.isAuthError && error.status === status);
  assert.equal(calls, 1);
});

test('network failures are bounded and report a useful connection error', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => { calls++; throw new TypeError('Failed to fetch'); }});
  await assert.rejects(request('/api/transactions'), /Cannot reach the finance server/);
  assert.equal(calls, 2);
});

test('ordinary POST mutations are never automatically repeated', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => { calls++; return json({}, 503); }});
  await assert.rejects(request('/api/transaction', {method: 'POST'}));
  assert.equal(calls, 1);
});

test('explicit read-only POST retries recover compare requests', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: async () => ++calls === 1 ? json({}, 503) : json([])});
  assert.deepEqual(await (await request('/api/growth/compare', {method: 'POST', retries: 3})).json(), []);
  assert.equal(calls, 2);
});

test('an already cancelled request performs no network call', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  const request = createApiTransport({fetchImpl: async () => { calls++; return json([]); }});
  await assert.rejects(request('/api/transactions', {signal: controller.signal}), error => error.name === 'AbortError');
  assert.equal(calls, 0);
});

test('timeout aborts attempts instead of waiting indefinitely', async () => {
  let calls = 0;
  const request = createApiTransport({sleep: async () => {}, fetchImpl: (url, {signal}) => new Promise((resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), {once: true});
  })});
  await assert.rejects(request('/api/transactions', {timeoutMs: 5}), /too long/);
  assert.equal(calls, 2);
});

test('JSON error responses never become cached success', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => json({error: 'Invalid period'}, 400);
  try {
    await assert.rejects(fetchJsonWithApiKey('/api/test-invalid-response'), /Invalid period/);
    assert.equal(getCachedApiResponse('/api/test-invalid-response'), null);
  } finally { globalThis.fetch = previous; }
});

test('cached financial data is not used to hide failed authentication', async () => {
  const previous = globalThis.fetch;
  setCachedApiResponse('/api/test-auth', [{id: 'saved'}]);
  globalThis.fetch = async () => json({error: 'Denied'}, 401);
  try { await assert.rejects(fetchJsonWithApiKey('/api/test-auth'), error => error.isAuthError); }
  finally { globalThis.fetch = previous; }
});

test('offline array fallback preserves its array type and is explicitly stale', async () => {
  const previous = globalThis.fetch;
  setCachedApiResponse('/api/test-array', [{id: 'saved'}]);
  globalThis.fetch = async () => { throw new TypeError('Offline'); };
  try {
    const result = await fetchJsonWithApiKey('/api/test-array', {retries: 1});
    assert.equal(Array.isArray(result), true);
    assert.equal(result[0].id, 'saved');
    assert.equal(result._isStale, true);
  } finally { globalThis.fetch = previous; }
});
