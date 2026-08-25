import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

const run = async () => {
  try {
    console.log('🔍 Checking match statistics between tds_dues.company_name and tds_26as_entries.deductor_name...');

    // 1. Let's find distinct mappings in 26AS
    const [mappings] = await db.execute(`
      SELECT DISTINCT UPPER(TRIM(deductor_name)) as name, UPPER(TRIM(tan_no)) as tan 
      FROM tds_26as_entries 
      WHERE tan_no IS NOT NULL AND tan_no != ""
    `);
    console.log(`📌 Found ${mappings.length} unique company-to-TAN mappings in Form 26AS.`);

    // 2. Perform updates for matched company names
    let matchedCount = 0;
    for (const map of mappings) {
      const companyName = map.name;
      const tan = map.tan;

      // We use clean name comparisons (MySQL is case-insensitive by default)
      const [updateResult] = await db.execute(`
        UPDATE tds_dues 
        SET tan_no = ? 
        WHERE (tan_no IS NULL OR tan_no = "") AND UPPER(TRIM(company_name)) = ?
      `, [tan, companyName]);

      matchedCount += updateResult.affectedRows;
    }

    console.log(`✅ Successfully updated ${matchedCount} records in tds_dues with TAN numbers!`);

    // Let's print new counts
    const [validTanDues] = await db.execute('SELECT COUNT(*) as count FROM tds_dues WHERE tan_no IS NOT NULL AND tan_no != ""');
    console.log('📊 Dues with valid tan_no now:', validTanDues[0].count);

    // 3. Re-run reconciliation for the existing batch ID
    const [as26Batches] = await db.execute('SELECT DISTINCT upload_batch_id FROM tds_26as_entries LIMIT 1');
    if (as26Batches.length > 0) {
      const batchId = as26Batches[0].upload_batch_id;
      console.log(`🔄 Re-running reconciliation for 26AS Batch: ${batchId}`);
      const recResult = await reconcile(batchId, null);
      console.log('✅ Reconciliation Result:', recResult);

      const [resultsCheck] = await db.execute('SELECT COUNT(*) as count FROM tds_reconciliation_results');
      console.log('📊 New row count in tds_reconciliation_results:', resultsCheck[0].count);
    }

  } catch (err) {
    console.error('❌ Error mapping TAN numbers:', err);
  } finally {
    await db.close();
  }
};

run();
