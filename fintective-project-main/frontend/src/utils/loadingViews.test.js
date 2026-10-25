import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';

let server, finance, FilterProvider;
const originals = {};
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    originals[key] = globalThis[key];
    const values = new Map();
    globalThis[key] = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)};
  }
  localStorage.setItem('saarthi_current_user', JSON.stringify({name: 'Synthetic Test User', role: 'admin'}));
  server = await createServer({server: {middlewareMode: true, hmr: false}, appType: 'custom', logLevel: 'error'});
  finance = await server.ssrLoadModule('/src/context/FinanceContext.jsx');
  ({FilterProvider} = await server.ssrLoadModule('/src/context/FilterContext.jsx'));
});
after(async () => {
  await server?.close();
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

test('the screenshot card renders loading instead of invented zero financial figures', async () => {
  const {default: Card} = await server.ssrLoadModule('/src/components/FinancialPerformanceCard.jsx');
  const html = renderToString(React.createElement(Card));
  assert.match(html, /Loading financial performance/);
  assert.doesNotMatch(html, /₹0|0\.0%|0 invoiced deals|Save Inputs/);
});

test('partial and offline banners render an accurate data state', async () => {
  const {default: Banner} = await server.ssrLoadModule('/src/components/DataStateBanner.jsx');
  for (const state of ['partial', 'offline']) {
    const html = renderToString(React.createElement(finance.FinanceContext.Provider, {
      value: {dataState: state, fetchAllData: () => {}, authError: 'Synthetic connection error'}
    }, React.createElement(Banner)));
    assert.match(html, state === 'partial' ? /Some finance sections/ : /Finance data unavailable/);
    assert.doesNotMatch(html, /Sample Data/);
  }
});

test('top badge shows the same recorded result as the waterfall instead of the gross transaction spread', async () => {
  const {default: Topbar} = await server.ssrLoadModule('/src/components/Topbar.jsx');
  const html = renderToString(React.createElement(finance.FinanceContext.Provider, {value: {
    selectedYear:'2026-2027',selectedMonth:'All Months',availableYears:['2026-2027'],availableMonths:['All Months'],
    userRole:'admin',activeModule:'franchise_bd',dataState:'live',timeAgo:'just now',currentUser:{name:'Synthetic Manager'},
    moduleFilteredTransactions:[
      {type:'income',date:'2026-10-01',financialYear:'2026-2027',amount:62800000},
      {type:'expense',date:'2026-10-02',financialYear:'2026-2027',amount:20800000}
    ],
    financeSummary:{period:{start_date:'2026-04-01'},accounting_status:'needs_payroll_reconciliation',net:null,
      revenue:52100000,our_share:14550000,operating_expenses:3000000,salaries:11000000,
      cash_breakdown:{unreconciled_cost_result:550000}},
    fetchAllData:()=>{},setSelectedYear:()=>{},setSelectedMonth:()=>{}
  }}, React.createElement(Topbar,{activePage:'dashboard'})));
  assert.match(html,/Recorded operating difference.*FY 2026-2027/);
  assert.match(html,/₹5\.50L/);
  assert.match(html,/payroll reconciliation pending/);
  assert.doesNotMatch(html,/₹4\.20 Cr|P&amp;L/);
});

test('unreconciled booked-cost waterfall renders a negative result without a net-profit label', async () => {
  const {WaterfallChart} = await server.ssrLoadModule('/src/components/CustomCharts.jsx');
  const html=renderToString(React.createElement(WaterfallChart,{
    grossRevenue:400000,companyShare:100000,operatingExpenses:200000,payroll:20000,netProfit:-120000,
    resultLabel:'Recorded diff',resultDetail:'Unreconciled booked-cost difference; not verified profit',
    payrollRows:1,unreconciled:true,height:200
  }));
  assert.match(html,/Recorded diff/);
  assert.match(html,/Unreconciled booked-cost difference/);
  assert.match(html,/₹1\.2 L/);
  assert.doesNotMatch(html,/Net Profit|NaN|Infinity/);
});

test('dashboard cards show the backend recorded difference and ratio while payroll is under review', async () => {
  const {default: Dashboard}=await server.ssrLoadModule('/src/pages/Dashboard.jsx');
  const summary={period:{start_date:'2026-04-01',end_date:'2026-10-25'},accounting_status:'needs_payroll_reconciliation',
    revenue:400000,our_share:100000,operating_expenses:200000,salaries:20000,net:null,
    cash_breakdown:{unreconciled_cost_result:-120000,sources:{payroll_records:{rows:1}}}};
  const html=renderToString(React.createElement(finance.FinanceContext.Provider,{value:{
    moduleFilteredTransactions:[
      {id:'synthetic-income',type:'income',date:'2026-10-01',financialYear:'2026-2027',amount:62800000},
      {id:'synthetic-expense',type:'expense',date:'2026-10-02',financialYear:'2026-2027',amount:20800000}
    ],selectedMonth:'All Months',selectedYear:'2026-2027',
    budgets:{},userRole:'admin',franchisees:[],bdAgents:[],activeModule:'franchise_bd',
    backendHealth:null,isLoadingData:false,financeSummary:summary
  }},React.createElement(Dashboard,{setActivePage:()=>{}})));
  assert.match(html,/Operating Result \(Booked Costs\)/);
  assert.match(html,/Estimated Operating Margin/);
  assert.match(html,/-₹1\.20L/);
  assert.match(html,/-120\.0%/);
  assert.match(html,/Recorded diff/);
  assert.match(html,/Payroll reconciliation pending/);
  const cards=html.match(/<section class="dash-kpi-grid">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(cards);
  assert.match(cards,/Invoice Revenue \(ex-GST\)/);
  assert.match(cards,/₹4\.00L/);
  assert.match(cards,/Booked Costs/);
  assert.match(cards,/₹2\.20L/);
  assert.doesNotMatch(cards,/₹6\.28 Cr|₹2\.08 Cr|₹4\.20 Cr/);
  assert.match(html,/Ledger Income vs Expenses/);
  assert.match(html,/Exclusion count unavailable/);
  assert.doesNotMatch(html,/18 bills excluded|Ledger Verified/);
});

for (const name of ['Dashboard', 'Franchisees', 'BDPerformance', 'TLPerformance', 'JobPortalAnalytics',
  'CashOutflow', 'Reports', 'RunwayRoiTracker', 'GrowthTracking', 'IndustryAnalysis', 'CostOfPerformance']) {
  test(`${name} renders with an empty initial cache`, async () => {
    const {default: Page} = await server.ssrLoadModule(`/src/pages/${name}.jsx`);
    const html = renderToString(React.createElement(finance.FinanceProvider, null,
      React.createElement(FilterProvider, null,
        React.createElement(Page, {setActivePage: () => {}, setIsSettingsOpen: () => {}}))));
    assert.ok(html.length > 0);
  });
}
