import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performanceInputKey, performanceSelectionKey, validatePerformanceData} from './performanceData.js';
const scopes = [{scope_key: 'bd:sample|tl:all|fn:all'}];
const valid = () => ({scope_key: scopes[0].scope_key, companies: 0, invoicedDeals: 0,
  revenue: 0, ourShare: 0, verifiedCount: 0, estimatedCount: 0});

test('a loaded empty finance scope is distinguishable from unavailable API data', () => {
  assert.equal(validatePerformanceData([valid()], scopes)[0].revenue, 0);
  assert.throws(() => validatePerformanceData([], scopes), /incomplete/);
  assert.throws(() => validatePerformanceData({error: 'Failed'}, scopes), /incomplete/);
});
test('a different financial year cannot reuse the old selection or edited amounts', () => {
  assert.notEqual(performanceSelectionKey('FY 2025-26', scopes), performanceSelectionKey('FY 2026-27', scopes));
  assert.notEqual(performanceInputKey('FY 2025-26', scopes[0].scope_key), performanceInputKey('FY 2026-27', scopes[0].scope_key));
});
test('a different person cannot match the previous response', () => {
  assert.throws(() => validatePerformanceData([{...valid(), scope_key: 'bd:other|tl:all|fn:all'}], scopes));
});
test('an incomplete or duplicated comparison scope is rejected', () => {
  const two = [...scopes, {scope_key: 'bd:other|tl:all|fn:all'}];
  assert.throws(() => validatePerformanceData([valid(), valid()], two));
});
test('missing or invalid financial metrics do not silently become zero', () => {
  for (const revenue of [null, undefined, '', 'bad amount', Infinity, NaN]) {
    assert.throws(() => validatePerformanceData([{...valid(), revenue}], scopes));
  }
});
test('numeric amounts are normalized before calculating totals and comparisons', () => {
  const data = validatePerformanceData([{...valid(), revenue: '12000.50', ourShare: '3000.25'}], scopes);
  assert.equal(data[0].revenue, 12000.5);
  assert.equal(data[0].ourShare, 3000.25);
});
