import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditCsv, financialYear, outlook, plotData, scopeOf, targetPlan, todayInIndia, validateAudit, valueText} from './growthAudit.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./growthAudit.fixture.json',import.meta.url),'utf8'));
const scopes=fixture.profiles.map(profile=>profile.scope);

test('the actual backend contract matches the compared profiles and dates',()=>{
  assert.equal(validateAudit(fixture,scopes,'FY 2026-27','2026-10-25'),fixture);
});
test('an older FY, as-of date or profile response cannot populate the current screen',()=>{
  assert.throws(()=>validateAudit(fixture,scopes,'FY 2025-26','2026-03-31'));
  assert.throws(()=>validateAudit(fixture,scopes,'FY 2026-27','2026-10-24'));
  assert.throws(()=>validateAudit(fixture,[scopeOf({bd:'Another person'}),...scopes.slice(1)],'FY 2026-27','2026-10-25'));
});
test('missing financial coverage fields are rejected instead of causing zero or NaN figures',()=>{
  const broken=structuredClone(fixture);delete broken.profiles[0].financial.salary_ratio;
  assert.throws(()=>validateAudit(broken,scopes,'FY 2026-27','2026-10-25'));
  broken.profiles[0].financial.salary_ratio=null;
  assert.doesNotThrow(()=>validateAudit(broken,scopes,'FY 2026-27','2026-10-25'));
});
test('all, BD, TL, franchise and combined profile keys match server normalization',()=>{
  assert.equal(scopeOf({}).key,'["all","all","all"]');
  assert.equal(scopeOf({bd:' Example   BD ',tl:'All'}).key,scopes[0].key);
  assert.equal(scopeOf({bd:'A',tl:'B'}).type,'combo');
  assert.equal(scopeOf({franchise:'Example Partner'}).key,scopes[2].key);
});
test('reporting date and FY use the Indian calendar across a UTC day boundary',()=>{
  assert.equal(todayInIndia(new Date('2026-10-24T20:00:00Z')),'2026-10-25');
  assert.equal(financialYear('2026-03-31'),'FY 2025-26');
  assert.equal(financialYear('2026-04-01'),'FY 2026-27');
});
test('unknown financial values display as unavailable while genuine zero stays zero',()=>{
  assert.equal(valueText(null),'—');assert.equal(valueText(undefined),'—');
  assert.equal(valueText('bad'),'—');assert.equal(valueText(0),'₹0');
});
test('future months are not plotted as zero actual revenue',()=>{
  const points=plotData(fixture.profiles[0],'company_share');
  assert.equal(points[6].actual,150);assert.equal(points[7].actual,null);
  assert.equal(points[7].projected,300);
});
test('cumulative recorded values stop at the reporting date and reconcile totals',()=>{
  const points=plotData(fixture.profiles[0],'company_share',true);
  assert.equal(points[6].actual,1950);assert.equal(points[7].actual,null);
  assert.equal(points[11].projected,outlook(fixture.profiles[0],'company_share'));
});
test('missing forecast history never becomes a zero-valued projection',()=>{
  const profile=structuredClone(fixture.profiles[0]);profile.monthly[7].projected_company_share=null;
  assert.equal(outlook(profile,'company_share'),null);
});
test('target plan respects the deadline and uses current month-to-date pacing',()=>{
  const goal=fixture.profiles[0].goals[0],period=fixture.period;
  assert.ok(targetPlan('2026-10',goal,period,true)<3000);
  assert.equal(targetPlan('2027-03',goal,period,true),3000);
  const earlier={...goal,due_date:'2026-09-30'};
  assert.equal(targetPlan('2026-10',earlier,period,false),0);
  assert.equal(targetPlan('2026-10',earlier,period,true),3000);
});
test('CSV export escapes company text and neutralizes spreadsheet formulas',()=>{
  const csv=auditCsv([{date:'2026-10-01',company:'=HYPERLINK("x")',position:'Analyst, senior',bill:'B1',stage:'invoiced',revenue:100,company_share:null}]);
  assert.match(csv,/'=HYPERLINK/);assert.match(csv,/"Analyst, senior"/);
  assert.match(csv,/"Date","Stage"/);assert.ok(csv.startsWith('\uFEFF'));
});
