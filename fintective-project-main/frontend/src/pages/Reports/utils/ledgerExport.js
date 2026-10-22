import { normalizePaymentMode, formatDateDisplay, isProjectedTransaction } from './ledgerFilter.js';

/**
 * Escapes text for CSV cells safely handling quotes and newlines.
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates a clean, filter-aware filename for the ledger export.
 */
export function generateLedgerFilename(selectedMonth, selectedYear, activeFilterCount = 0) {
  const parts = ['Fintective', 'Ledger'];
  
  if (selectedYear && selectedYear !== 'All Years') {
    parts.push(selectedYear.replace(/[^a-zA-Z0-9-]/g, ''));
  }
  
  if (selectedMonth && selectedMonth !== 'All Months') {
    parts.push(selectedMonth.replace(/\s+/g, '_'));
  }

  if (activeFilterCount > 0) {
    parts.push(`filtered_${activeFilterCount}`);
  }

  return `${parts.join('_')}.csv`;
}

/**
 * Exports all filtered transactions to CSV with O(1) Map lookups for BD agents and franchisees.
 */
export function exportLedgerToCsv({
  transactions = [],
  bdAgents = [],
  franchisees = [],
  selectedMonth = 'All Months',
  selectedYear = 'All Years',
  activeFilterCount = 0
}) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    alert('No transactions to export with the current filter settings.');
    return;
  }

  // Build O(1) Map lookups for fast resolution
  const bdMap = new Map();
  if (Array.isArray(bdAgents)) {
    bdAgents.forEach(a => {
      if (a?.id) bdMap.set(a.id, a.name || a.title || 'BD Specialist');
    });
  }

  const franMap = new Map();
  if (Array.isArray(franchisees)) {
    franchisees.forEach(f => {
      if (f?.id) franMap.set(f.id, f.name || f.city || 'Hub');
    });
  }

  const headers = [
    'Date',
    'Formatted Date',
    'Status (Actual/Projected)',
    'Title',
    'Company Name',
    'Type',
    'Category',
    'Sub-Category',
    'BD Agent',
    'Franchisee',
    'Team Leader',
    'Payment Mode',
    'Reference ID',
    'Amount (INR)',
    'Description',
    'Financial Year'
  ];

  const rows = transactions.map(tx => {
    const isProj = isProjectedTransaction(tx.date);
    const bdName = tx.bdAgentName || (tx.bdAgentId ? bdMap.get(tx.bdAgentId) : '') || '';
    const franName = tx.franchiseeName || (tx.franchiseeId ? franMap.get(tx.franchiseeId) : '') || '';
    const tlName = tx.teamLeaderName || '';
    const mode = normalizePaymentMode(tx.paymentMode);
    const amountVal = Number(tx.amount) || 0;

    return [
      escapeCsvCell(tx.date || ''),
      escapeCsvCell(formatDateDisplay(tx.date)),
      escapeCsvCell(isProj ? 'Projected' : 'Actual'),
      escapeCsvCell(tx.title || ''),
      escapeCsvCell(tx.companyName || '—'),
      escapeCsvCell(tx.type || ''),
      escapeCsvCell(tx.category || ''),
      escapeCsvCell(tx.subCategory || 'General'),
      escapeCsvCell(bdName),
      escapeCsvCell(franName),
      escapeCsvCell(tlName),
      escapeCsvCell(mode),
      escapeCsvCell(tx.referenceId || ''),
      amountVal.toFixed(2),
      escapeCsvCell(tx.description || ''),
      escapeCsvCell(tx.financialYear || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = generateLedgerFilename(selectedMonth, selectedYear, activeFilterCount);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
