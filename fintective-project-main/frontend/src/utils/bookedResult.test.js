import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookedResultView,selectedFinanceStart} from './bookedResult.js';

const selection={selectedYear:'2026-2027',selectedMonth:'All Months',userRole:'admin',activeModule:'franchise_bd'};
const summary={period:{start_date:'2026-04-01',end_date:'2026-10-25'},accounting_status:'needs_payroll_reconciliation',net:null};

test('the screenshot cannot show a numeric P&L badge while booked costs need review',()=>{
  const result=bookedResultView({...selection,summary});
  assert.equal(result.status,'needs_review');assert.equal(result.value,null);
  assert.match(result.label,/Operating result \(FY 2026-2027\)/);
});
test('only the matching, provisional backend result can be shown as a numeric result',()=>{
  const ready={...summary,accounting_status:'provisional_booked_costs',net:0};
  assert.equal(bookedResultView({...selection,summary:ready}).value,0);
  assert.equal(bookedResultView({...selection,summary:{...ready,period:{start_date:'2025-04-01'}}}).status,'loading');
  assert.equal(bookedResultView({...selection,summary:{...ready,net:NaN}}).status,'unavailable');
});
test('a selected calendar month overrides the FY when matching the summary period',()=>{
  const selected={...selection,selectedMonth:'October 2026'};
  assert.equal(selectedFinanceStart(selected.selectedMonth,selected.selectedYear),'2026-10-01');
  assert.equal(bookedResultView({...selected,summary:{...summary,period:{start_date:'2026-10-01'}}}).status,'needs_review');
});
test('portfolio and job-portal roles cannot expose an unscoped company result',()=>{
  const ready={...summary,accounting_status:'provisional_booked_costs',net:42000000};
  assert.equal(bookedResultView({...selection,userRole:'bd_1',summary:ready}).status,'not_applicable');
  assert.equal(bookedResultView({...selection,activeModule:'job_portal',summary:ready}).status,'not_applicable');
  assert.equal(bookedResultView({...selection,summary:null,error:'Backend unavailable'}).status,'unavailable');
});
