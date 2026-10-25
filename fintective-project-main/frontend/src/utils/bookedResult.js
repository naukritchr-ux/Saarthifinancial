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
