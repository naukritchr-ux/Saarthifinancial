import xlsx from 'xlsx';
import db from '../config/db.js';
import { reconcile } from '../services/tdsReconciliationService.js';
import { seedEmbeddedDataset } from '../seed_embedded_dataset.js';
import { v4 as uuidv4 } from 'uuid';

// Helper to format values
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

/**
 * Trigger Database Seeding Endpoint
 */
export const seedDatabaseEndpoint = async (req, res) => {
  try {
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
    console.log('📥 Upload 26AS API called');
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Read file using xlsx (natively parses CSV and Excel)
    const workbook = xlsx.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (rawData.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded file is empty' });
    }

    // Heuristics: Scan for header row
    let headerRowIdx = -1;
    let colMap = {
      tan_no: -1,
      deductor_name: -1,
      amount_paid: -1,
      tds_deducted: -1,
      section: -1,
      quarter: -1
    };

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row) continue;
      let hasTan = false;
      let hasTds = false;
      row.forEach((cell) => {
        const text = String(cell || '').toLowerCase();
        if (text.includes('tan')) hasTan = true;
        if (text.includes('tds') || text.includes('tax deducted') || text.includes('deducted')) hasTds = true;
      });
      if (hasTan && hasTds) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const text = String(cell || '').toLowerCase().trim();
          if (text === 'tan' || text === 'tan no' || text === 'tan number' || text.includes('tan of deductor') || text.includes('deductor tan') || text.includes('party tan')) {
            colMap.tan_no = col;
          }
          if (text.includes('deductor name') || text === 'company name' || text === 'name' || text === 'deductor' || text.includes('party name')) {
            colMap.deductor_name = col;
          }
          if (text.includes('amount paid') || text.includes('amount credited') || text.includes('total amount') || text === 'amount') {
            colMap.amount_paid = col;
          }
          if (text.includes('tds') || text.includes('tax deducted') || text.includes('deducted')) {
            colMap.tds_deducted = col;
          }
          if (text.includes('section')) {
            colMap.section = col;
          }
          if (text.includes('quarter') || text.includes('period')) {
            colMap.quarter = col;
          }
        });
        break;
      }
    }

    // Fallback: If tan_no could not be found via header labels, match based on data patterns
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
    if (colMap.tan_no === -1) {
      for (let c = 0; c < 30; c++) {
        let matchCount = 0;
        for (let r = 0; r < Math.min(100, rawData.length); r++) {
          if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim())) {
            matchCount++;
          }
        }
        if (matchCount > 1) {
          colMap.tan_no = c;
          break;
        }
      }
    }

    // Fallback for amount columns if headers not found
    if (colMap.tds_deducted === -1) colMap.tds_deducted = colMap.tan_no + 3; // heuristic offset
    if (colMap.amount_paid === -1) colMap.amount_paid = colMap.tan_no + 2;

    if (colMap.tan_no === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect client TAN number column inside the uploaded file structure.'
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
    const errors = [];
    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawTan = String(row[colMap.tan_no] || '').trim();
      if (!rawTan) continue;

      const tan = rawTan.toUpperCase();
      if (!tanRegex.test(tan)) {
        continue; // Skip summary or meta rows
      }

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
      return res.status(400).json({ success: false, error: 'No valid data rows matching standard TAN format found.' });
    }

    // Batch insert parsed rows in chunks
    const BATCH_SIZE = 1000;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const insertQuery = `
        INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
        VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      const params = [];
      chunk.forEach(e => {
        params.push(e.tan, e.deductorName, e.amountPaid, e.tdsDeducted, e.section, e.quarter, e.uploadBatchId);
      });
      await db.execute(insertQuery, params);
    }

    // Run reconciliation logic for the new batch
    await reconcile(uploadBatchId, null);

    // Save history log
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

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row) continue;
      let hasTan = false;
      let hasTds = false;
      row.forEach((cell) => {
        const text = String(cell || '').toLowerCase();
        if (text.includes('tan')) hasTan = true;
        if (text.includes('tds') || text.includes('tax') || text.includes('deducted')) hasTds = true;
      });
      if (hasTan && hasTds) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const text = String(cell || '').toLowerCase().trim();
          if (text === 'tan' || text === 'tan no' || text === 'tan_no' || text === 'tan number' || text.includes('tan of deductor') || text.includes('deductor tan') || text === 'pan' || text === 'pan no' || text === 'pan number') {
            colMap.tan_no = col;
          }
          if (text.includes('name of the company') || text.includes('party name') || text.includes('company name') || text === 'company' || text === 'ledger name' || text === 'ledger' || text.includes('name')) {
            colMap.party_name = col;
          }
          if (text.includes('gstnum') || text.includes('gst num') || text.includes('gstin') || text.includes('gst')) {
            colMap.gst_num = col;
          }
          if (text.includes('pan no') || text.includes('panno') || text.includes('pan number') || text === 'pan') {
            if (colMap.tan_no === -1) colMap.tan_no = col;
            colMap.pan_no = col;
          }
          if (text.includes('date') || text.includes('voucher date')) {
            colMap.voucher_date = col;
          }
          if (text.includes('gross total') || text.includes('total amount') || text.includes('amount') || text.includes('value')) {
            colMap.amount = col;
          }
          if (text.includes('tdsamt') || text.includes('tds amt') || text.includes('tds amount') || text === 'tds' || text === 'tds deducted' || text.includes('tax')) {
            colMap.tds_amount = col;
          }
          if (text.includes('ledger') && colMap.ledger_name === -1) {
            colMap.ledger_name = col;
          }
        });
        break;
      }
    }

    // Fallback regex matching for TAN or PAN
    const tanRegex = /^([A-Z]{4}\d{5}[A-Z]|[A-Z]{5}\d{4}[A-Z])$/i;
    if (colMap.tan_no === -1) {
      for (let c = 0; c < 30; c++) {
        let matchCount = 0;
        for (let r = 0; r < Math.min(100, rawData.length); r++) {
          if (rawData[r] && tanRegex.test(String(rawData[r][c] || '').trim())) {
            matchCount++;
          }
        }
        if (matchCount > 1) {
          colMap.tan_no = c;
          break;
        }
      }
    }

    if (colMap.tan_no === -1) {
      return res.status(400).json({ success: false, error: 'Could not detect client TAN number column inside Tally sheet.' });
    }

    // Fallback mappings
    if (colMap.tds_amount === -1) colMap.tds_amount = colMap.tan_no + 3;
    if (colMap.amount === -1) colMap.amount = colMap.tan_no + 2;

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
      if (!tanRegex.test(tan)) continue;

      const partyName = colMap.party_name !== -1 ? String(row[colMap.party_name] || '').trim() : 'Unknown Client';
      const gstNum = colMap.gst_num !== -1 ? String(row[colMap.gst_num] || '').trim() : '';
      const panNo = colMap.pan_no !== -1 ? String(row[colMap.pan_no] || '').trim() : '';
      const voucherDateRaw = colMap.voucher_date !== -1 ? String(row[colMap.voucher_date] || '').trim() : null;
      
      // Basic date parsing helper
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
      return res.status(400).json({ success: false, error: 'No valid Tally rows with matching TAN format found.' });
    }

    // Chunked insertions
    const BATCH_SIZE = 1000;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const insertQuery = `
        INSERT INTO tds_tally_entries (tan_no, party_name, gst_num, pan_no, voucher_date, amount, tds_amount, ledger_name, upload_batch_id)
        VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      const params = [];
      chunk.forEach(e => {
        params.push(e.tan, e.partyName, e.gstNum, e.panNo, e.voucherDate, e.amount, e.tdsAmount, e.ledgerName, e.uploadBatchId);
      });
      await db.execute(insertQuery, params);
    }

    // Run reconciliation matching
    await reconcile(null, uploadBatchId);

    // Save history logs
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
      whereClause = 'WHERE tr.as26_batch_id LIKE ?';
      params.push(`%${fy}%`);
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

      // Source Coverage calculation
      const sourcesPresent = (tally > 0 ? 1 : 0) + (as26 > 0 ? 1 : 0) + (saarthi > 0 ? 1 : 0);
      if (sourcesPresent === 3) threeOfThree++;
      else if (sourcesPresent === 2) twoOfThree++;
      else if (sourcesPresent === 1) oneOfThree++;
      else noMatch++;

      // Financial status mapping
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
    // Defines rows needing cleaning: TAN missing/blank OR company name fuzzy mismatch across sources OR duplicate TAN
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
             OR tr.overall_status = 'Major Mismatch')
      ORDER BY tr.id DESC
      LIMIT 100
    `;

    const [rows] = await db.execute(query);

    const cleaningItems = rows.map((r, idx) => {
      let reason = 'Unmatched TAN / Missing metadata';
      let issueType = 'unmatched_tan';
      if (!r.tanNo || r.tanNo.length < 10) {
        reason = 'Missing or Invalid TAN Format';
        issueType = 'invalid_tan';
      } else if (!r.booksCompanyName || r.booksCompanyName === 'Unknown Company') {
        reason = 'Deductor Name Discrepancy';
        issueType = 'name_mismatch';
      } else {
        reason = 'Multi-source Data Discrepancy';
        issueType = 'source_discrepancy';
      }

      return {
        id: r.id,
        tanNo: r.tanNo || 'UNKNOWN_TAN',
        companyName: r.booksCompanyName || 'Unknown Client',
        issueType,
        issueReason: reason,
        sources: [
          r.booksTds > 0 ? 'Saarthi 360' : null,
          r.as26Tds > 0 ? 'Form 26AS' : null,
          r.tallyTds > 0 ? 'Tally Ledger' : null
        ].filter(Boolean),
        booksTds: r.booksTds,
        as26Tds: r.as26Tds,
        tallyTds: r.tallyTds
      };
    });

    res.json({
      success: true,
      count: cleaningItems.length,
      data: cleaningItems
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
    const { tanNo, companyName } = req.body;

    if (!id || !tanNo || !companyName) {
      return res.status(400).json({ success: false, error: 'Required: id, tanNo, companyName' });
    }

    const cleanTan = String(tanNo).toUpperCase().trim();
    const cleanCompany = String(companyName).trim();

    // 1. Update tds_reconciliation_results and recalculate status
    await db.execute(
      `UPDATE tds_reconciliation_results 
       SET tan_no = ?, is_manually_edited = 1, overall_status = 'All Matched', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cleanTan, id]
    );

    // 2. Update associated tds_dues record
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
    const {
      page = 1,
      limit = 20,
      search = '',
      overallStatus = '',
      coverageFilter = 'All',
      sortBy = 'updated_at',
      booksVs26asStatus = '',
      booksVsTallyStatus = '',
      as26VsTallyStatus = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let whereClauses = [];
    const queryParams = [];

    // Search filter
    if (search.trim() !== '') {
      whereClauses.push('(tr.tan_no LIKE ? OR d.company_name LIKE ?)');
      const wild = `%${search.trim()}%`;
      queryParams.push(wild, wild);
    }

    // Status filters
    if (overallStatus && overallStatus !== 'All') {
      whereClauses.push('tr.overall_status = ?');
      queryParams.push(overallStatus);
    }
    if (booksVs26asStatus && booksVs26asStatus !== 'All') {
      whereClauses.push('tr.books_vs_26as_status = ?');
      queryParams.push(booksVs26asStatus);
    }

    // Source Coverage Filter
    if (coverageFilter === '3/3' || coverageFilter === '3 of 3') {
      whereClauses.push('(tr.books_tds > 0 AND tr.as26_tds > 0 AND tr.tally_tds > 0)');
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push('((CASE WHEN tr.books_tds > 0 THEN 1 ELSE 0 END + CASE WHEN tr.as26_tds > 0 THEN 1 ELSE 0 END + CASE WHEN tr.tally_tds > 0 THEN 1 ELSE 0 END) = 2)');
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3') {
      whereClauses.push('((CASE WHEN tr.books_tds > 0 THEN 1 ELSE 0 END + CASE WHEN tr.as26_tds > 0 THEN 1 ELSE 0 END + CASE WHEN tr.tally_tds > 0 THEN 1 ELSE 0 END) = 1)');
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Sort clause
    let orderSQL = 'ORDER BY tr.updated_at DESC';
    if (sortBy === 'difference_desc' || sortBy === 'difference' || sortBy === 'Difference (High → Low)') {
      orderSQL = 'ORDER BY ABS((COALESCE(tr.books_tds, tr.tally_tds, 0)) - COALESCE(tr.as26_tds, 0)) DESC';
    }

    // Count query
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
    `;
    let [countRes] = await db.execute(countQuery, queryParams);
    let total = countRes[0]?.total || 0;


    // Report query
    const reportQuery = `
      SELECT 
        tr.id,
        tr.tds_dues_id as tdsDuesId,
        tr.tan_no as tanNo,
        d.company_name as companyName,
        d.bill_number as billNumber,
        d.bill_date as billDate,
        d.total_bill_amount as totalBillAmount,
        'FY 2024-25' as financialYear,

        tr.books_tds as booksTds,
        tr.as26_tds as as26Tds,
        tr.tally_tds as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus,
        tr.as26_batch_id as as26BatchId,
        tr.tally_batch_id as tallyBatchId,
        tr.is_manually_edited as isManuallyEdited,
        tr.updated_at as updatedAt,

        (SELECT t.party_name FROM tds_tally_entries t WHERE (t.upload_batch_id = tr.tally_batch_id OR tr.tally_batch_id IS NULL) AND t.tan_no = tr.tan_no LIMIT 1) as tallyPartyName,
        (SELECT t.gst_num FROM tds_tally_entries t WHERE (t.upload_batch_id = tr.tally_batch_id OR tr.tally_batch_id IS NULL) AND t.tan_no = tr.tan_no LIMIT 1) as gstNum,
        (SELECT t.pan_no FROM tds_tally_entries t WHERE (t.upload_batch_id = tr.tally_batch_id OR tr.tally_batch_id IS NULL) AND t.tan_no = tr.tan_no LIMIT 1) as panNo,
        (SELECT t.amount FROM tds_tally_entries t WHERE (t.upload_batch_id = tr.tally_batch_id OR tr.tally_batch_id IS NULL) AND t.tan_no = tr.tan_no LIMIT 1) as tallyGrossTotal,

        (SELECT a.deductor_name FROM tds_26as_entries a WHERE (a.upload_batch_id = tr.as26_batch_id OR tr.as26_batch_id IS NULL) AND a.tan_no = tr.tan_no LIMIT 1) as as26DeductorName,
        (SELECT a.amount_paid FROM tds_26as_entries a WHERE (a.upload_batch_id = tr.as26_batch_id OR tr.as26_batch_id IS NULL) AND a.tan_no = tr.tan_no LIMIT 1) as as26InvoiceAmount
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
      ${orderSQL}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [rawRows] = await db.execute(reportQuery, queryParams);

    // Enrich rows with sourceCoverage and financialStatus
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

      // Financial status mapping
      let financialStatus = 'Match';
      if (r.overallStatus === 'All Matched') financialStatus = 'Match';
      else if (r.overallStatus === 'Partial Mismatch') financialStatus = 'Pending Review';
      else if (sources.length < 3) financialStatus = 'Missing';
      else if (r.booksVs26asStatus === 'Less Paid') financialStatus = 'Less';
      else if (r.booksVs26asStatus === 'Excess') financialStatus = 'Excess';
      else financialStatus = 'Match';

      // Net difference (Saarthi/Tally vs 26AS)
      const difference = (saarthi || tally) - as26;

      return {
        ...r,
        saarthiTds: saarthi,
        difference,
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
      return res.status(400).json({ success: false, error: 'Missing parameters. required: reconciliationId, overrideField, newValue, note' });
    }

    const allowedFields = ['books_vs_26as_status', 'books_vs_tally_status', 'as26_vs_tally_status', 'overall_status'];
    if (!allowedFields.includes(overrideField)) {
      return res.status(400).json({ success: false, error: 'Invalid override field' });
    }

    // Validate enum options
    const validPairStatuses = ['Excess', 'Less Paid', 'Not Received', 'Matched'];
    const validOverallStatuses = ['All Matched', 'Partial Mismatch', 'Major Mismatch'];
    if (overrideField === 'overall_status') {
      if (!validOverallStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: 'Invalid overall status value' });
      }
    } else {
      if (!validPairStatuses.includes(newValue)) {
        return res.status(400).json({ success: false, error: 'Invalid status value' });
      }
    }

    // Update results table
    const updateQuery = `
      UPDATE tds_reconciliation_results 
      SET ${overrideField} = ?, is_manually_edited = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await db.execute(updateQuery, [newValue, reconciliationId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Reconciliation record not found' });
    }

    // Log override action to audit trail
    const auditQuery = `
      INSERT INTO tds_reconciliation_audit_logs (reconciliation_id, action, details, changed_by)
      VALUES (?, ?, ?, ?)
    `;
    const detailsText = `Field: ${overrideField} changed to "${newValue}". Reason/Note: ${note}`;
    await db.execute(auditQuery, [
      reconciliationId,
      'status_override',
      detailsText,
      req.user?.email || 'System Override'
    ]);

    res.json({
      success: true,
      message: 'Status overridden and logged successfully',
      reconciliationId,
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

    // Map rows and parse JSON metadata
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

    // Build CSV content
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
    const { target } = req.body || {}; // '26as', 'tally', 'all'
    if (target === '26as') {
      await db.execute('DELETE FROM tds_26as_entries');
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET as26_tds = 0, as26_batch_id = NULL, books_vs_26as_status = 'Not Received', as26_vs_tally_status = 'Not Received', overall_status = 'Major Mismatch' 
         WHERE is_manually_edited = 0`
      );
    } else if (target === 'tally') {
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET tally_tds = 0, tally_batch_id = NULL, books_vs_tally_status = 'Not Received', as26_vs_tally_status = 'Not Received', overall_status = 'Major Mismatch' 
         WHERE is_manually_edited = 0`
      );
    } else {
      await db.execute('DELETE FROM tds_26as_entries');
      await db.execute('DELETE FROM tds_tally_entries');
      await db.execute('DELETE FROM upload_history');
      await db.execute('DELETE FROM tds_reconciliation_results');
      await db.execute('DELETE FROM tds_dues');
      await db.execute('DELETE FROM tds_followups');
    }
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
    if (!id) {
      return res.status(400).json({ success: false, error: 'Batch ID is required' });
    }

    // 1. Retrieve record from upload_history
    const [rows] = await db.execute('SELECT * FROM upload_history WHERE id = ?', [id]);
    
    if (rows.length > 0) {
      const batchRecord = rows[0];
      let meta = {};
      try {
        meta = typeof batchRecord.metadata === 'string' ? JSON.parse(batchRecord.metadata) : (batchRecord.metadata || {});
      } catch (e) {}

      const batchId = meta.upload_batch_id || req.body?.batchId;
      const uploadType = meta.upload_type;

      if (batchId) {
        if (uploadType === '26AS_TDS' || batchId.includes('26as')) {
          await db.execute('DELETE FROM tds_26as_entries WHERE upload_batch_id = ?', [batchId]);
          await db.execute(
            'UPDATE tds_reconciliation_results SET as26_tds = 0, as26_batch_id = NULL WHERE as26_batch_id = ? AND is_manually_edited = 0',
            [batchId]
          );
        } else if (uploadType === 'TALLY_TDS' || batchId.includes('tally')) {
          await db.execute('DELETE FROM tds_tally_entries WHERE upload_batch_id = ?', [batchId]);
          await db.execute(
            'UPDATE tds_reconciliation_results SET tally_tds = 0, tally_batch_id = NULL WHERE tally_batch_id = ? AND is_manually_edited = 0',
            [batchId]
          );
        }
      }

      // Delete log record
      await db.execute('DELETE FROM upload_history WHERE id = ?', [id]);
    } else if (req.body?.batchId) {
      const batchId = req.body.batchId;
      await db.execute('DELETE FROM tds_26as_entries WHERE upload_batch_id = ?', [batchId]);
      await db.execute('DELETE FROM tds_tally_entries WHERE upload_batch_id = ?', [batchId]);
    }

    res.json({ success: true, message: 'Upload file batch deleted successfully', id });
  } catch (error) {
    console.error('💥 Error in deleteUploadBatch:', error);
    res.status(500).json({ success: false, error: 'Failed to delete upload batch', details: error.message });
  }
};


