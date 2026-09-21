import db from '../config/db.js';
import { 
  TDS_TOLERANCE, 
  isSaarthiEra, 
  calculateTdsBalance, 
  deriveFinancialStatus 
} from './reconciliationRules.js';

/**
 * Common TAN exclusion filter to ignore invalid/placeholder TANs
 */
const BASE_WHERE_CLAUSES = [
  "(COALESCE(tr.books_tds, 0) > 0 OR COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)",
  "(tr.tan_no IS NOT NULL AND tr.tan_no NOT LIKE 'NO_TAN_%' AND tr.tan_no != 'Pending TAN' AND tr.tan_no != 'Not Available' AND tr.tan_no NOT LIKE '%UNKNOWN%' AND TRIM(tr.tan_no) != '')"
];

/**
 * Helper to derive status based on difference and tolerance
 */
const calculateRowStatus = (balance) => {
  if (Math.abs(balance) <= TDS_TOLERANCE) {
    return 'Matched';
  }
  if (balance > TDS_TOLERANCE) {
    return 'Less Payment'; // Primary > 26AS (under-deposited)
  }
  return 'Excess Payment'; // 26AS > Primary (excess deposited)
};

/**
 * Filter processed rows by view ('all' | 'excess' | 'less' | 'matched')
 */
const applyViewFilter = (rows, view) => {
  const normalized = String(view || 'all').toLowerCase().trim();
  if (normalized === 'excess' || normalized === 'excess payment' || normalized === 'excess paid') {
    return rows.filter(r => r.status === 'Excess Payment' || r.financialStatus === 'Excess');
  }
  if (normalized === 'less' || normalized === 'less payment' || normalized === 'less paid') {
    return rows.filter(r => r.status === 'Less Payment' || r.financialStatus === 'Less Paid');
  }
  if (normalized === 'matched' || normalized === 'match') {
    return rows.filter(r => r.status === 'Matched' || r.financialStatus === 'Match');
  }
  return rows;
};

/**
 * Helper to build standard search/FY/company/PAN filters
 */
const buildReportFilterConditions = ({ fy = '', company = '', pan = '', search = '' }) => {
  const whereClauses = [...BASE_WHERE_CLAUSES];
  const params = [];

  if (fy && fy !== 'All' && fy !== 'All Financial Years' && String(fy).trim() !== '') {
    const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
    whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
    params.push(`%${cleanFy}%`, `%${cleanFy}%`);
  }

  if (company && String(company).trim() !== '' && company !== 'All') {
    const term = `%${String(company).trim()}%`;
    whereClauses.push('(d.company_name LIKE ? OR tr.tan_no IN (SELECT tan_no FROM tds_tally_entries WHERE party_name LIKE ?))');
    params.push(term, term);
  }

  if (pan && String(pan).trim() !== '' && pan !== 'All') {
    const term = `%${String(pan).trim()}%`;
    whereClauses.push('(d.pan_no LIKE ? OR tr.tan_no IN (SELECT tan_no FROM tds_tally_entries WHERE pan_no LIKE ?))');
    params.push(term, term);
  }

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ? OR d.pan_no LIKE ?)');
    params.push(term, term, term);
  }

  return { whereSQL: whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '', params };
};

/**
 * 1. TALLY DATA REPORT
 * Displays full Tally data with comparisons and FY-based balance
 * Rule: FY 2019-20 to 2025-26: Balance = Tally - 26AS
 *       FY 2026-27 onwards: Balance = Saarthi 360 - 26AS
 */
export const getTallyDataReport = async ({ fy = '', company = '', pan = '', view = 'all', search = '' } = {}) => {
  const { whereSQL, params } = buildReportFilterConditions({ fy, company, pan, search });

  const query = `
    SELECT 
      tr.id,
      tr.tan_no,
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'Unspecified') AS financial_year,
      COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unknown Client') AS company_name,
      COALESCE(NULLIF(TRIM(d.pan_no), ''), (SELECT t.pan_no FROM tds_tally_entries t WHERE t.tan_no = tr.tan_no AND t.pan_no IS NOT NULL AND TRIM(t.pan_no) != '' LIMIT 1), '') AS pan_no,
      COALESCE(tr.tally_tds, 0) AS tally_tds,
      COALESCE(tr.as26_tds, 0) AS as26_tds,
      COALESCE(tr.books_tds, 0) AS saarthi_tds,
      COALESCE(d.total_bill_amount, 0) AS gross_amount,
      d.contact_person_name,
      d.contact_number,
      d.email_id
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    ${whereSQL}
    ORDER BY financial_year DESC, company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(r => {
    const tally = parseFloat(r.tally_tds || 0);
    const as26 = parseFloat(r.as26_tds || 0);
    const saarthi = parseFloat(r.saarthi_tds || 0);
    const fyStr = r.financial_year || '';

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    const status = calculateRowStatus(balance);
    const financialStatus = deriveFinancialStatus({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    return {
      id: r.id,
      tan_no: r.tan_no,
      company_name: r.company_name,
      pan_no: r.pan_no || 'N/A',
      financial_year: fyStr,
      gross_amount: parseFloat(r.gross_amount || 0),
      tally_tds: tally,
      as26_tds: as26,
      saarthi_tds: saarthi,
      balance,
      baselineSource,
      baselineValue,
      status,
      financialStatus,
      contact_person_name: r.contact_person_name || '',
      contact_number: r.contact_number || '',
      email_id: r.email_id || ''
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * 2. 26AS DATA REPORT
 * Displays Form 26AS records with comparisons and FY-based balance
 */
export const getAs26DataReport = async ({ fy = '', company = '', pan = '', view = 'all', search = '' } = {}) => {
  const { whereSQL, params } = buildReportFilterConditions({ fy, company, pan, search });

  const query = `
    SELECT 
      tr.id,
      tr.tan_no,
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'Unspecified') AS financial_year,
      COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unknown Client') AS company_name,
      COALESCE(NULLIF(TRIM(d.pan_no), ''), (SELECT t.pan_no FROM tds_tally_entries t WHERE t.tan_no = tr.tan_no AND t.pan_no IS NOT NULL AND TRIM(t.pan_no) != '' LIMIT 1), '') AS pan_no,
      COALESCE(tr.as26_tds, 0) AS as26_tds,
      COALESCE(tr.tally_tds, 0) AS tally_tds,
      COALESCE(tr.books_tds, 0) AS saarthi_tds,
      (SELECT e.section FROM tds_26as_entries e WHERE e.tan_no = tr.tan_no LIMIT 1) AS section,
      (SELECT e.quarter FROM tds_26as_entries e WHERE e.tan_no = tr.tan_no LIMIT 1) AS quarter
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    ${whereSQL}
    ORDER BY financial_year DESC, company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(r => {
    const tally = parseFloat(r.tally_tds || 0);
    const as26 = parseFloat(r.as26_tds || 0);
    const saarthi = parseFloat(r.saarthi_tds || 0);
    const fyStr = r.financial_year || '';

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    const status = calculateRowStatus(balance);
    const financialStatus = deriveFinancialStatus({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    return {
      id: r.id,
      tan_no: r.tan_no,
      company_name: r.company_name,
      pan_no: r.pan_no || 'N/A',
      financial_year: fyStr,
      section: r.section || '194J',
      quarter: r.quarter || 'Q1-Q4',
      as26_tds: as26,
      tally_tds: tally,
      saarthi_tds: saarthi,
      balance,
      baselineSource,
      baselineValue,
      status,
      financialStatus
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * 3. SAARTHI 360 DATA REPORT
 * Displays Saarthi 360 CRM records with invoice details, contacts, and FY-based balance
 */
export const getSaarthi360DataReport = async ({ fy = '', company = '', pan = '', view = 'all', search = '' } = {}) => {
  const { whereSQL, params } = buildReportFilterConditions({ fy, company, pan, search });

  const query = `
    SELECT 
      tr.id,
      tr.tan_no,
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'Unspecified') AS financial_year,
      COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unknown Client') AS company_name,
      COALESCE(NULLIF(TRIM(d.pan_no), ''), (SELECT t.pan_no FROM tds_tally_entries t WHERE t.tan_no = tr.tan_no AND t.pan_no IS NOT NULL AND TRIM(t.pan_no) != '' LIMIT 1), '') AS pan_no,
      COALESCE(tr.books_tds, 0) AS saarthi_tds,
      COALESCE(tr.as26_tds, 0) AS as26_tds,
      COALESCE(tr.tally_tds, 0) AS tally_tds,
      d.bill_number,
      d.bill_date,
      COALESCE(d.total_bill_amount, 0) AS total_bill_amount,
      d.contact_person_name,
      d.contact_number,
      d.email_id,
      d.teamleader
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    ${whereSQL}
    ORDER BY financial_year DESC, company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(r => {
    const tally = parseFloat(r.tally_tds || 0);
    const as26 = parseFloat(r.as26_tds || 0);
    const saarthi = parseFloat(r.saarthi_tds || 0);
    const fyStr = r.financial_year || '';

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    const status = calculateRowStatus(balance);
    const financialStatus = deriveFinancialStatus({
      tally,
      as26,
      saarthi,
      financialYear: fyStr
    });

    return {
      id: r.id,
      tan_no: r.tan_no,
      company_name: r.company_name,
      pan_no: r.pan_no || 'N/A',
      financial_year: fyStr,
      bill_number: r.bill_number || 'N/A',
      bill_date: r.bill_date || 'N/A',
      total_bill_amount: parseFloat(r.total_bill_amount || 0),
      saarthi_tds: saarthi,
      as26_tds: as26,
      tally_tds: tally,
      balance,
      baselineSource,
      baselineValue,
      status,
      financialStatus,
      contact_person_name: r.contact_person_name || '',
      contact_number: r.contact_number || '',
      email_id: r.email_id || '',
      teamleader: r.teamleader || ''
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * a) FY-Wise Report: Grouped by financial_year, SUM(tally_tds), SUM(as26_tds), SUM(books_tds)
 */
export const getFyWiseReport = async ({ view = 'all', fy = '' } = {}) => {
  const whereClauses = [...BASE_WHERE_CLAUSES];
  const params = [];

  if (fy && fy !== 'All' && fy !== 'All Financial Years' && String(fy).trim() !== '') {
    const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
    whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
    params.push(`%${cleanFy}%`, `%${cleanFy}%`);
  }

  const query = `
    SELECT 
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified') AS financial_year,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total,
      SUM(COALESCE(tr.books_tds, 0)) AS saarthi_total
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified')
    ORDER BY financial_year DESC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(row => {
    const tallyTotal = parseFloat(row.tally_total || 0);
    const as26Total = parseFloat(row.as26_total || 0);
    const saarthiTotal = parseFloat(row.saarthi_total || 0);
    const fyStr = row.financial_year || '';

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally: tallyTotal,
      as26: as26Total,
      saarthi: saarthiTotal,
      financialYear: fyStr
    });

    const status = calculateRowStatus(balance);

    return {
      financial_year: fyStr,
      tally_total: tallyTotal,
      as26_total: as26Total,
      saarthi_total: saarthiTotal,
      difference: balance,
      balance,
      baselineSource,
      baselineValue,
      status
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * b) TAN-Wise Report: Grouped by tan_no + company_name across all financial years
 */
export const getTanWiseReport = async ({ view = 'all', fy = '', search = '' } = {}) => {
  const whereClauses = [...BASE_WHERE_CLAUSES];
  const params = [];

  if (fy && fy !== 'All' && fy !== 'All Financial Years' && String(fy).trim() !== '') {
    const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
    whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
    params.push(`%${cleanFy}%`, `%${cleanFy}%`);
  }

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ? OR d.pan_no LIKE ?)');
    params.push(term, term, term);
  }

  const query = `
    SELECT 
      tr.tan_no,
      COALESCE(MAX(d.company_name), tr.tan_no) AS company_name,
      COALESCE(MAX(d.pan_no), (SELECT t.pan_no FROM tds_tally_entries t WHERE t.tan_no = tr.tan_no LIMIT 1), '') AS pan_no,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total,
      SUM(COALESCE(tr.books_tds, 0)) AS saarthi_total
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY tr.tan_no
    ORDER BY company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(row => {
    const tallyTotal = parseFloat(row.tally_total || 0);
    const as26Total = parseFloat(row.as26_total || 0);
    const saarthiTotal = parseFloat(row.saarthi_total || 0);

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally: tallyTotal,
      as26: as26Total,
      saarthi: saarthiTotal,
      financialYear: fy
    });

    const status = calculateRowStatus(balance);

    return {
      tan_no: row.tan_no,
      company_name: row.company_name,
      pan_no: row.pan_no || 'N/A',
      tally_total: tallyTotal,
      as26_total: as26Total,
      saarthi_total: saarthiTotal,
      difference: balance,
      balance,
      baselineSource,
      baselineValue,
      status
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * c) TAN-Wise by FY Report: Grouped by tan_no + financial_year with latest contact details
 */
export const getTanWiseByFyReport = async ({ view = 'all', fy = '', search = '' } = {}) => {
  const whereClauses = [...BASE_WHERE_CLAUSES];
  const params = [];

  if (fy && fy !== 'All' && fy !== 'All Financial Years' && String(fy).trim() !== '') {
    const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
    whereClauses.push('(TRIM(tr.financial_year) LIKE ? OR (tr.financial_year IS NULL AND TRIM(d.financial_year) LIKE ?))');
    params.push(`%${cleanFy}%`, `%${cleanFy}%`);
  }

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ? OR d.pan_no LIKE ?)');
    params.push(term, term, term);
  }

  const query = `
    SELECT 
      tr.tan_no,
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified') AS financial_year,
      COALESCE(MAX(d.company_name), tr.tan_no) AS company_name,
      COALESCE(MAX(d.pan_no), (SELECT t.pan_no FROM tds_tally_entries t WHERE t.tan_no = tr.tan_no LIMIT 1), '') AS pan_no,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total,
      SUM(COALESCE(tr.books_tds, 0)) AS saarthi_total,
      COALESCE(
        MAX(d.contact_person_name), 
        (SELECT d2.contact_person_name FROM tds_dues d2 WHERE d2.tan_no = tr.tan_no AND d2.contact_person_name IS NOT NULL AND TRIM(d2.contact_person_name) != '' LIMIT 1)
      ) AS dues_contact_person,
      COALESCE(
        MAX(d.contact_number), 
        (SELECT d2.contact_number FROM tds_dues d2 WHERE d2.tan_no = tr.tan_no AND d2.contact_number IS NOT NULL AND TRIM(d2.contact_number) != '' LIMIT 1)
      ) AS dues_contact_number,
      (SELECT f.contact_person FROM tds_followups f WHERE f.tan_no = tr.tan_no ORDER BY f.id DESC LIMIT 1) AS followup_contact_person,
      (SELECT f.contact_number FROM tds_followups f WHERE f.tan_no = tr.tan_no ORDER BY f.id DESC LIMIT 1) AS followup_contact_number
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON (tr.tds_dues_id = d.id OR (tr.tan_no = d.tan_no AND d.tan_no IS NOT NULL AND TRIM(d.tan_no) != ''))
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY tr.tan_no, COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified')
    ORDER BY financial_year DESC, company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(row => {
    const tallyTotal = parseFloat(row.tally_total || 0);
    const as26Total = parseFloat(row.as26_total || 0);
    const saarthiTotal = parseFloat(row.saarthi_total || 0);
    const fyStr = row.financial_year || '';

    const { balance, baselineSource, baselineValue } = calculateTdsBalance({
      tally: tallyTotal,
      as26: as26Total,
      saarthi: saarthiTotal,
      financialYear: fyStr
    });

    const status = calculateRowStatus(balance);

    const hrName = row.followup_contact_person || row.dues_contact_person || '';
    const contactNo = row.followup_contact_number || row.dues_contact_number || '';

    return {
      tan_no: row.tan_no,
      company_name: row.company_name,
      pan_no: row.pan_no || 'N/A',
      financial_year: fyStr,
      tally_total: tallyTotal,
      as26_total: as26Total,
      saarthi_total: saarthiTotal,
      difference: balance,
      balance,
      baselineSource,
      baselineValue,
      status,
      hr_name: hrName,
      contact_no: contactNo
    };
  });

  return applyViewFilter(processed, view);
};
