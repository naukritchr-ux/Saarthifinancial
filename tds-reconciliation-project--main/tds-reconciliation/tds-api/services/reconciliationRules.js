/**
 * Shared Source of Truth for TDS Reconciliation Rules, Tolerances, and Baselines.
 * 
 * Centralizes:
 * - ₹1.0 rounding discrepancy tolerance
 * - Primary comparison baseline (Tally TDS if > 0, otherwise Sarthi CRM Books TDS)
 * - SQL WHERE clauses for status tabs (Match, Less Paid, Excess, Not Received)
 * - JavaScript status derivation logic
 */

export const TDS_TOLERANCE = 1.0;

/**
 * SQL expression for determining the primary comparison TDS figure.
 * Priority: Tally TDS if > 0, otherwise Sarthi CRM Books TDS.
 */
export const PRIMARY_TDS_SQL = '(CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END)';

/**
 * JS function to calculate the primary TDS baseline figure.
 * @param {number} tally - Tally TDS
 * @param {number} books - Sarthi Books TDS
 * @returns {number}
 */
export const getPrimaryTdsVal = (tally = 0, books = 0) => {
  const t = parseFloat(tally || 0);
  const b = parseFloat(books || 0);
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
 * Derive unified financial status in JS for a record.
 * @param {Object} params
 * @param {number} params.tally
 * @param {number} params.as26
 * @param {number} params.saarthi
 * @param {boolean|number} [params.isManuallyEdited=false]
 * @param {string} [params.overallStatus='']
 * @returns {string} 'Match' | 'Less Paid' | 'Excess' | 'Not Received' | 'Pending Review'
 */
export const deriveFinancialStatus = ({
  tally = 0,
  as26 = 0,
  saarthi = 0,
  isManuallyEdited = false,
  overallStatus = ''
}) => {
  if (isManuallyEdited) {
    return 'Match';
  }

  const primaryVal = getPrimaryTdsVal(tally, saarthi);
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
    return `(COALESCE(tr.is_manually_edited, 0) = 1 OR (${primarySql} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ABS(${primarySql} - COALESCE(tr.as26_tds, 0)) <= ${TDS_TOLERANCE}) OR tr.overall_status IN ('All Matched', 'Match', 'Matched'))`;
  }
  if (status === 'Less Paid' || status === 'Less') {
    return `(COALESCE(tr.is_manually_edited, 0) = 0 AND ${primarySql} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ${primarySql} > COALESCE(tr.as26_tds, 0) + ${TDS_TOLERANCE})`;
  }
  if (status === 'Excess' || status === 'Excess Paid') {
    return `(COALESCE(tr.is_manually_edited, 0) = 0 AND COALESCE(tr.as26_tds, 0) > 0 AND (${primarySql} = 0 OR ${primarySql} < COALESCE(tr.as26_tds, 0) - ${TDS_TOLERANCE}))`;
  }
  if (status === 'Not Received' || status === 'No Match' || status === 'Missing') {
    return `(COALESCE(tr.is_manually_edited, 0) = 0 AND COALESCE(tr.as26_tds, 0) = 0 AND ${primarySql} > 0)`;
  }
  return 'tr.overall_status = ?';
};
