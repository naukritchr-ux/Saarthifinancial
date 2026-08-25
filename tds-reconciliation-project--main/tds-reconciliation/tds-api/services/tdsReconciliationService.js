import db from '../config/db.js';

/**
 * Perform three-way reconciliation for a given 26AS and/or Tally upload batch
 * @param {string|null} as26BatchId - The upload batch ID for 26AS entries
 * @param {string|null} tallyBatchId - The upload batch ID for Tally entries
 */
export async function reconcile(as26BatchId = null, tallyBatchId = null) {
  try {
    console.log(`🔄 Running three-way reconciliation. 26AS Batch: ${as26BatchId || 'none'} | Tally Batch: ${tallyBatchId || 'none'}`);

    // 1. Fetch all dues (books)
    const [dues] = await db.execute(
      'SELECT id, tan_no, tds, company_name FROM tds_dues WHERE tan_no IS NOT NULL AND tan_no != ""'
    );

    if (dues.length === 0) {
      console.log('⚠️ No tds_dues entries found in the database. Reconciliation skipped.');
      return { success: true, count: 0 };
    }

    // 2. Fetch sums for the current 26AS batch grouped by TAN
    const as26Map = new Map();
    if (as26BatchId) {
      const [as26Rows] = await db.execute(
        'SELECT UPPER(TRIM(tan_no)) as tan, SUM(tds_deducted) as total FROM tds_26as_entries WHERE upload_batch_id = ? GROUP BY UPPER(TRIM(tan_no))',
        [as26BatchId]
      );
      as26Rows.forEach(row => as26Map.set(row.tan, parseFloat(row.total || 0)));
    }

    // 3. Fetch sums for the current Tally batch grouped by TAN
    const tallyMap = new Map();
    if (tallyBatchId) {
      const [tallyRows] = await db.execute(
        'SELECT UPPER(TRIM(tan_no)) as tan, SUM(tds_amount) as total FROM tds_tally_entries WHERE upload_batch_id = ? GROUP BY UPPER(TRIM(tan_no))',
        [tallyBatchId]
      );

      tallyRows.forEach(row => tallyMap.set(row.tan, parseFloat(row.total || 0)));
    }

    let processedCount = 0;

    for (const due of dues) {
      const tan = due.tan_no.toUpperCase().trim();
      const booksTds = parseFloat(due.tds || 0);

      // Fetch existing reconciliation details for this due to preserve uploaded batches
      const [existingRows] = await db.execute(
        'SELECT as26_tds, tally_tds, as26_batch_id, tally_batch_id, is_manually_edited FROM tds_reconciliation_results WHERE tds_dues_id = ?',
        [due.id]
      );
      
      const existing = existingRows[0] || {};
      
      // If manual edits are locked, we don't automatically overwrite (or we can preserve)
      if (existing.is_manually_edited) {
        continue;
      }

      // Determine 26AS TDS
      let as26Tds = 0;
      let finalAs26BatchId = existing.as26_batch_id || null;
      if (as26BatchId) {
        as26Tds = as26Map.has(tan) ? as26Map.get(tan) : 0;
        finalAs26BatchId = as26BatchId;
      } else if (existing.as26_tds !== undefined) {
        as26Tds = parseFloat(existing.as26_tds || 0);
      }

      // Determine Tally TDS
      let tallyTds = 0;
      let finalTallyBatchId = existing.tally_batch_id || null;
      if (tallyBatchId) {
        tallyTds = tallyMap.has(tan) ? tallyMap.get(tan) : 0;
        finalTallyBatchId = tallyBatchId;
      } else if (existing.tally_tds !== undefined) {
        tallyTds = parseFloat(existing.tally_tds || 0);
      }

      // Helper to classify pairwise status
      const evaluatePair = (valA, valB, isBMissing) => {
        if (isBMissing && valB > 0) return 'Not Received';
        if (Math.abs(valA - valB) <= 1.0) return 'Matched';
        if (valA > valB) return 'Excess'; // A is higher (e.g. 26AS > Books)
        return 'Less Paid';              // A is lower (e.g. 26AS < Books)
      };

      // Check if data source is missing (e.g., if a batch has not been uploaded yet for this due)
      const has26as = finalAs26BatchId !== null;
      const hasTally = finalTallyBatchId !== null;

      // Pairwise comparisons
      // 1. Books vs 26AS
      const booksVs26as = evaluatePair(as26Tds, booksTds, !has26as);
      
      // 2. Books vs Tally
      const booksVsTally = evaluatePair(tallyTds, booksTds, !hasTally);

      // 3. 26AS vs Tally
      const as26VsTally = evaluatePair(tallyTds, as26Tds, !has26as || !hasTally);

      // Determine overall status
      let overallStatus = 'All Matched';
      
      // If either batch is missing, it's considered a Major Mismatch (missing source)
      if (!has26as || !hasTally) {
        overallStatus = 'Major Mismatch';
      } else {
        const offCount = [booksVs26as, booksVsTally, as26VsTally].filter(status => status !== 'Matched').length;
        if (offCount === 0) {
          overallStatus = 'All Matched';
        } else if (offCount === 1) {
          overallStatus = 'Partial Mismatch';
        } else {
          overallStatus = 'Major Mismatch';
        }
      }

      // Insert or Update the reconciliation results
      if (existingRows.length > 0) {
        await db.execute(
          `UPDATE tds_reconciliation_results 
           SET tan_no = ?, books_tds = ?, as26_tds = ?, tally_tds = ?, 
               books_vs_26as_status = ?, books_vs_tally_status = ?, as26_vs_tally_status = ?, 
               overall_status = ?, as26_batch_id = ?, tally_batch_id = ?
           WHERE tds_dues_id = ?`,
          [
            tan, booksTds, as26Tds, tallyTds,
            booksVs26as, booksVsTally, as26VsTally,
            overallStatus, finalAs26BatchId, finalTallyBatchId,
            due.id
          ]
        );
      } else {
        await db.execute(
          `INSERT INTO tds_reconciliation_results 
           (tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, 
            books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, 
            overall_status, as26_batch_id, tally_batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            due.id, tan, booksTds, as26Tds, tallyTds,
            booksVs26as, booksVsTally, as26VsTally,
            overallStatus, finalAs26BatchId, finalTallyBatchId
          ]
        );
      }

      processedCount++;
    }

    console.log(`✅ Reconciliation completed. Processed ${processedCount} entries.`);
    return { success: true, count: processedCount };

  } catch (error) {
    console.error('❌ Error during three-way reconciliation:', error);
    throw error;
  }
}

export default {
  reconcile
};
