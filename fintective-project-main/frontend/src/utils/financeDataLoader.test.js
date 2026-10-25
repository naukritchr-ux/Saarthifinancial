import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadFinanceCollections} from './financeDataLoader.js';

const reply = data => ({ok: true, status: 200, json: async () => data});
test('fast datasets publish before an unrelated slow request finishes', async () => {
  let release;
  const slow = new Promise(resolve => {release = resolve;});
  const calls = [], received = [];
  const pending = loadFinanceCollections({base: '/api', request: async url => {
    calls.push(url);
    if (url.endsWith('/budgets')) return slow;
    return reply([{id: url}]);
  }, onData: key => received.push(key)});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 5, 'all requests start without a health prerequisite');
  assert.ok(received.includes('transactions'));
  assert.equal(received.includes('budgets'), false);
  release(reply({Salaries: 20}));
  assert.equal((await pending).every(result => result.ok), true);
});

test('one failed tab does not erase other datasets or become an empty successful response', async () => {
  const received = [], errors = [];
  const results = await loadFinanceCollections({base: '/api', request: async url => url.endsWith('/bd-agents')
    ? {ok: false, status: 503} : reply(url.endsWith('/budgets') ? {} : []),
  onData: key => received.push(key), onError: key => errors.push(key)});
  assert.deepEqual(errors, ['bdAgents']);
  assert.ok(received.includes('transactions'));
  assert.equal(results.find(result => result.key === 'bdAgents').ok, false);
});

test('a valid empty DB result remains a successful empty collection', async () => {
  const results = await loadFinanceCollections({base: '/api', request: async url => reply(url.endsWith('/budgets') ? {} : [])});
  assert.ok(results.every(result => result.ok));
});

test('malformed transaction collections are rejected', async () => {
  const results = await loadFinanceCollections({base: '/api', request: async url => reply(url.endsWith('/transactions')
    ? {error: 'query failed'} : url.endsWith('/budgets') ? {} : [])});
  assert.equal(results.find(result => result.key === 'transactions').ok, false);
});

test('a manual refresh bypasses each backend worker metadata cache', async () => {
  const urls = [];
  await loadFinanceCollections({base: '/api', refresh: true, request: async (url, options) => {
    urls.push(url); assert.equal(options.cache, 'no-store');
    return reply(url.includes('/budgets') ? {} : []);
  }});
  assert.equal(urls.length, 5);
  assert.ok(urls.every(url => url.endsWith('?refresh=1')));
});

test('access failures are preserved for the application-wide auth banner', async () => {
  const error = Object.assign(new Error('Denied'), {status: 401, isAuthError: true});
  const results = await loadFinanceCollections({base: '/api', request: async () => { throw error; }});
  assert.ok(results.every(result => !result.ok && result.error === error));
});
