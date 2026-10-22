// Pure filter, sort, and summary functions for the General Transaction Ledger

export const MONTH_NAME_TO_NUM = {
  'january': '01',
  'february': '02',
  'march': '03',
  'april': '04',
  'may': '05',
  'june': '06',
  'july': '07',
  'august': '08',
  'september': '09',
  'october': '10',
  'november': '11',
  'december': '12'
};

export const MONTH_NUM_TO_NAME = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Returns today's ISO date string YYYY-MM-DD
 */
export function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalizes payment modes into a standard display string.
 * Shows 'Unspecified' instead of silently defaulting to 'Cash'.
 */
export function normalizePaymentMode(mode) {
  if (!mode || typeof mode !== 'string') return 'Unspecified';
  const clean = mode.trim();
  if (!clean || clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'unspecified') {
    return 'Unspecified';
  }
  const lower = clean.toLowerCase();
  if (lower.includes('direct bank') || lower === 'bank transfer' || lower.includes('wire')) {
    return 'Direct Bank Transfer';
  }
  if (lower.includes('net banking') || lower.includes('netbanking') || lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps')) {
    return 'Net Banking';
  }
  if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) {
    return 'UPI';
  }
  if (lower.includes('credit card') || lower.includes('card')) {
    return 'Credit Card';
  }
  if (lower.includes('cheque') || lower.includes('check')) {
    return 'Cheque';
  }
  if (lower === 'cash') {
    return 'Cash';
  }
  return clean;
}

/**
 * Checks whether a company name is a genuine corporate client vs synthetic metadata.
 */
export function isCompanyValid(companyName) {
  if (!companyName || typeof companyName !== 'string') return false;
  const trimmed = companyName.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return false;
  const lower = trimmed.toLowerCase();
  if (lower === 'n/a' || lower === 'none' || lower === 'null' || lower === 'undefined' || lower.startsWith('payroll')) {
    return false;
  }
  return true;
}

/**
 * Returns true if the transaction date is in the future relative to referenceDate (YYYY-MM-DD).
 */
export function isProjectedTransaction(dateStr, todayStr = getTodayISO()) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const clean = dateStr.slice(0, 10);
  return clean > todayStr;
}

/**
 * Formats ISO date (YYYY-MM-DD) into DD MMM YYYY (e.g. 28 Apr 2026) without timezone shifts.
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length < 3) return dateStr;
  const [year, monthNum, day] = parts;
  const mIdx = parseInt(monthNum, 10) - 1;
  const monthAbbr = MONTH_ABBR[mIdx] || monthNum;
  return `${parseInt(day, 10)} ${monthAbbr} ${year}`;
}

/**
 * Month matching using string slicing (YYYY-MM) instead of new Date() to avoid timezone shifts.
 * selectedMonth format: e.g. "April 2026"
 */
export function matchesMonth(dateStr, selectedMonth) {
  if (!selectedMonth || selectedMonth === 'All Months') return true;
  if (!dateStr || typeof dateStr !== 'string') return false;
  const parts = selectedMonth.trim().split(/\s+/);
  if (parts.length < 2) return true;
  const monthName = parts[0].toLowerCase();
  const yearStr = parts[1];
  const monthNum = MONTH_NAME_TO_NUM[monthName];
  if (!monthNum) return true;
  const targetYearMonth = `${yearStr}-${monthNum}`;
  return dateStr.slice(0, 7) === targetYearMonth;
}

/**
 * Financial Year matching using string manipulation.
 * selectedYear format: e.g. "2026-2027" or "2026-27"
 */
export function matchesFinancialYear(dateStr, txFy, selectedYear) {
  if (!selectedYear || selectedYear === 'All Years') return true;
  const cleanSelected = selectedYear.trim();
  
  // 1. Direct match on transaction.financialYear
  if (txFy && typeof txFy === 'string') {
    const cleanFy = txFy.trim();
    if (cleanFy === cleanSelected) return true;
    // Normalize short format (2026-27 vs 2026-2027)
    const selNorm = cleanSelected.length === 7 ? `${cleanSelected.slice(0, 5)}20${cleanSelected.slice(5)}` : cleanSelected;
    const fyNorm = cleanFy.length === 7 ? `${cleanFy.slice(0, 5)}20${cleanFy.slice(5)}` : cleanFy;
    if (selNorm === fyNorm) return true;
  }

  // 2. Derive FY from date string YYYY-MM-DD
  if (dateStr && typeof dateStr === 'string' && dateStr.length >= 7) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(5, 7), 10);
    if (!isNaN(y) && !isNaN(m)) {
      const derivedFy = m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
      if (derivedFy === cleanSelected) return true;
      const derivedShort = m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
      if (derivedShort === cleanSelected) return true;
    }
  }

  return false;
}

/**
 * Filter ledger transactions based on all active criteria.
 */
export function filterLedgerTransactions(transactions, filters = {}, selectedMonth = 'All Months', selectedYear = 'All Years', todayStr = getTodayISO()) {
  if (!Array.isArray(transactions)) return [];

  const query = (filters.search || '').trim().toLowerCase();
  const types = Array.isArray(filters.types) ? filters.types : [];
  const categories = Array.isArray(filters.category) ? filters.category : [];
  const subCategories = Array.isArray(filters.subCategory) ? filters.subCategory : [];
  const paymentModes = Array.isArray(filters.paymentMode) ? filters.paymentMode : [];
  const companies = Array.isArray(filters.company) ? filters.company : [];
  const bds = Array.isArray(filters.bd) ? filters.bd : [];
  const franchises = Array.isArray(filters.franchise) ? filters.franchise : [];
  const tls = Array.isArray(filters.tl) ? filters.tl : [];
  const minAmt = filters.amountMin !== '' && filters.amountMin !== undefined ? Number(filters.amountMin) : null;
  const maxAmt = filters.amountMax !== '' && filters.amountMax !== undefined ? Number(filters.amountMax) : null;
  const dateFrom = filters.dateFrom ? filters.dateFrom.slice(0, 10) : '';
  const dateTo = filters.dateTo ? filters.dateTo.slice(0, 10) : '';
  const timing = filters.actualProjected || 'all';

  return transactions.filter(tx => {
    if (!tx) return false;

    // 1. Month filter (topbar)
    if (!matchesMonth(tx.date, selectedMonth)) return false;

    // 2. FY filter (topbar)
    if (!matchesFinancialYear(tx.date, tx.financialYear, selectedYear)) return false;

    const dateOnly = (tx.date || '').slice(0, 10);

    // 3. Date Range (from/to)
    if (dateFrom && dateOnly && dateOnly < dateFrom) return false;
    if (dateTo && dateOnly && dateOnly > dateTo) return false;

    // 4. Actual vs Projected toggle
    if (timing === 'actual' && dateOnly > todayStr) return false;
    if (timing === 'projected' && dateOnly <= todayStr) return false;

    // 5. Amount Range
    const amt = Number(tx.amount) || 0;
    if (minAmt !== null && !isNaN(minAmt) && amt < minAmt) return false;
    if (maxAmt !== null && !isNaN(maxAmt) && amt > maxAmt) return false;

    // 6. Multi-select Type
    if (types.length > 0 && !types.includes(tx.type)) return false;

    // 7. Multi-select Category
    if (categories.length > 0 && !categories.includes(tx.category)) return false;

    // 8. Multi-select SubCategory
    if (subCategories.length > 0 && !subCategories.includes(tx.subCategory || 'General')) return false;

    // 9. Multi-select Payment Mode
    if (paymentModes.length > 0) {
      const normalizedMode = normalizePaymentMode(tx.paymentMode);
      if (!paymentModes.includes(normalizedMode)) return false;
    }

    // 10. Multi-select Company Name
    if (companies.length > 0) {
      const compName = tx.companyName || 'N/A';
      if (!companies.includes(compName)) return false;
    }

    // 11. BD Agent
    if (bds.length > 0) {
      const agentMatch = bds.includes(tx.bdAgentId) || 
        (tx.bdAgentName && bds.includes(tx.bdAgentName)) || 
        (tx.bdMemberName && bds.includes(tx.bdMemberName));
      if (!agentMatch) return false;
    }

    // 12. Franchisee
    if (franchises.length > 0) {
      const franMatch = franchises.includes(tx.franchiseeId) || 
        (tx.franchiseeName && franchises.includes(tx.franchiseeName));
      if (!franMatch) return false;
    }

    // 13. Team Leader
    if (tls.length > 0) {
      const tlMatch = tx.teamLeaderName && tls.includes(tx.teamLeaderName);
      if (!tlMatch) return false;
    }

    // 14. Free Text Search (title, description, subCategory, referenceId, companyName, employeeName)
    if (query) {
      const tTitle = (tx.title || '').toLowerCase();
      const tDesc = (tx.description || '').toLowerCase();
      const tSub = (tx.subCategory || '').toLowerCase();
      const tRef = (tx.referenceId || '').toLowerCase();
      const tComp = (tx.companyName || '').toLowerCase();
      const tEmp = (tx.employeeName || '').toLowerCase();

      if (!tTitle.includes(query) && 
          !tDesc.includes(query) && 
          !tSub.includes(query) && 
          !tRef.includes(query) && 
          !tComp.includes(query) &&
          !tEmp.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts ledger transactions by the requested key and direction.
 */
export function sortLedgerTransactions(transactions, sortKey = 'date', sortDirection = 'desc') {
  if (!Array.isArray(transactions)) return [];
  const mult = sortDirection === 'asc' ? 1 : -1;

  return [...transactions].sort((a, b) => {
    if (sortKey === 'date') {
      const dA = (a.date || '').slice(0, 10);
      const dB = (b.date || '').slice(0, 10);
      return dA.localeCompare(dB) * mult;
    }
    if (sortKey === 'amount') {
      const aAmt = Number(a.amount) || 0;
      const bAmt = Number(b.amount) || 0;
      return (aAmt - bAmt) * mult;
    }
    if (sortKey === 'title') {
      return (a.title || '').localeCompare(b.title || '') * mult;
    }
    if (sortKey === 'company') {
      return (a.companyName || '').localeCompare(b.companyName || '') * mult;
    }
    if (sortKey === 'category') {
      return (a.category || '').localeCompare(b.category || '') * mult;
    }
    return 0;
  });
}

/**
 * Computes summary statistics including top 5 categories and projected totals.
 */
export function computeLedgerSummary(transactions, todayStr = getTodayISO()) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      inflow: 0,
      outflow: 0,
      net: 0,
      totalCount: 0,
      actualCount: 0,
      projectedCount: 0,
      hasProjected: false,
      topCategories: []
    };
  }

  let inflow = 0;
  let outflow = 0;
  let actualCount = 0;
  let projectedCount = 0;
  const categoryTotals = {};

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    const isProj = isProjectedTransaction(t.date, todayStr);

    if (isProj) {
      projectedCount++;
    } else {
      actualCount++;
    }

    if (t.type === 'income') {
      inflow += amt;
    } else if (t.type === 'expense') {
      outflow += amt;
    }

    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const totalVolume = inflow + outflow;
  const topCategories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalVolume > 0 ? (amount / totalVolume) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    inflow,
    outflow,
    net: inflow - outflow,
    totalCount: transactions.length,
    actualCount,
    projectedCount,
    hasProjected: projectedCount > 0,
    topCategories
  };
}

/**
 * Builds distinct option lists with counts from the active transaction collection.
 */
export function buildLedgerFilterOptions(transactions) {
  const counts = {
    types: {},
    categories: {},
    subCategories: {},
    paymentModes: {},
    companies: {},
    bds: {},
    franchises: {},
    tls: {}
  };

  if (!Array.isArray(transactions)) return counts;

  transactions.forEach(t => {
    if (!t) return;

    // Type
    if (t.type) {
      counts.types[t.type] = (counts.types[t.type] || 0) + 1;
    }

    // Category
    if (t.category) {
      counts.categories[t.category] = (counts.categories[t.category] || 0) + 1;
    }

    // Sub-Category
    const sub = t.subCategory || 'General';
    counts.subCategories[sub] = (counts.subCategories[sub] || 0) + 1;

    // Payment Mode
    const mode = normalizePaymentMode(t.paymentMode);
    counts.paymentModes[mode] = (counts.paymentModes[mode] || 0) + 1;

    // Company (only genuine client names)
    if (isCompanyValid(t.companyName)) {
      counts.companies[t.companyName] = (counts.companies[t.companyName] || 0) + 1;
    }

    // BD Agent
    const bd = t.bdAgentName || t.bdMemberName || t.bdAgentId;
    if (bd && !bd.toLowerCase().includes('head - office')) {
      counts.bds[bd] = (counts.bds[bd] || 0) + 1;
    }

    // Franchisee
    const fran = t.franchiseeName || t.franchiseeId;
    if (fran) {
      counts.franchises[fran] = (counts.franchises[fran] || 0) + 1;
    }

    // Team Leader
    if (t.teamLeaderName) {
      counts.tls[t.teamLeaderName] = (counts.tls[t.teamLeaderName] || 0) + 1;
    }
  });

  return counts;
}
