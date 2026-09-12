import db from '../config/db.js';
import { TDS_TOLERANCE } from './reconciliationRules.js';

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
const calculateRowStatus = (difference) => {
  if (Math.abs(difference) <= TDS_TOLERANCE) {
    return 'Matched';
  }
  if (difference > TDS_TOLERANCE) {
    return 'Less Payment';
  }
  return 'Excess Payment';
};

/**
 * Filter processed rows by view ('all' | 'excess' | 'less')
 */
const applyViewFilter = (rows, view) => {
  const normalized = String(view || 'all').toLowerCase().trim();
  if (normalized === 'excess') {
    return rows.filter(r => r.status === 'Excess Payment');
  }
  if (normalized === 'less') {
    return rows.filter(r => r.status === 'Less Payment');
  }
  return rows;
};

/**
 * a) FY-Wise Report: Grouped by financial_year, SUM(tally_tds) and SUM(as26_tds) across all clients
 */
export const getFyWiseReport = async ({ view = 'all' } = {}) => {
  const query = `
    SELECT 
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified') AS financial_year,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total
    FROM tds_reconciliation_results tr
    WHERE ${BASE_WHERE_CLAUSES.join(' AND ')}
    GROUP BY COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified')
    ORDER BY financial_year DESC
  `;

  const [rows] = await db.execute(query);

  const processed = (rows || []).map(row => {
    const tallyTotal = parseFloat(row.tally_total || 0);
    const as26Total = parseFloat(row.as26_total || 0);
    const difference = tallyTotal - as26Total;
    const status = calculateRowStatus(difference);

    return {
      financial_year: row.financial_year,
      tally_total: tallyTotal,
      as26_total: as26Total,
      difference,
      status
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * b) TAN-Wise Report: Grouped by tan_no + company_name across all financial years
 */
export const getTanWiseReport = async ({ view = 'all', search = '' } = {}) => {
  const whereClauses = [...BASE_WHERE_CLAUSES];
  const params = [];

  if (search && String(search).trim() !== '') {
    const term = `%${String(search).trim()}%`;
    whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ?)');
    params.push(term, term);
  }

  const query = `
    SELECT 
      tr.tan_no,
      COALESCE(MAX(d.company_name), tr.tan_no) AS company_name,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total
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
    const difference = tallyTotal - as26Total;
    const status = calculateRowStatus(difference);

    return {
      tan_no: row.tan_no,
      company_name: row.company_name,
      tally_total: tallyTotal,
      as26_total: as26Total,
      difference,
      status
    };
  });

  return applyViewFilter(processed, view);
};

/**
 * c) TAN-Wise by FY Report: Grouped by tan_no + financial_year with latest HR contact details
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
    whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ?)');
    params.push(term, term);
  }

  const query = `
    SELECT 
      tr.tan_no,
      COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified') AS financial_year,
      COALESCE(MAX(d.company_name), tr.tan_no) AS company_name,
      SUM(COALESCE(tr.tally_tds, 0)) AS tally_total,
      SUM(COALESCE(tr.as26_tds, 0)) AS as26_total,
      MAX(d.contact_person_name) AS dues_contact_person,
      MAX(d.contact_number) AS dues_contact_number,
      (SELECT f.contact_person FROM tds_followups f WHERE f.tan_no = tr.tan_no ORDER BY f.id DESC LIMIT 1) AS followup_contact_person,
      (SELECT f.contact_number FROM tds_followups f WHERE f.tan_no = tr.tan_no ORDER BY f.id DESC LIMIT 1) AS followup_contact_number
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY tr.tan_no, COALESCE(NULLIF(TRIM(tr.financial_year), ''), 'Unspecified')
    ORDER BY financial_year DESC, company_name ASC, tr.tan_no ASC
  `;

  const [rows] = await db.execute(query, params);

  const processed = (rows || []).map(row => {
    const tallyTotal = parseFloat(row.tally_total || 0);
    const as26Total = parseFloat(row.as26_total || 0);
    const difference = tallyTotal - as26Total;
    const status = calculateRowStatus(difference);

    const hrName = row.followup_contact_person || row.dues_contact_person || '';
    const contactNo = row.followup_contact_number || row.dues_contact_number || '';

    return {
      tan_no: row.tan_no,
      company_name: row.company_name,
      financial_year: row.financial_year,
      tally_total: tallyTotal,
      as26_total: as26Total,
      difference,
      status,
      hr_name: hrName,
      contact_no: contactNo
    };
  });

  return applyViewFilter(processed, view);
};
