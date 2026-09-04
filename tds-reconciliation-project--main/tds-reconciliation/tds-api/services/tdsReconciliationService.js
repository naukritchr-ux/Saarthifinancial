import db from '../config/db.js';

/**
 * Perform three-way reconciliation for a given 26AS and/or Tally upload batch
 * @param {string|null} as26BatchId - The upload batch ID for 26AS entries
 * @param {string|null} tallyBatchId - The upload batch ID for Tally entries
 */
export async function reconcile(as26BatchId = null, tallyBatchId = null) {
  try {
    console.log(`🔄 Running 3-way reconciliation. 26AS Batch: ${as26BatchId || 'all'} | Tally Batch: ${tallyBatchId || 'all'}`);

    // 1. Fetch rows from tds_dues grouped by TAN to prevent duplicate TAN records
    const [groupedDuesRows] = await db.query(
      `SELECT 
         MAX(id) as id, 
         UPPER(TRIM(tan_no)) as tan, 
         SUM(COALESCE(tds, 0)) as tds, 
         MAX(company_name) as company_name 
       FROM tds_dues 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
       GROUP BY UPPER(TRIM(tan_no))`
    );

    const [unnamedDuesRows] = await db.query(
      `SELECT id, '' as tan, COALESCE(tds, 0) as tds, company_name 
       FROM tds_dues 
       WHERE tan_no IS NULL OR TRIM(tan_no) = ''`
    );

    const duesRows = [...groupedDuesRows, ...unnamedDuesRows];
    const duesList = duesRows.map(r => ({
      id: r.id,
      tan: (r.tan || '').trim().toUpperCase(),
      tds: parseFloat(r.tds || 0),
      company_name: r.company_name || 'Client Entity'
    }));

    // 2. Fetch sums for 26AS grouped by TAN
    const [as26Rows] = await db.query(
      `SELECT UPPER(TRIM(tan_no)) as tan, MAX(deductor_name) as company_name, SUM(tds_deducted) as total, MAX(upload_batch_id) as batch_id 
       FROM tds_26as_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' 
       GROUP BY UPPER(TRIM(tan_no))`
    );
    const as26Map = new Map();
    as26Rows.forEach(r => as26Map.set(r.tan, { total: parseFloat(r.total || 0), batchId: r.batch_id, companyName: r.company_name }));

    // 3. Fetch sums for Tally grouped by TAN
    const [tallyRows] = await db.query(
      `SELECT UPPER(TRIM(tan_no)) as tan, MAX(party_name) as company_name, SUM(tds_amount) as total, MAX(upload_batch_id) as batch_id 
       FROM tds_tally_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' 
       GROUP BY UPPER(TRIM(tan_no))`
    );
    const tallyMap = new Map();
    tallyRows.forEach(r => tallyMap.set(r.tan, { total: parseFloat(r.total || 0), batchId: r.batch_id, companyName: r.company_name }));

    // Ensure all orphan TANs from 26AS / Tally also exist in duesList
    const existingDuesTans = new Set(duesList.map(d => d.tan).filter(Boolean));
    const allExternalTans = new Set([...as26Map.keys(), ...tallyMap.keys()]);

    for (const extTan of allExternalTans) {
      if (!existingDuesTans.has(extTan)) {
        const companyName = as26Map.get(extTan)?.companyName || tallyMap.get(extTan)?.companyName || `Entity ${extTan}`;
        const [insertRes] = await db.execute(
          'INSERT INTO tds_dues (tan_no, company_name, tds, financial_year) VALUES (?, ?, 0.00, NULL)',
          [extTan, companyName]
        );
        const newId = insertRes?.insertId || insertRes?.lastInsertRowid || insertRes?.id;
        if (newId) {
          duesList.push({
            id: newId,
            tan: extTan,
            tds: 0.00,
            company_name: companyName
          });
          existingDuesTans.add(extTan);
        }
      }
    }

    if (duesList.length === 0) {
      console.log('⚠️ No data entries found across dues, 26AS, or Tally. Reconciliation finished with 0 records.');
      return { success: true, count: 0 };
    }

    let processedCount = 0;

    const [recRows] = await db.query(
      'SELECT id, tds_dues_id, UPPER(TRIM(tan_no)) as tan_no, is_manually_edited, as26_batch_id, tally_batch_id FROM tds_reconciliation_results'
    );
    const existingByDuesId = new Map();
    const existingByTan = new Map();
    (recRows || []).forEach(r => {
      if (r.tds_dues_id) existingByDuesId.set(r.tds_dues_id, r);
      if (r.tan_no) existingByTan.set(r.tan_no, r);
    });

    for (const due of duesList) {
      try {
        const dueId = due.id ? parseInt(due.id) : 0;
        const tan = due.tan || `NO_TAN_${dueId}`;
        const booksTds = due.tds;

        // Check existing reconciliation record by tds_dues_id or tan_no
        let existing = (dueId > 0 ? existingByDuesId.get(dueId) : null) || (tan ? existingByTan.get(tan.toUpperCase()) : null);

        if (existing && existing.is_manually_edited) {
          continue; // Respect manual overrides
        }

        const as26Data = due.tan ? as26Map.get(due.tan) : null;
        const as26Tds = as26Data ? as26Data.total : 0;
        const finalAs26BatchId = as26Data ? as26Data.batchId : (existing ? existing.as26_batch_id : null);

        const tallyData = due.tan ? tallyMap.get(due.tan) : null;
        const tallyTds = tallyData ? tallyData.total : 0;
        const finalTallyBatchId = tallyData ? tallyData.batchId : (existing ? existing.tally_batch_id : null);

        // Skip inserting or updating ghost rows if ALL 3 sources have zero TDS
        const totalTdsSum = booksTds + as26Tds + tallyTds;
        if (totalTdsSum === 0 && (!due.tan || due.tan.startsWith('NO_TAN_'))) {
          if (existing && existing.id && !existing.is_manually_edited) {
            await db.execute('DELETE FROM tds_reconciliation_results WHERE id = ?', [existing.id]);
          }
          continue;
        }

        const has26as = finalAs26BatchId !== null || as26Tds > 0;
        const hasTally = finalTallyBatchId !== null || tallyTds > 0;
        const hasSaarthi = booksTds > 0;

        // Pairwise evaluate helper
        const evaluatePair = (valA, valB, hasA, hasB) => {
          if (!hasA || !hasB || valA <= 0 || valB <= 0) return 'Not Received';
          if (Math.abs(valA - valB) <= 1.0) return 'Matched';
          if (valA > valB) return 'Excess';
          return 'Less Paid';
        };

        const booksVs26as = evaluatePair(as26Tds, booksTds, has26as, true);
        const booksVsTally = evaluatePair(tallyTds, booksTds, hasTally, true);
        const as26VsTally = evaluatePair(tallyTds, as26Tds, hasTally, has26as);

        // 3-way status classification
        const activeSourcesCount = [hasSaarthi, hasTally, has26as].filter(Boolean).length;
        let overallStatus = 'Not Received';

        if (activeSourcesCount >= 2) {
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
        } else {
          overallStatus = 'Not Received';
        }

        if (existing && existing.id) {
          await db.execute(
            `UPDATE tds_reconciliation_results 
             SET tds_dues_id = COALESCE(NULLIF(?, 0), tds_dues_id),
                 tan_no = ?, books_tds = ?, as26_tds = ?, tally_tds = ?, 
                 books_vs_26as_status = ?, books_vs_tally_status = ?, as26_vs_tally_status = ?, 
                 overall_status = ?, as26_batch_id = ?, tally_batch_id = ?
             WHERE id = ?`,
            [
              dueId, tan, booksTds, as26Tds, tallyTds,
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
              dueId, tan, booksTds, as26Tds, tallyTds,
              booksVs26as, booksVsTally, as26VsTally,
              overallStatus, finalAs26BatchId, finalTallyBatchId
            ]
          );
        }

        processedCount++;
      } catch (rowErr) {
        console.warn(`⚠️ Skipped reconciliation row ${due.id}:`, rowErr.message);
      }
    }

    console.log(`✅ Three-way reconciliation completed. Processed ${processedCount} records.`);
    return { success: true, count: processedCount };

  } catch (error) {
    console.error('❌ Error during three-way reconciliation:', error);
    throw error;
  }
}

export default {
  reconcile
};
