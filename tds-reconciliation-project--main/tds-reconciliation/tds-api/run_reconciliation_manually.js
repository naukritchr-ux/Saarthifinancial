import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

const run = async () => {
  try {
    // 1. Get all upload history batches
    const [batches] = await db.execute('SELECT * FROM upload_history');
    console.log('📚 Batches in upload_history:', JSON.stringify(batches, null, 2));

    // 2. Get distinct batch IDs in tds_26as_entries
    const [as26Batches] = await db.execute('SELECT DISTINCT upload_batch_id FROM tds_26as_entries');
    console.log('📌 Distinct 26AS batch IDs:', as26Batches.map(b => b.upload_batch_id));

    // 3. Get distinct batch IDs in tds_tally_entries
    const [tallyBatches] = await db.execute('SELECT DISTINCT upload_batch_id FROM tds_tally_entries');
    console.log('📌 Distinct Tally batch IDs:', tallyBatches.map(b => b.upload_batch_id));

    // 4. Trigger reconciliation for each found 26AS batch ID!
    if (as26Batches.length > 0) {
      const batchId = as26Batches[0].upload_batch_id;
      console.log(`🔄 Triggering reconciliation for 26AS Batch: ${batchId}`);
      
      const result = await reconcile(batchId, null);
      console.log('✅ Reconciliation Result:', result);
      
      // Let's verify results count now
      const [countCheck] = await db.execute('SELECT COUNT(*) as count FROM tds_reconciliation_results');
      console.log('📊 New row count in tds_reconciliation_results:', countCheck[0].count);
    } else {
      console.log('⚠️ No 26AS batches found to reconcile.');
    }

  } catch (err) {
    console.error('❌ Error running manual reconciliation:', err);
  } finally {
    await db.close();
  }
};

run();
