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

test('top badge follows booked-cost reconciliation instead of gross income minus expenditure', async () => {
  const {default: Topbar} = await server.ssrLoadModule('/src/components/Topbar.jsx');
  const html = renderToString(React.createElement(finance.FinanceContext.Provider, {value: {
    selectedYear:'2026-2027',selectedMonth:'All Months',availableYears:['2026-2027'],availableMonths:['All Months'],
    userRole:'admin',activeModule:'franchise_bd',dataState:'live',timeAgo:'just now',currentUser:{name:'Synthetic Manager'},
    financeSummary:{period:{start_date:'2026-04-01'},accounting_status:'needs_payroll_reconciliation',net:null},
    fetchAllData:()=>{},setSelectedYear:()=>{},setSelectedMonth:()=>{}
  }}, React.createElement(Topbar,{activePage:'dashboard'})));
  assert.match(html,/Operating result \(FY 2026-2027\)/);
  assert.match(html,/Needs payroll review/);
  assert.doesNotMatch(html,/P&amp;L|₹4\.20 Cr/);
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
