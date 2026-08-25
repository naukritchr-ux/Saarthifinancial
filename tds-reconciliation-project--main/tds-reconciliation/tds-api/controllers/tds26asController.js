import xlsx from 'xlsx';
import db from '../config/db.js';
import { reconcile } from '../services/tdsReconciliationService.js';
import { v4 as uuidv4 } from 'uuid';

// Helper to format values
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
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
          if (text === 'tan' || text === 'tan no' || text === 'tan number' || text.includes('tan of deductor') || text.includes('deductor tan')) {
            colMap.tan_no = col;
          }
          if (text.includes('party name') || text === 'company name' || text === 'ledger name' || text === 'ledger' || text.includes('name')) {
            colMap.party_name = col;
          }
          if (text.includes('date') || text.includes('voucher date')) {
            colMap.voucher_date = col;
          }
          if (text.includes('amount') || text.includes('value')) {
            colMap.amount = col;
          }
          if (text.includes('tds amount') || text === 'tds' || text === 'tds deducted' || text.includes('tax')) {
            colMap.tds_amount = col;
          }
          if (text.includes('ledger') && colMap.ledger_name === -1) {
            colMap.ledger_name = col;
          }
        });
        break;
      }
    }

    // Fallback regex matching for TAN
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

    if (colMap.tan_no === -1) {
      return res.status(400).json({ success: false, error: 'Could not detect client TAN number column inside Tally sheet.' });
    }

    // Fallback mappings
    if (colMap.tds_amount === -1) colMap.tds_amount = colMap.tan_no + 3;
    if (colMap.amount === -1) colMap.amount = colMap.tan_no + 2;

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
        tan, partyName, voucherDate, amount, tdsAmount, ledgerName, uploadBatchId
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
        INSERT INTO tds_tally_entries (tan_no, party_name, voucher_date, amount, tds_amount, ledger_name, upload_batch_id)
        VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `;
      const params = [];
      chunk.forEach(e => {
        params.push(e.tan, e.partyName, e.voucherDate, e.amount, e.tdsAmount, e.ledgerName, e.uploadBatchId);
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
 * Get Paginated & Filterable Reconciliation Report
 */
export const getReconciliationReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      overallStatus = '',
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
    if (booksVsTallyStatus && booksVsTallyStatus !== 'All') {
      whereClauses.push('tr.books_vs_tally_status = ?');
      queryParams.push(booksVsTallyStatus);
    }
    if (as26VsTallyStatus && as26VsTallyStatus !== 'All') {
      whereClauses.push('tr.as26_vs_tally_status = ?');
      queryParams.push(as26VsTallyStatus);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
    `;
    const [countRes] = await db.execute(countQuery, queryParams);
    const total = countRes[0]?.total || 0;

    // Report query
    const reportQuery = `
      SELECT 
        tr.id,
        tr.tds_dues_id as tdsDuesId,
        tr.tan_no as tanNo,
        d.company_name as companyName,
        d.bill_number as billNumber,
        d.bill_date as billDate,
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
        tr.updated_at as updatedAt
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
      ORDER BY tr.updated_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [rows] = await db.execute(reportQuery, queryParams);

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
