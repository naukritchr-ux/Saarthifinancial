import xlsx from 'xlsx';
import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

// Helper to format values
const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

// Robust date parsing
const parseDateValue = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'number') {
    const UTC_DAYS_DIFF = 25569;
    const date = new Date((dateVal - UTC_DAYS_DIFF) * 86400 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
};

const run = async () => {
  try {
    console.log('📖 Reading Excel file "TDS Mearge Data 2019-2024.xlsx"...');
    const workbook = xlsx.readFile('TDS Mearge Data 2019-2024.xlsx');

    // ==========================================
    // STEP 1: Map company names to TAN numbers using Sheet15
    // ==========================================
    console.log('🔗 Resolving TAN mappings from sheet "Sheet15"...');
    const sheet15 = workbook.Sheets['Sheet15'];
    const sheet15Data = xlsx.utils.sheet_to_json(sheet15, { header: 1 });
    
    // We expect headers at Row 0: Name of Copmany, TAN No
    let mappingCount = 0;
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;

    for (let r = 1; r < sheet15Data.length; r++) {
      const row = sheet15Data[r];
      if (!row || row.length < 2) continue;

      const companyName = String(row[0] || '').trim();
      const tan = String(row[1] || '').trim().toUpperCase().replace(/\s+/g, '');

      if (companyName && tan && tanRegex.test(tan)) {
        const [updateResult] = await db.execute(`
          UPDATE tds_dues 
          SET tan_no = ? 
          WHERE (tan_no IS NULL OR tan_no = "") AND UPPER(TRIM(company_name)) = ?
        `, [tan, companyName.toUpperCase()]);

        mappingCount += updateResult.affectedRows;
      }
    }
    console.log(`✅ Successfully mapped TAN numbers for ${mappingCount} records in tds_dues.`);

    // ==========================================
    // STEP 2: Parse Master Data sheet
    // ==========================================
    console.log('📊 Parsing sheet "Master Data"...');
    const masterSheet = workbook.Sheets['Master Data'];
    const masterData = xlsx.utils.sheet_to_json(masterSheet, { header: 1 });

    const as26BatchId = 'batch_as26_initial';
    const tallyBatchId = 'batch_tally_initial';

    const as26Entries = [];
    const tallyEntries = [];

    // Row 0 is the header:
    // Cols 0-5: Tally (Company Name, TAN No, Date, FY, TDS, Source)
    // Cols 7-11: 26AS (Company Name, TAN No, FY, TDS, Source)
    for (let r = 1; r < masterData.length; r++) {
      const row = masterData[r];
      if (!row || row.length === 0) continue;

      // Extract Tally block (cols 0-5)
      const tallyTan = String(row[1] || '').trim().toUpperCase().replace(/\s+/g, '');
      const tallySource = String(row[5] || '').trim();
      if (tallyTan && tanRegex.test(tallyTan) && tallySource === 'Tally') {
        const companyName = String(row[0] || '').trim();
        const entryDate = parseDateValue(row[2]);
        const fy = String(row[3] || '').trim();
        const tdsAmount = cleanNumber(row[4]);
        
        tallyEntries.push([
          tallyBatchId, tallyTan, companyName, entryDate, fy, tdsAmount
        ]);
      }

      // Extract 26AS block (cols 7-11)
      const as26Tan = String(row[8] || '').trim().toUpperCase().replace(/\s+/g, '');
      const as26Source = String(row[11] || '').trim();
      if (as26Tan && tanRegex.test(as26Tan) && as26Source === '26AS') {
        const deductorName = String(row[7] || '').trim();
        const fy = String(row[9] || '').trim();
        const tdsDeducted = cleanNumber(row[10]);

        as26Entries.push([
          as26Tan, deductorName, 0.00, tdsDeducted, 'N/A', fy, as26BatchId
        ]);
      }
    }

    console.log(`✅ Extracted ${tallyEntries.length} Tally entries.`);
    console.log(`✅ Extracted ${as26Entries.length} 26AS entries.`);

    // ==========================================
    // STEP 3: Clear old entries and do chunked inserts
    // ==========================================
    await db.execute('DELETE FROM tds_tally_entries');
    await db.execute('DELETE FROM tds_26as_entries');

    const BATCH_SIZE = 1000;

    // Insert Tally
    console.log('⚙️ Inserting Tally entries into database...');
    for (let i = 0; i < tallyEntries.length; i += BATCH_SIZE) {
      const chunk = tallyEntries.slice(i, i + BATCH_SIZE);
      const query = `
        INSERT INTO tds_tally_entries (upload_batch_id, tan_no, company_name, entry_date, financial_year, tds_deducted)
        VALUES ?
      `;
      await db.query(query, [chunk]);
    }

    // Insert 26AS
    console.log('⚙️ Inserting 26AS entries into database...');
    for (let i = 0; i < as26Entries.length; i += BATCH_SIZE) {
      const chunk = as26Entries.slice(i, i + BATCH_SIZE);
      const query = `
        INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
        VALUES ?
      `;
      await db.query(query, [chunk]);
    }

    // ==========================================
    // STEP 4: Save History Log
    // ==========================================
    await db.execute('DELETE FROM upload_history');
    
    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'TDS Mearge Data 2019-2024.xlsx',
      'TDS Mearge Data 2019-2024.xlsx',
      'System',
      'Completed',
      JSON.stringify({ upload_type: '26AS_TDS', upload_batch_id: as26BatchId, total_rows_parsed: as26Entries.length, financialYear: '2019-2024' })
    ]);

    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'TDS Mearge Data 2019-2024.xlsx',
      'TDS Mearge Data 2019-2024.xlsx',
      'System',
      'Completed',
      JSON.stringify({ upload_type: 'TALLY_TDS', upload_batch_id: tallyBatchId, total_rows_parsed: tallyEntries.length, financialYear: '2019-2024' })
    ]);

    // ==========================================
    // STEP 5: Trigger Reconciliation matching
    // ==========================================
    console.log('🔄 Triggering 3-way reconciliation...');
    await reconcile(as26BatchId, tallyBatchId);
    console.log('✅ Reconciliation completed successfully.');

    // Count results
    const [finalDues] = await db.execute('SELECT COUNT(*) as count FROM tds_dues WHERE tan_no IS NOT NULL AND tan_no != ""');
    console.log('📊 Final invoices with valid TAN:', finalDues[0].count);

    const [finalResults] = await db.execute('SELECT COUNT(*) as count FROM tds_reconciliation_results');
    console.log('📊 Final reconciliation results row count:', finalResults[0].count);

  } catch (err) {
    console.error('❌ Error in master data import:', err);
  } finally {
    await db.close();
  }
};

run();
