import db from '../config/db.js';

/**
 * Perform three-way reconciliation for a given 26AS and/or Tally upload batch
 * @param {string|null} as26BatchId - The upload batch ID for 26AS entries
 * @param {string|null} tallyBatchId - The upload batch ID for Tally entries
 */
export async function reconcile(as26BatchId = null, tallyBatchId = null) {
  try {
    console.log(`🔄 Running 3-way reconciliation. 26AS Batch: ${as26BatchId || 'all'} | Tally Batch: ${tallyBatchId || 'all'}`);

    // 1. Fetch all unique TANs from tds_dues
    const [duesRows] = await db.execute(
      'SELECT id, UPPER(TRIM(tan_no)) as tan, tds, company_name FROM tds_dues WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ""'
    );
    const duesMap = new Map();
    duesRows.forEach(r => duesMap.set(r.tan, r));

    // 2. Fetch sums for 26AS grouped by TAN
    const [as26Rows] = await db.execute(
      `SELECT UPPER(TRIM(tan_no)) as tan, MAX(deductor_name) as company_name, SUM(tds_deducted) as total, MAX(upload_batch_id) as batch_id 
       FROM tds_26as_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != "" 
       GROUP BY UPPER(TRIM(tan_no))`
    );
    const as26Map = new Map();
    as26Rows.forEach(r => as26Map.set(r.tan, { total: parseFloat(r.total || 0), batchId: r.batch_id, companyName: r.company_name }));

    // 3. Fetch sums for Tally grouped by TAN
    const [tallyRows] = await db.execute(
      `SELECT UPPER(TRIM(tan_no)) as tan, MAX(party_name) as company_name, SUM(tds_amount) as total, MAX(upload_batch_id) as batch_id 
       FROM tds_tally_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != "" 
       GROUP BY UPPER(TRIM(tan_no))`
    );
    const tallyMap = new Map();
    tallyRows.forEach(r => tallyMap.set(r.tan, { total: parseFloat(r.total || 0), batchId: r.batch_id, companyName: r.company_name }));

    // Collect all unique TANs across all 3 datasets
    const allTans = new Set([
      ...duesMap.keys(),
      ...as26Map.keys(),
      ...tallyMap.keys()
    ]);

    if (allTans.size === 0) {
      console.log('⚠️ No data entries found across dues, 26AS, or Tally. Reconciliation finished with 0 records.');
      return { success: true, count: 0 };
    }

    let processedCount = 0;

    for (const tan of allTans) {
      // 4. Ensure a due entry exists for this TAN
      let due = duesMap.get(tan);
      if (!due) {
        const companyName = as26Map.get(tan)?.companyName || tallyMap.get(tan)?.companyName || `Entity ${tan}`;
        const [insertRes] = await db.execute(
          'INSERT INTO tds_dues (tan_no, company_name, tds) VALUES (?, ?, 0.00)',
          [tan, companyName]
        );
        due = { id: insertRes.insertId, tan, tds: 0.00, company_name: companyName };
        duesMap.set(tan, due);
      }

      const booksTds = parseFloat(due.tds || 0);

      // Check existing reconciliation record
      const [existingRows] = await db.execute(
        'SELECT id, is_manually_edited, as26_batch_id, tally_batch_id FROM tds_reconciliation_results WHERE tds_dues_id = ? OR UPPER(TRIM(tan_no)) = ?',
        [due.id, tan]
      );
      const existing = existingRows[0] || {};

      if (existing.is_manually_edited) {
        continue; // Respect manual overrides
      }

      const as26Data = as26Map.get(tan);
      const as26Tds = as26Data ? as26Data.total : 0;
      const finalAs26BatchId = as26Data ? as26Data.batchId : (existing.as26_batch_id || null);

      const tallyData = tallyMap.get(tan);
      const tallyTds = tallyData ? tallyData.total : 0;
      const finalTallyBatchId = tallyData ? tallyData.batchId : (existing.tally_batch_id || null);

      const has26as = finalAs26BatchId !== null || as26Tds > 0;
      const hasTally = finalTallyBatchId !== null || tallyTds > 0;

      // Pairwise evaluate helper
      const evaluatePair = (valA, valB, hasA, hasB) => {
        if (!hasA || !hasB) return 'Not Received';
        if (Math.abs(valA - valB) <= 1.0) return 'Matched';
        if (valA > valB) return 'Excess';
        return 'Less Paid';
      };

      const booksVs26as = evaluatePair(as26Tds, booksTds, has26as, true);
      const booksVsTally = evaluatePair(tallyTds, booksTds, hasTally, true);
      const as26VsTally = evaluatePair(tallyTds, as26Tds, hasTally, has26as);

      let overallStatus = 'All Matched';
      if (!has26as || !hasTally) {
        overallStatus = 'Major Mismatch';
      } else {
        const offCount = [booksVs26as, booksVsTally, as26VsTally].filter(s => s !== 'Matched').length;
        if (offCount === 0) overallStatus = 'All Matched';
        else if (offCount === 1) overallStatus = 'Partial Mismatch';
        else overallStatus = 'Major Mismatch';
      }

      if (existing.id) {
        await db.execute(
          `UPDATE tds_reconciliation_results 
           SET tan_no = ?, books_tds = ?, as26_tds = ?, tally_tds = ?, 
               books_vs_26as_status = ?, books_vs_tally_status = ?, as26_vs_tally_status = ?, 
               overall_status = ?, as26_batch_id = ?, tally_batch_id = ?
           WHERE id = ?`,
          [
            tan, booksTds, as26Tds, tallyTds,
            booksVs26as, booksVsTally, as26VsTally,
            overallStatus, finalAs26BatchId, finalTallyBatchId,
            existing.id
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

    console.log(`✅ Three-way reconciliation completed. Processed ${processedCount} TAN entities.`);
    return { success: true, count: processedCount };

  } catch (error) {
    console.error('❌ Error during three-way reconciliation:', error);
    throw error;
  }
}

export default {
  reconcile
};
