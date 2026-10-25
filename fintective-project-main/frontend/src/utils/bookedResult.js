const months=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function selectedFinanceStart(selectedMonth,selectedYear) {
  if (selectedMonth && selectedMonth!=='All Months') {
    const [name,rawYear]=selectedMonth.split(' ');
    const month=months.indexOf(name),year=Number(rawYear);
    return month>=0 && Number.isInteger(year) ? `${year}-${String(month+1).padStart(2,'0')}-01` : null;
  }
  if (selectedYear && selectedYear!=='All Years') {
    const match=String(selectedYear).match(/^(?:FY\s*)?(\d{4})-(?:\d{2}|\d{4})$/);
    return match ? `${match[1]}-04-01` : null;
  }
  return '1900-01-01';
}

// This is a source arithmetic check, not an income statement. It deliberately
// excludes any guessed payroll accrual or inferred share allocation.
export function recordedSpread(transactions,selectedMonth,selectedYear) {
  if (!Array.isArray(transactions)) return null;
  let income=0,expense=0;
  for (const row of transactions) {
    if (!row || !['income','expense'].includes(row.type)) continue;
    const date=new Date(row.date);
    if (selectedYear!=='All Years') {
      const fy=row.financialYear && row.financialYear!=='N/A' ? row.financialYear :
        Number.isNaN(date.getTime()) ? null : `${date.getUTCMonth()>=3 ? date.getUTCFullYear() : date.getUTCFullYear()-1}-${date.getUTCMonth()>=3 ? date.getUTCFullYear()+1 : date.getUTCFullYear()}`;
      if (fy!==selectedYear) continue;
    }
    if (selectedMonth!=='All Months' &&
        (Number.isNaN(date.getTime()) || `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`!==selectedMonth)) continue;
    if (row.amount===null || row.amount===undefined || !Number.isFinite(Number(row.amount))) return null;
    if (row.type==='income') income+=Number(row.amount);
    else expense+=Number(row.amount);
  }
  return {income,expense,difference:income-expense};
}

export function bookedResultView({summary,selectedMonth,selectedYear,userRole,activeModule,error}) {
  const period=selectedMonth!=='All Months' ? selectedMonth : selectedYear==='All Years' ? 'All time' : `FY ${selectedYear}`;
  const label=`Operating result (${period}):`;
  if (!['admin','manager'].includes(userRole) || activeModule==='job_portal') {
    return {label,status:'not_applicable',value:null};
  }
  if (!summary || summary.period?.start_date!==selectedFinanceStart(selectedMonth,selectedYear)) {
    return {label,status:error?'unavailable':'loading',value:null};
  }
  if (summary.accounting_status==='needs_payroll_reconciliation') {
    return {label,status:'needs_review',value:null};
  }
  if (summary.accounting_status!=='provisional_booked_costs' || !Number.isFinite(summary.net)) {
    return {label,status:'unavailable',value:null};
  }
  return {label,status:'ready',value:summary.net};
}

export function bookedCostFigures(summary,view) {
  const unreconciled=view.status==='needs_review';
  const raw=unreconciled ? summary?.cash_breakdown?.unreconciled_cost_result : view.value;
  if (!['ready','needs_review'].includes(view.status) || !Number.isFinite(raw)) {
    return {result:null,ratio:null,unreconciled,chartReady:false};
  }
  const share=summary?.our_share;
  const ratio=Number.isFinite(share) && share>0 ? raw/share*100 : null;
  const chartReady=[summary?.revenue,share,summary?.operating_expenses,summary?.salaries].every(Number.isFinite);
  return {result:raw,ratio,unreconciled,chartReady};
}
