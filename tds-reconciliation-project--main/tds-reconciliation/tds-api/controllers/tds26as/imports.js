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
 * High-speed RFC-4180 CSV Parser (parses 20,000 lines in ~30ms)
 * Avoids xlsx workbook memory overhead on raw text/csv files.
 */
export const parseCsvFast = (csvText) => {
  if (!csvText) return [];
  const result = [];
  const len = csvText.length;
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let i = 0; i < len; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
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

// Helper to format values
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

const isTanOrPanHeaderCell = (text) => {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return false;
  if (t === 'tan' || t === 'tan no' || t === 'tan_no' || t === 'tan number' || t === 'tan num' ||
    t === 'pan' || t === 'pan no' || t === 'pan_no' || t === 'pan number' || t === 'pan num' ||
    t === 'deductor tan' || t === 'party tan' || t === 'deductor pan' || t === 'party pan' ||
    t === 'deductor id' || t === 'tan of deductor' || t === 'tan/pan' || t === 'pan/tan') {
    return true;
  }
  return /^(tan|pan)(\s*(no|number|num|id|code))?$/i.test(t) ||
    /^(deductor|party|client)\s*(tan|pan)$/i.test(t);
};

const normalizeCompanyName = (name) => {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/\b(PVT|PRIVATE|LTD|LIMITED|INC|LLP|CORP|CORPORATION|CO|COMPANY|SERVICES|SOLUTIONS|INDIA)\b/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
};

const calculateStringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const s1 = String(str1).trim().toUpperCase();
  const s2 = String(str2).trim().toUpperCase();
  if (s1 === s2) return 100;

  const n1 = normalizeCompanyName(s1);
  const n2 = normalizeCompanyName(s2);
  if (n1 === n2 && n1.length > 0) return 95;

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;
  if (longer.length === 0) {
    return s1 === s2 ? 100 : 80;
  }

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  const distance = costs[shorter.length];
  const similarity = (longer.length - distance) / parseFloat(longer.length);
  return Math.max(50, Math.round(similarity * 100));
};

/**
 * Trigger Database Seeding Endpoint
 */
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


/**
 * Upload & Parse Form 26AS CSV/Excel file
 */
export const upload26as = async (req, res) => {
  try {
    clearPurgedFlag();
    console.log('📥 Upload 26AS API called');
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let rawData = [];
    const isCsv = file.originalname?.toLowerCase().endsWith('.csv') || file.mimetype?.includes('csv') || file.mimetype?.includes('text');
    if (isCsv) {
      try {
        const csvText = fs.readFileSync(file.path, 'utf8');
        rawData = parseCsvFast(csvText);
      } catch (csvErr) {
        console.warn('⚠️ parseCsvFast failed, trying xlsx fallback:', csvErr.message);
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      }
    } else {
      try {
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      } catch (excelErr) {
        console.warn('⚠️ xlsx.readFile failed, falling back to text split:', excelErr.message);
        const csvText = fs.readFileSync(file.path, 'utf8');
        rawData = parseCsvFast(csvText);
      }
    }

    if (rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded file is empty' });
    }

    let headerRowIdx = -1;
    let colMap = {
      tan_no: -1,
      deductor_name: -1,
      amount_paid: -1,
      tds_deducted: -1,
      section: -1,
      quarter: -1,
      fy: -1
    };

    const tanRegex = /^([A-Z]{4}\d{5}[A-Z]|[A-Z]{5}\d{4}[A-Z]|[A-Z0-9]{8,15})$/i;

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;

      let foundHeader = false;
      row.forEach((cell, col) => {
        const text = String(cell || '').toLowerCase().trim();
        if (isTanOrPanHeaderCell(text)) {
          colMap.tan_no = col;
          foundHeader = true;
        }
        if (colMap.deductor_name === -1 && (text.includes('deductor') || text.includes('company') || text.includes('party') || text === 'name')) {
          colMap.deductor_name = col;
        }
        if (colMap.amount_paid === -1 && (text.includes('amount paid') || text.includes('amount credited') || text.includes('gross') || text.includes('invoice') || text === 'amount')) {
          colMap.amount_paid = col;
        }
        if (colMap.tds_deducted === -1 && (text.includes('tds') || text.includes('tax deducted') || text.includes('deducted') || text === 'tax')) {
          colMap.tds_deducted = col;
        }
        if (colMap.section === -1 && text.includes('section')) {
          colMap.section = col;
        }
        if (colMap.quarter === -1 && (text.includes('quarter') || text.includes('period') || text.includes('qtr'))) {
          colMap.quarter = col;
        }
        if (colMap.fy === -1 && (/^f\.?y\.?$/i.test(text) || text.includes('financial year') || text.includes('fin year') || text === 'fy' || text === 'f.y.')) {
          colMap.fy = col;
        }
      });

      if (foundHeader && (colMap.tan_no !== -1 || colMap.tds_deducted !== -1)) {
        headerRowIdx = r;
        break;
      }
    }

    if (colMap.tan_no === -1) {
      for (let c = 0; c < 30; c++) {
        let matchCount = 0;
        for (let r = 0; r < Math.min(100, rawData.length); r++) {
          if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim())) {
            matchCount++;
          }
        }
        if (matchCount >= 1) {
          colMap.tan_no = c;
          break;
        }
      }
    }

    if (colMap.tan_no === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect TAN/PAN column in uploaded file. Please ensure your file contains a valid TAN column (e.g. DELG03106F).'
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

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawTan = String(row[colMap.tan_no] || '').trim();
      if (!rawTan) continue;

      const tan = rawTan.toUpperCase();
      if (['TANNO', 'TAN_NO', 'TAN', 'PAN', 'PANNO', 'COMPANYNAME', 'PARTYNAME', 'DEDUCTORNAME', 'DEDUCTOR_NAME'].includes(tan)) continue;

      const deductorName = colMap.deductor_name !== -1 ? String(row[colMap.deductor_name] || '').trim() : 'Unknown Deductor';
      const amountPaid = colMap.amount_paid !== -1 ? cleanNumber(row[colMap.amount_paid]) : 0.00;
      const tdsDeducted = colMap.tds_deducted !== -1 ? cleanNumber(row[colMap.tds_deducted]) : 0.00;
      const section = colMap.section !== -1 ? String(row[colMap.section] || '').trim() : 'N/A';
      const quarter = colMap.quarter !== -1 ? String(row[colMap.quarter] || '').trim() : 'N/A';
      const rowFyRaw = colMap.fy !== -1 ? String(row[colMap.fy] || '').trim() : '';
      const isSpecificFy = uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years';
      const fallbackFy = isSpecificFy ? (normalizeFY(uploadFy) || null) : null;
      const financialYear = normalizeFY(rowFyRaw) || fallbackFy;

      entries.push({
        tan, deductorName, amountPaid, tdsDeducted, section, quarter, financialYear, uploadBatchId
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data rows found in 26AS file.' });
    }

    // Deduplicate exact matching rows in-memory before bulk insert:
    // (tan_no, financial_year, tds_deducted, section, quarter)
    const seen26asKeys = new Set();
    const dedupedEntries = [];
    let duplicatesSkipped = 0;

    for (const entry of entries) {
      const key = [
        String(entry.tan || '').toUpperCase().trim(),
        String(entry.financialYear || '').toUpperCase().trim(),
        parseFloat(entry.tdsDeducted || 0).toFixed(2),
        String(entry.section || '').toUpperCase().trim(),
        String(entry.quarter || '').toUpperCase().trim()
      ].join('|');

      if (seen26asKeys.has(key)) {
        duplicatesSkipped++;
      } else {
        seen26asKeys.add(key);
        dedupedEntries.push(entry);
      }
    }

    if (dedupedEntries.length === 0) {
      return res.status(400).json({ success: false, error: 'All rows in 26AS file were empty or skipped.' });
    }

    // Bulk insert entries in chunks of 500
    const INSERT_CHUNK = 500;
    for (let i = 0; i < dedupedEntries.length; i += INSERT_CHUNK) {
      const chunk = dedupedEntries.slice(i, i + INSERT_CHUNK);
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

    // Persist financial year onto matching tds_dues rows in bulk chunks of 200 only if specific FY
    if (uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years') {
      const uniqueTans = [...new Set(dedupedEntries.map(e => e.tan).filter(Boolean))];
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
      console.warn('⚠️ Background reconciliation warning:', recErr.message);
    }

    const metadata = JSON.stringify({
      upload_type: '26AS_TDS',
      upload_batch_id: uploadBatchId,
      financial_year: normalizeFY(uploadFy) || null,
      file_name: file.originalname,
      total_records: dedupedEntries.length,
      duplicates_skipped: duplicatesSkipped
    });

    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `26AS CSV uploaded and parsed successfully. Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: dedupedEntries.length,
      duplicatesSkipped
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

/**
 * Upload & Parse Tally CSV file
 */
export const uploadTally = async (req, res) => {
  try {
    clearPurgedFlag();
    console.log('📥 Upload Tally API called');
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let rawData = [];
    const isCsv = file.originalname?.toLowerCase().endsWith('.csv') || file.mimetype?.includes('csv') || file.mimetype?.includes('text');
    if (isCsv) {
      try {
        const csvText = fs.readFileSync(file.path, 'utf8');
        rawData = parseCsvFast(csvText);
      } catch (csvErr) {
        console.warn('⚠️ parseCsvFast failed in uploadTally, trying xlsx fallback:', csvErr.message);
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      }
    } else {
      try {
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      } catch (excelErr) {
        console.warn('⚠️ xlsx.readFile failed in uploadTally, falling back to text split:', excelErr.message);
        const csvText = fs.readFileSync(file.path, 'utf8');
        rawData = parseCsvFast(csvText);
      }
    }

    if (rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded file is empty' });
    }

    let headerRowIdx = -1;
    let colMap = {
      tan_no: -1,
      party_name: -1,
      voucher_date: -1,
      amount: -1,
      tds_amount: -1,
      ledger_name: -1,
      contact_person: -1,
      designation: -1,
      contact_number: -1,
      email_id: -1,
      teamleader: -1,
      fy: -1
    };

    const tanRegex = /^([A-Z]{4}\d{5}[A-Z]|[A-Z]{5}\d{4}[A-Z]|[A-Z0-9]{8,15})$/i;

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;
      let hasTanOrPanOrCompany = false;
      row.forEach((cell) => {
        const text = String(cell || '').toLowerCase().trim();
        if (isTanOrPanHeaderCell(text) || text.includes('tan') || text.includes('pan') || text.includes('company') || text.includes('tally')) hasTanOrPanOrCompany = true;
      });
      if (hasTanOrPanOrCompany) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const text = String(cell || '').toLowerCase().trim();
          if (isTanOrPanHeaderCell(text) && colMap.tan_no === -1) {
            colMap.tan_no = col;
            colMap.pan_no = col;
          }
          if (!isTanOrPanHeaderCell(text) && colMap.party_name === -1 && (text.includes('company') || text.includes('party') || text === 'name' || text.includes('client'))) {
            colMap.party_name = col;
          }
          if (text.includes('gstnum') || text.includes('gst num') || text.includes('gstin') || text.includes('gst')) {
            colMap.gst_num = col;
          }
          if (text.includes('date') || text.includes('voucher date')) {
            colMap.voucher_date = col;
          }
          if (colMap.amount === -1 && (text.includes('gross total') || text.includes('total amount') || text.includes('invoice amount') || text === 'amount' || text.includes('value'))) {
            colMap.amount = col;
          }
          if (colMap.tds_amount === -1 && (text.includes('tdsamt') || text.includes('tds amt') || text.includes('tds amount') || text === 'tds' || text === 'tds deducted' || text.includes('tax'))) {
            colMap.tds_amount = col;
          }
          if (text.includes('ledger') && colMap.ledger_name === -1) {
            colMap.ledger_name = col;
          }
          if (text.includes('contactperson') || text.includes('contact person') || text === 'person' || text.includes('hr')) {
            colMap.contact_person = col;
          }
          if (text.includes('designation') || text.includes('role')) {
            colMap.designation = col;
          }
          if (text.includes('phone') || text.includes('mobile') || text.includes('contactnumber') || text.includes('contact number')) {
            colMap.contact_number = col;
          }
          if (text.includes('email')) {
            colMap.email_id = col;
          }
          if (text.includes('teamleader') || text.includes('team leader') || text.includes('manager')) {
            colMap.teamleader = col;
          }
          if (colMap.fy === -1 && (/^f\.?y\.?$/i.test(text) || text.includes('financial year') || text.includes('fin year') || text === 'fy' || text === 'f.y.')) {
            colMap.fy = col;
          }
        });
        break;
      }
    }

    if (colMap.tan_no === -1) {
      for (let c = 0; c < 30; c++) {
        let matchCount = 0;
        for (let r = 0; r < Math.min(100, rawData.length); r++) {
          if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim())) {
            matchCount++;
          }
        }
        if (matchCount >= 1) {
          colMap.tan_no = c;
          break;
        }
      }
    }

    if (colMap.tan_no === -1) {
      return res.status(400).json({ success: false, error: 'Could not detect client TAN number column inside uploaded Tally file.' });
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

    // Pre-load known genuine TANs from Form 26AS to resolve any PANs or aliases provided in Tally
    const [known26asTans] = await db.query(
      "SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(deductor_name)) as name FROM tds_26as_entries WHERE tan_no REGEXP '^[A-Za-z]{4}[0-9]{5}[A-Za-z]$'"
    );
    const tanByCleanName = new Map();
    for (const k of known26asTans) {
      const c = cleanNameTokens(k.name);
      if (c && !tanByCleanName.has(c)) tanByCleanName.set(c, k.tan_no);
    }

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawTan = String(row[colMap.tan_no] || '').trim();
      if (!rawTan) continue;

      const tan = rawTan.toUpperCase();
      if (['TANNO', 'TAN_NO', 'TAN', 'PAN', 'PANNO', 'COMPANYNAME', 'PARTYNAME', 'DEDUCTORNAME', 'DEDUCTOR_NAME'].includes(tan)) continue;

      const partyName = colMap.party_name !== -1 ? String(row[colMap.party_name] || '').trim() : 'Unknown Client';
      const gstNum = colMap.gst_num !== -1 ? String(row[colMap.gst_num] || '').trim() : '';
      let panNo = colMap.pan_no !== -1 ? String(row[colMap.pan_no] || '').trim() : '';
      const voucherDateRaw = colMap.voucher_date !== -1 ? String(row[colMap.voucher_date] || '').trim() : null;

      // Detect if TAN is actually a PAN (5 letters, 4 numbers, 1 letter)
      const isRealTan = /^[A-Z]{4}\d{5}[A-Z]$/i.test(tan);
      const isRealPan = /^[A-Z]{5}\d{4}[A-Z]$/i.test(tan);
      let finalTan = tan;
      if (isRealPan && !panNo) {
        panNo = tan;
      }
      if (!isRealTan) {
        const resolvedTan = tanByCleanName.get(cleanNameTokens(partyName));
        if (resolvedTan) {
          finalTan = resolvedTan;
        }
      }

      let voucherDate = null;
      if (voucherDateRaw) {
        if (typeof voucherDateRaw === 'number' || (!isNaN(Number(voucherDateRaw)) && Number(voucherDateRaw) > 20000 && Number(voucherDateRaw) < 60000)) {
          const UTC_DAYS_DIFF = 25569;
          const date = new Date((Number(voucherDateRaw) - UTC_DAYS_DIFF) * 86400 * 1000);
          if (!isNaN(date.getTime())) voucherDate = date.toISOString().split('T')[0];
        } else {
          const parsedDate = Date.parse(voucherDateRaw);
          if (!isNaN(parsedDate)) {
            voucherDate = new Date(parsedDate).toISOString().split('T')[0];
          } else {
            // Check DD-Mon-YY or DD/MM/YYYY
            const ddmmyyyy = String(voucherDateRaw).match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})$/);
            if (ddmmyyyy) {
              const tryParsed = Date.parse(`${ddmmyyyy[2]} ${ddmmyyyy[1]}, ${ddmmyyyy[3].length === 2 ? '20' + ddmmyyyy[3] : ddmmyyyy[3]}`);
              if (!isNaN(tryParsed)) {
                voucherDate = new Date(tryParsed).toISOString().split('T')[0];
              }
            }
          }
        }
      }

      const amount = colMap.amount !== -1 ? cleanNumber(row[colMap.amount]) : 0.00;
      const tdsAmount = colMap.tds_amount !== -1 ? cleanNumber(row[colMap.tds_amount]) : 0.00;
      const ledgerName = colMap.ledger_name !== -1 ? String(row[colMap.ledger_name] || '').trim() : 'Tally Ledger';

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
        tan: finalTan, partyName, gstNum, panNo, voucherDate, amount, tdsAmount, ledgerName, uploadBatchId,
        contactPerson, designation, contactNumber, emailId, teamleader, financialYear
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid Tally rows found.' });
    }

    // Deduplicate exact matching rows in-memory before bulk insert:
    // (tan_no, financial_year, tds_amount, voucher_date)
    const seenTallyKeys = new Set();
    const dedupedEntries = [];
    let duplicatesSkipped = 0;

    for (const entry of entries) {
      const key = [
        String(entry.tan || '').toUpperCase().trim(),
        String(entry.financialYear || '').toUpperCase().trim(),
        parseFloat(entry.tdsAmount || 0).toFixed(2),
        String(entry.voucherDate || '').trim()
      ].join('|');

      if (seenTallyKeys.has(key)) {
        duplicatesSkipped++;
      } else {
        seenTallyKeys.add(key);
        dedupedEntries.push(entry);
      }
    }

    if (dedupedEntries.length === 0) {
      return res.status(400).json({ success: false, error: 'All rows in Tally file were empty or skipped.' });
    }

    // Bulk insert entries in chunks of 500
    const TALLY_CHUNK = 500;
    for (let i = 0; i < dedupedEntries.length; i += TALLY_CHUNK) {
      const chunk = dedupedEntries.slice(i, i + TALLY_CHUNK);
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

    // Deduplicate contact info by TAN and update in parallel chunks of 30
    const contactsByTan = new Map();
    for (const e of dedupedEntries) {
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

    // Persist financial year onto matching tds_dues rows in bulk chunks of 200 only if specific FY
    if (uploadFy && uploadFy !== 'All' && uploadFy !== 'All Financial Years') {
      const uniqueTans = [...new Set(dedupedEntries.map(e => e.tan).filter(Boolean))];
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
      total_records: dedupedEntries.length,
      duplicates_skipped: duplicatesSkipped
    });

    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `Tally CSV uploaded and parsed successfully. Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: dedupedEntries.length,
      duplicatesSkipped
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

/**
 * Get Dashboard Summary Aggregate Counts & Totals
 */