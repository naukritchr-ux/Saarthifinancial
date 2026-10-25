import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runCrmSync} from './crmSync.js';
const response = (data, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => data});
function harness(responses, options = {}) {
  let clock = 0;
  let refreshes = 0;
  const urls = [];
  const request = async (url, init) => {
    urls.push({url, method: init.method || 'GET', cache: init.cache});
    const result = responses.shift();
    if (result instanceof Error) throw result;
    if (!result) return response({latest: {id: 7, status: 'in_progress'}});
    return result;
  };
  return {urls, run: () => runCrmSync({apiBaseUrl: '/api', request,
    onRefresh: async () => { refreshes++; return true; },
    sleep: async ms => {clock += ms;}, now: () => clock,
    pollIntervalMs: 1, maxWaitMs: 10, ...options}), refreshes: () => refreshes};
}

test('adopts an existing job even when it predates the button click', async () => {
  const h = harness([response({status: 'in_progress', log_id: 7}),
    response({latest: {id: 7, status: 'completed', enquiries_count: 5}})]);
  const result = await h.run();
  assert.equal(result.success, true);
  assert.equal(result.data.enquiries, 5);
  assert.equal(h.refreshes(), 1);
  assert.match(h.urls[1].url, /log_id=7/);
});

test('does not mistake another job for the requested one', async () => {
  const h = harness([response({log_id: 7}), response({latest: {id: 8, status: 'completed'}}),
    response({latest: {id: 8, status: 'failed'}, logs: [{id: 7, status: 'completed', invoices_count: 3}]})]);
  assert.equal((await h.run()).data.invoices, 3);
});

test('temporary status failure recovers without starting a second job', async () => {
  const h = harness([response({log_id: 7}), response({error: 'gateway'}, 503),
    response({latest: {id: 7, status: 'completed'}})]);
  assert.equal((await h.run()).success, true);
  assert.equal(h.urls.filter(row => row.method === 'POST').length, 1);
});

test('ambiguous registration network failure retries and adopts a durable job', async () => {
  const h = harness([new Error('connection reset'), response({log_id: 7, status: 'in_progress'}),
    response({latest: {id: 7, status: 'completed'}})]);
  assert.equal((await h.run()).success, true);
  assert.equal(h.urls.filter(row => row.method === 'POST').length, 2);
});

test('monitor timeout reports pending instead of claiming backend failure', async () => {
  const h = harness([response({log_id: 7})], {maxWaitMs: 3});
  const result = await h.run();
  assert.equal(result.pending, true);
  assert.equal(result.log_id, 7);
  assert.equal(h.urls.filter(row => row.method === 'POST').length, 1);
});

test('resuming monitoring never starts another sync', async () => {
  const h = harness([response({latest: {id: 7, status: 'completed'}})], {jobId: 7});
  assert.equal((await h.run()).success, true);
  assert.equal(h.urls.filter(row => row.method === 'POST').length, 0);
});

test('partial success stays visibly marked with warnings', async () => {
  const h = harness([response({log_id: 7}), response({latest: {id: 7, status: 'completed_with_warnings',
    enquiries_count: 4, message: 'Expenses API unavailable'}})]);
  const result = await h.run();
  assert.equal(result.success, true);
  assert.equal(result.warning, true);
  assert.match(result.data.errors[0], /Expenses/);
});

test('a successful CRM job with failed dashboard reload carries a warning', async () => {
  const h = harness([response({log_id: 7}), response({latest: {id: 7, status: 'completed'}})], {onRefresh: async () => false});
  const result = await h.run();
  assert.equal(result.success, true);
  assert.equal(result.warning, true);
  assert.match(result.data.errors[0], /refresh/);
});

test('permanent auth failure is surfaced immediately', async () => {
  const h = harness([response({error: 'Invalid API credentials'}, 401)]);
  const result = await h.run();
  assert.equal(result.success, false);
  assert.match(result.error, /credentials/);
  assert.equal(h.urls.length, 1);
});

test('a worker error is returned from the tracked job', async () => {
  const h = harness([response({log_id: 7}), response({latest: {id: 7, status: 'failed', message: 'CRM token expired'}})]);
  const result = await h.run();
  assert.equal(result.success, false);
  assert.match(result.error, /token expired/);
  assert.equal(h.refreshes(), 0);
});

test('untracked backend responses fail clearly instead of waiting forever', async () => {
  const h = harness([response({status: 'started', log_id: null})]);
  const result = await h.run();
  assert.equal(result.success, false);
  assert.match(result.error, /trackable/);
  assert.equal(h.urls.length, 1);
});

test('all status and registration requests bypass HTTP caches', async () => {
  const h = harness([response({log_id: 7}), response({latest: {id: 7, status: 'completed'}})]);
  await h.run();
  assert.ok(h.urls.every(row => row.cache === 'no-store'));
});
