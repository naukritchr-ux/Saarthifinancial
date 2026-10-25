import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookedCostFigures,bookedResultView,recordedSpread,selectedFinanceStart} from './bookedResult.js';

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
test('the previous header arithmetic remains available as a clearly separate recorded spread',()=>{
  const rows=[{type:'income',amount:62800000,date:'2026-10-01',financialYear:'2026-2027'},
    {type:'expense',amount:20800000,date:'2026-10-02',financialYear:'2026-2027'},
    {type:'income',amount:500000,date:'2025-05-01',financialYear:'2025-2026'}];
  assert.deepEqual(recordedSpread(rows,'All Months','2026-2027'),{income:62800000,expense:20800000,difference:42000000});
  assert.deepEqual(recordedSpread(rows,'October 2026','2026-2027'),{income:62800000,expense:20800000,difference:42000000});
  assert.equal(recordedSpread(null,'All Months','2026-2027'),null);
  assert.equal(recordedSpread([...rows,{type:'expense',amount:undefined,date:'2026-10-03',financialYear:'2026-2027'}],'All Months','2026-2027'),null);
});
test('review status preserves recorded booked-cost numbers for the cards and waterfall',()=>{
  const reported={...summary,our_share:100000,revenue:400000,operating_expenses:200000,salaries:20000,
    cash_breakdown:{unreconciled_cost_result:-120000,sources:{payroll_records:{rows:1}}}};
  const view=bookedResultView({...selection,summary:reported});
  const figures=bookedCostFigures(reported,view);
  assert.deepEqual(figures,{result:-120000,ratio:-120,unreconciled:true,chartReady:true});
  assert.equal(bookedCostFigures({...reported,cash_breakdown:{}},view).result,null);
  assert.equal(bookedCostFigures(reported,{status:'loading',value:null}).result,null);
});
