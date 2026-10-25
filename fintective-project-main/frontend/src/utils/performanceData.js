export const performanceSelectionKey = (fy, scopes) => JSON.stringify([fy, scopes.map(scope => scope.scope_key)]);
export const performanceInputKey = (fy, scopeKey) => JSON.stringify([fy, scopeKey]);

export function validatePerformanceData(data, scopes) {
  if (!Array.isArray(data) || data.length !== scopes.length) throw new Error('Financial performance data is incomplete. Please retry.');
  const expected = new Set(scopes.map(scope => scope.scope_key));
  const fields = ['companies', 'invoicedDeals', 'revenue', 'ourShare', 'verifiedCount', 'estimatedCount'];
  for (const row of data) {
    if (!row || !expected.delete(row.scope_key) || fields.some(field =>
      row[field] === null || row[field] === undefined || row[field] === '' || !Number.isFinite(Number(row[field])))) {
      throw new Error('Financial performance response does not match this selection or contains invalid figures.');
    }
  }
  return data.map(row => ({...row, ...Object.fromEntries(fields.map(field => [field, Number(row[field])]))}));
}
