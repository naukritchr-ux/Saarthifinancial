import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import db from '../../config/db.js';
import { reconcile, cleanNameTokens } from '../../services/tdsReconciliationService.js';
import { seedEmbeddedDataset, markPurgedFlag, clearPurgedFlag } from '../../seed_embedded_dataset.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeFY, getFinancialYearFromDate } from '../../utils/fyHelper.js';
import {
  TDS_TOLERANCE,
  PRIMARY_TDS_SQL,
  getPrimaryTdsVal,
  getDifferenceAmount,
  deriveFinancialStatus,
  getFinancialStatusWhereClause
} from '../../services/reconciliationRules.js';

export { normalizeFY, getFinancialYearFromDate };

/**
 * Autodetect delimiter from sample lines of a text file (comma, tab, semicolon, pipe)
 */
const detectDelimiter = (text) => {
  if (!text) return ',';
  const sampleLines = text.split(/\r?\n/).slice(0, 15).filter(l => l.trim().length > 0);
  if (sampleLines.length === 0) return ',';

  const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 };
  for (const line of sampleLines) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && counts[char] !== undefined) {
        counts[char]++;
      }
    }
  }

  let bestDelim = ',';
  let maxCount = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestDelim = delim;
    }
  }
  return maxCount > 0 ? bestDelim : ',';
};

/**
 * High-speed RFC-4180 CSV / TSV / Semicolon Parser
 * Strips UTF-8 BOM, supports custom or auto-detected delimiters, quotes, escaped quotes.
 */
export const parseCsvFast = (csvText, explicitDelimiter = null) => {
  if (!csvText) return [];
  
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const delimiter = explicitDelimiter || detectDelimiter(text);
  const result = [];
  const len = text.length;
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      cell = '';
      if (row.length > 0 && row.some(c => c !== '')) {
        result.push(row);
      }
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      result.push(row);
    }
  }

  return result;
};

/**
 * Read any uploaded file (CSV, TSV, XLSX, XLS) into a 2D matrix [rows][columns]
 * Scans all sheets in Excel files to pick the sheet with the most rows/header matches.
 */
export const readAnyFileToMatrix = (filePath, originalName = '') => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const isCsvOrText = ext === '.csv' || ext === '.tsv' || ext === '.txt';

  if (isCsvOrText) {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      const parsed = parseCsvFast(text);
      if (parsed && parsed.length > 0 && parsed[0].length > 1) {
        return parsed;
      }
    } catch (csvErr) {
      console.warn('⚠️ parseCsvFast failed, trying xlsx fallback:', csvErr.message);
    }
  }

  try {
    const workbook = xlsx.readFile(filePath, { cellDates: true, raw: false, defval: '' });
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return [];
    }

    let bestSheetMatrix = [];
    let maxNonEmptyRows = -1;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;
      const matrix = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!matrix || !Array.isArray(matrix)) continue;

      const nonEmptyCount = matrix.filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && String(c).trim() !== '')).length;
      if (nonEmptyCount > maxNonEmptyRows) {
        maxNonEmptyRows = nonEmptyCount;
        bestSheetMatrix = matrix;
      }
    }

    if (bestSheetMatrix.length > 0) {
      return bestSheetMatrix;
    }
  } catch (excelErr) {
    console.warn('⚠️ xlsx.readFile failed, falling back to raw text parsing:', excelErr.message);
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return parseCsvFast(text);
    } catch (err) {
      console.error('💥 All file reading strategies failed:', err);
      return [];
    }
  }

  return [];
};

/**
 * Robust number cleaner: handles Indian formatting (1,00,000), currency symbols (₹, Rs., $),
 * negative parentheses (1000), Dr/Cr suffixes, and nil/dash placeholders.
 */
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (str === '-' || str === '--' || str === 'Nil' || str === 'nil' || str === 'N/A' || str === 'n/a' || str === 'null' || str === 'NULL') {
    return 0;
  }

  const isNegative = (str.startsWith('(') && str.endsWith(')')) || str.startsWith('-') || /dr\b/i.test(str);
  str = str.replace(/[₹$€£,"]/g, '')
           .replace(/\b(rs|inr|dr|cr)\b/gi, '')
           .replace(/[()]/g, '')
           .trim();

  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
};

/**
 * Robust date parser supporting Excel serial dates, ISO strings, Indian DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY,
 * and text months like 15-Mar-2024 / 15-Mar-24.
 */
const parseAnyDate = (dateVal) => {
  if (!dateVal) return null;

  if (typeof dateVal === 'number' || (!isNaN(Number(dateVal)) && Number(dateVal) > 20000 && Number(dateVal) < 60000)) {
    const UTC_DAYS_DIFF = 25569;
    const date = new Date((Number(dateVal) - UTC_DAYS_DIFF) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(dateVal).trim();
  if (!str || str === '-' || str === 'N/A' || str === 'n/a') return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (Indian Standard)
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // DD-Mon-YYYY or DD-Mon-YY (e.g. 15-Mar-2024, 15-Mar-24, 15/Apr/2023)
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const dMonYMatch = str.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ](\d{2,4})/);
  if (dMonYMatch) {
    const d = String(dMonYMatch[1]).padStart(2, '0');
    const monStr = dMonYMatch[2].slice(0, 3).toLowerCase();
    const m = monthMap[monStr] || '01';
    let y = dMonYMatch[3];
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y;
    return `${y}-${m}-${d}`;
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
};

// ── Header Matching Utilities ──────────────────────────────────────────────────

const normalizeHeaderCell = (text) => {
  return String(text || '')
    .toLowerCase()
    .replace(/[._\-/:()[\]#\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const isTanHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  if (!t) return false;
  return (
    t === 'tan' || t === 'tan no' || t === 'tan number' || t === 'tan num' || t === 'tan code' || t === 'tan id' ||
    t === 'tanno' || t === 'tan_no' || t === 'tax deduction account number' || t === 'tax deduction and collection account number' ||
    t.includes('tan of deductor') || t.includes('tan of the deductor') || t.includes('deductor tan') ||
    t.includes('party tan') || t.includes('client tan') || t.includes('customer tan') ||
    t === 'tan pan' || t === 'pan tan' || t.includes('tan pan') || t.includes('pan tan') ||
    /^(deductor|party|client|customer)?\s*(tan)(\s*(no|number|num|id|code))?$/.test(t)
  );
};

const isPanHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  if (!t) return false;
  return (
    t === 'pan' || t === 'pan no' || t === 'pan number' || t === 'pan num' || t === 'pan code' || t === 'pan id' ||
    t === 'panno' || t === 'pan_no' || t.includes('deductor pan') || t.includes('party pan') || t.includes('client pan') ||
    t.includes('it pan') || t.includes('income tax pan') || t.includes('pan it no') ||
    /^(deductor|party|client|customer)?\s*(pan)(\s*(no|number|num|id|code))?$/.test(t)
  );
};

const isNameHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  if (!t) return false;
  return (
    t.includes('deductor name') || t.includes('name of deductor') || t.includes('name of the deductor') ||
    t.includes('party name') || t.includes('name of party') || t.includes('name of the party') ||
    t.includes('company name') || t.includes('name of company') || t.includes('name of the company') ||
    t.includes('client name') || t.includes('name of client') || t.includes('customer name') ||
    t.includes('assessee name') || t.includes('name of assessee') ||
    t === 'deductor' || t === 'party' || t === 'company' || t === 'client' || t === 'customer' ||
    t === 'particulars' || t === 'party ledger' || t === 'ledger name' || t === 'account name' || t === 'name'
  );
};

const isAmountHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  if (!t) return false;
  return (
    t.includes('amount paid') || t.includes('amount credited') || t.includes('amount paid credited') ||
    t.includes('gross total') || t.includes('gross amount') || t.includes('gross value') ||
    t.includes('invoice amount') || t.includes('bill amount') || t.includes('invoice value') || t.includes('bill value') ||
    t.includes('total amount') || t.includes('taxable amount') || t.includes('taxable value') ||
    t.includes('transaction amount') || t.includes('credit amount') || t.includes('debit amount') ||
    t === 'gross' || t === 'amount' || t === 'amt' || t === 'total' || t === 'value'
  );
};

const isTdsHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  if (!t) return false;
  return (
    t.includes('total tax deducted') || t.includes('total tds deducted') || t.includes('tax deducted') ||
    t.includes('tds deducted') || t.includes('total tax deposited') || t.includes('total tds deposited') ||
    t.includes('tax deposited') || t.includes('tds deposited') || t.includes('tds amount') || t.includes('tds amt') ||
    t.includes('tds value') || t.includes('tds receivable') || t.includes('income tax') || t.includes('tax amount') ||
    t.includes('tax amt') || t === 'tds' || t === 'tdsamt' || t === 'tax' || t === 'total tax' || t === 'total tds'
  );
};

const isSectionHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t === 'section' || t === 'sec' || t === 'section code' || t === 'under section' || t.includes('section');
};

const isQuarterHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t === 'quarter' || t === 'qtr' || t === 'period' || t === 'return period' || t.includes('quarter') || t.includes('qtr');
};

const isFyHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t === 'fy' || t === 'f y' || t === 'financial year' || t === 'fin year' || t === 'assessment year' || t === 'ay' || /^f\.?y\.?$/i.test(t);
};

const isDateHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return (
    t.includes('voucher date') || t.includes('bill date') || t.includes('invoice date') ||
    t.includes('txn date') || t.includes('transaction date') || t.includes('booking date') ||
    t.includes('date of payment') || t.includes('date of credit') || t === 'date' || t === 'dt'
  );
};

const isGstHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('gstin') || t.includes('gst num') || t.includes('gst no') || t.includes('gst number') || t === 'gst';
};

const isContactHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('contact person') || t.includes('contactperson') || t === 'person' || t.includes('coordinator') || t.includes('hr');
};

const isDesignationHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('designation') || t.includes('role') || t.includes('title') || t.includes('post');
};

const isPhoneHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('phone') || t.includes('mobile') || t.includes('contact number') || t.includes('contact no') || t.includes('telephone');
};

const isEmailHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('email') || t.includes('e mail') || t === 'mail';
};

const isTeamLeaderHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('team leader') || t.includes('teamleader') || t.includes('manager') || t === 'tl' || t === 'rm';
};

const isLedgerHeader = (cell) => {
  const t = normalizeHeaderCell(cell);
  return t.includes('ledger') || t.includes('voucher type') || t.includes('account');
};

/**
 * Intelligent Header Row & Column Detector for Form 26AS
 */
const detectHeaderRow26as = (rawData) => {
  let bestRowIdx = -1;
  let bestColMap = {
    tan_no: -1,
    deductor_name: -1,
    amount_paid: -1,
    tds_deducted: -1,
    section: -1,
    quarter: -1,
    fy: -1
  };
  let bestScore = 0;

  const maxScanRows = Math.min(60, rawData.length);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rawData[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const colMap = {
      tan_no: -1,
      deductor_name: -1,
      amount_paid: -1,
      tds_deducted: -1,
      section: -1,
      quarter: -1,
      fy: -1
    };

    row.forEach((cell, c) => {
      if (isTanHeader(cell) && colMap.tan_no === -1) colMap.tan_no = c;
      if (isNameHeader(cell) && colMap.deductor_name === -1) colMap.deductor_name = c;
      if (isAmountHeader(cell) && colMap.amount_paid === -1) colMap.amount_paid = c;
      if (isTdsHeader(cell) && colMap.tds_deducted === -1) colMap.tds_deducted = c;
      if (isSectionHeader(cell) && colMap.section === -1) colMap.section = c;
      if (isQuarterHeader(cell) && colMap.quarter === -1) colMap.quarter = c;
      if (isFyHeader(cell) && colMap.fy === -1) colMap.fy = c;
    });

    let score = 0;
    if (colMap.tan_no !== -1) score += 3;
    if (colMap.deductor_name !== -1) score += 2;
    if (colMap.tds_deducted !== -1) score += 3;
    if (colMap.amount_paid !== -1) score += 2;
    if (colMap.section !== -1) score += 1;
    if (colMap.quarter !== -1) score += 1;
    if (colMap.fy !== -1) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = r;
      bestColMap = colMap;
    }
  }

  // Fallback: search for TAN column if not found by name
  const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
  if (bestColMap.tan_no === -1) {
    for (let c = 0; c < 30; c++) {
      let matchCount = 0;
      for (let r = 0; r < maxScanRows; r++) {
        if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim().replace(/\s+/g, ''))) {
          matchCount++;
        }
      }
      if (matchCount >= 1) {
        bestColMap.tan_no = c;
        if (bestRowIdx === -1) bestRowIdx = 0;
        break;
      }
    }
  }

  return { headerRowIdx: bestRowIdx, colMap: bestColMap, score: bestScore };
};

/**
 * Intelligent Header Row & Column Detector for Tally exports
 */
const detectHeaderRowTally = (rawData) => {
  let bestRowIdx = -1;
  let bestColMap = {
    tan_no: -1,
    pan_no: -1,
    party_name: -1,
    voucher_date: -1,
    amount: -1,
    tds_amount: -1,
    gst_num: -1,
    ledger_name: -1,
    contact_person: -1,
    designation: -1,
    contact_number: -1,
    email_id: -1,
    teamleader: -1,
    fy: -1
  };
  let bestScore = 0;

  const maxScanRows = Math.min(60, rawData.length);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rawData[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const colMap = {
      tan_no: -1,
      pan_no: -1,
      party_name: -1,
      voucher_date: -1,
      amount: -1,
      tds_amount: -1,
      gst_num: -1,
      ledger_name: -1,
      contact_person: -1,
      designation: -1,
      contact_number: -1,
      email_id: -1,
      teamleader: -1,
      fy: -1
    };

    row.forEach((cell, c) => {
      if (isTanHeader(cell) && colMap.tan_no === -1) colMap.tan_no = c;
      if (isPanHeader(cell) && colMap.pan_no === -1) colMap.pan_no = c;
      if (isNameHeader(cell) && colMap.party_name === -1) colMap.party_name = c;
      if (isDateHeader(cell) && colMap.voucher_date === -1) colMap.voucher_date = c;
      if (isAmountHeader(cell) && colMap.amount === -1) colMap.amount = c;
      if (isTdsHeader(cell) && colMap.tds_amount === -1) colMap.tds_amount = c;
      if (isGstHeader(cell) && colMap.gst_num === -1) colMap.gst_num = c;
      if (isLedgerHeader(cell) && colMap.ledger_name === -1) colMap.ledger_name = c;
      if (isContactHeader(cell) && colMap.contact_person === -1) colMap.contact_person = c;
      if (isDesignationHeader(cell) && colMap.designation === -1) colMap.designation = c;
      if (isPhoneHeader(cell) && colMap.contact_number === -1) colMap.contact_number = c;
      if (isEmailHeader(cell) && colMap.email_id === -1) colMap.email_id = c;
      if (isTeamLeaderHeader(cell) && colMap.teamleader === -1) colMap.teamleader = c;
      if (isFyHeader(cell) && colMap.fy === -1) colMap.fy = c;
    });

    let score = 0;
    if (colMap.tan_no !== -1) score += 3;
    if (colMap.pan_no !== -1) score += 2;
    if (colMap.party_name !== -1) score += 3;
    if (colMap.tds_amount !== -1) score += 3;
    if (colMap.amount !== -1) score += 2;
    if (colMap.voucher_date !== -1) score += 2;
    if (colMap.gst_num !== -1) score += 1;
    if (colMap.ledger_name !== -1) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = r;
      bestColMap = colMap;
    }
  }

  // Fallback: search for TAN / PAN columns if not mapped
  const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
  const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/i;
  if (bestColMap.tan_no === -1) {
    for (let c = 0; c < 30; c++) {
      let matchCount = 0;
      for (let r = 0; r < maxScanRows; r++) {
        if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim().replace(/\s+/g, ''))) {
          matchCount++;
        }
      }
      if (matchCount >= 1) {
        bestColMap.tan_no = c;
        if (bestRowIdx === -1) bestRowIdx = 0;
        break;
      }
    }
  }

  if (bestColMap.pan_no === -1) {
    for (let c = 0; c < 30; c++) {
      let matchCount = 0;
      for (let r = 0; r < maxScanRows; r++) {
        if (rawData[r] && panRegex.test(String(rawData[r][c] || '').trim().replace(/\s+/g, ''))) {
          matchCount++;
        }
      }
      if (matchCount >= 1) {
        bestColMap.pan_no = c;
        break;
      }
    }
  }

  return { headerRowIdx: bestRowIdx, colMap: bestColMap, score: bestScore };
};

// ── Database Seeding Endpoint ──────────────────────────────────────────────────

export const seedDatabaseEndpoint = async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_SEED !== 'true') {
    return res.status(403).json({
      success: false,
      error: 'Database seeding is disabled in production'
    });
  }
  try {
    clearPurgedFlag();
    await seedEmbeddedDataset(true);
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Form 26AS Upload & Parser ──────────────────────────────────────────────────

/**
 * Upload & Parse Form 26AS CSV/Excel file
 */
export const upload26as = async (req, res) => {
  const file = req.file;
  try {
    clearPurgedFlag();
    console.log('📥 Upload 26AS API called');
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const rawData = readAnyFileToMatrix(file.path, file.originalname);
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded 26AS file is empty or could not be read.' });
    }

    const { headerRowIdx, colMap } = detectHeaderRow26as(rawData);

    // If TAN is not found and TDS is not found, reject with helpful instructions
    if (colMap.tan_no === -1 && colMap.tds_deducted === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect TAN or TDS amount columns in Form 26AS file. Please ensure your file has valid columns (e.g. TAN, Deductor Name, Amount Paid, TDS Deducted).'
      });
    }

    const importMode = req.body?.importMode || req.query?.importMode || 'update';
    const uploadFy = String(req.body?.financialYear || req.query?.financialYear || '').trim();
    if (importMode === 'clean') {
      console.log('🧹 Cleaning past Form 26AS data before import...');
      await db.execute('DELETE FROM tds_26as_entries');
      await db.execute('UPDATE tds_reconciliation_results SET as26_tds = 0, as26_batch_id = NULL WHERE is_manually_edited = 0');
    }

    const uploadBatchId = `batch_26as_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const entries = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    let activeTan = '';
    let activeDeductorName = '';
    let activeSection = 'N/A';
    let activeQuarter = 'N/A';

    const tanRegex = /[A-Z]{4}\d{5}[A-Z]/i;
    const panRegex = /[A-Z]{5}\d{4}[A-Z]/i;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      // Extract raw cell values
      let rawTan = colMap.tan_no !== -1 ? String(row[colMap.tan_no] || '').trim() : '';
      let deductorName = colMap.deductor_name !== -1 ? String(row[colMap.deductor_name] || '').trim() : '';
      const amountPaid = colMap.amount_paid !== -1 ? cleanNumber(row[colMap.amount_paid]) : 0.00;
      const tdsDeducted = colMap.tds_deducted !== -1 ? cleanNumber(row[colMap.tds_deducted]) : 0.00;
      let section = colMap.section !== -1 ? String(row[colMap.section] || '').trim() : '';
      let quarter = colMap.quarter !== -1 ? String(row[colMap.quarter] || '').trim() : '';
      const rowFyRaw = colMap.fy !== -1 ? String(row[colMap.fy] || '').trim() : '';

      // Skip obvious repeated header rows or summary rows
      const combinedRowText = row.join(' ').toUpperCase();
      if (combinedRowText.includes('TOTAL TAX DEDUCTED') || combinedRowText.includes('SR NO') || combinedRowText.includes('NAME OF DEDUCTOR')) {
        continue;
      }

      // Check if this row is a TRACES section header row e.g. "Deductor: XYZ Ltd (DELA12345B)"
      const rowTanMatch = combinedRowText.match(tanRegex) || combinedRowText.match(panRegex);
      if (rowTanMatch && (!rawTan || !tanRegex.test(rawTan))) {
        activeTan = rowTanMatch[0].toUpperCase();
      }

      if (rawTan) {
        const cleanTanExtract = rawTan.replace(/[\s\-_/#:]/g, '').toUpperCase();
        const m = cleanTanExtract.match(tanRegex) || cleanTanExtract.match(panRegex);
        if (m) {
          rawTan = m[0];
          activeTan = rawTan;
        }
      } else if (activeTan) {
        rawTan = activeTan;
      }

      if (deductorName) {
        activeDeductorName = deductorName;
      } else if (activeDeductorName) {
        deductorName = activeDeductorName;
      }

      if (section) activeSection = section;
      else section = activeSection;

      if (quarter) activeQuarter = quarter;
      else quarter = activeQuarter;

      // Filter out invalid rows (no TAN/Deductor and no TDS/Amount)
      if (!rawTan && !deductorName && amountPaid === 0 && tdsDeducted === 0) {
        continue;
      }

      const tan = (rawTan || ('NO_TAN_' + cleanNameTokens(deductorName))).toUpperCase();
      if (['TANNO', 'TAN_NO', 'TAN', 'PAN', 'PANNO', 'COMPANYNAME', 'PARTYNAME', 'DEDUCTORNAME'].includes(tan)) {
        continue;
      }

      const isSpecificFy = uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years';
      const fallbackFy = isSpecificFy ? (normalizeFY(uploadFy) || null) : null;
      const financialYear = normalizeFY(rowFyRaw) || fallbackFy;

      entries.push({
        tan,
        deductorName: deductorName || 'Unknown Deductor',
        amountPaid,
        tdsDeducted,
        section: section || 'N/A',
        quarter: quarter || 'N/A',
        financialYear,
        uploadBatchId
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data rows found in Form 26AS file.' });
    }

    // Bulk insert entries in chunks of 500
    const INSERT_CHUNK = 500;
    for (let i = 0; i < entries.length; i += INSERT_CHUNK) {
      const chunk = entries.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const e of chunk) {
        params.push(e.tan, e.deductorName, e.amountPaid, e.tdsDeducted, e.section, e.quarter, e.financialYear, e.uploadBatchId);
      }
      await db.execute(
        `INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, financial_year, upload_batch_id) VALUES ${placeholders}`,
        params
      );
    }

    // Persist financial year onto matching tds_dues rows if specific FY chosen
    if (uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years') {
      const uniqueTans = [...new Set(entries.map(e => e.tan).filter(t => t && !t.startsWith('NO_TAN_')))];
      const FY_CHUNK = 200;
      for (let i = 0; i < uniqueTans.length; i += FY_CHUNK) {
        const chunk = uniqueTans.slice(i, i + FY_CHUNK);
        const placeholders = chunk.map(() => '?').join(', ');
        try {
          await db.execute(
            `UPDATE tds_dues 
             SET financial_year = COALESCE(NULLIF(financial_year, ''), ?) 
             WHERE UPPER(TRIM(tan_no)) IN (${placeholders})`,
            [uploadFy, ...chunk]
          );
        } catch (fyErr) {
          console.warn('⚠️ Bulk FY update warning in 26AS:', fyErr.message);
        }
      }
    }

    try {
      await reconcile(uploadBatchId, null);
    } catch (recErr) {
      console.warn('⚠️ Background reconciliation warning in 26AS:', recErr.message);
    }

    const metadata = JSON.stringify({
      upload_type: '26AS_TDS',
      upload_batch_id: uploadBatchId,
      financial_year: normalizeFY(uploadFy) || null,
      file_name: file.originalname,
      total_records: entries.length,
      duplicates_skipped: 0
    });

    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `Form 26AS uploaded and parsed successfully (${entries.length} records). Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: entries.length,
      duplicatesSkipped: 0
    });

  } catch (error) {
    console.error('💥 Error in upload26as:', error);
    res.status(500).json({ success: false, error: 'Internal server error during 26AS parsing', details: error.message });
  } finally {
    if (file && file.path) {
      fs.promises.unlink(file.path).catch(err => {
        console.warn(`⚠️ [Cleanup] Failed to unlink temp 26AS upload file ${file.path}:`, err.message);
      });
    }
  }
};

// ── Tally Upload & Parser ──────────────────────────────────────────────────────

/**
 * Upload & Parse Tally CSV/Excel file
 */
export const uploadTally = async (req, res) => {
  const file = req.file;
  try {
    clearPurgedFlag();
    console.log('📥 Upload Tally API called');
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const rawData = readAnyFileToMatrix(file.path, file.originalname);
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded Tally file is empty or could not be read.' });
    }

    const { headerRowIdx, colMap } = detectHeaderRowTally(rawData);

    // If neither Party Name nor TAN nor TDS Amount is found, reject with helpful message
    if (colMap.party_name === -1 && colMap.tan_no === -1 && colMap.tds_amount === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not recognize Tally columns. Please ensure your file includes Party Name / Particulars, TDS Amount, and Voucher Date.'
      });
    }

    const importMode = req.body?.importMode || req.query?.importMode || 'update';
    const uploadFy = String(req.body?.financialYear || req.query?.financialYear || '').trim();
    if (importMode === 'clean') {
      console.log('🧹 Cleaning past Tally data before import...');
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute('UPDATE tds_reconciliation_results SET tally_tds = 0, tally_batch_id = NULL WHERE is_manually_edited = 0');
    }

    const uploadBatchId = `batch_tally_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const entries = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    // Pre-load known genuine TANs from Form 26AS and Dues to resolve any PANs or aliases provided in Tally
    const [known26asTans] = await db.query(
      "SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(deductor_name)) as name FROM tds_26as_entries WHERE tan_no REGEXP '^[A-Za-z]{4}[0-9]{5}[A-Za-z]$'"
    );
    const [knownDuesTans] = await db.query(
      "SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(company_name)) as name, UPPER(TRIM(pan_no)) as pan_no FROM tds_dues WHERE tan_no REGEXP '^[A-Za-z]{4}[0-9]{5}[A-Za-z]$'"
    );

    const tanByCleanName = new Map();
    const tanByPan = new Map();

    for (const k of known26asTans) {
      const c = cleanNameTokens(k.name);
      if (c && !tanByCleanName.has(c)) tanByCleanName.set(c, k.tan_no);
    }
    for (const k of knownDuesTans) {
      const c = cleanNameTokens(k.name);
      if (c && !tanByCleanName.has(c)) tanByCleanName.set(c, k.tan_no);
      if (k.pan_no && !tanByPan.has(k.pan_no)) tanByPan.set(k.pan_no, k.tan_no);
    }

    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/i;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const rawTanCell = colMap.tan_no !== -1 ? String(row[colMap.tan_no] || '').trim() : '';
      const partyName = colMap.party_name !== -1 ? String(row[colMap.party_name] || '').trim() : '';
      const gstNum = colMap.gst_num !== -1 ? String(row[colMap.gst_num] || '').trim() : '';
      let panNo = colMap.pan_no !== -1 ? String(row[colMap.pan_no] || '').trim().toUpperCase() : '';
      const voucherDateRaw = colMap.voucher_date !== -1 ? row[colMap.voucher_date] : null;
      const amount = colMap.amount !== -1 ? cleanNumber(row[colMap.amount]) : 0.00;
      const tdsAmount = colMap.tds_amount !== -1 ? cleanNumber(row[colMap.tds_amount]) : 0.00;
      const ledgerName = colMap.ledger_name !== -1 ? String(row[colMap.ledger_name] || '').trim() : 'Tally Ledger';

      // Skip header repetitions or empty rows
      const combinedRowText = row.join(' ').toUpperCase();
      if (combinedRowText.includes('VOUCHER DATE') || combinedRowText.includes('PARTY NAME') || combinedRowText.includes('GROSS TOTAL')) {
        continue;
      }
      if (!partyName && !rawTanCell && amount === 0 && tdsAmount === 0) {
        continue;
      }

      // Parse Voucher Date
      const voucherDate = parseAnyDate(voucherDateRaw);

      // Clean TAN/PAN
      let cleanedTan = rawTanCell.replace(/[\s\-_/#:]/g, '').toUpperCase();
      if (['TANNO', 'TAN_NO', 'TAN', 'PAN', 'PANNO', 'COMPANYNAME', 'PARTYNAME'].includes(cleanedTan)) {
        cleanedTan = '';
      }

      // If PAN is empty but GSTIN is given, extract PAN from GSTIN (chars 2-12)
      if (!panNo && gstNum && gstNum.length >= 12) {
        const derivedPan = gstNum.substring(2, 12).toUpperCase();
        if (panRegex.test(derivedPan)) panNo = derivedPan;
      }

      // If TAN cell is actually a PAN
      if (panRegex.test(cleanedTan)) {
        if (!panNo) panNo = cleanedTan;
      }

      // Determine Final TAN
      let finalTan = '';
      if (tanRegex.test(cleanedTan)) {
        finalTan = cleanedTan;
      } else if (panNo && tanByPan.has(panNo)) {
        finalTan = tanByPan.get(panNo);
      } else if (partyName && tanByCleanName.has(cleanNameTokens(partyName))) {
        finalTan = tanByCleanName.get(cleanNameTokens(partyName));
      } else if (panRegex.test(cleanedTan)) {
        finalTan = cleanedTan;
      } else if (panNo) {
        finalTan = panNo;
      } else if (cleanedTan) {
        finalTan = cleanedTan;
      } else {
        finalTan = 'NO_TAN_' + (cleanNameTokens(partyName) || `ROW_${r}`);
      }

      const contactPerson = colMap.contact_person !== -1 ? String(row[colMap.contact_person] || '').trim() : null;
      const designation = colMap.designation !== -1 ? String(row[colMap.designation] || '').trim() : null;
      const contactNumber = colMap.contact_number !== -1 ? String(row[colMap.contact_number] || '').trim() : null;
      const emailId = colMap.email_id !== -1 ? String(row[colMap.email_id] || '').trim() : null;
      const teamleader = colMap.teamleader !== -1 ? String(row[colMap.teamleader] || '').trim() : null;
      const rowFyRaw = colMap.fy !== -1 ? String(row[colMap.fy] || '').trim() : '';

      const isSpecificFy = uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years';
      const fallbackFy = isSpecificFy ? (normalizeFY(uploadFy) || null) : null;
      const financialYear = normalizeFY(rowFyRaw) || (voucherDate ? getFinancialYearFromDate(voucherDate) : null) || fallbackFy;

      entries.push({
        tan: finalTan,
        partyName: partyName || 'Unknown Client',
        gstNum,
        panNo,
        voucherDate,
        amount,
        tdsAmount,
        ledgerName: ledgerName || 'Tally Ledger',
        uploadBatchId,
        contactPerson,
        designation,
        contactNumber,
        emailId,
        teamleader,
        financialYear
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data rows found in Tally file.' });
    }

    // Bulk insert entries in chunks of 500
    const TALLY_CHUNK = 500;
    for (let i = 0; i < entries.length; i += TALLY_CHUNK) {
      const chunk = entries.slice(i, i + TALLY_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const e of chunk) {
        params.push(e.tan, e.partyName, e.gstNum, e.panNo, e.voucherDate, e.amount, e.tdsAmount, e.ledgerName, e.financialYear, e.uploadBatchId);
      }
      await db.execute(
        `INSERT INTO tds_tally_entries (tan_no, party_name, gst_num, pan_no, voucher_date, amount, tds_amount, ledger_name, financial_year, upload_batch_id) VALUES ${placeholders}`,
        params
      );
    }

    // Deduplicate contact info by TAN and update
    const contactsByTan = new Map();
    for (const e of entries) {
      if (e.tan && (e.contactPerson || e.designation || e.contactNumber || e.emailId || e.teamleader)) {
        const existing = contactsByTan.get(e.tan.toUpperCase()) || {};
        contactsByTan.set(e.tan.toUpperCase(), {
          contactPerson: e.contactPerson || existing.contactPerson || null,
          designation: e.designation || existing.designation || null,
          contactNumber: e.contactNumber || existing.contactNumber || null,
          emailId: e.emailId || existing.emailId || null,
          teamleader: e.teamleader || existing.teamleader || null,
        });
      }
    }

    if (contactsByTan.size > 0) {
      const allContactTans = Array.from(contactsByTan.keys());
      const existingTansSet = new Set();
      const CHECK_CHUNK = 500;
      for (let i = 0; i < allContactTans.length; i += CHECK_CHUNK) {
        const chunk = allContactTans.slice(i, i + CHECK_CHUNK);
        try {
          const [rows] = await db.query(
            `SELECT UPPER(TRIM(tan_no)) as tan FROM tds_dues WHERE UPPER(TRIM(tan_no)) IN (${chunk.map(() => '?').join(', ')})`,
            chunk
          );
          (rows || []).forEach(r => existingTansSet.add(r.tan));
        } catch (e) { }
      }

      const relevantContacts = allContactTans
        .filter(tan => existingTansSet.has(tan))
        .map(tan => [tan, contactsByTan.get(tan)]);

      const CONTACT_CHUNK = 100;
      for (let i = 0; i < relevantContacts.length; i += CONTACT_CHUNK) {
        const chunk = relevantContacts.slice(i, i + CONTACT_CHUNK);
        await Promise.all(chunk.map(([tan, info]) =>
          db.execute(`
            UPDATE tds_dues 
            SET 
              contact_person_name = COALESCE(?, contact_person_name),
              designation = COALESCE(?, designation),
              contact_number = COALESCE(?, contact_number),
              email_id = COALESCE(?, email_id),
              teamleader = COALESCE(?, teamleader)
            WHERE tan_no = ?
          `, [info.contactPerson, info.designation, info.contactNumber, info.emailId, info.teamleader, tan])
            .catch(() => { })
        ));
      }
    }

    // Persist financial year onto matching tds_dues rows if specific FY chosen
    if (uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years') {
      const uniqueTans = [...new Set(entries.map(e => e.tan).filter(t => t && !t.startsWith('NO_TAN_')))];
      const FY_CHUNK = 200;
      for (let i = 0; i < uniqueTans.length; i += FY_CHUNK) {
        const chunk = uniqueTans.slice(i, i + FY_CHUNK);
        const placeholders = chunk.map(() => '?').join(', ');
        try {
          await db.execute(
            `UPDATE tds_dues 
             SET financial_year = COALESCE(NULLIF(financial_year, ''), ?) 
             WHERE UPPER(TRIM(tan_no)) IN (${placeholders})`,
            [uploadFy, ...chunk]
          );
        } catch (fyErr) {
          console.warn('⚠️ Bulk FY update warning in Tally:', fyErr.message);
        }
      }
    }

    try {
      await reconcile(null, uploadBatchId);
    } catch (recErr) {
      console.warn('⚠️ Background reconciliation warning in Tally:', recErr.message);
    }

    const metadata = JSON.stringify({
      upload_type: 'TALLY_TDS',
      upload_batch_id: uploadBatchId,
      financial_year: normalizeFY(uploadFy) || null,
      file_name: file.originalname,
      total_records: entries.length,
      duplicates_skipped: 0
    });

    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `Tally file uploaded and parsed successfully (${entries.length} records). Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: entries.length,
      duplicatesSkipped: 0
    });

  } catch (error) {
    console.error('💥 Error in uploadTally:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Tally parsing', details: error.message });
  } finally {
    if (file && file.path) {
      fs.promises.unlink(file.path).catch(err => {
        console.warn(`⚠️ [Cleanup] Failed to unlink temp Tally upload file ${file.path}:`, err.message);
      });
    }
  }
};