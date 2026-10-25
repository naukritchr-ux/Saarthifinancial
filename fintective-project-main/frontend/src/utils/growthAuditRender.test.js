import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';
let server,Chart,components;
const fixture=JSON.parse(fs.readFileSync(new URL('./growthAudit.fixture.json',import.meta.url),'utf8'));
before(async()=>{
  server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
  ({default:Chart}=await server.ssrLoadModule('/src/components/GrowthAuditChart.jsx'));
  components=await server.ssrLoadModule('/src/pages/GrowthTracking.jsx');
});
after(async()=>{await server?.close();});
test('loaded comparison and projection chart renders real backend data without undefined indices',()=>{
  for (const cumulative of [true,false]) {
    const html=renderToString(React.createElement(Chart,{profiles:fixture.profiles,period:fixture.period,metric:'company_share',cumulative}));
    assert.match(html,/Example BD/);assert.match(html,/Example TL/);assert.match(html,/Primary target plan/);
    assert.doesNotMatch(html,/NaN|Infinity/);
  }
});
test('financial table uses recorded payroll and explicit contribution from the contract',()=>{
  const html=renderToString(React.createElement(components.CompareTable,{profiles:fixture.profiles,onCost:()=>{}}));
  assert.match(html,/₹700/);assert.match(html,/₹1,100/);assert.match(html,/Payroll CTC/);
});
test('payroll source audit exposes matched records and net payable separately',()=>{
  const html=renderToString(React.createElement(components.PayrollAudit,{profile:fixture.profiles[0]}));
  assert.match(html,/Example BD/);assert.match(html,/Net payable/);assert.match(html,/₹665/);
});
test('fixed-expense save requires an explicit basis instead of assuming legacy costs are monthly',()=>{
  const profile=structuredClone(fixture.profiles[0]);profile.fixed_expense={...profile.fixed_expense,basis:null,legacy_amount:150000,input_amount:undefined};
  const html=renderToString(React.createElement(components.CostModal,{profile,period:fixture.period,onClose:()=>{},onSave:()=>{}}));
  assert.match(html,/Choose the meaning of this amount/);assert.match(html,/Total for the displayed period/);assert.match(html,/Fixed monthly rate/);
});
test('growth goal source form includes metric, deadline, baseline and action plan',()=>{
  const html=renderToString(React.createElement(components.GoalModal,{profile:fixture.profiles[0],period:fixture.period,onClose:()=>{},onSave:()=>{}}));
  assert.match(html,/Company share/);assert.match(html,/Due date/);assert.match(html,/Action plan/);assert.match(html,/Save growth target/);
});
