/**
 * Shared Source of Truth for TDS Reconciliation Rules, Tolerances, and Baselines.
 * 
 * Centralizes:
 * - ₹1.0 rounding discrepancy tolerance
 * - FY-based comparison baseline:
 *     - FY 2019-2020 to FY 2025-2026: Balance is Tally - 26AS (Primary baseline = Tally TDS)
 *     - FY 2026-2027 onwards: Balance is Saarthi 360 - 26AS (Primary baseline = Saarthi 360 CRM TDS)
 * - SQL WHERE clauses for status tabs (Match, Less Paid, Excess, Not Received)
 * - JavaScript status derivation logic
 */

export const TDS_TOLERANCE = 1.0;

/**
 * Determine if a financial year belongs to the Saarthi 360 era (2026-2027 onwards).
 * @param {string} financialYear - e.g. "FY 2026-27", "2026-2027", "2025-26"
 * @returns {boolean}
 */
export const isSaarthiEra = (financialYear = '') => {
  if (!financialYear) return false;
  const str = String(financialYear).trim();
  const match = str.match(/(\d{4})/);
  if (match) {
    const startYear = parseInt(match[1], 10);
    return startYear >= 2026;
  }
  // Check 2-digit format e.g. "26-27"
  const shortMatch = str.match(/(\d{2})[-/](\d{2})/);
  if (shortMatch) {
    const yr = parseInt(shortMatch[1], 10);
    return yr >= 26 && yr < 90;
  }
  return false;
};

/**
 * SQL expression for determining the primary comparison TDS figure dynamically based on FY.
 * Priority:
 *   - FY 2026-27 onwards: Saarthi CRM Books TDS if > 0, otherwise Tally TDS.
 *   - FY 2019-20 to 2025-26: Tally TDS if > 0, otherwise Saarthi CRM Books TDS.
 */
export const PRIMARY_TDS_SQL = `(CASE 
  WHEN (COALESCE(tr.financial_year, d.financial_year, '') REGEXP '20(2[6-9]|[3-9][0-9])' 
        OR COALESCE(tr.financial_year, d.financial_year, '') REGEXP 'FY *(2[6-9]|[3-9][0-9])')
  THEN (CASE WHEN COALESCE(tr.books_tds, 0) > 0 THEN tr.books_tds ELSE COALESCE(tr.tally_tds, 0) END)
  ELSE (CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END)
END)`;

/**
 * JS function to calculate the primary TDS baseline figure based on FY.
 * @param {number} tally - Tally TDS
 * @param {number} books - Sarthi Books TDS
 * @param {string} [financialYear=''] - Financial Year string
 * @returns {number}
 */
export const getPrimaryTdsVal = (tally = 0, books = 0, financialYear = '') => {
  const t = parseFloat(tally || 0);
  const b = parseFloat(books || 0);
  if (isSaarthiEra(financialYear)) {
    return b > 0 ? b : t;
  }
  return t > 0 ? t : b;
};

/**
 * Calculate financial difference between 26AS and primary baseline.
 * @param {number} as26 - Form 26AS TDS
 * @param {number} primaryVal - Primary baseline TDS (Tally or Books)
 * @returns {number}
 */
export const getDifferenceAmount = (as26 = 0, primaryVal = 0) => {
  return parseFloat(as26 || 0) - parseFloat(primaryVal || 0);
};

/**
 * Calculate Balance according to user rule:
 * - FY 2019-20 to 2025-26: Tally TDS - 26AS TDS
 * - FY 2026-27 onwards: Saarthi 360 TDS - 26AS TDS
 * @param {Object} params
 * @param {number} params.tally
 * @param {number} params.as26
 * @param {number} params.saarthi
 * @param {string} [params.financialYear='']
 * @returns {{ balance: number, baselineSource: 'Tally' | 'Saarthi 360', baselineValue: number }}
 */
export const calculateTdsBalance = ({ tally = 0, as26 = 0, saarthi = 0, financialYear = '' }) => {
  const t = parseFloat(tally || 0);
  const a = parseFloat(as26 || 0);
  const s = parseFloat(saarthi || 0);
  const saarthiMode = isSaarthiEra(financialYear);
  const baselineSource = saarthiMode ? 'Saarthi 360' : 'Tally';
  const baselineValue = saarthiMode ? (s > 0 ? s : t) : (t > 0 ? t : s);
  const balance = baselineValue - a; // (Tally - 26AS) or (Saarthi 360 - 26AS)
  return { balance, baselineSource, baselineValue };
};

/**
 * Derive unified financial status in JS for a record.
 * @param {Object} params
 * @param {number} params.tally
 * @param {number} params.as26
 * @param {number} params.saarthi
 * @param {string} [params.financialYear='']
 * @param {boolean|number} [params.isManuallyEdited=false]
 * @param {string} [params.overallStatus='']
 * @returns {string} 'Match' | 'Less Paid' | 'Excess' | 'Not Received' | 'Pending Review'
 */
export const deriveFinancialStatus = ({
  tally = 0,
  as26 = 0,
  saarthi = 0,
  financialYear = '',
  isManuallyEdited = false,
  overallStatus = ''
}) => {
  const primaryVal = getPrimaryTdsVal(tally, saarthi, financialYear);
  const as26Val = parseFloat(as26 || 0);
  const diff = as26Val - primaryVal;

  if (as26Val === 0 && primaryVal > 0) {
    return 'Not Received';
  }
  if (primaryVal > 0 && as26Val > 0 && Math.abs(diff) <= TDS_TOLERANCE) {
    return 'Match';
  }
  if (primaryVal > 0 && as26Val > 0 && primaryVal > as26Val + TDS_TOLERANCE) {
    return 'Less Paid';
  }
  if (as26Val > 0 && (primaryVal === 0 || as26Val > primaryVal + TDS_TOLERANCE)) {
    return 'Excess';
  }
  if (['All Matched', 'Match', 'Matched'].includes(overallStatus)) {
    return 'Match';
  }
  if (overallStatus === 'Partial Mismatch') {
    return 'Pending Review';
  }
  return 'Not Received';
};

/**
 * Build SQL WHERE condition for filtering by overallStatus tab.
 * @param {string} status - Tab name ('Match', 'Less Paid', 'Excess', 'Not Received', etc.)
 * @param {string} [primarySql=PRIMARY_TDS_SQL] - Column / expression for primary TDS
 * @returns {string|null} SQL snippet or null if 'All' or empty
 */
export const getFinancialStatusWhereClause = (status, primarySql = PRIMARY_TDS_SQL) => {
  if (!status || status === 'All') return null;

  if (status === 'Match' || status === 'All Matched') {
    return `((${primarySql} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ABS(${primarySql} - COALESCE(tr.as26_tds, 0)) <= ${TDS_TOLERANCE}) OR (tr.overall_status IN ('All Matched', 'Match', 'Matched') AND COALESCE(tr.as26_tds, 0) > 0 AND ABS(${primarySql} - COALESCE(tr.as26_tds, 0)) <= ${TDS_TOLERANCE}))`;
  }
  if (status === 'Less Paid' || status === 'Less') {
    return `(${primarySql} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ${primarySql} > COALESCE(tr.as26_tds, 0) + ${TDS_TOLERANCE})`;
  }
  if (status === 'Excess' || status === 'Excess Paid') {
    return `(COALESCE(tr.as26_tds, 0) > 0 AND (${primarySql} = 0 OR ${primarySql} < COALESCE(tr.as26_tds, 0) - ${TDS_TOLERANCE}))`;
  }
  if (status === 'Not Received' || status === 'No Match' || status === 'Missing') {
    return `(COALESCE(tr.as26_tds, 0) = 0 AND ${primarySql} > 0)`;
  }
  return 'tr.overall_status = ?';
};

