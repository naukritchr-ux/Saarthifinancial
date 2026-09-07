/**
 * Helper to normalize any financial year string to canonical "FY YYYY-YY" format
 * e.g. "2022-2023" -> "FY 2022-23"
 *      "2022-23"   -> "FY 2022-23"
 *      "22-23"     -> "FY 2022-23"
 *      "FY 2022-23"-> "FY 2022-23"
 *      "2022"      -> "FY 2022-23"
 */
export function normalizeFY(rawValue) {
  if (!rawValue) return null;
  const str = String(rawValue).trim();
  if (!str || str.toLowerCase() === 'all' || str.toLowerCase() === 'all financial years' || str.toLowerCase() === 'unspecified' || str === 'n/a') {
    return null;
  }

  // Remove leading "FY", "F.Y.", etc.
  const clean = str.replace(/^F\.?Y\.?\s*/i, '').trim();

  // Pattern: 4 digits - 4 digits (e.g., "2022-2023" or "2022/2023")
  const m44 = clean.match(/^(\d{4})[-/](\d{4})$/);
  if (m44) {
    const startYear = m44[1];
    const endYearShort = m44[2].slice(-2);
    return `FY ${startYear}-${endYearShort}`;
  }

  // Pattern: 4 digits - 2 digits (e.g., "2022-23" or "2022/23")
  const m42 = clean.match(/^(\d{4})[-/](\d{2})$/);
  if (m42) {
    return `FY ${m42[1]}-${m42[2]}`;
  }

  // Pattern: 2 digits - 2 digits (e.g., "22-23")
  const m22 = clean.match(/^(\d{2})[-/](\d{2})$/);
  if (m22) {
    return `FY 20${m22[1]}-${m22[2]}`;
  }

  // Pattern: single 4-digit year (e.g., "2022")
  const m4 = clean.match(/^(\d{4})$/);
  if (m4) {
    const yr = parseInt(m4[1], 10);
    const nextYrShort = String((yr + 1) % 100).padStart(2, '0');
    return `FY ${yr}-${nextYrShort}`;
  }

  // If already formatted like "FY 2024-25"
  if (/^FY\s*\d{4}-\d{2}$/i.test(str)) {
    return str.replace(/^FY\s*/i, 'FY ').trim();
  }

  return null;
}

/**
 * Derive Indian financial year (April 1 - March 31) from any date value
 * e.g. "2024-05-15" -> "FY 2024-25"
 *      "2026-03-25" -> "FY 2025-26"
 */
export function getFinancialYearFromDate(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const month = d.getUTCMonth() + 1; // 1-indexed (1=Jan, 4=Apr, 12=Dec)
  const year = d.getUTCFullYear();
  if (month >= 4) {
    const nextYr = String((year + 1) % 100).padStart(2, '0');
    return `FY ${year}-${nextYr}`;
  } else {
    const currYr = String(year % 100).padStart(2, '0');
    return `FY ${year - 1}-${currYr}`;
  }
}