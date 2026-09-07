import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
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

    let rawData = [];
    try {
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    } catch (excelErr) {
      console.warn('⚠️ xlsx.readFile failed, falling back to text split:', excelErr.message);
      const csvText = fs.readFileSync(file.path, 'utf8');
      rawData = csvText.split(/\r?\n/).filter(Boolean).map(l => l.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
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
      quarter: -1
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

      entries.push({
        tan, deductorName, amountPaid, tdsDeducted, section, quarter, uploadBatchId
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid data rows found in 26AS file.' });
    }

    // Bulk insert entries in chunks of 500
    const INSERT_CHUNK = 500;
    for (let i = 0; i < entries.length; i += INSERT_CHUNK) {
      const chunk = entries.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const e of chunk) {
        params.push(e.tan, e.deductorName, e.amountPaid, e.tdsDeducted, e.section, e.quarter, e.uploadBatchId);
      }
      await db.execute(
        `INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id) VALUES ${placeholders}`,
        params
      );
    }

    // Persist financial year onto matching tds_dues rows in bulk chunks of 200
    if (uploadFy) {
      const uniqueTans = [...new Set(entries.map(e => e.tan).filter(Boolean))];
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

    if (uploadFy) {
      try {
        await db.execute('UPDATE tds_reconciliation_results SET financial_year = ? WHERE as26_batch_id = ?', [uploadFy, uploadBatchId]);
      } catch (e) {}
    }

    const metadata = JSON.stringify({
      upload_type: '26AS_TDS',
      upload_batch_id: uploadBatchId,
      financial_year: uploadFy || 'FY 2024-25',
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

    let rawData = [];
    try {
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    } catch (excelErr) {
      console.warn('⚠️ xlsx.readFile failed in uploadTally, falling back to text split:', excelErr.message);
      const csvText = fs.readFileSync(file.path, 'utf8');
      rawData = csvText.split(/\r?\n/).filter(Boolean).map(l => l.split(',').map(s => s.trim().replace(/^"|"$/g, '')));
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
      teamleader: -1
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

    for (let r = startRow; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const rawTan = String(row[colMap.tan_no] || '').trim();
      if (!rawTan) continue;

      const tan = rawTan.toUpperCase();
      if (['TANNO', 'TAN_NO', 'TAN', 'PAN', 'PANNO', 'COMPANYNAME', 'PARTYNAME', 'DEDUCTORNAME', 'DEDUCTOR_NAME'].includes(tan)) continue;

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
      const tdsAmount = colMap.tds_amount !== -1 ? cleanNumber(row[colMap.tds_amount]) : 0.00;
      const ledgerName = colMap.ledger_name !== -1 ? String(row[colMap.ledger_name] || '').trim() : 'Tally Ledger';

      const contactPerson = colMap.contact_person !== -1 ? String(row[colMap.contact_person] || '').trim() : null;
      const designation = colMap.designation !== -1 ? String(row[colMap.designation] || '').trim() : null;
      const contactNumber = colMap.contact_number !== -1 ? String(row[colMap.contact_number] || '').trim() : null;
      const emailId = colMap.email_id !== -1 ? String(row[colMap.email_id] || '').trim() : null;
      const teamleader = colMap.teamleader !== -1 ? String(row[colMap.teamleader] || '').trim() : null;

      entries.push({
        tan, partyName, gstNum, panNo, voucherDate, amount, tdsAmount, ledgerName, uploadBatchId,
        contactPerson, designation, contactNumber, emailId, teamleader
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid Tally rows found.' });
    }

    // Bulk insert entries in chunks of 500
    const TALLY_CHUNK = 500;
    for (let i = 0; i < entries.length; i += TALLY_CHUNK) {
      const chunk = entries.slice(i, i + TALLY_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const e of chunk) {
        params.push(e.tan, e.partyName, e.gstNum, e.panNo, e.voucherDate, e.amount, e.tdsAmount, e.ledgerName, e.uploadBatchId);
      }
      await db.execute(
        `INSERT INTO tds_tally_entries (tan_no, party_name, gst_num, pan_no, voucher_date, amount, tds_amount, ledger_name, upload_batch_id) VALUES ${placeholders}`,
        params
      );
    }

    // Deduplicate contact info by TAN and update in parallel chunks of 30
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
        } catch (e) {}
      }

      const relevantContacts = allContactTans
        .filter(tan => existingTansSet.has(tan))
        .map(tan => [tan, contactsByTan.get(tan)]);

      const CONTACT_CHUNK = 10;
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
            WHERE UPPER(TRIM(tan_no)) = ?
          `, [info.contactPerson, info.designation, info.contactNumber, info.emailId, info.teamleader, tan])
          .catch(() => {})
        ));
      }
    }

    // Persist financial year onto matching tds_dues rows in bulk chunks of 200
    if (uploadFy) {
      const uniqueTans = [...new Set(entries.map(e => e.tan).filter(Boolean))];
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

    if (uploadFy) {
      try {
        await db.execute('UPDATE tds_reconciliation_results SET financial_year = ? WHERE tally_batch_id = ?', [uploadFy, uploadBatchId]);
      } catch (e) {}
    }

    const metadata = JSON.stringify({
      upload_type: 'TALLY_TDS',
      upload_batch_id: uploadBatchId,
      financial_year: uploadFy || 'FY 2024-25',
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

    let whereClauses = [
      "(COALESCE(tr.books_tds, 0) > 0 OR COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)"
    ];
    const params = [];
    if (fy && fy !== 'All' && fy !== 'All Financial Years') {
      const cleanFy = String(fy).replace(/^FY\s*/i, '').trim();
      whereClauses.push("(tr.financial_year = 'All Financial Years' OR COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'FY 2024-25') LIKE ? OR tr.as26_batch_id LIKE ? OR tr.tally_batch_id LIKE ?)");
      const fyWild = `%${cleanFy}%`;
      params.push(fyWild, fyWild, fyWild);
    }

    const whereSQL = 'WHERE ' + whereClauses.join(' AND ');

    const query = `
      SELECT 
        tr.books_tds,
        tr.as26_tds,
        tr.tally_tds,
        tr.overall_status,
        tr.books_vs_26as_status,
        tr.books_vs_tally_status,
        tr.as26_vs_tally_status,
        tr.is_manually_edited,
        tr.tds_dues_id,
        d.id as crm_id
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      ${whereSQL}
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

      const hasTally = tally > 0;
      const has26as = as26 > 0;
      const hasSarthi = saarthi > 0 || Boolean(r.tds_dues_id || r.crm_id);

      const sourcesPresent = (hasTally ? 1 : 0) + (has26as ? 1 : 0) + (hasSarthi ? 1 : 0);
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
      } else {
        const primaryVal = tally > 0 ? tally : saarthi;
        if (tally <= 0 && saarthi <= 0 && as26 > 0) {
          excessCount++;
        } else if (as26 > 0 || primaryVal > 0) {
          const diffVal = primaryVal - as26;
          if (Math.abs(diffVal) <= 1.0) matchCount++;
          else if (diffVal > 1.0) lessCount++;
          else excessCount++;
        } else {
          missingCount++;
        }
      }
    });

    res.json({
      success: true,
      totals: {
        tally: tallyTotal,
        as26: as26Total,
        saarthi: saarthiTotal,
        netGap: as26Total - tallyTotal
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
        COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'FY 2024-25') as financialYear,
        tr.books_tds as booksTds,
        tr.as26_tds as as26Tds,
        tr.tally_tds as tallyTds,
        tr.overall_status as overallStatus
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
        AND (COALESCE(tr.books_tds, 0) > 0 OR COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)
        AND (tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10 
             OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = ''
             OR tr.overall_status = 'Major Mismatch'
             OR tr.overall_status = 'Partial Mismatch')
        AND tr.tan_no NOT IN ('COMPANYNAME', 'TANNO', 'TAN_NO', 'PANNO', 'TAN')
        AND UPPER(COALESCE(d.company_name, '')) NOT IN ('UNKNOWN CLIENT', 'COMPANYNAME')
      ORDER BY tr.id DESC
      LIMIT 100
    `;

    const [rows] = await db.execute(query);
    if (!rows || rows.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const [all26as] = await db.execute("SELECT deductor_name, UPPER(TRIM(tan_no)) as tan_no FROM tds_26as_entries WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' LIMIT 2000");
    const [allTally] = await db.execute("SELECT party_name, UPPER(TRIM(tan_no)) as tan_no FROM tds_tally_entries WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' LIMIT 2000");

    const as26ByTan = new Map();
    const as26ByName = new Map();
    for (const e of all26as) {
      const tanKey = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (tanKey && !as26ByTan.has(tanKey)) as26ByTan.set(tanKey, e);
      const nameKey = e.deductor_name ? String(e.deductor_name).trim().toUpperCase() : '';
      if (nameKey && !as26ByName.has(nameKey)) as26ByName.set(nameKey, e);
    }

    const tallyByTan = new Map();
    const tallyByName = new Map();
    for (const e of allTally) {
      const tanKey = e.tan_no ? String(e.tan_no).trim().toUpperCase() : '';
      if (tanKey && !tallyByTan.has(tanKey)) tallyByTan.set(tanKey, e);
      const nameKey = e.party_name ? String(e.party_name).trim().toUpperCase() : '';
      if (nameKey && !tallyByName.has(nameKey)) tallyByName.set(nameKey, e);
    }

    const cleaningItems = rows.map((r) => {
      const tan = r.tanNo ? String(r.tanNo).trim().toUpperCase() : '';
      const booksName = r.booksCompanyName || 'Unknown Client';
      const normBooksName = String(booksName).trim().toUpperCase();

      let as26Name = null;
      let as26Tan = null;
      const as26Match = (tan ? as26ByTan.get(tan) : null) || (normBooksName ? as26ByName.get(normBooksName) : null);
      if (as26Match) {
        as26Name = as26Match.deductor_name;
        as26Tan = as26Match.tan_no;
      }

      let tallyName = null;
      let tallyTan = null;
      const tallyMatch = (tan ? tallyByTan.get(tan) : null) || (normBooksName ? tallyByName.get(normBooksName) : null);
      if (tallyMatch) {
        tallyName = tallyMatch.party_name;
        tallyTan = tallyMatch.tan_no;
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
        financialYear: r.financialYear || 'FY 2024-25',
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
      const isNoTan = item.tanNo && item.tanNo.toUpperCase().startsWith('NO_TAN_');
      const isUnknownDummy = (item.companyName || item.saarthiName || '').toUpperCase().includes('UNKNOWN');

      if (isNoTan && (isZeroData || isUnknownDummy)) return false;
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
    const { tanNo, companyName, status, panNo, gstNum } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Cleaning Item ID is required' });
    }

    if (String(status || '').toLowerCase() === 'rejected') {
      const targetTan = String(tanNo || '').trim().toUpperCase();
      await db.execute(
        'DELETE FROM tds_reconciliation_results WHERE id = ? OR (tan_no IS NOT NULL AND UPPER(TRIM(tan_no)) = ?)',
        [id, targetTan || id]
      );
      if (targetTan) {
        try {
          await db.execute(
            'DELETE FROM tds_dues WHERE UPPER(TRIM(tan_no)) = ? AND (tds IS NULL OR tds = 0)',
            [targetTan]
          );
        } catch (e) {}
      }

      return res.json({
        success: true,
        message: 'Cleaning item rejected and removed successfully',
        id
      });
    }

    const cleanTan = String(tanNo || 'N/A').toUpperCase().trim();
    const cleanCompany = String(companyName || 'Cleaned Entity').trim();
    const cleanPan = panNo ? String(panNo).toUpperCase().trim() : null;
    const cleanGst = gstNum ? String(gstNum).toUpperCase().trim() : null;

    const [recRows] = await db.execute('SELECT * FROM tds_reconciliation_results WHERE id = ?', [id]);

    let booksVs26as = 'Not Received';
    let booksVsTally = 'Not Received';
    let as26VsTally = 'Not Received';
    let overallStatus = 'Not Received';

    if (recRows.length > 0) {
      const rec = recRows[0];
      const booksTds = parseFloat(rec.books_tds || 0);
      const as26Tds = parseFloat(rec.as26_tds || 0);
      const tallyTds = parseFloat(rec.tally_tds || 0);

      const has26as = rec.as26_batch_id !== null || as26Tds > 0;
      const hasTally = rec.tally_batch_id !== null || tallyTds > 0;
      const hasSaarthi = booksTds > 0;

      const evaluatePair = (valA, valB, hasA, hasB) => {
        if (!hasA || !hasB || valA <= 0 || valB <= 0) return 'Not Received';
        if (Math.abs(valA - valB) <= 1.0) return 'Matched';
        if (valA > valB) return 'Excess';
        return 'Less Paid';
      };

      booksVs26as = evaluatePair(as26Tds, booksTds, has26as, true);
      booksVsTally = evaluatePair(tallyTds, booksTds, hasTally, true);
      as26VsTally = evaluatePair(tallyTds, as26Tds, hasTally, has26as);

      const activeSourcesCount = [hasSaarthi, hasTally, has26as].filter(Boolean).length;

      if (tallyTds <= 0 && booksTds <= 0 && as26Tds > 0) {
        overallStatus = 'Excess';
        booksVs26as = 'Excess';
        as26VsTally = 'Excess';
      } else if (activeSourcesCount >= 2) {
        const vals = [];
        if (hasSaarthi) vals.push(booksTds);
        if (hasTally) vals.push(tallyTds);
        if (has26as) vals.push(as26Tds);

        let allAgree = true;
        for (let i = 0; i < vals.length; i++) {
          for (let j = i + 1; j < vals.length; j++) {
            if (Math.abs(vals[i] - vals[j]) > 1.0) {
              allAgree = false;
              break;
            }
          }
        }

        if (allAgree && activeSourcesCount === 3) {
          overallStatus = 'All Matched';
        } else if (allAgree) {
          overallStatus = 'Partial Mismatch';
        } else {
          overallStatus = 'Major Mismatch';
        }
      }
    }

    await db.execute(
      `UPDATE tds_reconciliation_results 
       SET tan_no = ?, is_manually_edited = 1, 
           books_vs_26as_status = ?, books_vs_tally_status = ?, as26_vs_tally_status = ?,
           overall_status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cleanTan, booksVs26as, booksVsTally, as26VsTally, overallStatus, id]
    );

    if (recRows.length > 0 && recRows[0].tds_dues_id) {
      try {
        await db.execute(
          `UPDATE tds_dues 
           SET tan_no = ?, company_name = ?, 
               pan_no = COALESCE(?, pan_no), 
               gst_num = COALESCE(?, gst_num) 
           WHERE id = ?`,
          [cleanTan, cleanCompany, cleanPan, cleanGst, recRows[0].tds_dues_id]
        );
      } catch (e) {
        await db.execute(
          'UPDATE tds_dues SET tan_no = ?, company_name = ? WHERE id = ?',
          [cleanTan, cleanCompany, recRows[0].tds_dues_id]
        );
      }
    }

    // Fire-and-forget reconcile so corrected TAN gets its 26AS/Tally amounts recalculated immediately
    reconcile(null, null).catch(rErr => {
      console.warn('Background reconcile warning after cleaning item resolve:', rErr.message);
    });

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

let followupColumnChecked = false;
async function ensureFollowupDoneColumn() {
  if (followupColumnChecked) return;
  try {
    await db.execute('ALTER TABLE tds_reconciliation_results ADD COLUMN is_followup_done BOOLEAN DEFAULT FALSE');
  } catch (e) {
    try { await db.execute('ALTER TABLE tds_reconciliation_results ADD COLUMN is_followup_done INTEGER DEFAULT 0'); } catch (err) {}
  }
  followupColumnChecked = true;
}

/**
 * Get Paginated & Filterable Reconciliation Report
 */
export const getReconciliationReport = async (req, res) => {
  try {
    await ensureFollowupDoneColumn();

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
      as26VsTallyStatus = '',
      followupStatus = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(1000, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    const queryParams = [];

    // Filter by follow-up done / pending
    if (followupStatus === 'done' || followupStatus === '1' || followupStatus === 'true') {
      whereClauses.push('(tr.is_followup_done = 1 OR tr.is_followup_done = true)');
    } else if (followupStatus === 'pending' || followupStatus === '0' || followupStatus === 'false') {
      whereClauses.push('(tr.is_followup_done = 0 OR tr.is_followup_done IS NULL OR tr.is_followup_done = false)');
    }

    // Always exclude zero-data ghost rows where all 3 TDS amounts are zero/null
    whereClauses.push("NOT (COALESCE(tr.books_tds, 0) = 0 AND COALESCE(tr.as26_tds, 0) = 0 AND COALESCE(tr.tally_tds, 0) = 0)");

    const activeFy = fy || financialYear;
    if (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years') {
      const cleanFy = String(activeFy).replace(/^FY\s*/i, '').trim();
      whereClauses.push("(tr.financial_year = 'All Financial Years' OR COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'FY 2024-25') LIKE ? OR tr.as26_batch_id LIKE ? OR tr.tally_batch_id LIKE ?)");
      const fyWild = `%${cleanFy}%`;
      queryParams.push(fyWild, fyWild, fyWild);
    }

    if (search && String(search).trim() !== '') {
      whereClauses.push("(tr.tan_no LIKE ? OR COALESCE(d.company_name, '') LIKE ?)");
      const wild = `%${String(search).trim()}%`;
      queryParams.push(wild, wild);
    }

    const primaryTdsSQL = '(CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END)';

    if (overallStatus && overallStatus !== 'All') {
      if (overallStatus === 'Match' || overallStatus === 'All Matched') {
        whereClauses.push(`(${primaryTdsSQL} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND (COALESCE(tr.is_manually_edited, 0) = 1 OR ABS(${primaryTdsSQL} - COALESCE(tr.as26_tds, 0)) <= 1.0))`);
      } else if (overallStatus === 'Less Paid' || overallStatus === 'Less') {
        whereClauses.push(`(COALESCE(tr.is_manually_edited, 0) = 0 AND ${primaryTdsSQL} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ${primaryTdsSQL} > COALESCE(tr.as26_tds, 0) + 1.0)`);
      } else if (overallStatus === 'Excess' || overallStatus === 'Excess Paid') {
        whereClauses.push(`(COALESCE(tr.is_manually_edited, 0) = 0 AND COALESCE(tr.as26_tds, 0) > 0 AND (${primaryTdsSQL} = 0 OR ${primaryTdsSQL} < COALESCE(tr.as26_tds, 0) - 1.0))`);
      } else if (overallStatus === 'Not Received' || overallStatus === 'No Match' || overallStatus === 'Missing') {
        whereClauses.push(`(COALESCE(tr.as26_tds, 0) = 0 AND ${primaryTdsSQL} > 0)`);
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
    const hasSaarthiSQL = '(COALESCE(tr.books_tds, 0) > 0 OR tr.tds_dues_id IS NOT NULL)';
    const hasTallySQL = '(COALESCE(tr.tally_tds, 0) > 0)';
    const has26asSQL = '(COALESCE(tr.as26_tds, 0) > 0)';

    if (coverageFilter === '3/3' || coverageFilter === '3 of 3' || coverageFilter === 'all_3' || coverageFilter === 'all3' || coverageFilter === 'All 3 (Saarthi + Tally + 26AS)' || coverageFilter === 'All 3 (Sarthi + Tally + 26AS)') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND ${has26asSQL})`);
    } else if (coverageFilter === 'saarthi_tally' || coverageFilter === 'sarthi_tally' || coverageFilter === 'tally_saarthi' || coverageFilter === 'tally_sarthi' || coverageFilter === 'Saarthi + Tally' || coverageFilter === 'Sarthi + Tally') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND NOT ${has26asSQL})`);
    } else if (coverageFilter === 'tally_26as' || coverageFilter === '26as_tally' || coverageFilter === 'Tally + 26AS') {
      whereClauses.push(`(${hasTallySQL} AND ${has26asSQL} AND NOT ${hasSaarthiSQL})`);
    } else if (coverageFilter === 'as26_saarthi' || coverageFilter === 'as26_sarthi' || coverageFilter === 'saarthi_26as' || coverageFilter === 'sarthi_26as' || coverageFilter === '26as_saarthi' || coverageFilter === '26as_sarthi' || coverageFilter === '26AS + Saarthi' || coverageFilter === '26AS + Sarthi') {
      whereClauses.push(`(${has26asSQL} AND ${hasSaarthiSQL} AND NOT ${hasTallySQL})`);
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 2)`);
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3' || coverageFilter === 'Single Source Only') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 1)`);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let orderSQL = 'ORDER BY tr.id DESC';
    if (sortBy === 'difference_desc' || sortBy === 'difference' || sortBy === 'Difference (High → Low)') {
      orderSQL = 'ORDER BY ABS((COALESCE(tr.books_tds, tr.tally_tds, 0)) - COALESCE(tr.as26_tds, 0)) DESC';
    }

    let countQuery = `
      SELECT COUNT(tr.id) as total 
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
        COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unassigned Entity') as companyName,
        'N/A' as billNumber,
        'N/A' as billDate,
        0 as totalBillAmount,
        COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'FY 2024-25') as financialYear,

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
        tr.is_followup_done as isFollowupDone,
        tr.updated_at as updatedAt,

        COALESCE(NULLIF(TRIM(d.contact_person_name), ''), '') as contactPersonName,
        COALESCE(NULLIF(TRIM(d.designation), ''), '') as designation,
        COALESCE(NULLIF(TRIM(d.contact_number), ''), '') as contactNumber,
        COALESCE(NULLIF(TRIM(d.email_id), ''), '') as emailId,
        COALESCE(NULLIF(TRIM(d.teamleader), ''), '') as teamleader,

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

    let rawRows = [];
    try {
      const [res] = await db.query(reportQuery, queryParams);
      rawRows = res;
    } catch (qErr) {
      console.warn('⚠️ Primary report query failed, retrying with fallback:', qErr.message);
      const fallbackQuery = reportQuery.replace('tr.is_followup_done as isFollowupDone,', '0 as isFollowupDone,');
      const [res] = await db.query(fallbackQuery, queryParams);
      rawRows = res;
    }

    const rows = rawRows.map(r => {
      const tally = parseFloat(r.tallyTds || 0);
      const as26 = parseFloat(r.as26Tds || 0);
      const saarthi = parseFloat(r.booksTds || 0);

      const has26as = Boolean(as26 > 0);
      const hasTally = Boolean(tally > 0);
      const hasSaarthi = Boolean(saarthi > 0 || r.tdsDuesId || r.contactPersonName || (r.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(String(r.companyName).trim())));

      const sources = [];
      if (hasTally) sources.push('Tally');
      if (has26as) sources.push('26AS');
      if (hasSaarthi) sources.push('Sarthi');

      const countStr = `${sources.length}/3`;
      let coverageLabel = `${countStr} · ${sources.join(' + ') || 'No match'}`;

      const primaryVal = tally > 0 ? tally : saarthi;
      let financialStatus = 'Not Received';
      if (tally <= 0 && saarthi <= 0 && as26 > 0) {
        financialStatus = 'Excess';
      } else if (as26 <= 0 || primaryVal <= 0) {
        financialStatus = 'Not Received';
      } else if (r.isManuallyEdited) {
        financialStatus = 'Match';
      } else {
        const diffVal = primaryVal - as26;
        if (Math.abs(diffVal) <= 1.0) financialStatus = 'Match';
        else if (diffVal > 1.0) financialStatus = 'Less Paid';
        else financialStatus = 'Excess';
      }

      const diffCalc = (tally || saarthi) - as26;
      // Use the row's actual stored FY; only fall back to the active filter when it is genuinely empty
      const displayFy = (r.financialYear && r.financialYear.trim()) ? r.financialYear.trim() : (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years' ? activeFy : 'FY 2024-25');

      const personName = (r.contactPersonName && r.contactPersonName.trim() !== '') ? r.contactPersonName.trim() : '';
      const desig = (r.designation && r.designation.trim() !== '') ? r.designation.trim() : '';
      const phone = (r.contactNumber && r.contactNumber.trim() !== '') ? r.contactNumber.trim() : '';
      const email = (r.emailId && r.emailId.trim() !== '') ? r.emailId.trim() : '';

      return {
        ...r,
        contactPersonName: personName,
        designation: desig,
        contactNumber: phone,
        emailId: email,
        financialYear: displayFy,
        saarthiTds: saarthi,
        difference: diffCalc,
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
      WHERE id = ?
    `;
    const [result] = await db.execute(updateQuery, [newValue, targetId]);

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
    const {
      search = '',
      overallStatus = '',
      coverageFilter = 'All',
      fy = '',
      financialYear = '',
      booksVs26asStatus = '',
      booksVsTallyStatus = '',
      as26VsTallyStatus = ''
    } = req.query;

    let whereClauses = [];
    const queryParams = [];

    // Always exclude zero-data ghost rows where all 3 TDS amounts are zero/null
    whereClauses.push("NOT (COALESCE(tr.books_tds, 0) = 0 AND COALESCE(tr.as26_tds, 0) = 0 AND COALESCE(tr.tally_tds, 0) = 0)");

    const activeFy = fy || financialYear;
    if (activeFy && activeFy !== 'All' && activeFy !== 'All Financial Years') {
      const cleanFy = String(activeFy).replace(/^FY\s*/i, '').trim();
      whereClauses.push("(COALESCE(NULLIF(TRIM(tr.financial_year), ''), NULLIF(TRIM(d.financial_year), ''), 'FY 2024-25') LIKE ? OR tr.as26_batch_id LIKE ? OR tr.tally_batch_id LIKE ?)");
      const fyWild = `%${cleanFy}%`;
      queryParams.push(fyWild, fyWild, fyWild);
    }

    if (search && String(search).trim() !== '') {
      whereClauses.push("(tr.tan_no LIKE ? OR COALESCE(d.company_name, '') LIKE ?)");
      const wild = `%${String(search).trim()}%`;
      queryParams.push(wild, wild);
    }

    const primaryTdsSQL = '(CASE WHEN COALESCE(tr.tally_tds, 0) > 0 THEN tr.tally_tds ELSE COALESCE(tr.books_tds, 0) END)';

    if (overallStatus && overallStatus !== 'All') {
      if (overallStatus === 'Match' || overallStatus === 'All Matched') {
        whereClauses.push(`(${primaryTdsSQL} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND (COALESCE(tr.is_manually_edited, 0) = 1 OR ABS(${primaryTdsSQL} - COALESCE(tr.as26_tds, 0)) <= 1.0))`);
      } else if (overallStatus === 'Less Paid' || overallStatus === 'Less') {
        whereClauses.push(`(COALESCE(tr.is_manually_edited, 0) = 0 AND ${primaryTdsSQL} > 0 AND COALESCE(tr.as26_tds, 0) > 0 AND ${primaryTdsSQL} > COALESCE(tr.as26_tds, 0) + 1.0)`);
      } else if (overallStatus === 'Excess' || overallStatus === 'Excess Paid') {
        whereClauses.push(`(COALESCE(tr.is_manually_edited, 0) = 0 AND COALESCE(tr.as26_tds, 0) > 0 AND (${primaryTdsSQL} = 0 OR ${primaryTdsSQL} < COALESCE(tr.as26_tds, 0) - 1.0))`);
      } else if (overallStatus === 'Not Received' || overallStatus === 'No Match' || overallStatus === 'Missing') {
        whereClauses.push(`(COALESCE(tr.as26_tds, 0) = 0 AND ${primaryTdsSQL} > 0)`);
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
    const hasSaarthiSQL = '(COALESCE(tr.books_tds, 0) > 0)';
    const hasTallySQL = '(COALESCE(tr.tally_tds, 0) > 0)';
    const has26asSQL = '(COALESCE(tr.as26_tds, 0) > 0)';

    if (coverageFilter === '3/3' || coverageFilter === '3 of 3' || coverageFilter === 'all_3' || coverageFilter === 'all3' || coverageFilter === 'All 3 (Saarthi + Tally + 26AS)' || coverageFilter === 'All 3 (Sarthi + Tally + 26AS)') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND ${has26asSQL})`);
    } else if (coverageFilter === 'saarthi_tally' || coverageFilter === 'sarthi_tally' || coverageFilter === 'tally_saarthi' || coverageFilter === 'tally_sarthi' || coverageFilter === 'Saarthi + Tally' || coverageFilter === 'Sarthi + Tally') {
      whereClauses.push(`(${hasSaarthiSQL} AND ${hasTallySQL} AND NOT ${has26asSQL})`);
    } else if (coverageFilter === 'tally_26as' || coverageFilter === '26as_tally' || coverageFilter === 'Tally + 26AS') {
      whereClauses.push(`(${hasTallySQL} AND ${has26asSQL} AND NOT ${hasSaarthiSQL})`);
    } else if (coverageFilter === 'as26_saarthi' || coverageFilter === 'as26_sarthi' || coverageFilter === 'saarthi_26as' || coverageFilter === 'sarthi_26as' || coverageFilter === '26as_saarthi' || coverageFilter === '26as_sarthi' || coverageFilter === '26AS + Saarthi' || coverageFilter === '26AS + Sarthi') {
      whereClauses.push(`(${has26asSQL} AND ${hasSaarthiSQL} AND NOT ${hasTallySQL})`);
    } else if (coverageFilter === '2/3' || coverageFilter === '2 of 3') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 2)`);
    } else if (coverageFilter === '1/3' || coverageFilter === '1 of 3' || coverageFilter === 'Single Source Only') {
      whereClauses.push(`(((CASE WHEN ${hasSaarthiSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${has26asSQL} THEN 1 ELSE 0 END) + (CASE WHEN ${hasTallySQL} THEN 1 ELSE 0 END)) = 1)`);
    }

    const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        COALESCE(NULLIF(TRIM(d.company_name), ''), tr.tan_no, 'Unassigned Entity') as companyName,
        tr.tan_no as tanNo,
        COALESCE(tr.books_tds, 0) as booksTds,
        COALESCE(tr.as26_tds, 0) as as26Tds,
        COALESCE(tr.tally_tds, 0) as tallyTds,
        tr.books_vs_26as_status as booksVs26asStatus,
        tr.books_vs_tally_status as booksVsTallyStatus,
        tr.as26_vs_tally_status as as26VsTallyStatus,
        tr.overall_status as overallStatus
      FROM tds_reconciliation_results tr
      LEFT JOIN (
        SELECT 
          MAX(id) as id,
          UPPER(TRIM(tan_no)) as tan_key,
          MAX(company_name) as company_name,
          MAX(financial_year) as financial_year
        FROM tds_dues
        WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
        GROUP BY UPPER(TRIM(tan_no))
      ) d ON (tr.tds_dues_id = d.id OR UPPER(TRIM(tr.tan_no)) = d.tan_key)
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
      // NOTE: Follow-up logs (tds_followups) are preserved and never deleted during dataset purge
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
      
      // Zero out matching 26AS side
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET as26_tds = 0, as26_batch_id = NULL, books_vs_26as_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE as26_batch_id = ? AND (is_manually_edited IS NULL OR is_manually_edited = 0)`,
        [batchId]
      );

      // Zero out matching Tally side
      await db.execute(
        `UPDATE tds_reconciliation_results 
         SET tally_tds = 0, tally_batch_id = NULL, books_vs_tally_status = 'Not Received', as26_vs_tally_status = 'Not Received' 
         WHERE tally_batch_id = ? AND (is_manually_edited IS NULL OR is_manually_edited = 0)`,
        [batchId]
      );
    }

    if (historyId) {
      await db.execute('DELETE FROM upload_history WHERE id = ?', [historyId]);
    } else if (id) {
      await db.execute('DELETE FROM upload_history WHERE metadata LIKE ?', [`%${id}%`]);
    }

    try {
      await reconcile(null, null);
    } catch (recErr) {
      console.warn('Reconcile after delete warning:', recErr.message);
    }

    try {
      await db.execute(
        `DELETE FROM tds_reconciliation_results 
         WHERE (as26_tds IS NULL OR as26_tds = 0) 
           AND (tally_tds IS NULL OR tally_tds = 0) 
           AND (books_tds IS NULL OR books_tds = 0)
           AND (is_manually_edited IS NULL OR is_manually_edited = 0)`
      );
    } catch (e) {}

    res.json({ success: true, message: 'Upload file batch deleted successfully', id });
  } catch (error) {
    console.error('💥 Error in deleteUploadBatch:', error);
    res.status(500).json({ success: false, error: 'Failed to delete upload batch', details: error.message });
  }
};

/**
 * Sync Live Sarthi 360 API Data (api/clients_info + legals_info)
 */
export const syncSaarthiLiveApi = async (req, res) => {
  try {
    clearPurgedFlag();
    console.log('🔄 Syncing live Sarthi 360 client & legal master data...');

    const fetchEndpointWithFallback = async (endpointName, ms = 12000) => {
      const cleanName = String(endpointName || '').replace(/^api\//, '').trim();
      const candidates = [
        `https://api.sarthi360.in/${cleanName}`,
        `https://api.sarthi360.in/api/${cleanName}`,
        `https://sarthi360.in/${cleanName}`,
        `https://sarthi360.in/api/${cleanName}`,
        `https://api.saarthi360.in/${cleanName}`,
        `https://api.saarthi360.in/api/${cleanName}`
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
            if (arr.length > 0) {
              console.log(`✅ Successfully fetched ${arr.length} records from ${url}`);
              return { ok: true, data: arr, url };
            }
          }
        } catch (err) {
          clearTimeout(timer);
          console.warn(`Candidate fetch error for ${url}:`, err.message);
        }
      }
      return { ok: false, data: [] };
    };

    const [cRes, lRes, iRes] = await Promise.all([
      fetchEndpointWithFallback('clients_info'),
      fetchEndpointWithFallback('legals_info'),
      fetchEndpointWithFallback('Invoice')
    ]);

    let clientsData = cRes.data || [];
    let legalsData = lRes.data || [];
    let invoicesData = iRes.data || [];

    if (invoicesData.length === 0) {
      const invAlt = await fetchEndpointWithFallback('invoice');
      invoicesData = invAlt.data || [];
    }

    console.log(`ℹ️ CRM Data Live: ${clientsData.length} clients, ${legalsData.length} legals, ${invoicesData.length} invoices`);

    const liveApiStatus = {
      clients_info: cRes.ok ? 'ok' : 'unreachable',
      legals_info: lRes.ok ? 'ok' : 'unreachable',
      invoices: invoicesData.length > 0 ? 'ok' : 'unreachable'
    };

    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // Map legals GST -> TAN and normalized company name -> TAN
    const legalGstToTan = new Map();
    const legalNameToTan = new Map();

    legalsData.forEach(l => {
      const tan = String(l.tanNo || '').trim().toUpperCase();
      const gst = String(l.gstNo || '').trim().toUpperCase();
      const norm = normalize(l.companyName || l.partyName);
      if (tan) {
        if (gst) legalGstToTan.set(gst, tan);
        if (norm) legalNameToTan.set(norm, tan);
      }
    });

    // Accumulate invoice TDS amounts from CRM
    const crmTdsByTan = new Map();
    const crmTdsByNormName = new Map();

    invoicesData.forEach(inv => {
      const tds = parseFloat(inv.tds || 0);
      if (tds > 0) {
        const gst = String(inv.gstNo || '').trim().toUpperCase();
        const norm = normalize(inv.companyName);
        const tan = legalGstToTan.get(gst) || legalNameToTan.get(norm);
        if (tan) {
          crmTdsByTan.set(tan, (crmTdsByTan.get(tan) || 0) + tds);
        }
        if (norm) {
          crmTdsByNormName.set(norm, (crmTdsByNormName.get(norm) || 0) + tds);
        }
      }
    });

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
      const gst = String(item.gstNumber || item.gstNo || item.gstNum || '').trim().toUpperCase();
      const pan = extractPanFromGst(gst) || (panRegex.test(item.panNo || item.panNumber || item.pan || '') ? String(item.panNo || item.panNumber || item.pan).trim().toUpperCase() : null);
      const companyName = String(item.companyName || '').trim();
      const norm = normalize(companyName);
      const itemTan = String(item.tanNo || item.tanNumber || '').trim().toUpperCase() || legalGstToTan.get(gst) || legalNameToTan.get(norm) || null;
      const itemTds = (itemTan && crmTdsByTan.get(itemTan)) || (norm && crmTdsByNormName.get(norm)) || parseFloat(item.tdsAmount || item.tds_amount || item.tds || 0) || 0;

      clientMasters.push({
        saarthi_client_id: item.id ? parseInt(item.id) : null,
        company_name: companyName,
        normalized_name: normalizeCompanyName(companyName),
        gst_no: gstRegex.test(gst) ? gst : null,
        pan_no: pan,
        tan_no: itemTan && tanRegex.test(itemTan) ? itemTan : null,
        contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
        designation: String(item.contactDesignation || item.designation || item.contact_designation || item.role || '').trim() || null,
        contact_number: String(item.contactPhone || item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.phone || item.contact_no || '').trim() || null,
        email_id: String(item.contactEmail || item.contactEmailId || item.emailId || item.email || item.contact_email || '').trim() || null,
        teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
        saarthi_tds: itemTds,
        saarthi_amount: parseFloat(item.amount || item.grossAmount || item.gross_amount || 0) || 0,
        status: String(item.status || 'active').toLowerCase()
      });
    });

    legalsData.forEach(item => {
      if (!item || (!item.companyName && !item.partyName && !item.id)) return;
      const gst = String(item.gstNo || item.gstNumber || item.gstNum || '').trim().toUpperCase();
      const tan = String(item.tanNo || item.tanNumber || '').trim().toUpperCase();
      const pan = String(item.panNo || item.panNumber || '').trim().toUpperCase() || extractPanFromGst(gst);
      const companyName = String(item.companyName || item.partyName || '').trim();
      const norm = normalize(companyName);
      const itemTds = (tan && crmTdsByTan.get(tan)) || (norm && crmTdsByNormName.get(norm)) || parseFloat(item.tdsAmount || item.tds_amount || item.tds || 0) || 0;
      
      clientMasters.push({
        saarthi_client_id: item.id ? parseInt(item.id) : null,
        company_name: companyName,
        normalized_name: normalizeCompanyName(companyName),
        gst_no: gstRegex.test(gst) ? gst : null,
        pan_no: panRegex.test(pan) ? pan : null,
        tan_no: tanRegex.test(tan) ? tan : null,
        contact_person_name: String(item.contactPersonName || item.contactPerson || item.clientName || item.personName || item.contact_name || '').trim() || null,
        designation: String(item.designation || item.contactDesignation || item.contact_designation || item.role || '').trim() || null,
        contact_number: String(item.contactPhoneNumber || item.phoneNumber || item.mobile || item.mobileNo || item.contactPhone || item.phone || item.contact_no || '').trim() || null,
        email_id: String(item.contactEmailId || item.emailId || item.email || item.contactEmail || item.contact_email || '').trim() || null,
        teamleader: String(item.teamLeader || item.teamleader || item.tlName || item.manager || '').trim() || null,
        saarthi_tds: itemTds,
        saarthi_amount: parseFloat(item.amount || item.grossAmount || item.gross_amount || 0) || 0,
        status: String(item.status || 'ACTIVE').toLowerCase()
      });
    });

    // Filter out records that have neither a TAN nor a client ID nor PAN —
    // they can't be matched to reconciliation rows and just accumulate as dead junk on every sync.
    const usableMasters = clientMasters.filter(m => m.tan_no || m.saarthi_client_id || m.pan_no);
    const skippedCount = clientMasters.length - usableMasters.length;
    if (skippedCount > 0) {
      console.log(`⚠️  Skipped ${skippedCount} records with no TAN, PAN, or client ID (unreconcilable).`);
    }

    // 1. Fetch all existing records in ONE query for fast in-memory matching
    const [existingAll] = await db.execute(
      'SELECT id, saarthi_client_id, UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(pan_no)) as pan_no, UPPER(TRIM(company_name)) as company_name FROM tds_dues'
    );

    const clientIdMap = new Map();
    const tanMap = new Map();
    const panMap = new Map();
    const nameMap = new Map();

    (existingAll || []).forEach(row => {
      if (row.saarthi_client_id) clientIdMap.set(row.saarthi_client_id, row.id);
      if (row.tan_no) tanMap.set(row.tan_no.toUpperCase(), row.id);
      if (row.pan_no) panMap.set(row.pan_no.toUpperCase(), row.id);
      if (row.company_name) nameMap.set(row.company_name.toUpperCase(), row.id);
    });

    const toUpdate = [];
    const toInsert = [];
    const seenNewKeys = new Set();

    for (const master of usableMasters) {
      let matchedId = null;
      if (master.saarthi_client_id && clientIdMap.has(master.saarthi_client_id)) {
        matchedId = clientIdMap.get(master.saarthi_client_id);
      } else if (master.tan_no && tanMap.has(master.tan_no.toUpperCase())) {
        matchedId = tanMap.get(master.tan_no.toUpperCase());
      } else if (master.pan_no && panMap.has(master.pan_no.toUpperCase())) {
        matchedId = panMap.get(master.pan_no.toUpperCase());
      } else if (master.company_name && nameMap.has(master.company_name.toUpperCase())) {
        matchedId = nameMap.get(master.company_name.toUpperCase());
      }

      if (matchedId) {
        toUpdate.push({ id: matchedId, master });
      } else {
        // Prevent duplicate inserts within the same sync payload
        const dedupeKey = master.saarthi_client_id ? `id_${master.saarthi_client_id}` :
                          master.tan_no ? `tan_${master.tan_no.toUpperCase()}` :
                          master.pan_no ? `pan_${master.pan_no.toUpperCase()}` :
                          master.company_name ? `name_${master.company_name.toUpperCase()}` : null;
        if (!dedupeKey || !seenNewKeys.has(dedupeKey)) {
          if (dedupeKey) seenNewKeys.add(dedupeKey);
          toInsert.push(master);
        }
      }
    }

    let inserted = 0;
    let updated = 0;

    // 2. Perform updates in parallel chunks of 50
    const UPDATE_CHUNK_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK_SIZE) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
      await Promise.all(chunk.map(item => 
        db.execute(`
          UPDATE tds_dues 
          SET 
            saarthi_client_id = COALESCE(?, saarthi_client_id),
            tan_no = COALESCE(?, tan_no),
            pan_no = COALESCE(?, pan_no),
            gst_num = COALESCE(?, gst_num),
            contact_person_name = COALESCE(NULLIF(?, ''), contact_person_name),
            designation = COALESCE(NULLIF(?, ''), designation),
            contact_number = COALESCE(NULLIF(?, ''), contact_number),
            email_id = COALESCE(NULLIF(?, ''), email_id),
            teamleader = COALESCE(NULLIF(?, ''), teamleader),
            tds = CASE WHEN ? > 0 THEN ? ELSE COALESCE(tds, 0) END
          WHERE id = ?
        `, [
          item.master.saarthi_client_id,
          item.master.tan_no,
          item.master.pan_no,
          item.master.gst_no,
          item.master.contact_person_name,
          item.master.designation,
          item.master.contact_number,
          item.master.email_id,
          item.master.teamleader,
          item.master.saarthi_tds || 0,   // condition check
          item.master.saarthi_tds || 0,   // actual value
          item.id
        ])
      ));
      updated += chunk.length;
    }

    // 3. Perform inserts in multi-row bulk chunks of 200
    const INSERT_CHUNK_SIZE = 200;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const valueRows = [];
      const params = [];
      for (const m of chunk) {
        valueRows.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        params.push(
          m.saarthi_client_id || null,
          m.company_name || '',
          m.tan_no || null,
          m.pan_no || null,
          m.gst_no || null,
          m.contact_person_name || null,
          m.designation || null,
          m.contact_number || null,
          m.email_id || null,
          m.teamleader || null,
          'FY 2025-26',
          m.saarthi_tds || 0   // ← Saarthi Books TDS from CRM legals
        );
      }
      const sql = `
        INSERT INTO tds_dues 
        (saarthi_client_id, company_name, tan_no, pan_no, gst_num, contact_person_name, designation, contact_number, email_id, teamleader, financial_year, tds)
        VALUES ${valueRows.join(', ')}
      `;
      await db.execute(sql, params);
      inserted += chunk.length;
    }

    // ─── Directly update tds_reconciliation_results.books_tds from tds_dues.tds ───
    try {
      await db.execute(`
        UPDATE tds_reconciliation_results tr
        INNER JOIN (
          SELECT UPPER(TRIM(tan_no)) as tan, SUM(COALESCE(tds, 0)) as total_tds
          FROM tds_dues
          WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' AND tds > 0
          GROUP BY UPPER(TRIM(tan_no))
        ) d ON UPPER(TRIM(tr.tan_no)) = d.tan
        SET tr.books_tds = d.total_tds
        WHERE d.total_tds > 0
      `);

      // Match by company name for remaining rows with books_tds = 0
      const [zeroRows] = await db.query(`
        SELECT tr.id, d.company_name 
        FROM tds_reconciliation_results tr 
        LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id 
        WHERE COALESCE(tr.books_tds, 0) = 0 AND d.company_name IS NOT NULL AND d.company_name != ''
      `);
      
      const nameUpdates = [];
      zeroRows.forEach(r => {
        const norm = normalize(r.company_name);
        const tds = crmTdsByNormName.get(norm);
        if (tds && tds > 0) {
          nameUpdates.push([tds, r.id]);
        }
      });

      const BATCH = 50;
      for (let i = 0; i < nameUpdates.length; i += BATCH) {
        const chunk = nameUpdates.slice(i, i + BATCH);
        await Promise.all(chunk.map(([tds, id]) =>
          db.execute('UPDATE tds_reconciliation_results SET books_tds = ? WHERE id = ?', [tds, id]).catch(() => {})
        ));
      }

      // Recalculate status for rows with books_tds > 0
      await db.execute(`
        UPDATE tds_reconciliation_results
        SET 
          books_vs_26as_status = CASE 
            WHEN COALESCE(books_tds, 0) <= 0 OR COALESCE(as26_tds, 0) <= 0 THEN 'Not Received'
            WHEN ABS(COALESCE(as26_tds, 0) - COALESCE(books_tds, 0)) <= 1.0 THEN 'Matched'
            WHEN COALESCE(as26_tds, 0) > COALESCE(books_tds, 0) THEN 'Excess'
            ELSE 'Less Paid'
          END,
          books_vs_tally_status = CASE 
            WHEN COALESCE(books_tds, 0) <= 0 OR COALESCE(tally_tds, 0) <= 0 THEN 'Not Received'
            WHEN ABS(COALESCE(tally_tds, 0) - COALESCE(books_tds, 0)) <= 1.0 THEN 'Matched'
            WHEN COALESCE(tally_tds, 0) > COALESCE(books_tds, 0) THEN 'Excess'
            ELSE 'Less Paid'
          END
        WHERE books_tds > 0
      `);

      console.log('✅ Directly updated tds_reconciliation_results.books_tds from Saarthi CRM TDS');
    } catch (directErr) {
      console.warn('Direct books_tds update warning:', directErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    reconcile(null, null).catch(rErr => {
      console.warn('Background reconcile warning:', rErr.message);
    });

    res.json({
      success: true,
      message: `Sarthi 360 sync complete. ${inserted} inserted, ${updated} updated.`,
      liveApiStatus,
      stats: {
        clientsFetched: clientMasters.length,
        clientsProcessed: usableMasters.length,
        skipped: skippedCount,
        inserted,
        updated
      }
    });

  } catch (error) {
    console.error('💥 Error in syncSaarthiLiveApi:', error);
    res.status(500).json({
      success: false,
      error: 'Sarthi 360 sync failed',
      details: error.message
    });
  }
};

export const syncSarthiLiveApi = syncSaarthiLiveApi;

/**
 * PATCH /api/tds-26as/report/:id/followup-done
 * Toggle the is_followup_done flag on a single reconciliation row.
 */
export const toggleFollowupDone = async (req, res) => {
  try {
    await ensureFollowupDoneColumn();
    const { id } = req.params;
    const rowId = parseInt(id, 10);
    if (!rowId || isNaN(rowId)) {
      return res.status(400).json({ success: false, error: 'Invalid reconciliation record ID' });
    }

    // Read current value
    const [existing] = await db.query(
      'SELECT is_followup_done FROM tds_reconciliation_results WHERE id = ? LIMIT 1',
      [rowId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const currentVal = existing[0].is_followup_done;
    const newVal = currentVal ? 0 : 1;

    await db.query(
      'UPDATE tds_reconciliation_results SET is_followup_done = ? WHERE id = ?',
      [newVal, rowId]
    );

    res.json({ success: true, id: rowId, isFollowupDone: Boolean(newVal) });
  } catch (error) {
    console.error('💥 Error in toggleFollowupDone:', error);
    res.status(500).json({ success: false, error: 'Failed to update follow-up done flag', details: error.message });
  }
};

