import xlsx from 'xlsx';
import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

// Helper to format values
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

const runImport = async () => {
  try {
    console.log('📖 Reading Excel file "TDS Mearge Data 2019-2024.xlsx"...');
    
    // Read file
    const workbook = xlsx.readFile('TDS Mearge Data 2019-2024.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log(`📊 Parsed ${rawData.length} rows from sheet.`);
    
    // Find header row
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
        if (text.includes('tds') || text.includes('tax') || text.includes('deducted') || text.includes('deposited')) hasTds = true;
      });
      if (hasTan && hasTds) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const text = String(cell || '').toLowerCase().trim();
          if (text === 'tan' || text === 'tan no' || text === 'tan number' || text.includes('tan of deductor') || text.includes('deductor tan') || text.includes('party tan')) {
            colMap.tan_no = col;
          }
          if (text.includes('deductor name') || text === 'company name' || text === 'name' || text === 'deductor' || text.includes('party name') || text.includes('company')) {
            colMap.deductor_name = col;
          }
          if (text.includes('amount paid') || text.includes('amount credited') || text.includes('total amount') || text === 'amount' || text.includes('paid')) {
            colMap.amount_paid = col;
          }
          if (text.includes('tds') || text.includes('tax deducted') || text.includes('deducted') || text.includes('deposited')) {
            colMap.tds_deducted = col;
          }
          if (text.includes('section') || text.includes('sec')) {
            colMap.section = col;
          }
          if (text.includes('quarter') || text.includes('period') || text.includes('qtr')) {
            colMap.quarter = col;
          }
        });
        break;
      }
    }

    console.log('📍 Header row detected at index:', headerRowIdx);
    console.log('📍 Column mapping:', colMap);

    if (colMap.tan_no === -1 || colMap.tds_deducted === -1) {
      // Fallback column indexing if heuristics fail
      console.log('⚠️ Heuristic mapping failed, using fallback indices.');
      colMap.tan_no = 0;
      colMap.deductor_name = 1;
      colMap.amount_paid = 2;
      colMap.tds_deducted = 3;
      colMap.section = 4;
      colMap.quarter = 5;
    }

    const uploadBatchId = `batch_import_${Date.now()}`;
    const entries = [];

    // Parse rows
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;

    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const tan = String(row[colMap.tan_no] || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!tan || !tanRegex.test(tan)) continue;

      const deductorName = colMap.deductor_name !== -1 ? String(row[colMap.deductor_name] || '').trim() : 'Unknown';
      const amountPaid = colMap.amount_paid !== -1 ? cleanNumber(row[colMap.amount_paid]) : 0.00;
      const tdsDeducted = cleanNumber(row[colMap.tds_deducted]);
      const section = colMap.section !== -1 ? String(row[colMap.section] || '').trim() : 'N/A';
      const quarter = colMap.quarter !== -1 ? String(row[colMap.quarter] || '').trim() : 'N/A';

      entries.push([
        tan, deductorName, amountPaid, tdsDeducted, section, quarter, uploadBatchId
      ]);
    }

    console.log(`✅ Extracted ${entries.length} valid 26AS entries from Excel.`);

    if (entries.length === 0) {
      throw new Error('No valid entries could be parsed.');
    }

    // Chunked insertions
    const BATCH_SIZE = 1000;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const insertQuery = `
        INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
        VALUES ?
      `;
      await db.query(insertQuery, [chunk]);
    }
    console.log('✅ Inserted all entries into tds_26as_entries.');

    // Save history log
    const metadata = JSON.stringify({
      upload_type: '26AS_TDS',
      upload_batch_id: uploadBatchId,
      total_rows_parsed: entries.length,
      financialYear: '2019-2024'
    });
    
    await db.execute(
      'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
      ['TDS Mearge Data 2019-2024.xlsx', 'TDS Mearge Data 2019-2024.xlsx', 'System', 'Completed', metadata]
    );
    console.log('✅ Logged batch into upload_history.');

    // Map company names in tds_dues to TAN numbers
    console.log('🔗 Resolving missing TAN numbers in tds_dues table...');
    const [mappings] = await db.execute(`
      SELECT DISTINCT UPPER(TRIM(deductor_name)) as name, UPPER(TRIM(tan_no)) as tan 
      FROM tds_26as_entries 
      WHERE tan_no IS NOT NULL AND tan_no != ""
    `);
    
    let matchedCount = 0;
    for (const map of mappings) {
      const [updateResult] = await db.execute(`
        UPDATE tds_dues 
        SET tan_no = ? 
        WHERE (tan_no IS NULL OR tan_no = "") AND UPPER(TRIM(company_name)) = ?
      `, [map.tan, map.name]);
      matchedCount += updateResult.affectedRows;
    }
    console.log(`✅ Updated ${matchedCount} records in tds_dues with correct TAN numbers.`);

    // Run reconciliation matching
    console.log(`🔄 Triggering reconciliation matching for batch: ${uploadBatchId}`);
    await reconcile(uploadBatchId, null);
    console.log('✅ Reconciliation completed successfully.');

    // Check counts
    const [duesCheck] = await db.execute('SELECT COUNT(*) as count FROM tds_dues WHERE tan_no IS NOT NULL AND tan_no != ""');
    console.log('📊 Invoices with valid TAN now:', duesCheck[0].count);

    const [resultsCheck] = await db.execute('SELECT COUNT(*) as count FROM tds_reconciliation_results');
    console.log('📊 Reconciliation results rows:', resultsCheck[0].count);

  } catch (err) {
    console.error('❌ Error during import:', err);
  } finally {
    await db.close();
  }
};

runImport();
