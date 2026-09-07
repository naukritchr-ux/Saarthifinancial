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
         MAX(company_name) as company_name,
         MAX(financial_year) as financial_year
       FROM tds_dues 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''
       GROUP BY UPPER(TRIM(tan_no))`
    );

    const [unnamedDuesRows] = await db.query(
      `SELECT id, '' as tan, COALESCE(tds, 0) as tds, company_name, financial_year 
       FROM tds_dues 
       WHERE tan_no IS NULL OR TRIM(tan_no) = ''`
    );

    const duesRows = [...groupedDuesRows, ...unnamedDuesRows];
    const duesList = duesRows.map(r => ({
      id: r.id,
      tan: (r.tan || '').trim().toUpperCase(),
      tds: parseFloat(r.tds || 0),
      company_name: r.company_name || 'Client Entity',
      financial_year: r.financial_year || null
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

    const orphanItems = [];
    for (const extTan of allExternalTans) {
      if (!existingDuesTans.has(extTan)) {
        const companyName = as26Map.get(extTan)?.companyName || tallyMap.get(extTan)?.companyName || `Entity ${extTan}`;
        orphanItems.push({ tan: extTan, companyName });
      }
    }

    if (orphanItems.length > 0) {
      const ORPHAN_CHUNK = 200;
      for (let i = 0; i < orphanItems.length; i += ORPHAN_CHUNK) {
        const chunk = orphanItems.slice(i, i + ORPHAN_CHUNK);
        const placeholders = chunk.map(() => '(?, ?, 0.00, NULL)').join(', ');
        const params = [];
        for (const item of chunk) {
          params.push(item.tan, item.companyName);
        }
        await db.execute(
          `INSERT INTO tds_dues (tan_no, company_name, tds, financial_year) VALUES ${placeholders}`,
          params
        );
      }

      // Fetch newly inserted dues to add them to duesList
      const orphanTans = orphanItems.map(o => o.tan);
      for (let i = 0; i < orphanTans.length; i += 200) {
        const chunk = orphanTans.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(', ');
        const [insertedRows] = await db.query(
          `SELECT id, UPPER(TRIM(tan_no)) as tan, company_name FROM tds_dues WHERE UPPER(TRIM(tan_no)) IN (${placeholders})`,
          chunk
        );
        for (const r of insertedRows) {
          duesList.push({
            id: r.id,
            tan: r.tan,
            tds: 0.00,
            company_name: r.company_name
          });
          existingDuesTans.add(r.tan);
        }
      }
    }

    if (duesList.length === 0) {
      console.log('⚠️ No data entries found across dues, 26AS, or Tally. Reconciliation finished with 0 records.');
      return { success: true, count: 0 };
    }

    const [recRows] = await db.query(
      'SELECT id, tds_dues_id, UPPER(TRIM(tan_no)) as tan_no, is_manually_edited, as26_batch_id, tally_batch_id, financial_year FROM tds_reconciliation_results'
    );
    const existingByDuesId = new Map();
    const existingByTan = new Map();
    (recRows || []).forEach(r => {
      if (r.tds_dues_id) existingByDuesId.set(r.tds_dues_id, r);
      if (r.tan_no) existingByTan.set(r.tan_no, r);
    });

    const ghostIdsToDelete = [];
    const updatesList = [];
    const insertsList = [];

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
            ghostIdsToDelete.push(existing.id);
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

        let booksVs26as = evaluatePair(as26Tds, booksTds, has26as, hasSaarthi);
        let booksVsTally = evaluatePair(tallyTds, booksTds, hasTally, hasSaarthi);
        let as26VsTally = evaluatePair(tallyTds, as26Tds, hasTally, has26as);

        // 3-way status classification
        const activeSourcesCount = [hasSaarthi, hasTally, has26as].filter(Boolean).length;
        let overallStatus = 'Not Received';

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
        } else {
          overallStatus = 'Not Received';
        }

        const financialYear = due.financial_year || (existing && existing.financial_year) || null;

        if (existing && existing.id) {
          updatesList.push({
            id: existing.id,
            dueId,
            tan,
            booksTds,
            as26Tds,
            tallyTds,
            booksVs26as,
            booksVsTally,
            as26VsTally,
            overallStatus,
            finalAs26BatchId,
            finalTallyBatchId,
            financialYear
          });
        } else {
          insertsList.push({
            dueId,
            tan,
            booksTds,
            as26Tds,
            tallyTds,
            booksVs26as,
            booksVsTally,
            as26VsTally,
            overallStatus,
            finalAs26BatchId,
            finalTallyBatchId,
            financialYear
          });
        }
      } catch (rowErr) {
        console.warn(`⚠️ Skipped reconciliation preparation for row ${due.id}:`, rowErr.message);
      }
    }

    // 1. Bulk delete ghost records in chunks
    if (ghostIdsToDelete.length > 0) {
      const DEL_CHUNK = 500;
      for (let i = 0; i < ghostIdsToDelete.length; i += DEL_CHUNK) {
        const chunk = ghostIdsToDelete.slice(i, i + DEL_CHUNK);
        await db.execute(
          `DELETE FROM tds_reconciliation_results WHERE id IN (${chunk.map(() => '?').join(', ')})`,
          chunk
        );
      }
    }

    // 2. Bulk upsert updates in chunks
    const UPSERT_CHUNK = 300;
    for (let i = 0; i < updatesList.length; i += UPSERT_CHUNK) {
      const chunk = updatesList.slice(i, i + UPSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const u of chunk) {
        params.push(
          u.id,
          u.dueId,
          u.tan,
          u.booksTds,
          u.as26Tds,
          u.tallyTds,
          u.booksVs26as,
          u.booksVsTally,
          u.as26VsTally,
          u.overallStatus,
          u.finalAs26BatchId,
          u.finalTallyBatchId,
          u.financialYear
        );
      }
      await db.execute(
        `INSERT INTO tds_reconciliation_results 
         (id, tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, 
          books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, 
          overall_status, as26_batch_id, tally_batch_id, financial_year)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE 
           tds_dues_id = COALESCE(NULLIF(VALUES(tds_dues_id), 0), tds_dues_id),
           tan_no = VALUES(tan_no),
           books_tds = VALUES(books_tds),
           as26_tds = VALUES(as26_tds),
           tally_tds = VALUES(tally_tds),
           books_vs_26as_status = VALUES(books_vs_26as_status),
           books_vs_tally_status = VALUES(books_vs_tally_status),
           as26_vs_tally_status = VALUES(as26_vs_tally_status),
           overall_status = VALUES(overall_status),
           as26_batch_id = VALUES(as26_batch_id),
           tally_batch_id = VALUES(tally_batch_id),
           financial_year = COALESCE(NULLIF(VALUES(financial_year), ''), tds_reconciliation_results.financial_year)`,
        params
      );
    }

    // 3. Bulk insert new records in chunks
    const INSERT_CHUNK = 300;
    for (let i = 0; i < insertsList.length; i += INSERT_CHUNK) {
      const chunk = insertsList.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const ins of chunk) {
        params.push(
          ins.dueId,
          ins.tan,
          ins.booksTds,
          ins.as26Tds,
          ins.tallyTds,
          ins.booksVs26as,
          ins.booksVsTally,
          ins.as26VsTally,
          ins.overallStatus,
          ins.finalAs26BatchId,
          ins.finalTallyBatchId,
          ins.financialYear
        );
      }
      await db.execute(
        `INSERT INTO tds_reconciliation_results 
         (tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, 
          books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, 
          overall_status, as26_batch_id, tally_batch_id, financial_year)
         VALUES ${placeholders}`,
        params
      );
    }

    const processedCount = updatesList.length + insertsList.length;

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
