import db from '../config/db.js';

export const cleanNameTokens = (name) => {
  if (!name) return '';
  return String(name)
    .toUpperCase()
    .replace(/PRIVATE\s+LIMITED/gi, ' ')
    .replace(/PVT\.?\s*LTD\.?/gi, ' ')
    .replace(/LIMITED/gi, ' ')
    .replace(/LTD\.?/gi, ' ')
    .replace(/LLP/gi, ' ')
    .replace(/INCORPORATED|INC\.?/gi, ' ')
    .replace(/CORP(\.|ORATION)?/gi, ' ')
    .replace(/\b(THE|FOR|OF|AND|&|AN|IN|TO)\b/gi, ' ')
    .replace(/[^A-Z0-9]/gi, '')
    .trim();
};

export const extractAliases = (name) => {
  if (!name) return [];
  const aliases = new Set();
  const raw = String(name).toUpperCase().trim();
  const clean = cleanNameTokens(raw);
  if (clean) aliases.add(clean);

  const match = raw.match(/\((.*?)\)/);
  if (match && match[1]) {
    const sub = cleanNameTokens(match[1]);
    if (sub) aliases.add(sub);
  }
  const beforeParen = raw.replace(/\(.*?\)/g, '').trim();
  if (beforeParen) {
    const sub = cleanNameTokens(beforeParen);
    if (sub) aliases.add(sub);
  }
  if (raw.includes('/')) {
    raw.split('/').forEach(part => {
      const sub = cleanNameTokens(part);
      if (sub) aliases.add(sub);
    });
  }

  return Array.from(aliases).filter(a => a && a.length >= 3);
};

/**
 * Perform three-way reconciliation for a given 26AS and/or Tally upload batch
 * Grouped per (tan_no, financial_year)
 * @param {string|null} as26BatchId - The upload batch ID for 26AS entries
 * @param {string|null} tallyBatchId - The upload batch ID for Tally entries
 */
export async function reconcile(as26BatchId = null, tallyBatchId = null) {
  try {
    console.log(`🔄 Running 3-way reconciliation by (tan, financial_year). 26AS Batch: ${as26BatchId || 'all'} | Tally Batch: ${tallyBatchId || 'all'}`);

    const makeKey = (tan, fy) => `${(tan || '').toUpperCase().trim()}|${(fy || '').toUpperCase().trim()}`;

    // Pre-build knowledge base of TANs across 26AS, Tally, and existing Dues
    const [as26TanRows] = await db.query("SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(deductor_name)) as name FROM tds_26as_entries WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''");
    const [tallyTanRows] = await db.query("SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(party_name)) as name, UPPER(TRIM(pan_no)) as pan_no FROM tds_tally_entries WHERE tan_no IS NOT NULL AND TRIM(tan_no) != ''");
    const [duesWithTan] = await db.query("SELECT DISTINCT UPPER(TRIM(tan_no)) as tan_no, UPPER(TRIM(company_name)) as name, UPPER(TRIM(pan_no)) as pan_no FROM tds_dues WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' AND tan_no NOT LIKE 'NO_TAN_%'");

    const tanByPan = new Map();
    const tanByAlias = new Map();

    const registerTan = (tan, name, pan) => {
      if (!tan || tan.length < 10 || tan.startsWith('NO_TAN_')) return;
      const cleanTan = tan.toUpperCase().trim();
      if (pan && pan.length === 10 && !tanByPan.has(pan)) tanByPan.set(pan.toUpperCase().trim(), cleanTan);
      extractAliases(name).forEach(a => {
        if (!tanByAlias.has(a)) tanByAlias.set(a, cleanTan);
      });
    };

    duesWithTan.forEach(r => registerTan(r.tan_no, r.name, r.pan_no));
    tallyTanRows.forEach(r => registerTan(r.tan_no, r.name, r.pan_no));
    as26TanRows.forEach(r => registerTan(r.tan_no, r.name, null));

    // Resolve any unpopulated TANs in tds_dues using PAN and Aliases
    const [unresolvedDues] = await db.query(
      `SELECT id, company_name, pan_no, gst_num, financial_year, tds 
       FROM tds_dues 
       WHERE tan_no IS NULL OR TRIM(tan_no) = '' OR tan_no LIKE 'NO_TAN_%'`
    );

    const duesToUpdateTan = [];
    const resolvedDuesList = [];
    const unresolvedGroupMap = new Map();

    for (const row of unresolvedDues) {
      const pan = row.pan_no ? row.pan_no.toUpperCase().trim() : (row.gst_num && row.gst_num.length >= 12 ? row.gst_num.substring(2, 12).toUpperCase().trim() : null);
      let resolved = pan ? tanByPan.get(pan) : null;
      if (!resolved) {
        for (const a of extractAliases(row.company_name)) {
          if (tanByAlias.has(a)) {
            resolved = tanByAlias.get(a);
            break;
          }
        }
      }

      const fy = row.financial_year ? row.financial_year.trim() : null;
      const tdsVal = parseFloat(row.tds || 0);

      if (resolved) {
        duesToUpdateTan.push({ id: row.id, tan: resolved });
        resolvedDuesList.push({
          id: row.id,
          tan: resolved,
          financial_year: fy,
          tds: tdsVal,
          company_name: row.company_name
        });
      } else {
        // Group unresolved rows by (cleanNameTokens(company_name), financial_year) to prevent duplicates
        const normKey = `${cleanNameTokens(row.company_name) || 'ENTITY'}|${fy || ''}`;
        if (!unresolvedGroupMap.has(normKey)) {
          unresolvedGroupMap.set(normKey, {
            id: row.id,
            tan: `NO_TAN_${cleanNameTokens(row.company_name) || row.id}`,
            financial_year: fy,
            tds: 0,
            company_name: row.company_name || 'Client Entity'
          });
        }
        unresolvedGroupMap.get(normKey).tds += tdsVal;
      }
    }

    // Persist resolved TANs back to tds_dues in background
    if (duesToUpdateTan.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < duesToUpdateTan.length; i += BATCH) {
        const chunk = duesToUpdateTan.slice(i, i + BATCH);
        Promise.all(chunk.map(u => db.query("UPDATE tds_dues SET tan_no = ? WHERE id = ?", [u.tan, u.id]))).catch(() => {});
      }
    }

    // 1. Fetch rows from tds_dues grouped by (tan_no, financial_year)
    const [groupedDuesRows] = await db.query(
      `SELECT 
         MAX(id) as id, 
         UPPER(TRIM(tan_no)) as tan, 
         financial_year,
         SUM(COALESCE(tds, 0)) as tds, 
         MAX(company_name) as company_name
       FROM tds_dues 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' AND tan_no NOT LIKE 'NO_TAN_%'
       GROUP BY UPPER(TRIM(tan_no)), financial_year`
    );

    // Merge resolved dues into grouped rows
    const allDuesGroupMap = new Map();
    for (const r of [...groupedDuesRows, ...resolvedDuesList]) {
      const k = makeKey(r.tan, r.financial_year);
      if (!allDuesGroupMap.has(k)) {
        allDuesGroupMap.set(k, {
          id: r.id,
          tan: r.tan.toUpperCase().trim(),
          financial_year: r.financial_year ? r.financial_year.trim() : null,
          tds: 0,
          company_name: r.company_name || 'Client Entity'
        });
      }
      allDuesGroupMap.get(k).tds += parseFloat(r.tds || 0);
    }

    const duesList = [
      ...Array.from(allDuesGroupMap.values()),
      ...Array.from(unresolvedGroupMap.values())
    ];

    // 2. Fetch sums for 26AS grouped by (tan_no, financial_year)
    const [as26Rows] = await db.query(
      `SELECT 
         UPPER(TRIM(tan_no)) as tan, 
         financial_year,
         MAX(deductor_name) as company_name, 
         SUM(tds_deducted) as total, 
         MAX(upload_batch_id) as batch_id 
       FROM tds_26as_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' 
       GROUP BY UPPER(TRIM(tan_no)), financial_year`
    );
    const as26Map = new Map();
    as26Rows.forEach(r => {
      const fy = r.financial_year ? r.financial_year.trim() : null;
      as26Map.set(makeKey(r.tan, fy), {
        tan: r.tan,
        financial_year: fy,
        total: parseFloat(r.total || 0),
        batchId: r.batch_id,
        companyName: r.company_name
      });
    });

    // 3. Fetch sums for Tally grouped by (tan_no, financial_year)
    const [tallyRows] = await db.query(
      `SELECT 
         UPPER(TRIM(tan_no)) as tan, 
         financial_year,
         MAX(party_name) as company_name, 
         SUM(tds_amount) as total, 
         MAX(upload_batch_id) as batch_id 
       FROM tds_tally_entries 
       WHERE tan_no IS NOT NULL AND TRIM(tan_no) != '' 
       GROUP BY UPPER(TRIM(tan_no)), financial_year`
    );
    const tallyMap = new Map();
    tallyRows.forEach(r => {
      const fy = r.financial_year ? r.financial_year.trim() : null;
      tallyMap.set(makeKey(r.tan, fy), {
        tan: r.tan,
        financial_year: fy,
        total: parseFloat(r.total || 0),
        batchId: r.batch_id,
        companyName: r.company_name
      });
    });

    // Ensure all orphan (TAN, FY) from 26AS / Tally also exist in duesList
    const existingDuesKeys = new Set(duesList.map(d => makeKey(d.tan, d.financial_year)));
    const allExternalKeys = new Set([...as26Map.keys(), ...tallyMap.keys()]);

    const orphanItems = [];
    for (const key of allExternalKeys) {
      if (!existingDuesKeys.has(key)) {
        const ext = as26Map.get(key) || tallyMap.get(key);
        if (ext && ext.tan) {
          orphanItems.push({
            tan: ext.tan,
            companyName: ext.companyName || `Entity ${ext.tan}`,
            financial_year: ext.financial_year || null
          });
        }
      }
    }

    if (orphanItems.length > 0) {
      const ORPHAN_CHUNK = 200;
      for (let i = 0; i < orphanItems.length; i += ORPHAN_CHUNK) {
        const chunk = orphanItems.slice(i, i + ORPHAN_CHUNK);
        const placeholders = chunk.map(() => '(?, ?, 0.00, ?)').join(', ');
        const params = [];
        for (const item of chunk) {
          params.push(item.tan, item.companyName, item.financial_year);
        }
        await db.execute(
          `INSERT INTO tds_dues (tan_no, company_name, tds, financial_year) VALUES ${placeholders}`,
          params
        );
      }

      // Fetch the real IDs assigned by MySQL for the newly inserted orphans
      const [newDuesRows] = await db.query(
        'SELECT id, UPPER(TRIM(tan_no)) as tan_no, financial_year, company_name FROM tds_dues WHERE tan_no IN (' +
        orphanItems.map(() => '?').join(',') + ')',
        orphanItems.map(item => item.tan)
      );
      const newDuesMap = new Map();
      (newDuesRows || []).forEach(r => {
        newDuesMap.set(makeKey(r.tan_no, r.financial_year), r);
      });

      // Add newly inserted orphans to duesList with their real IDs
      for (const item of orphanItems) {
        const matchedDue = newDuesMap.get(makeKey(item.tan, item.financial_year));
        duesList.push({
          id: matchedDue ? matchedDue.id : 0,
          tan: item.tan,
          tds: 0.00,
          company_name: item.companyName,
          financial_year: item.financial_year
        });
        existingDuesKeys.add(makeKey(item.tan, item.financial_year));
      }
    }

    if (duesList.length === 0) {
      console.log('⚠️ No data entries found across dues, 26AS, or Tally. Reconciliation finished with 0 records.');
      return { success: true, count: 0 };
    }

    // Clean up obsolete NO_TAN rows in tds_reconciliation_results where dues now have real TANs
    try {
      await db.execute(`
        DELETE tr FROM tds_reconciliation_results tr
        INNER JOIN tds_dues d ON tr.tds_dues_id = d.id
        WHERE tr.tan_no LIKE 'NO_TAN_%' 
          AND d.tan_no IS NOT NULL AND d.tan_no != '' AND d.tan_no NOT LIKE 'NO_TAN_%'
      `);
    } catch (cleanErr) {
      console.warn('Ghost cleanup warning:', cleanErr.message);
    }

    const [recRows] = await db.query(
      'SELECT id, tds_dues_id, UPPER(TRIM(tan_no)) as tan_no, financial_year, is_manually_edited, as26_batch_id, tally_batch_id FROM tds_reconciliation_results'
    );
    const existingByTanFy = new Map();
    (recRows || []).forEach(r => {
      if (r.tan_no) {
        existingByTanFy.set(makeKey(r.tan_no, r.financial_year), r);
      }
    });

    const ghostIdsToDelete = [];
    const updatesList = [];
    const insertsList = [];

    for (const due of duesList) {
      try {
        const dueId = due.id ? parseInt(due.id) : 0;
        const tan = due.tan || `NO_TAN_${dueId}`;
        const financialYear = due.financial_year || null;
        const compositeKey = makeKey(tan, financialYear);
        const booksTds = due.tds;

        // Check existing reconciliation record by (tan_no, financial_year)
        const existing = existingByTanFy.get(compositeKey);

        if (existing && existing.is_manually_edited) {
          continue; // Respect manual overrides
        }

        const as26Data = as26Map.get(compositeKey) || null;
        const as26Tds = as26Data ? as26Data.total : 0;
        const finalAs26BatchId = as26Data ? as26Data.batchId : (existing ? existing.as26_batch_id : null);

        const tallyData = tallyMap.get(compositeKey) || null;
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
           as26_batch_id = COALESCE(VALUES(as26_batch_id), tds_reconciliation_results.as26_batch_id),
           tally_batch_id = COALESCE(VALUES(tally_batch_id), tds_reconciliation_results.tally_batch_id),
           financial_year = VALUES(financial_year)`,
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
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           tds_dues_id = COALESCE(NULLIF(VALUES(tds_dues_id), 0), tds_dues_id),
           books_tds = VALUES(books_tds),
           as26_tds = VALUES(as26_tds),
           tally_tds = VALUES(tally_tds),
           books_vs_26as_status = VALUES(books_vs_26as_status),
           books_vs_tally_status = VALUES(books_vs_tally_status),
           as26_vs_tally_status = VALUES(as26_vs_tally_status),
           overall_status = VALUES(overall_status),
           as26_batch_id = COALESCE(VALUES(as26_batch_id), tds_reconciliation_results.as26_batch_id),
           tally_batch_id = COALESCE(VALUES(tally_batch_id), tds_reconciliation_results.tally_batch_id),
           financial_year = VALUES(financial_year)`,
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
