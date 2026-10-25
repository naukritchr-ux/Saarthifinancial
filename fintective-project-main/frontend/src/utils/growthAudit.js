import {formatCurrency, formatLakhs} from './formatters.js';

export const metricLabels = {company_share: 'Company share', revenue: 'Revenue excluding GST', deals: 'Invoiced deals'};
export const stageLabels = {invoiced: 'Invoiced', in_progress: 'In progress', cancelled: 'Cancelled', awaiting_invoice: 'Awaiting invoice', other: 'Other'};
export const profileColors = ['#0f766e', '#2563eb', '#d97706', '#7c3aed'];
const normalize = value => String(value || 'All').trim().replace(/\s+/g, ' ').toLowerCase();

export function scopeOf(value = {}) {
  const scope = Object.fromEntries(['bd','tl','franchise'].map(key => [key, normalize(value[key]) === 'all' ? 'All' : String(value[key]).trim().replace(/\s+/g, ' ')]));
  const active = Object.keys(scope).filter(key => scope[key] !== 'All');
  return {...scope, key: JSON.stringify(['bd','tl','franchise'].map(key => normalize(scope[key]))),
    type: active.length === 1 ? active[0] : active.length ? 'combo' : 'company',
    label: active.map(key => scope[key]).join(' + ') || 'Overall portfolio'};
}

export function todayInIndia(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const part = key => parts.find(value => value.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function financialYear(date = todayInIndia()) {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `FY ${start}-${String(start+1).slice(-2)}`;
}

export function valueText(value, metric = 'company_share', compact = false) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  if (metric === 'deals') return new Intl.NumberFormat('en-IN', {maximumFractionDigits: 1}).format(Number(value));
  return (compact ? formatLakhs : formatCurrency)(value);
}

export function validateAudit(data, scopes, fy, asOf) {
  if (!data || !data.period || !Array.isArray(data.profiles) || data.profiles.length !== scopes.length) throw new Error('The server returned an incomplete profile audit.');
  const year = String(fy).match(/\d{4}/)?.[0];
  const expectedFy = `${year}-${String(Number(year)+1).slice(-2)}`;
  const expectedEnd = asOf < `${Number(year)+1}-03-31` ? asOf : `${Number(year)+1}-03-31`;
  if (data.period.financial_year !== expectedFy || data.period.as_of !== expectedEnd) throw new Error('The returned audit belongs to a different reporting period.');
  const expected = new Set(scopes.map(scope => scopeOf(scope).key));
  for (const profile of data.profiles) {
    if (!profile?.scope || !expected.delete(profile.scope.key) || !Array.isArray(profile.monthly) || profile.monthly.length !== 12 ||
        !Array.isArray(profile.deals) || !Array.isArray(profile.goals) || !profile.payroll || !profile.financial || !profile.fixed_expense) throw new Error('The returned profiles do not match this comparison.');
    for (const key of ['companies','deals','revenue','company_share','gross_billed','in_progress','cancelled']) {
      if (profile.totals?.[key] === null || profile.totals?.[key] === undefined || !Number.isFinite(Number(profile.totals[key]))) throw new Error('A required profile total is missing or invalid.');
    }
    for (const [object, fields] of [[profile.financial,['salary_ratio','contribution','tax_estimate','surplus_estimate']],
      [profile.payroll,['ctc','net_payable']],[profile.fixed_expense,['amount']]]) {
      if (fields.some(field=>object[field] === undefined || (object[field] !== null && !Number.isFinite(Number(object[field]))))) throw new Error('Financial coverage fields are incomplete. Refresh after the backend deployment.');
    }
    if (!Array.isArray(profile.payroll.records) || !Array.isArray(profile.payroll.months) || !profile.payroll.missing_closed_months || !profile.projection?.rates) throw new Error('Payroll or projection details are missing.');
  }
  return data;
}

export function plotData(profile, metric, cumulative = false) {
  let actualSum = 0, projectedSum = 0;
  let projectionValid = true;
  return profile.monthly.map(row => {
    const value = Number(row[metric]);
    const projected = row[`projected_${metric}`];
    if (!row.future) actualSum += value;
    if (projected === null || projected === undefined) projectionValid = false;
    else projectedSum += Number(projected);
    return {month: row.month, partial: row.partial, future: row.future,
      actual: row.future ? null : cumulative ? actualSum : value,
      projected: projectionValid ? cumulative ? projectedSum : Number(projected) : null};
  });
}

export function targetPlan(month, goal, period, cumulative) {
  if (!goal) return null;
  const start = Date.parse(`${period.start}T00:00:00Z`), due = Date.parse(`${goal.due_date}T00:00:00Z`);
  const [year, number] = month.split('-').map(Number);
  const first = Date.UTC(year, number-1, 1), last = Date.UTC(year, number, 0);
  const asOf = Date.parse(`${period.as_of}T00:00:00Z`);
  const stop = Math.min(due, month === period.as_of.slice(0,7) ? asOf : last);
  const day = 86400000;
  const full = (due-start)/day+1;
  const elapsed = Math.max(0, (stop-Math.max(start, cumulative ? start : first))/day+1);
  return full > 0 ? goal.target * Math.min(full,elapsed)/full : null;
}

export function outlook(profile, metric) {
  const points = plotData(profile,metric);
  return points.some(row => row.projected === null) ? null : points.reduce((sum,row) => sum+row.projected,0);
}

export function auditCsv(rows) {
  const cell = value => {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ['Date','Stage','Company','Position','Bill number','Revenue excluding GST','Recorded company share'];
  return '\uFEFF'+[header,...rows.map(row=>[row.date,stageLabels[row.stage] || row.stage,row.company,row.position,row.bill,row.revenue,row.company_share])]
    .map(row=>row.map(cell).join(',')).join('\r\n');
}
