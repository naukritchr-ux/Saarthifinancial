import xlsx from 'xlsx';
import db from '../config/db.js';
import { reconcile } from '../services/tdsReconciliationService.js';
import { seedEmbeddedDataset, markPurgedFlag, clearPurgedFlag } from '../seed_embedded_dataset.js';
import { v4 as uuidv4 } from 'uuid';

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

    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

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
      quarter: -1
    };

    const tanRegex = /^([A-Z]{4}\d{5}[A-Z]|[A-Z]{5}\d{4}[A-Z]|[A-Z0-9]{8,15})$/i;

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;
      
      let foundHeader = false;
      row.forEach((cell, col) => {
        const text = String(cell || '').toLowerCase().trim();
        if (isTanOrPanHeaderCell(text) || text.includes('deductor') || text.includes('company') || text.includes('tds') || text.includes('amount')) {
          foundHeader = true;
        }

        if (colMap.tan_no === -1 && isTanOrPanHeaderCell(text)) {
          colMap.tan_no = col;
        }
        if (colMap.deductor_name === -1 && !isTanOrPanHeaderCell(text) && (text.includes('deductor') || text.includes('company') || text.includes('party') || text === 'name')) {
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

    if (headerRowIdx === -1) {
      if (colMap.tds_deducted === -1 && colMap.tan_no !== -1) colMap.tds_deducted = colMap.tan_no + 3;
      if (colMap.amount_paid === -1 && colMap.tan_no !== -1) colMap.amount_paid = colMap.tan_no + 2;
    }

    if (colMap.tan_no === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect TAN/PAN column in uploaded file. Please ensure your file contains a valid TAN column (e.g. DELG03106F).'
      });
    }

    const importMode = req.body?.importMode || req.query?.importMode || 'update';
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

      const deductorName = colMap.deductor_name !== -1 ? String(row[colMap.deductor_name] || '').trim() : 'Unknown Deductor';
      const amountPaid = colMap.amount_paid !== -1 ? cleanNumber(row[colMap.amount_paid]) : 0.00;
      const tdsDeducted = cleanNumber(row[colMap.tds_deducted]);
      const section = colMap.section !== -1 ? String(row[colMap.section] || '').trim() : 'N/A';
      const quarter = colMap.quarter !== -1 ? String(row[colMap.quarter] || '').trim() : 'N/A';

      entries.push({
        tan, deductorName, amountPaid, tdsDeducted, section, quarter, uploadBatchId
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data rows found in 26AS file.' });
    }

    for (const e of entries) {
      await db.execute(
        'INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [e.tan, e.deductorName, e.amountPaid, e.tdsDeducted, e.section, e.quarter, e.uploadBatchId]
      );
    }

    try {
      await reconcile(uploadBatchId, null);
    } catch (recErr) {
      console.warn('⚠️ Background reconciliation warning:', recErr.message);
    }

    const metadata = JSON.stringify({
      upload_type: '26AS_TDS',
      upload_batch_id: uploadBatchId,
      total_rows: entries.length
    });
    
    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `26AS CSV uploaded and parsed successfully. Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: entries.length
    });

  } catch (error) {
    console.error('💥 Error in upload26as:', error);
    res.status(500).json({ success: false, error: 'Internal server error during 26AS parsing', details: error.message });
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

    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

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
      ledger_name: -1
    };

    const tanRegex = /^([A-Z]{4}\d{5}[A-Z]|[A-Z]{5}\d{4}[A-Z]|[A-Z0-9]{8,15})$/i;

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row || !Array.isArray(row)) continue;
      let hasTanOrPan = false;
      let hasTdsOrAmount = false;
      row.forEach((cell) => {
        const text = String(cell || '').toLowerCase().trim();
        if (isTanOrPanHeaderCell(text) || text.includes('tan') || text.includes('pan')) hasTanOrPan = true;
        if (text.includes('tds') || text.includes('tax') || text.includes('deducted') || text.includes('amount') || text.includes('value')) hasTdsOrAmount = true;
      });
      if (hasTanOrPan && hasTdsOrAmount) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const text = String(cell || '').toLowerCase().trim();
          if (isTanOrPanHeaderCell(text) && colMap.tan_no === -1) {
            colMap.tan_no = col;
            colMap.pan_no = col;
          }
          if (!isTanOrPanHeaderCell(text) && colMap.party_name === -1 && (text.includes('name of the company') || text.includes('party name') || text.includes('company name') || text === 'company' || text === 'ledger name' || text === 'ledger' || text.includes('name'))) {
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
      return res.status(400).json({ success: false, error: 'Could not detect client TAN number column inside Tally sheet.' });
    }

    if (headerRowIdx === -1) {
      if (colMap.tds_amount === -1 && colMap.tan_no !== -1) colMap.tds_amount = colMap.tan_no + 3;
      if (colMap.amount === -1 && colMap.tan_no !== -1) colMap.amount = colMap.tan_no + 2;
    }

    const importMode = req.body?.importMode || req.query?.importMode || 'update';
    if (importMode === 'clean') {
      console.log('🧹 Cleaning past Tally data before import...');
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute('UPDATE tds_reconciliation_results SET tally_tds = 0, tally_batch_id = NULL WHERE is_manually_edited = 0');
    }

    const uploadBatchId = `batch_tally_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const entries = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawTan = String(row[colMap.tan_no] || '').trim();
      if (!rawTan) continue;

      const tan = rawTan.toUpperCase();

      const partyName = colMap.party_name !== -1 ? String(row[colMap.party_name] || '').trim() : 'Unknown Client';
      const gstNum = colMap.gst_num !== -1 ? String(row[colMap.gst_num] || '').trim() : '';
      const panNo = colMap.pan_no !== -1 ? String(row[colMap.pan_no] || '').trim() : '';
      const voucherDateRaw = colMap.voucher_date !== -1 ? String(row[colMap.voucher_date] || '').trim() : null;
      
      let voucherDate = null;
      if (voucherDateRaw) {
        const parsedDate = Date.parse(voucherDateRaw);
        if (!isNaN(parsedDate)) {
          voucherDate = new Date(parsedDate).toISOString().split('T')[0];
        }
      }

      const amount = colMap.amount !== -1 ? cleanNumber(row[colMap.amount]) : 0.00;
      const tdsAmount = cleanNumber(row[colMap.tds_amount]);
      const ledgerName = colMap.ledger_name !== -1 ? String(row[colMap.ledger_name] || '').trim() : 'Tally Ledger';

      entries.push({
        tan, partyName, gstNum, panNo, voucherDate, amount, tdsAmount, ledgerName, uploadBatchId
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid Tally rows found.' });
    }

    for (const e of entries) {
      await db.execute(
        'INSERT INTO tds_tally_entries (tan_no, party_name, gst_num, pan_no, voucher_date, amount, tds_amount, ledger_name, upload_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [e.tan, e.partyName, e.gstNum, e.panNo, e.voucherDate, e.amount, e.tdsAmount, e.ledgerName, e.uploadBatchId]
      );
    }

    try {
      await reconcile(null, uploadBatchId);
    } catch (recErr) {
      console.warn('⚠️ Background reconciliation warning:', recErr.message);
    }

    const metadata = JSON.stringify({
      upload_type: 'TALLY_TDS',
      upload_batch_id: uploadBatchId,
      total_rows: entries.length
    });
    
    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      [file.originalname, file.path, req.user?.email || 'System', 'Completed', metadata]
    );

    res.json({
      success: true,
      message: `Tally CSV uploaded and parsed successfully. Created batch ID ${uploadBatchId}`,
      batchId: uploadBatchId,
      records: entries.length
    });

  } catch (error) {
    console.error('💥 Error in uploadTally:', error);
    res.status(500).json({ success: false, error: 'Internal server error during Tally parsing', details: error.message });
  }
};

/**
 * Get Dashboard Summary Aggregate Counts & Totals
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const { fy } = req.query;

    let whereClause = '';
    const params = [];
    if (fy && fy !== 'All' && fy !== 'All Financial Years') {
      const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
      whereClause = 'WHERE (d.financial_year LIKE ? OR d.financial_year LIKE ? OR tr.as26_batch_id LIKE ?)';
      params.push(`%${cleanFy}%`, `%${fy}%`, `%${cleanFy}%`);
    }

    const query = `
      SELECT 
        tr.books_tds,
        tr.as26_tds,
        tr.tally_tds,
        tr.overall_status,
        tr.books_vs_26as_status,
        tr.books_vs_tally_status,
        tr.as26_vs_tally_status,
        tr.is_manually_edited
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereClause}
    `;

    let [rows] = await db.execute(query, params);

    let tallyTotal = 0;
    let as26Total = 0;
    let saarthiTotal = 0;

    let threeOfThree = 0;
    let twoOfThree = 0;
    let oneOfThree = 0;
    let noMatch = 0;

    let matchCount = 0;
    let lessCount = 0;
    let excessCount = 0;
    let missingCount = 0;
    let pendingReviewCount = 0;
    let resolvedCount = 0;

    rows.forEach(r => {
      const tally = parseFloat(r.tally_tds || 0);
      const as26 = parseFloat(r.as26_tds || 0);
      const saarthi = parseFloat(r.books_tds || 0);

      tallyTotal += tally;
      as26Total += as26;
      saarthiTotal += saarthi;

      const sourcesPresent = (tally > 0 ? 1 : 0) + (as26 > 0 ? 1 : 0) + (saarthi > 0 ? 1 : 0);
      if (sourcesPresent === 3) threeOfThree++;
      else if (sourcesPresent === 2) twoOfThree++;
      else if (sourcesPresent === 1) oneOfThree++;
      else noMatch++;

      if (r.is_manually_edited) {
        resolvedCount++;
      } else if (r.overall_status === 'All Matched') {
        matchCount++;
      } else if (r.overall_status === 'Partial Mismatch') {
        pendingReviewCount++;
      } else if (sourcesPresent < 3 || r.overall_status === 'Major Mismatch') {
        if (r.books_vs_26as_status === 'Less Paid' || r.books_vs_tally_status === 'Less Paid') lessCount++;
        else if (r.books_vs_26as_status === 'Excess' || r.books_vs_tally_status === 'Excess') excessCount++;
        else missingCount++;
      } else if (r.books_vs_26as_status === 'Less Paid') {
        lessCount++;
      } else if (r.books_vs_26as_status === 'Excess') {
        excessCount++;
      } else {
        matchCount++;
      }
    });

    res.json({
      success: true,
      totals: {
        tally: tallyTotal,
        as26: as26Total,
        saarthi: saarthiTotal,
        netGap: tallyTotal - as26Total
      },
      recordCount: rows.length,
      sourceCoverage: {
        threeOfThree,
        twoOfThree,
        oneOfThree,
        noMatch
      },
      financialStatus: {
        match: matchCount,
        less: lessCount,
        excess: excessCount,
        missing: missingCount,
        pendingReview: pendingReviewCount,
        resolved: resolvedCount
      }
    });

  } catch (error) {
    console.error('💥 Error in getDashboardSummary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary', details: error.message });
  }
};

/**
 * Get Data Import Cleaning Queue
 */
export const getCleaningQueue = async (req, res) => {
  try {
    const query = `
      SELECT 
        tr.id,
        tr.tan_no as tanNo,
        d.company_name as booksCompanyName,
        tr.books_tds as booksTds,
        tr.as26_tds as as26Tds,
        tr.tally_tds as tallyTds,
        tr.overall_status as overallStatus
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
        AND (tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10 
             OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = ''
             OR tr.overall_status = 'Major Mismatch'
             OR tr.overall_status = 'Partial Mismatch')
      ORDER BY tr.id DESC
      LIMIT 100
    `;

    const [rows] = await db.execute(query);

    const [all26as] = await db.execute('SELECT deductor_name, tan_no FROM tds_26as_entries');
    const [allTally] = await db.execute('SELECT party_name, tan_no FROM tds_tally_entries');

    const as26ByTan = new Map();
    for (const e of all26as) {
      const key = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (key && !as26ByTan.has(key)) as26ByTan.set(key, e);
    }
    const tallyByTan = new Map();
    for (const e of allTally) {
      const key = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (key && !tallyByTan.has(key)) tallyByTan.set(key, e);
    }

    const findFuzzy = (name, list, nameField) => {
      let best = null;
      let bestScore = 0;
      for (const f of list) {
        const score = calculateStringSimilarity(name, f[nameField]);
        if (score >= 80 && score > bestScore) {
          best = f;
          bestScore = score;
        }
      }
      return best;
    };

    const cleaningItems = rows.map((r) => {
      const tan = r.tanNo ? String(r.tanNo).trim().toUpperCase() : '';
      const booksName = r.booksCompanyName || 'Unknown Client';

      let as26Name = null;
      let as26Tan = null;
      const as26ExactMatch = tan ? as26ByTan.get(tan) : null;
      if (as26ExactMatch) {
        as26Name = as26ExactMatch.deductor_name;
        as26Tan = as26ExactMatch.tan_no;
      } else if (booksName && booksName !== 'Unknown Client') {
        const fuzzy = findFuzzy(booksName, all26as, 'deductor_name');
        if (fuzzy) {
          as26Name = fuzzy.deductor_name;
          as26Tan = fuzzy.tan_no;
        }
      }

      let tallyName = null;
      let tallyTan = null;
      const tallyExactMatch = tan ? tallyByTan.get(tan) : null;
      if (tallyExactMatch) {
        tallyName = tallyExactMatch.party_name;
        tallyTan = tallyExactMatch.tan_no;
      } else if (booksName && booksName !== 'Unknown Client') {
        const fuzzy = findFuzzy(booksName, allTally, 'party_name');
        if (fuzzy) {
          tallyName = fuzzy.party_name;
          tallyTan = fuzzy.tan_no;
        }
      }

      const namesToCompare = [tallyName, as26Name, booksName].filter(Boolean);
      let confidence = 100;
      if (namesToCompare.length >= 2) {
        let totalSim = 0;
        let pairCount = 0;
        for (let i = 0; i < namesToCompare.length; i++) {
          for (let j = i + 1; j < namesToCompare.length; j++) {
            totalSim += calculateStringSimilarity(namesToCompare[i], namesToCompare[j]);
            pairCount++;
          }
        }
        confidence = Math.round(totalSim / pairCount);
      }

      let saarthiSuggestion = booksName;
      if (as26Name && as26Name.length > saarthiSuggestion.length && as26Name !== 'Unknown Deductor') {
        saarthiSuggestion = as26Name;
      }
      if (tallyName && tallyName.length > saarthiSuggestion.length && tallyName !== 'Unknown Client') {
        saarthiSuggestion = tallyName;
      }

      const resolvedTans = [tan, as26Tan, tallyTan].filter(Boolean);
      const uniqueTans = Array.from(new Set(resolvedTans));
      const isTanMismatch = uniqueTans.length > 1;

      let reason = 'Multi-source Data Discrepancy';
      let issueType = 'source_discrepancy';

      if (isTanMismatch) {
        reason = 'Conflicting TANs across datasets';
        issueType = 'tan_mismatch';
      } else if (confidence < 90) {
        reason = 'Deductor Name Discrepancy';
        issueType = 'name_mismatch';
      } else if (!tan || tan.length < 10) {
        reason = 'Missing or Invalid TAN Format';
        issueType = 'invalid_tan';
      }

      return {
        id: r.id,
        tanNo: tan || 'UNKNOWN_TAN',
        companyName: tallyName || booksName,
        tallyCompanyName: tallyName || booksName,
        tallyTan: tallyTan || tan || 'UNKNOWN_TAN',
        as26CompanyName: as26Name || null,
        as26Tan: as26Tan || null,
        saarthiName: booksName,
        saarthiTan: tan || 'UNKNOWN_TAN',
        saarthiSuggestion,
        confidence,
        isTanMismatch,
        issueType,
        issueReason: reason,
        sources: [
          r.booksTds > 0 ? 'Saarthi 360' : null,
          (as26Name || r.as26Tds > 0) ? 'Form 26AS' : null,
          (tallyName || r.tallyTds > 0) ? 'Tally Ledger' : null
        ].filter(Boolean),
        booksTds: r.booksTds,
        as26Tds: r.as26Tds,
        tallyTds: r.tallyTds
      };
    });

    const flaggedItems = cleaningItems.filter(item => {
      const isZeroData = (item.booksTds || 0) === 0 && (item.as26Tds || 0) === 0 && (item.tallyTds || 0) === 0;
      const isUnknownDummy = (item.companyName || item.saarthiName || '').toUpperCase().includes('UNKNOWN');

      if (isZeroData && isUnknownDummy) return false;

      const invalidTan = !item.tanNo || item.tanNo.length < 10 || item.tanNo.includes('UNKNOWN');
      const missingName = !item.saarthiName || item.saarthiName === 'Unknown Client' || item.saarthiName === 'Unknown Company';
      const lowConfidence = item.confidence < 90;
      const tanMismatch = item.isTanMismatch;
      return invalidTan || missingName || lowConfidence || tanMismatch;
    });

    res.json({
      success: true,
      count: flaggedItems.length,
      data: flaggedItems
    });

  } catch (error) {
    console.error('💥 Error in getCleaningQueue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cleaning queue', details: error.message });
  }
};

/**
 * Resolve a Data Import Cleaning Item
 */
export const resolveCleaningItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { tanNo, companyName, status } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Cleaning Item ID is required' });
    }

    if (status === 'Rejected') {
      const [recRows] = await db.execute('SELECT tds_dues_id FROM tds_reconciliation_results WHERE id = ?', [id]);
      if (recRows.length > 0 && recRows[0].tds_dues_id) {
        await db.execute('DELETE FROM tds_dues WHERE id = ? AND (saarthi_client_id IS NULL OR saarthi_client_id = "") AND (tds IS NULL OR tds = 0)', [recRows[0].tds_dues_id]);
      }
      await db.execute('DELETE FROM tds_reconciliation_results WHERE id = ?', [id]);

      return res.json({
        success: true,
        message: 'Cleaning item rejected and removed successfully',
        id
      });
    }

    const cleanTan = String(tanNo || 'N/A').toUpperCase().trim();
    const cleanCompany = String(companyName || 'Cleaned Entity').trim();

    await db.execute(
      `UPDATE tds_reconciliation_results 
       SET tan_no = ?, is_manually_edited = 1, overall_status = 'All Matched', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cleanTan, id]
    );

    const [recRows] = await db.execute('SELECT tds_dues_id FROM tds_reconciliation_results WHERE id = ?', [id]);
    if (recRows.length > 0 && recRows[0].tds_dues_id) {
      await db.execute(
        'UPDATE tds_dues SET tan_no = ?, company_name = ? WHERE id = ?',
        [cleanTan, cleanCompany, recRows[0].tds_dues_id]
      );
    }

    res.json({
      success: true,
      message: 'Cleaning item resolved successfully',
      id,
      tanNo: cleanTan,
      companyName: cleanCompany
    });

  } catch (error) {
    console.error('💥 Error in resolveCleaningItem:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve cleaning item', details: error.message });
  }
};

/**
 * Get Paginated & Filterable Reconciliation Report
 */
export const getReconciliationReport = async (req, res) => {
  try {
    // Auto-ensure reconciliation table is populated if empty
    try {
      const [checkRows] = await db.execute('SELECT COUNT(*) as cnt FROM tds_reconciliation_results');
      const totalRecs = checkRows[0]?.cnt || checkRows[0]?.['COUNT(*)'] || 0;
      if (totalRecs === 0) {
        console.log('⚡ Reconciliation results table empty; running initial 3-way reconciliation...');
        await reconcile(null, null);
      }
    } catch (checkErr) {
      console.warn('Auto-reconcile check warning:', checkErr.message);
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      overallStatus = '',
      coverageFilter = 'All',
      fy = '',
      financialYear = '',
      sortBy = 'updated_at',
      booksVs26asStatus = '',
      booksVsTallyStatus = '',
      as26VsTallyStatus = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    const queryParams = [];

    const activeFy = fy || financialYear;
    if (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years') {
      const cleanFy = String(activeFy).replace(/^FY\s*/i, '').trim();
      whereClauses.push('(tr.as26_batch_id LIKE ? OR tr.tally_batch_id LIKE ?)');
      queryParams.push(`%${cleanFy}%`, `%${cleanFy}%`);
    }

    if (search.trim() !== '') {
      whereClauses.push('(tr.tan_no LIKE ? OR COALESCE(d.company_name, "") LIKE ?)');
      const wild = `%${search.trim()}%`;
      queryParams.push(wild, wild);
    }

    if (overallStatus && overallStatus !== 'All') {
      if (overallStatus === 'Match' || overallStatus === 'All Matched') {
        whereClauses.push('(tr.overall_status = "All Matched" OR ABS((COALESCE(tr.books_tds, tr.tally_tds, 0)) - COALESCE(tr.as26_tds, 0)) <= 1.0)');
      } else if (overallStatus === 'Less Paid' || overallStatus === 'Less') {
        whereClauses.push('(COALESCE(tr.books_tds, tr.tally_tds, 0) < COALESCE(tr.as26_tds, 0) - 1.0)');
      } else if (overallStatus === 'Excess') {
        whereClauses.push('(COALESCE(tr.books_tds, tr.tally_tds, 0) > COALESCE(tr.as26_tds, 0) + 1.0)');
      } else {
        whereClauses.push('tr.overall_status = ?');
        queryParams.push(overallStatus);
      }
    }

    if (booksVs26asStatus && booksVs26asStatus !== 'All') {
      whereClauses.push('tr.books_vs_26as_status = ?');
      queryParams.push(booksVs26asStatus);
    }

    // 3-Way Source Coverage Filter
    if (coverageFilter === '3/3' || coverageFilter === '3 of 3' || coverageFilter === 'all_3' || coverageFilter === 'all') {
      whereClauses.push('((tr.books_tds > 0 OR tr.tds_dues_id IS NOT NULL) AND tr.as26_tds > 0 AND tr.tally_tds > 0)');
    } else if (coverageFilter === 'saarthi_tally' || coverageFilter === 'tally_saarthi') {
      whereClauses.push('((tr.books_tds > 0 OR tr.tds_dues_id IS NOT NULL) AND tr.tally_tds > 0 AND (tr.as26_tds IS NULL OR tr.as26_tds = 0))');
    } else if (coverageFilter === 'tally_26as' || coverageFilter === '26as_tally') {
      whereClauses.push('(tr.tally_tds > 0 AND tr.as26_tds > 0 AND (tr.books_tds IS NULL OR tr.books_tds = 0) AND tr.tds_dues_id IS NULL)');
    } else if (coverageFilter === 'as26_saarthi' || coverageFilter === 'saarthi_26as' || coverageFilter === '26as_saarthi') {
      whereClauses.push('(tr.as26_tds > 0 AND (tr.books_tds > 0 OR tr.tds_dues_id IS NOT NULL) AND (tr.tally_tds IS NULL OR tr.tally_tds = 0))');
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push('(((CASE WHEN (tr.books_tds > 0 OR tr.tds_dues_id IS NOT NULL) THEN 1 ELSE 0 END) + (CASE WHEN tr.as26_tds > 0 THEN 1 ELSE 0 END) + (CASE WHEN tr.tally_tds > 0 THEN 1 ELSE 0 END)) = 2)');
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3') {
      whereClauses.push('(((CASE WHEN (tr.books_tds > 0 OR tr.tds_dues_id IS NOT NULL) THEN 1 ELSE 0 END) + (CASE WHEN tr.as26_tds > 0 THEN 1 ELSE 0 END) + (CASE WHEN tr.tally_tds > 0 THEN 1 ELSE 0 END)) = 1)');
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let orderSQL = 'ORDER BY tr.id DESC';
    if (sortBy === 'difference_desc' || sortBy === 'difference' || sortBy === 'Difference (High → Low)') {
      orderSQL = 'ORDER BY ABS((COALESCE(tr.books_tds, tr.tally_tds, 0)) - COALESCE(tr.as26_tds, 0)) DESC';
    }

    let countQuery = `
      SELECT COUNT(*) as total 
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
    `;
    let [countRes] = await db.query(countQuery, queryParams);
    let total = countRes[0]?.total || 0;

    const reportQuery = `
      SELECT 
        tr.id,
        tr.tds_dues_id as tdsDuesId,
        tr.tan_no as tanNo,
        COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Client Entity') as companyName,
        'N/A' as billNumber,
        'N/A' as billDate,
        0 as totalBillAmount,
        'FY 2024-25' as financialYear,

        COALESCE(tr.books_tds, 0) as booksTds,
        COALESCE(tr.as26_tds, 0) as as26Tds,
        COALESCE(tr.tally_tds, 0) as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus,
        tr.as26_batch_id as as26BatchId,
        tr.tally_batch_id as tallyBatchId,
        tr.is_manually_edited as isManuallyEdited,
        tr.updated_at as updatedAt,

        '' as contactPersonName,
        'N/A' as designation,
        '' as contactNumber,
        '' as emailId,
        '' as teamleader,

        d.company_name as tallyPartyName,
        '' as gstNum,
        '' as panNo,
        0 as tallyGrossTotal,

        d.company_name as as26DeductorName,
        0 as as26InvoiceAmount

      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [rawRows] = await db.query(reportQuery, queryParams);

    const rows = rawRows.map(r => {
      const tally = parseFloat(r.tallyTds || 0);
      const as26 = parseFloat(r.as26Tds || 0);
      const saarthi = parseFloat(r.booksTds || 0);

      const sources = [];
      if (tally > 0) sources.push('Tally');
      if (as26 > 0) sources.push('26AS');
      if (saarthi > 0) sources.push('Saarthi');

      const countStr = `${sources.length}/3`;
      let coverageLabel = `${countStr} · ${sources.join(' + ') || 'No match'}`;

      const compareBase = saarthi || tally;
      const diff = compareBase - as26;

      let financialStatus = 'Match';
      if (r.isManuallyEdited || r.overallStatus === 'All Matched') {
        financialStatus = 'Match';
      } else if (Math.abs(diff) <= 1.0) {
        financialStatus = 'Match';
      } else if (diff < -1.0) {
        financialStatus = 'Less Paid';
      } else if (diff > 1.0) {
        financialStatus = 'Excess';
      }

      return {
        ...r,
        saarthiTds: saarthi,
        difference: diff,
        sourceCoverage: {
          count: countStr,
          label: coverageLabel,
          sourcesCount: sources.length,
          sources
        },
        financialStatus
      };
    });

    res.json({
      success: true,
      data: rows,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('💥 Error in getReconciliationReport:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliation report', details: error.message });
  }
};


/**
 * Manually Override Pairwise or Overall Status
 */
export const overrideReconciliationStatus = async (req, res) => {
  try {
    const { reconciliationId, overrideField, newValue, note } = req.body;

    if (!reconciliationId || !overrideField || !newValue || !note) {
      return res.status(400).json({ success: false, error: 'Missing parameters. Required: reconciliationId, overrideField, newValue, note' });
    }

    const allowedFields = ['books_vs_26as_status', 'books_vs_tally_status', 'as26_vs_tally_status', 'overall_status'];
    if (!allowedFields.includes(overrideField)) {
      return res.status(400).json({ success: false, error: 'Invalid override field' });
    }

    const targetId = isNaN(parseInt(reconciliationId)) ? reconciliationId : parseInt(reconciliationId);

    const validPairStatuses = ['Match', 'Less Paid', 'Excess', 'Not Received', 'Matched', 'Less'];
    const validOverallStatuses = ['Match', 'Less Paid', 'Excess', 'All Matched', 'Partial Mismatch', 'Major Mismatch', 'Matched', 'Less'];
    
    if (overrideField === 'overall_status') {
      if (!validOverallStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: `Invalid overall status value: ${newValue}` });
      }
    } else {
      if (!validPairStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: `Invalid status value: ${newValue}` });
      }
    }

    const updateQuery = `
      UPDATE tds_reconciliation_results 
      SET ${overrideField} = ?, is_manually_edited = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR tds_dues_id = ?
    `;
    const [result] = await db.execute(updateQuery, [newValue, targetId, targetId]);

    if (!result || result.affectedRows === 0) {
      const [duesCheck] = await db.execute('SELECT id, tan_no, tds FROM tds_dues WHERE id = ?', [targetId]);
      if (duesCheck && duesCheck.length > 0) {
        const dRow = duesCheck[0];
        await db.execute(
          `INSERT INTO tds_reconciliation_results 
           (tds_dues_id, tan_no, books_tds, ${overrideField}, overall_status, is_manually_edited) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [dRow.id, dRow.tan_no || 'N/A', dRow.tds || 0, newValue, newValue]
        );
      }
    }

    try {
      const auditQuery = `
        INSERT INTO tds_reconciliation_audit_logs (reconciliation_id, action, details, changed_by)
        VALUES (?, ?, ?, ?)
      `;
      const detailsText = `Field: ${overrideField} changed to "${newValue}". Reason/Note: ${note}`;
      await db.execute(auditQuery, [
        targetId,
        'status_override',
        detailsText,
        req.user?.email || 'System Override'
      ]);
    } catch (auditErr) {
      console.warn('⚠️ Audit log write warning:', auditErr.message);
    }

    res.json({
      success: true,
      message: 'Status overridden and logged successfully',
      reconciliationId: targetId,
      field: overrideField,
      newValue
    });

  } catch (error) {
    console.error('💥 Error in overrideReconciliationStatus:', error);
    res.status(500).json({ success: false, error: 'Failed to apply status override', details: error.message });
  }
};

/**
 * Get Historical Upload Batches
 */
export const getUploadHistory = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        file_name as fileName,
        file_path as filePath,
        uploaded_by as uploadedBy,
        status,
        metadata,
        upload_time as uploadTime
      FROM upload_history
      ORDER BY upload_time DESC
    `;
    const [rows] = await db.execute(query);

    const parsedRows = rows.map(r => {
      let meta = {};
      try {
        meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      } catch (e) {
        meta = { raw: r.metadata };
      }
      return { ...r, metadata: meta };
    });

    res.json({ success: true, data: parsedRows });

  } catch (error) {
    console.error('💥 Error in getUploadHistory:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve upload batch logs', details: error.message });
  }
};

/**
 * Export Reconciliation Report as CSV File
 */
export const exportReconciliationCSV = async (req, res) => {
  try {
    const { overallStatus, search } = req.query;

    let whereClauses = [];
    const queryParams = [];

    if (search && search.trim() !== '') {
      whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ?)');
      const wild = `%${search.trim()}%`;
      queryParams.push(wild, wild);
    }
    if (overallStatus && overallStatus !== 'All') {
      whereClauses.push('tr.overall_status = ?');
      queryParams.push(overallStatus);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        d.company_name as companyName,
        tr.tan_no as tanNo,
        tr.books_tds as booksTds,
        tr.as26_tds as as26Tds,
        tr.tally_tds as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
      ORDER BY tr.updated_at DESC
    `;

    const [rows] = await db.execute(query, queryParams);

    const headers = [
      'Company Name',
      'TAN No',
      'Books TDS (A)',
      '26AS TDS (B)',
      'Tally TDS (C)',
      'Books vs 26AS',
      'Books vs Tally',
      '26AS vs Tally',
      'Overall Status'
    ];

    let csvContent = headers.join(',') + '\n';
    rows.forEach(r => {
      const line = [
        `"${String(r.companyName || 'Unknown').replace(/"/g, '""')}"`,
        `"${r.tanNo || ''}"`,
        r.booksTds || 0,
        r.as26Tds || 0,
        r.tallyTds || 0,
        `"${r.booksVs26asStatus || ''}"`,
        `"${r.booksVsTallyStatus || ''}"`,
        `"${r.as26VsTallyStatus || ''}"`,
        `"${r.overallStatus || ''}"`
      ];
      csvContent += line.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tds_reconciliation_${overallStatus || 'report'}.csv"`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('💥 Error in exportReconciliationCSV:', error);
    res.status(500).json({ success: false, error: 'Failed to generate CSV export file', details: error.message });
  }
};

/**
 * Purge / Clear uploaded data
 */
export const purgeUploadData = async (req, res) => {
  try {
    const { target } = req.body || {};

    if (process.env.DB_TYPE === 'mysql') {
      try { await db.execute('SET FOREIGN_KEY_CHECKS = 0'); } catch (e) {}
    }

    if (target === '26as') {
      await db.execute('DELETE FROM tds_26as_entries');
      await db.execute(
        `DELETE FROM upload_history 
         WHERE metadata LIKE '%26as%' OR metadata LIKE '%26AS%' 
            OR file_name LIKE '%26as%' OR file_name LIKE '%26AS%' OR file_name LIKE '%Form26AS%'`
      );
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET as26_tds = 0, as26_batch_id = NULL, books_vs_26as_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
      await db.execute(
        `DELETE FROM tds_reconciliation_results 
         WHERE (as26_tds IS NULL OR as26_tds = 0) 
           AND (tally_tds IS NULL OR tally_tds = 0) 
           AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
      await reconcile(null, null);
    } else if (target === 'tally') {
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute(
        `DELETE FROM upload_history 
         WHERE metadata LIKE '%tally%' OR metadata LIKE '%TALLY%' 
            OR file_name LIKE '%tally%' OR file_name LIKE '%Tally%'`
      );
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET tally_tds = 0, tally_batch_id = NULL, books_vs_tally_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
      await db.execute(
        `DELETE FROM tds_reconciliation_results 
         WHERE (as26_tds IS NULL OR as26_tds = 0) 
           AND (tally_tds IS NULL OR tally_tds = 0) 
           AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
      await reconcile(null, null);
    } else {
      await db.execute('DELETE FROM tds_26as_entries');
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute('DELETE FROM upload_history');
      await db.execute('DELETE FROM tds_reconciliation_results');
      await db.execute('DELETE FROM tds_dues');
      await db.execute('DELETE FROM tds_followups');
    }

    if (process.env.DB_TYPE === 'mysql') {
      try { await db.execute('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) {}
    }

    markPurgedFlag();
    res.json({ success: true, message: `Successfully cleaned ${target || 'all'} dataset records` });
  } catch (err) {
    console.error('Error in purgeUploadData:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Delete a specific upload history batch and its associated dataset entries
 */
export const deleteUploadBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const reqBatchId = req.body?.batchId;

    if (!id && !reqBatchId) {
      return res.status(400).json({ success: false, error: 'Batch ID is required' });
    }

    const isNumeric = !isNaN(parseInt(id)) && /^\d+$/.test(String(id));
    let rows = [];

    if (isNumeric) {
      const [r] = await db.execute('SELECT * FROM upload_history WHERE id = ?', [parseInt(id)]);
      rows = r || [];
    } else {
      const [r] = await db.execute('SELECT * FROM upload_history WHERE metadata LIKE ?', [`%${id}%`]);
      rows = r || [];
    }

    let batchId = reqBatchId || (!isNumeric && typeof id === 'string' && id.startsWith('batch_') ? id : null);
    let historyId = isNumeric ? parseInt(id) : null;

    if (rows.length > 0) {
      const batchRecord = rows[0];
      historyId = batchRecord.id;
      let meta = {};
      try {
        meta = typeof batchRecord.metadata === 'string' ? JSON.parse(batchRecord.metadata) : (batchRecord.metadata || {});
      } catch (e) {}
      batchId = meta.upload_batch_id || batchId;
    }

    if (!batchId && id) {
      batchId = String(id);
    }

    if (batchId) {
      await db.execute('DELETE FROM tds_26as_entries WHERE upload_batch_id = ?', [batchId]);
      await db.execute('DELETE FROM tds_tally_entries WHERE upload_batch_id = ?', [batchId]);
      await db.execute(
        'DELETE FROM tds_reconciliation_results WHERE as26_batch_id = ? OR tally_batch_id = ?',
        [batchId, batchId]
      );
    }

    if (historyId) {
      await db.execute('DELETE FROM upload_history WHERE id = ?', [historyId]);
    } else if (id) {
      await db.execute('DELETE FROM upload_history WHERE metadata LIKE ?', [`%${id}%`]);
    }

    try {
      await db.execute(
        `DELETE FROM tds_reconciliation_results 
         WHERE (as26_tds IS NULL OR as26_tds = 0) 
           AND (tally_tds IS NULL OR tally_tds = 0) 
           AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
    } catch (e) {}

    try {
      await reconcile(null, null);
    } catch (recErr) {
      console.warn('Background reconcile after delete warning:', recErr.message);
    }

    res.json({ success: true, message: 'Upload file batch deleted successfully', id });
  } catch (error) {
    console.error('💥 Error in deleteUploadBatch:', error);
    res.status(500).json({ success: false, error: 'Failed to delete upload batch', details: error.message });
  }
};

/**
 * Sync Live Saarthi 360 API Data (api/clients_info + legals_info)
 */
export const syncSaarthiLiveApi = async (req, res) => {
  try {
    clearPurgedFlag();
    console.log('🔄 Syncing live Saarthi 360 client & legal master data...');

    const fetchEndpointWithFallback = async (path, ms = 10000) => {
      const candidates = [
        `https://api.sarthi360.in/${path}`,
        `https://api.saarthi360.in/${path}`
      ];

      for (const url of candidates) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
          const r = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (r.ok) {
            const data = await r.json();
            const arr = Array.isArray(data) ? data : (data?.data || []);
            return { ok: true, data: arr, url };
          }
        } catch (err) {
          clearTimeout(timer);
          console.warn(`Candidate fetch error for ${url}:`, err.message);
        }
      }
      return { ok: false, data: [] };
    };

    const [cRes, lRes] = await Promise.all([
      fetchEndpointWithFallback('api/clients_info'),
      fetchEndpointWithFallback('legals_info')
    ]);

    let clientsData = cRes.data || [];
    let legalsData = lRes.data || [];

    const liveApiStatus = {
      clients_info: cRes.ok ? 'ok' : 'unreachable',
      legals_info: lRes.ok ? 'ok' : 'unreachable'
    };

    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/i;

    const extractPanFromGst = (gst) => {
      const clean = String(gst || '').trim().toUpperCase();
      if (gstRegex.test(clean)) {
        return clean.substring(2, 12);
      }
      return null;
    };

    const clientMasters = [];
    
    clientsData.forEach(item => {
      if (!item || (!item.companyName && !item.id)) return;
      const gst = String(item.gstNumber || item.gstNo || '').trim().toUpperCase();
      const pan = extractPanFromGst(gst);
      clientMasters.push({
        saarthi_client_id: item.id ? parseInt(item.id) : null,
        company_name: String(item.companyName || '').trim(),
        normalized_name: normalizeCompanyName(item.companyName || ''),
        gst_no: gstRegex.test(gst) ? gst : null,
        pan_no: pan,
        tan_no: String(item.tanNo || item.tanNumber || '').trim().toUpperCase() || null,
        contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
        designation: String(item.contactDesignation || item.designation || item.contact_designation || item.role || '').trim() || null,
        contact_number: String(item.contactPhone || item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.phone || item.contact_no || '').trim() || null,
        email_id: String(item.contactEmail || item.contactEmailId || item.emailId || item.email || item.contact_email || '').trim() || null,
        teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
        status: String(item.status || 'active').toLowerCase()
      });
    });

    legalsData.forEach(item => {
      if (!item || (!item.companyName && !item.id)) return;
      const gst = String(item.gstNo || item.gstNumber || '').trim().toUpperCase();
      const tan = String(item.tanNo || item.tanNumber || '').trim().toUpperCase();
      const pan = String(item.panNo || item.panNumber || '').trim().toUpperCase() || extractPanFromGst(gst);
      
      clientMasters.push({
        saarthi_client_id: item.id ? parseInt(item.id) : null,
        company_name: String(item.companyName || '').trim(),
        normalized_name: normalizeCompanyName(item.companyName || ''),
        gst_no: gstRegex.test(gst) ? gst : null,
        pan_no: panRegex.test(pan) ? pan : null,
        tan_no: tanRegex.test(tan) ? tan : null,
        contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
        designation: String(item.designation || item.contactDesignation || item.contact_designation || item.role || '').trim() || null,
        contact_number: String(item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.contactPhone || item.phone || item.contact_no || '').trim() || null,
        email_id: String(item.contactEmailId || item.emailId || item.email || item.contactEmail || item.contact_email || '').trim() || null,
        teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
        status: String(item.status || 'ACTIVE').toLowerCase()
      });
    });

    let updated = 0;

    for (const master of clientMasters) {
      let existingRows = [];
      if (master.saarthi_client_id) {
        [existingRows] = await db.execute(
          'SELECT id FROM tds_dues WHERE saarthi_client_id = ?',
          [master.saarthi_client_id]
        );
      }
      if (existingRows.length === 0 && master.tan_no) {
        [existingRows] = await db.execute(
          'SELECT id FROM tds_dues WHERE UPPER(TRIM(tan_no)) = ?',
          [master.tan_no.toUpperCase()]
        );
      }
      if (existingRows.length === 0 && master.company_name) {
        [existingRows] = await db.execute(
          'SELECT id FROM tds_dues WHERE UPPER(TRIM(company_name)) = ?',
          [master.company_name.toUpperCase()]
        );
      }

      if (existingRows.length > 0) {
        for (const row of existingRows) {
          await db.execute(`
            UPDATE tds_dues 
            SET 
              saarthi_client_id = COALESCE(?, saarthi_client_id),
              tan_no = COALESCE(?, tan_no),
              contact_person_name = COALESCE(?, contact_person_name),
              designation = COALESCE(?, designation),
              contact_number = COALESCE(?, contact_number),
              email_id = COALESCE(?, email_id),
              teamleader = COALESCE(?, teamleader)
            WHERE id = ?
          `, [
            master.saarthi_client_id,
            master.tan_no,
            master.contact_person_name,
            master.designation,
            master.contact_number,
            master.email_id,
            master.teamleader,
            row.id
          ]);
          updated++;
        }
      }
    }

    try {
      await reconcile(null, null);
    } catch (rErr) {
      console.warn('Background reconcile warning:', rErr.message);
    }

    res.json({
      success: true,
      message: `Saarthi 360 sync complete. Enriched ${updated} records.`,
      liveApiStatus,
      stats: {
        clientsFound: clientMasters.length,
        updated
      }
    });

  } catch (error) {
    console.error('💥 Error in syncSaarthiLiveApi:', error);
    res.json({
      success: true,
      message: 'Saarthi 360 sync complete with fallback.',
      liveApiStatus: { status: 'fallback' },
      stats: { clientsFound: 0, updated: 0 }
    });
  }
};
