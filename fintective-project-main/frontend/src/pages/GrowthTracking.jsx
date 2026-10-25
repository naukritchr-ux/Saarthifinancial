import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {FinanceContext, API_BASE_URL} from '../context/FinanceContext';
import {fetchWithApiKey} from '../utils/apiClient';
import {Target, RefreshCw, Plus, X, Download, AlertTriangle, TrendingUp, Users, Landmark, FileText, Settings2} from 'lucide-react';
import GrowthAuditChart from '../components/GrowthAuditChart';
import {auditCsv, financialYear, metricLabels, outlook, profileColors, scopeOf, stageLabels, todayInIndia, validateAudit, valueText} from '../utils/growthAudit.js';
import './GrowthAudit.css';

const plainScope = scope => Object.fromEntries(['bd','tl','franchise'].map(key=>[key,scope[key]]));
const number = value => valueText(value,'deals');
const dateLabel = value => value ? new Date(value+'T00:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : '—';

function initialFilters() {
  const defaults={bd:'All',tl:'All',franchise:'All',fy:financialYear(),as_of:todayInIndia(),tab:'overview'};
  try {
    const params=new URLSearchParams(window.location.search);
    return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,params.get(key)||value]));
  } catch { return defaults; }
}

function ErrorBox({message, retry}) {
  return <div className="ga-error" role="alert"><AlertTriangle size={19}/><div><strong>Profile data unavailable</strong><p>{message}</p></div>
    {retry && <button className="ga-button" onClick={retry}>Retry loading</button>}</div>;
}

export function CompareTable({profiles,onCost,busy}) {
  const rows=[
    ['Companies',profile=>number(profile.totals.companies)],
    ['Invoiced deals',profile=>number(profile.totals.deals)],
    ['Revenue excluding GST',profile=>valueText(profile.totals.revenue)],
    ['Billing including GST',profile=>valueText(profile.totals.gross_billed)],
    ['Recorded company share',profile=>valueText(profile.totals.company_share)],
    ['Payroll CTC for this period',profile=>valueText(profile.payroll.ctc)],
    ['Fixed non-payroll expense',profile=>valueText(profile.fixed_expense.amount)],
    ['Salary ÷ company share',profile=>profile.financial.salary_ratio === null ? '—' : `${profile.financial.salary_ratio.toFixed(1)}%`],
    ['Contribution from recorded costs',profile=>valueText(profile.financial.contribution)],
    ['Tax estimate (25% assumption)',profile=>valueText(profile.financial.tax_estimate)],
    ['Surplus estimate',profile=>valueText(profile.financial.surplus_estimate)],
    ['In-progress enquiries',profile=>number(profile.totals.in_progress)],
    ['Cancelled enquiries',profile=>number(profile.totals.cancelled)],
  ];
  return <div className="ga-table-scroll"><table className="ga-comparison"><thead><tr><th>Financial performance & activity</th>
    {profiles.map((profile,index)=><th key={profile.scope.key}><span className="ga-profile-dot" style={{background:profileColors[index]}}/>{profile.scope.label}
      <small>{profile.scope.type === 'company' ? 'Company portfolio' : profile.scope.type.toUpperCase()}{profile.payroll.allocated ? ' · allocated payroll estimate' : ''}</small></th>)}</tr></thead>
    <tbody>{rows.map(([title,display],index)=><tr key={title} className={[4,8,10].includes(index) ? 'ga-emphasis' : ''}><th>{title}</th>
      {profiles.map(profile=><td key={profile.scope.key}>{display(profile)}
        {index===5 && <small>{profile.payroll.months.length ? `${profile.payroll.months.join(', ')}` : 'No usable payroll match'}</small>}
        {index===6 && <small>{profile.fixed_expense.basis === 'monthly' ? 'Monthly rate · prorated estimate' : profile.fixed_expense.amount !== null ? 'Confirmed total for displayed period' : 'Period needs confirmation'}</small>}
        {index===8 && <small>{profile.financial.contribution === null ? 'Payroll and expense period required' : profile.financial.cost_coverage_complete ? (profile.financial.estimated ? 'Allocation estimate' : 'Recorded costs') : 'Partial cost coverage'}</small>}
      </td>)}</tr>)}</tbody></table>
    <p className="ga-note">Payroll comes from recorded CTC, not a saved manual salary. Net payable is shown in the payroll audit. Contribution excludes unrecorded costs and is not a bank balance.</p>
    <button className="ga-button" disabled={busy} onClick={()=>onCost(profiles[0])}><Settings2 size={15}/>Set fixed expense for {profiles[0].scope.label}</button>
  </div>;
}

export function CostModal({profile,period,onClose,onSave,busy,error}) {
  const saved=profile.fixed_expense;
  const [basis,setBasis]=useState(saved.basis || '');
  const [amount,setAmount]=useState(saved.input_amount ?? saved.legacy_amount ?? '');
  const [note,setNote]=useState(saved.note || '');
  return <div className="ga-modal-shade"><section className="ga-modal" role="dialog" aria-modal="true" aria-labelledby="ga-cost-title">
    <header><div><h2 id="ga-cost-title">Fixed expense allocation</h2><p>{profile.scope.label} · {dateLabel(period.start)}–{dateLabel(period.as_of)}</p></div>
      <button className="ga-icon" aria-label="Close expense form" disabled={busy} onClick={onClose}><X/></button></header>
    <form onSubmit={event=>{event.preventDefault();onSave({basis,amount,note});}}>
      <p className="ga-note">Allocate non-payroll overhead for this portfolio. Payroll CTC is included separately; exclude costs already included in that CTC.</p>
      {saved.legacy_amount !== null && !saved.basis && <div className="ga-notice">Earlier input: {valueText(saved.legacy_amount)}. Its period was never saved. Choose a basis before using it.</div>}
      <label>Expense basis<select required value={basis} onChange={event=>setBasis(event.target.value)}>
        <option value="">Choose the meaning of this amount</option><option value="period_total">Total for the displayed period</option><option value="monthly">Fixed monthly rate — estimate</option>
      </select></label>
      <label>{basis==='monthly' ? 'Monthly non-payroll amount (₹)' : 'Non-payroll total for this period (₹)'}
        <input required type="number" min="0" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)}/></label>
      {basis==='monthly' && <p className="ga-note">The monthly rate is applied from the FY start. Partial months are prorated by calendar days and clearly marked as estimates.</p>}
      {basis==='period_total' && <p className="ga-note">This total is valid for the dates above. A later reporting end date requires reviewing the total.</p>}
      <label>Allocation note<textarea value={note} maxLength={2000} onChange={event=>setNote(event.target.value)} placeholder="Which overheads are included, and how were they allocated?"/></label>
      {error && <p className="ga-inline-error" role="alert">{error}</p>}
      <footer><button type="button" className="ga-button" disabled={busy} onClick={onClose}>Cancel</button><button className="ga-button ga-primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense basis'}</button></footer>
    </form>
  </section></div>;
}

export function GoalModal({profile,period,onClose,onSave,busy,error}) {
  const [metric,setMetric]=useState('company_share');
  const [target,setTarget]=useState('');
  const [due,setDue]=useState(period.fy_end);
  const [note,setNote]=useState('');
  const expected=outlook(profile,metric);
  return <div className="ga-modal-shade"><section className="ga-modal" role="dialog" aria-modal="true" aria-labelledby="ga-goal-title">
    <header><div><h2 id="ga-goal-title">Set a profile growth target</h2><p>{profile.scope.label} · FY {period.financial_year}</p></div><button className="ga-icon" aria-label="Close target form" disabled={busy} onClick={onClose}><X/></button></header>
    <form onSubmit={event=>{event.preventDefault();onSave({metric,target,due_date:due,note});}}>
      <label>Target metric<select value={metric} onChange={event=>{setMetric(event.target.value);setTarget('');}}>{Object.entries(metricLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <div className="ga-two"><div className="ga-form-stat"><small>Recorded to date</small><strong>{valueText(profile.totals[metric],metric)}</strong></div><div className="ga-form-stat"><small>FY run-rate outlook</small><strong>{valueText(expected,metric)}</strong></div></div>
      <label>Total FY target {metric==='deals' ? '(deals)' : '(₹)'}<input required type="number" min={metric==='deals' ? 1 : .01} step={metric==='deals' ? 1 : .01} value={target} onChange={event=>setTarget(event.target.value)}/></label>
      <div className="ga-inline">{[10,20,30].map(percent=><button type="button" className="ga-button ga-small" disabled={expected===null} key={percent} onClick={()=>setTarget(metric==='deals' ? Math.ceil(expected*(1+percent/100)) : (expected*(1+percent/100)).toFixed(2))}>Outlook +{percent}%</button>)}</div>
      <label>Due date<input required type="date" min={todayInIndia()} max={period.fy_end} value={due} onChange={event=>setDue(event.target.value)}/></label>
      <label>Action plan<textarea value={note} maxLength={2000} onChange={event=>setNote(event.target.value)} placeholder="Accounts to pursue, pipeline actions, reviews and support needed"/></label>
      <p className="ga-note">The target uses this profile, metric and FY. Progress follows recorded invoices; the baseline snapshot stays attached to the saved goal. A new goal replaces the active goal for the same metric and preserves its history.</p>
      {error && <p className="ga-inline-error" role="alert">{error}</p>}
      <footer><button type="button" className="ga-button" disabled={busy} onClick={onClose}>Cancel</button><button className="ga-button ga-primary" disabled={busy}>{busy ? 'Saving…' : 'Save growth target'}</button></footer>
    </form>
  </section></div>;
}

export function GoalSetter({profile,period,metric,onSave,busy,error}) {
  const active=profile.goals.find(goal=>goal.status==='active' && goal.metric===metric);
  const today=todayInIndia();
  const [target,setTarget]=useState(active?.target ?? '');
  const [due,setDue]=useState(active?.due_date >= today ? active.due_date : period.fy_end);
  const [note,setNote]=useState(active?.note || '');
  const expected=outlook(profile,metric);
  const missingShare=metric==='company_share' && profile.totals.missing_share_rows>0;
  const closed=period.fy_end<today;
  return <div className="ga-goal-setter">
    <div className="ga-goal-setter-heading"><div><span className="ga-eyebrow">GROWTH GOAL SETTER</span><h4>{profile.scope.label} · {metricLabels[metric]}</h4>
      <p>Choose a measurable total and a deadline. The dotted line on the graph shows the saved goal's pace.</p></div>
      {active && <span className="ga-badge">Current: {valueText(active.target,metric)} by {dateLabel(active.due_date)}</span>}
    </div>
    {active && <p className="ga-note">Recorded by deadline: {valueText(active.actual,metric)} · Remaining: {valueText(active.gap,metric)} · {active.pace_status.replaceAll('_',' ')}. Replacing this goal keeps the previous version in Targets & progress.</p>}
    {closed ? <p className="ga-note">This financial year has ended. Select a current FY to save a new goal.</p> :
      <form onSubmit={event=>{event.preventDefault();onSave({metric,target,due_date:due,note});}}>
        <label>Goal target {metric==='deals'?'(deals)':'(₹)'}<input required type="number" min={metric==='deals'?1:.01} step={metric==='deals'?1:.01} value={target} onChange={event=>setTarget(event.target.value)}/></label>
        <label>Deadline<input required type="date" min={today} max={period.fy_end} value={due} onChange={event=>setDue(event.target.value)}/></label>
        <label>Action plan (optional)<input type="text" maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} placeholder="What will help this profile reach the goal?"/></label>
        <button className="ga-button ga-primary" disabled={busy || missingShare}><Target size={15}/>{busy?'Saving…':active?'Update goal':'Save goal'}</button>
      </form>}
    {expected!==null && !closed && <p className="ga-note">FY run-rate outlook for this metric: {valueText(expected,metric)}. Use it as a reference when choosing the goal.</p>}
    {missingShare && <p role="alert" className="ga-inline-error">Some invoice company shares are missing. Reconcile them before saving a company-share goal, or select a different metric.</p>}
    {error && <p role="alert" className="ga-inline-error">{error}</p>}
  </div>;
}

export function PayrollAudit({profile}) {
  const payroll=profile.payroll;
  return <section className="ga-panel"><header><div><h3>Payroll & expense audit</h3><p>Recorded cost sources for {profile.scope.label}</p></div><FileText size={19}/></header>
    <p className="ga-note">{payroll.method}</p>
    {profile.legacy_salary !== null && <div className="ga-notice">The old manual salary of {valueText(profile.legacy_salary)} is retained in storage but is not used in this audit.</div>}
    {payroll.records.length ? <div className="ga-table-scroll"><table><thead><tr><th>Month</th><th>Employee</th><th>Allocation</th><th>CTC cost</th><th>Net payable</th></tr></thead><tbody>
      {payroll.records.map((row,index)=><tr key={row.id+'-'+index}><td>{row.month}</td><td>{row.name}</td><td>{row.allocation_percent}%</td><td>{valueText(row.ctc)}</td><td>{valueText(row.net_payable)}</td></tr>)}
    </tbody><tfoot><tr><th colSpan="3">Recorded total</th><th>{valueText(payroll.ctc)}</th><th>{valueText(payroll.net_payable)}</th></tr></tfoot></table></div> : <p className="ga-empty">Payroll has not been matched for this profile.</p>}
    {Object.entries(payroll.missing_closed_months).map(([name,months])=><p key={name} className="ga-inline-error">No closed-month payroll row for {name}: {months.join(', ')}. Check employment dates and sync coverage.</p>)}
    {payroll.current_month_unrecorded && <p className="ga-note">No matched payroll has been recorded for the reporting end month.</p>}
    <p className="ga-note">Directly attributed expenditure: {profile.fixed_expense.ledger_available ? `${valueText(profile.fixed_expense.direct_ledger_total_raw)} across ${profile.fixed_expense.direct_ledger_rows} rows` : 'unavailable'}. {profile.fixed_expense.ledger_note}</p>
  </section>;
}

export default function GrowthTracking() {
  const finance=useContext(FinanceContext);
  const role=String(finance.currentUser?.role || finance.userRole || '').toLowerCase();
  const allowed=['admin','manager','head_office'].includes(role);
  const [filters,setFilters]=useState(initialFilters);
  const [pins,setPins]=useState(()=>{try { const stored=JSON.parse(localStorage.getItem('fintective_growth_pins_v2') || '[]'); return Array.isArray(stored) ? stored.slice(0,3).map(scopeOf) : []; } catch { return []; }});
  const [options,setOptions]=useState({bds:[],tls:[],franchises:[],fys:[]});
  const [optionsError,setOptionsError]=useState('');
  const [payload,setPayload]=useState({key:null,status:'loading',data:null,error:null});
  const [refreshToken,setRefreshToken]=useState(0);
  const [metric,setMetric]=useState('company_share');
  const [cumulative,setCumulative]=useState(false);
  const [showProjection,setShowProjection]=useState(true);
  const [search,setSearch]=useState('');
  const [stage,setStage]=useState('all');
  const [page,setPage]=useState(1);
  const [editor,setEditor]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [notice,setNotice]=useState('');
  const latestRequest=useRef(0), forceNext=useRef(false);
  const current=useMemo(()=>scopeOf({bd:filters.bd,tl:filters.tl,franchise:filters.franchise}),[filters.bd,filters.tl,filters.franchise]);
  const scopes=useMemo(()=>[current,...pins.filter(pin=>pin.key!==current.key)].slice(0,4),[current,pins]);
  const signature=JSON.stringify([filters.fy,filters.as_of,scopes.map(scope=>scope.key),role]);
  const requestKey=signature+'|'+refreshToken;
  const data=payload.key===requestKey && payload.status==='ready' ? payload.data : null;
  const loading=payload.key!==requestKey || payload.status==='loading';
  const primary=data?.profiles[0];
  const activeTab=['overview','plan_ahead','deals','targets'].includes(filters.tab) ? filters.tab : 'overview';
  const refresh=()=>{forceNext.current=true;setRefreshToken(value=>value+1);};

  useEffect(()=> {
    if (!allowed) return;
    const controller=new AbortController();
    fetchWithApiKey(`${API_BASE_URL}/growth-targets/filter-options`,{signal:controller.signal})
      .then(async response=>{if (!response.ok) throw new Error(`Profile list HTTP ${response.status}`);return response.json();})
      .then(result=>{if (!controller.signal.aborted) {setOptions(result);setOptionsError('');}})
      .catch(error=>{if (!controller.signal.aborted) setOptionsError(error.message);});
    return ()=>controller.abort();
  },[allowed,role]);

  useEffect(()=> {
    if (!allowed) return;
    const id=++latestRequest.current, controller=new AbortController();
    const params=new URLSearchParams({fy:filters.fy,as_of:filters.as_of,scopes:JSON.stringify(scopes.map(plainScope)),role});
    if (forceNext.current) {params.set('refresh','1');forceNext.current=false;}
    fetchWithApiKey(`${API_BASE_URL}/growth/profile-audit?${params}`,{signal:controller.signal})
      .then(async response=>{const body=await response.json();if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);return validateAudit(body,scopes,filters.fy,filters.as_of);})
      .then(result=>{if (!controller.signal.aborted && id===latestRequest.current) setPayload({key:requestKey,status:'ready',data:result,error:null});})
      .catch(error=>{if (!controller.signal.aborted && id===latestRequest.current) setPayload({key:requestKey,status:'error',data:null,error:error.message});});
    return ()=>controller.abort();
  },[requestKey,allowed,filters.fy,filters.as_of,scopes,role]);

  useEffect(()=>{try {localStorage.setItem('fintective_growth_pins_v2',JSON.stringify(pins.map(plainScope)));} catch { /* Comparison still works when browser storage is unavailable. */ }},[pins]);
  useEffect(()=>{try {const params=new URLSearchParams(window.location.search);Object.entries(filters).forEach(([key,value])=>params.set(key,value));window.history.replaceState({},'',`${window.location.pathname}?${params}`);} catch { /* Embedded routes may not allow history updates. */ }},[filters]);

  const selectedDeals=useMemo(()=>primary ? primary.deals.filter(row=>(stage==='all' || row.stage===stage) &&
    `${row.company} ${row.position} ${row.bill}`.toLowerCase().includes(search.trim().toLowerCase())) : [],[primary,stage,search]);
  const years=useMemo(()=> {
    const start=Number(financialYear().match(/\d{4}/)[0]);
    return [...new Set([filters.fy,...(options.fys || []),...Array.from({length:8},(_,i)=>`FY ${start-i}-${String(start-i+1).slice(-2)}`)])];
  },[filters.fy,options.fys]);
  const optionNames=(key,fromContext)=>[...new Set(['All',...(options[key] || []),...fromContext.filter(Boolean),filters[key==='bds'?'bd':key==='tls'?'tl':'franchise']])].sort((a,b)=>a==='All'?-1:b==='All'?1:a.localeCompare(b));
  const update=(key,value)=> {
    setPage(1);setEditor(null);setSaveError('');
    setFilters(old=> key==='fy' ? {...old,fy:value,as_of:[todayInIndia(),`${Number(value.match(/\d{4}/)[0])+1}-03-31`].sort()[0]} : {...old,[key]:value});
  };
  const pin=()=> {
    if (pins.some(item=>item.key===current.key)) return setNotice('This profile is already pinned. Select another profile to compare.');
    if (pins.length>=3) return setNotice('Compare up to four profiles. Remove a pinned profile before adding another.');
    setPins(old=>[...old,current]);setNotice('Profile pinned. Choose another BD, TL or franchise above to compare.');
  };
  const mutate=async (path,body)=> {
    setSaving(true);setSaveError('');
    try {
      const response=await fetchWithApiKey(`${API_BASE_URL}/growth/${path}?role=${encodeURIComponent(role)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();
      if (!response.ok || result.success===false) throw new Error(result.error || `HTTP ${response.status}`);
      setEditor(null);setNotice('Saved. Reloading the profile audit.');refresh();
    } catch(error) {setSaveError(error.message);}
    finally {setSaving(false);}
  };
  const saveContext={scope:plainScope(current),fy:filters.fy,as_of:filters.as_of,actor:finance.currentUser?.name || role};
  const download=()=> {
    const url=URL.createObjectURL(new Blob([auditCsv(selectedDeals)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`growth_audit_${data.period.financial_year}_${data.period.as_of}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  if (!allowed) return <div className="ga-workspace"><section className="ga-panel"><h2>Profile growth audits</h2><p>A manager or administrator role is required to view profile financials and manage targets.</p></section></div>;
  return <div className="ga-workspace">
    <section className="ga-panel ga-toolbar"><header><div><span className="ga-eyebrow">PROFILE AUDIT & GROWTH PLANNING</span><h2>Growth targets & profile direction</h2><p>Audit recorded performance, compare portfolios and set measurable commitments.</p></div>
      <div className="ga-inline"><button className="ga-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading?'spinning':''}/>Refresh</button><button className="ga-button ga-primary" onClick={()=>{setSaveError('');setEditor('goal');}} disabled={saving || !primary || data.period.fy_end<todayInIndia()}><Target size={16}/>Set growth target</button></div></header>
      <div className="ga-filters">
        <label>BD specialist<select value={filters.bd} onChange={event=>update('bd',event.target.value)}>{optionNames('bds',(finance.bdAgents || []).map(row=>row.name)).map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Team leader<select value={filters.tl} onChange={event=>update('tl',event.target.value)}>{optionNames('tls',(finance.teamLeaders || []).map(row=>row.name || row.teamLeaderName)).map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Franchise partner<select value={filters.franchise} onChange={event=>update('franchise',event.target.value)}>{optionNames('franchises',(finance.franchisees || []).map(row=>row.nameAsPerAgreement || row.name)).map(name=><option key={name}>{name}</option>)}</select></label>
        <label>Financial year<select value={filters.fy} onChange={event=>update('fy',event.target.value)}>{years.map(year=><option key={year}>{year}</option>)}</select></label>
        <label>As of<input required type="date" min={`${filters.fy.match(/\d{4}/)?.[0]}-04-01`} max={[todayInIndia(),`${Number(filters.fy.match(/\d{4}/)?.[0])+1}-03-31`].sort()[0]} value={filters.as_of} onChange={event=>update('as_of',event.target.value)}/></label>
      </div>
      {optionsError && <p className="ga-inline-error">Profile list: {optionsError}. Available saved/backend roster names are still selectable.</p>}
      <div className="ga-pinbar"><strong>{current.label}</strong><button className="ga-button ga-small" onClick={pin}><Plus size={14}/>Pin for comparison</button>
        {pins.map(item=><span className="ga-chip" key={item.key}>{item.label}<button aria-label={`Remove ${item.label} from comparison`} onClick={()=>setPins(old=>old.filter(pin=>pin.key!==item.key))}><X size={13}/></button></span>)}
        {pins.length>0 && <button className="ga-link" onClick={()=>setPins([])}>Clear comparison</button>}</div>
    </section>
    {notice && <div className="ga-notice" role="status">{notice}<button aria-label="Dismiss message" className="ga-icon" onClick={()=>setNotice('')}><X size={14}/></button></div>}
    {loading && <section className="ga-panel ga-empty" role="status"><RefreshCw className="spinning" size={24}/><h3>Loading profile audit…</h3><p>Fetching recorded invoices, payroll and target progress for this selection.</p></section>}
    {!loading && payload.status==='error' && <ErrorBox message={payload.error} retry={refresh}/>}
    {data && primary && <>
      <div className="ga-period"><span><Landmark size={15}/><strong>{dateLabel(data.period.start)} – {dateLabel(data.period.as_of)}</strong> · FY {data.period.financial_year}</span><span>{data.profiles.length} profile{data.profiles.length>1?'s':''} · same reporting period</span></div>
      <div className="ga-kpis">{[
        ['Company share',valueText(primary.totals.company_share),'Recorded invoice income',Landmark],
        ['Invoiced deals',number(primary.totals.deals),`${number(primary.totals.companies)} corporate companies`,FileText],
        ['In progress',number(primary.totals.in_progress),'Current CRM pipeline snapshot',TrendingUp],
        ['Cancelled',number(primary.totals.cancelled),'Enquiries, not booked financial loss',Users]
      ].map(([title,value,caption,Icon])=><section className="ga-kpi" key={title}><div><span>{title}</span><Icon size={18}/></div><strong>{value}</strong><small>{caption}</small></section>)}</div>
      {data.overlaps.length>0 && <div className="ga-notice"><AlertTriangle size={18}/><div><strong>Compared portfolios overlap. Do not add the columns.</strong>{data.overlaps.map((row,index)=><p key={index}>{row.a} / {row.b}: {row.shared_invoices} shared invoice rows, {row.shared_payroll_members} shared payroll members.</p>)}</div></div>}
      <section className="ga-panel"><header><div><h3>Financial performance comparison</h3><p>Same period, the same definitions, and payroll from recorded sources.</p></div><span className="ga-badge">{primary.financial.cost_coverage_complete ? 'Recorded cost coverage' : 'Cost review needed'}</span></header>
        <CompareTable profiles={data.profiles} busy={saving} onCost={()=>{setSaveError('');setEditor('cost');}}/></section>
      <nav className="ga-tabs" aria-label="Growth workspace sections">{[['overview','Audit & overview'],['plan_ahead','Trend & projection'],['deals','Deal audit'],['targets','Targets & progress']].map(([key,label])=><button key={key} className={activeTab===key?'active':''} aria-current={activeTab===key?'page':undefined} onClick={()=>update('tab',key)}>{label}</button>)}</nav>
      {(activeTab==='overview' || activeTab==='plan_ahead') && <section className="ga-panel"><header><div><h3>Where is the profile going?</h3><p>Compare recorded monthly performance with a transparent run-rate outlook.</p></div><div className="ga-inline"><select aria-label="Chart metric" value={metric} onChange={event=>setMetric(event.target.value)}>{Object.entries(metricLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><label className="ga-check"><input type="checkbox" checked={cumulative} onChange={event=>setCumulative(event.target.checked)}/>Cumulative</label><label className="ga-check"><input type="checkbox" checked={showProjection} onChange={event=>setShowProjection(event.target.checked)}/>Projection</label></div></header>
        {activeTab==='plan_ahead' && <GoalSetter key={`${primary.scope.key}|${filters.fy}|${data.period.as_of}|${metric}|${primary.goals.find(goal=>goal.status==='active' && goal.metric===metric)?.id || ''}`}
          profile={primary} period={data.period} metric={metric} busy={saving} error={saveError} onSave={body=>mutate('profile-goals',{...saveContext,...body})}/>}
        <GrowthAuditChart profiles={data.profiles} metric={metric} cumulative={cumulative} period={data.period} showProjection={showProjection}/>
        <div className="ga-outlooks">{data.profiles.map((profile,index)=><div key={profile.scope.key}><small style={{color:profileColors[index]}}>{profile.scope.label}</small><strong>{valueText(outlook(profile,metric),metric)}</strong><span>FY run-rate outlook</span><small>{profile.projection.trend_pct[metric]===null ? 'Three-vs-three-month change unavailable' : `${profile.projection.trend_pct[metric]>0?'+':''}${profile.projection.trend_pct[metric]}% · last 3 vs prior 3 complete months`}</small></div>)}</div>
        {activeTab==='plan_ahead' && <div className="ga-table-scroll"><table><thead><tr><th>Month</th><th>Recorded {metricLabels[metric]}</th><th>Month-end outlook</th><th>In progress</th><th>Cancelled</th></tr></thead><tbody>{primary.monthly.map(row=><tr key={row.month}><td>{row.month}{row.partial?' · MTD':''}</td><td>{row.future?'—':valueText(row[metric],metric)}</td><td>{valueText(row[`projected_${metric}`],metric)}</td><td>{row.future?'—':row.in_progress}</td><td>{row.future?'—':row.cancelled}</td></tr>)}</tbody></table></div>}
      </section>}
      {activeTab==='overview' && <><section className="ga-panel"><header><div><h3>Audit notes & data coverage</h3><p>Missing data remains visible; it is not silently replaced with zero.</p></div></header>
        {data.profiles.map(profile=><details key={profile.scope.key} open={profile.scope.key===primary.scope.key}><summary>{profile.scope.label} · {profile.warnings.length} review note{profile.warnings.length===1?'':'s'}</summary>{profile.warnings.length ? <ul>{profile.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul> : <p className="ga-note">The selected sources are available. Recorded invoice shares are not independent bank or statutory verification.</p>}</details>)}
        {primary.comparison && <p className="ga-note">Same-period prior FY: {valueText(primary.comparison.prior_revenue)} revenue; {valueText(primary.comparison.prior_company_share)} company share. Year-over-year company-share change: {primary.comparison.company_share_pct===null?'unavailable':`${primary.comparison.company_share_pct}%`}.</p>}
      </section><PayrollAudit profile={primary}/></>}
      {activeTab==='deals' && <section className="ga-panel"><header><div><h3>Source deal audit · {primary.scope.label}</h3><p>Invoices are separate from unbilled enquiries. Current enquiry stages are grouped by allocation date.</p></div><button className="ga-button" onClick={download} disabled={!selectedDeals.length}><Download size={15}/>Export filtered CSV</button></header>
        <div className="ga-inline ga-deal-filters"><input type="search" aria-label="Search source deals" placeholder="Company, position or bill number" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/><select aria-label="Filter source deals by stage" value={stage} onChange={event=>{setStage(event.target.value);setPage(1);}}><option value="all">All source records</option>{Object.entries(stageLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><span>{selectedDeals.length} matching records</span></div>
        <div className="ga-table-scroll"><table><thead><tr><th>Date</th><th>Company / position</th><th>Stage</th><th>Bill</th><th>Revenue ex GST</th><th>Company share</th></tr></thead><tbody>
          {selectedDeals.slice((page-1)*15,page*15).map(row=><tr key={row.id}><td>{row.date}</td><td>{row.company}<small>{row.position}</small></td><td><span className="ga-badge">{stageLabels[row.stage]}</span></td><td>{row.bill || '—'}</td><td>{valueText(row.revenue)}</td><td>{valueText(row.company_share)}</td></tr>)}
          {!selectedDeals.length && <tr><td colSpan="6" className="ga-empty">No source records match this filter.</td></tr>}
        </tbody></table></div><div className="ga-pagination"><button className="ga-button" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(selectedDeals.length/15))}</span><button className="ga-button" disabled={page*15>=selectedDeals.length} onClick={()=>setPage(value=>value+1)}>Next</button></div>
      </section>}
      {activeTab==='targets' && <section className="ga-panel"><header><div><h3>Targets & progress · {primary.scope.label}</h3><p>Each goal has an explicit metric, deadline and saved baseline.</p></div><button className="ga-button ga-primary" disabled={saving || data.period.fy_end<todayInIndia()} onClick={()=>{setSaveError('');setEditor('goal');}}><Plus size={15}/>Set target</button></header>
        {saveError && <p role="alert" className="ga-inline-error">{saveError}</p>}
        {!primary.goals.length && <p className="ga-empty">No targets saved for this profile and FY. Set a company-share, revenue or deals target.</p>}
        <div className="ga-goals">{primary.goals.map(goal=><article key={goal.id} className="ga-goal"><header><div><span className="ga-eyebrow">{metricLabels[goal.metric]}</span><h3>{valueText(goal.target,goal.metric)} by {dateLabel(goal.due_date)}</h3></div><span className="ga-badge">{goal.status==='active'?goal.pace_status.replaceAll('_',' '):goal.status}</span></header>
          <div className="ga-progress" role="progressbar" aria-label={`${metricLabels[goal.metric]} target progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100,Math.max(0,goal.progress_percent || 0))}><span style={{width:`${Math.min(100,Math.max(0,goal.progress_percent || 0))}%`}}/></div>
          <div className="ga-goal-stats"><div><small>Recorded by cutoff</small><strong>{valueText(goal.actual,goal.metric)}</strong></div><div><small>Remaining gap</small><strong>{valueText(goal.gap,goal.metric)}</strong></div><div><small>Required / remaining month</small><strong>{valueText(goal.required_per_month,goal.metric)}</strong></div><div><small>Run-rate at deadline</small><strong>{valueText(goal.projected_at_due,goal.metric)}</strong></div></div>
          <p className="ga-note">Baseline {valueText(goal.baseline_value,goal.metric)} as of {String(goal.baseline_as_of).slice(0,10)} · actual results stop at the earlier of the report date and this deadline.</p>{goal.note && <p>{goal.note}</p>}
          {goal.status==='active' && <button className="ga-button ga-small" disabled={saving} onClick={()=>mutate(`profile-goals/${goal.id}/archive`,{})}>Archive target</button>}
        </article>)}</div>
        {data.legacy_targets?.length>0 && <details><summary>Earlier target records ({data.legacy_targets.length})</summary><p className="ga-note">Earlier targets are preserved as history. New goals use explicit profile/metric keys and are shown above.</p><div className="ga-table-scroll"><table><thead><tr><th>Profile</th><th>Dates</th><th>Status</th><th>Earlier target</th></tr></thead><tbody>{data.legacy_targets.map(goal=><tr key={goal.id}><td>{goal.label}<small>{goal.type}</small></td><td>{goal.start} – {goal.end}</td><td>{goal.status}</td><td>{goal.target_deals!==null?`${goal.target_deals} deals`:valueText(goal.target_revenue)}{goal.letter && <details><summary>View saved memo</summary><pre className="ga-letter">{goal.letter}</pre></details>}</td></tr>)}</tbody></table></div></details>}
      </section>}
      <footer className="ga-footnotes">{data.notes.map(note=><span key={note}>{note}</span>)}</footer>
      {editor==='cost' && <CostModal profile={primary} period={data.period} onClose={()=>setEditor(null)} busy={saving} error={saveError} onSave={body=>mutate('profile-costs',{...saveContext,...body})}/>}
      {editor==='goal' && <GoalModal profile={primary} period={data.period} onClose={()=>setEditor(null)} busy={saving} error={saveError} onSave={body=>mutate('profile-goals',{...saveContext,...body})}/>}
    </>}
  </div>;
}
