/**
 * backfill_financial_year.js
 * One-off script: resets financial_year = 'FY 2024-25' rows that were
 * stamp-corrupted by the old seed_embedded_dataset.js startup migration.
 *
 * Strategy:
 *  1. Identify rows in tds_reconciliation_results where financial_year = 'FY 2024-25'
 *     AND whose as26_batch_id / tally_batch_id does NOT appear in upload_history
 *     with financial_year = 'FY 2024-25' metadata (i.e. no real upload from that year
 *     supports the stamp).
 *  2. For those rows, try to re-derive the correct FY from tds_dues.bill_date.
 *  3. Whatever cannot be positively re-derived → reset to NULL.
 *
 * Run: node backfill_financial_year.js
 */

import db from './config/db.js';

function dateToFy(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY ${year - 1}-${String(year).slice(-2)}`;
  }
}

async function main() {
  console.log('=== backfill_financial_year.js ===\n');

  // 1. Count current state
  const [before] = await db.execute(
    `SELECT financial_year, COUNT(*) as count FROM tds_reconciliation_results GROUP BY financial_year`
  );
  console.log('BEFORE reconciliation_results financial_year distribution:');
  before.forEach(r => console.log(`  ${r.financial_year || 'NULL'}: ${r.count}`));

  const [beforeDues] = await db.execute(
    `SELECT financial_year, COUNT(*) as count FROM tds_dues GROUP BY financial_year`
  );
  console.log('\nBEFORE tds_dues financial_year distribution:');
  beforeDues.forEach(r => console.log(`  ${r.financial_year || 'NULL'}: ${r.count}`));

  // 2. Find batch IDs that legitimately belong to FY 2024-25 (from upload_history metadata)
  const [histRows] = await db.execute(`SELECT metadata FROM upload_history`);
  const legitimateBatches = new Set();
  for (const row of histRows) {
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      if (meta && meta.financial_year === 'FY 2024-25') {
        if (meta.upload_batch_id) legitimateBatches.add(meta.upload_batch_id);
      }
    } catch (_) {}
  }
  console.log(`\nLegitimate FY 2024-25 batch IDs from upload_history: ${legitimateBatches.size}`);
  if (legitimateBatches.size > 0) {
    console.log(' ', Array.from(legitimateBatches).join(', '));
  }

  // 3. Fetch all rows stamped 'FY 2024-25' in reconciliation results
  const [stamped] = await db.execute(
    `SELECT tr.id, tr.as26_batch_id, tr.tally_batch_id, tr.tds_dues_id, d.bill_date, d.financial_year as due_fy
     FROM tds_reconciliation_results tr
     LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
     WHERE tr.financial_year = 'FY 2024-25'`
  );
  console.log(`\nRows stamped 'FY 2024-25' in tds_reconciliation_results: ${stamped.length}`);

  let correctedToBillDate = 0;
  let correctedToDueFy = 0;
  let resetToNull = 0;
  let leftAlone = 0;

  for (const row of stamped) {
    const isLegitimate =
      (row.as26_batch_id && legitimateBatches.has(row.as26_batch_id)) ||
      (row.tally_batch_id && legitimateBatches.has(row.tally_batch_id));

    if (isLegitimate) {
      leftAlone++;
      continue; // This row is genuinely FY 2024-25
    }

    // Try to derive FY from due.bill_date
    const derivedFromBillDate = dateToFy(row.bill_date);
    if (derivedFromBillDate && derivedFromBillDate !== 'FY 2024-25') {
      await db.execute(
        `UPDATE tds_reconciliation_results SET financial_year = ? WHERE id = ?`,
        [derivedFromBillDate, row.id]
      );
      correctedToBillDate++;
      continue;
    }

    // Try due.financial_year (if it's not also corrupted)
    if (row.due_fy && row.due_fy !== 'FY 2024-25' && row.due_fy !== 'All Financial Years') {
      await db.execute(
        `UPDATE tds_reconciliation_results SET financial_year = ? WHERE id = ?`,
        [row.due_fy, row.id]
      );
      correctedToDueFy++;
      continue;
    }

    // Cannot derive — reset to NULL
    await db.execute(
      `UPDATE tds_reconciliation_results SET financial_year = NULL WHERE id = ?`,
      [row.id]
    );
    resetToNull++;
  }

  console.log(`\nReconciliation results actions:`);
  console.log(`  Left alone (legitimate FY 2024-25): ${leftAlone}`);
  console.log(`  Corrected from bill_date: ${correctedToBillDate}`);
  console.log(`  Corrected from due.financial_year: ${correctedToDueFy}`);
  console.log(`  Reset to NULL (unknown origin): ${resetToNull}`);

  // 4. Same for tds_dues
  const [stampedDues] = await db.execute(
    `SELECT id, bill_date FROM tds_dues WHERE financial_year = 'FY 2024-25'`
  );
  console.log(`\nRows stamped 'FY 2024-25' in tds_dues: ${stampedDues.length}`);

  let duesCorrected = 0;
  let duesReset = 0;

  for (const row of stampedDues) {
    const derivedFy = dateToFy(row.bill_date);
    if (derivedFy && derivedFy !== 'FY 2024-25') {
      await db.execute(`UPDATE tds_dues SET financial_year = ? WHERE id = ?`, [derivedFy, row.id]);
      duesCorrected++;
    } else {
      await db.execute(`UPDATE tds_dues SET financial_year = NULL WHERE id = ?`, [row.id]);
      duesReset++;
    }
  }

  console.log(`tds_dues actions:`);
  console.log(`  Corrected from bill_date: ${duesCorrected}`);
  console.log(`  Reset to NULL: ${duesReset}`);

  // 5. Final count
  const [after] = await db.execute(
    `SELECT financial_year, COUNT(*) as count FROM tds_reconciliation_results GROUP BY financial_year`
  );
  console.log('\nAFTER reconciliation_results financial_year distribution:');
  after.forEach(r => console.log(`  ${r.financial_year || 'NULL'}: ${r.count}`));

  const [afterDues] = await db.execute(
    `SELECT financial_year, COUNT(*) as count FROM tds_dues GROUP BY financial_year`
  );
  console.log('\nAFTER tds_dues financial_year distribution:');
  afterDues.forEach(r => console.log(`  ${r.financial_year || 'NULL'}: ${r.count}`));

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Backfill failed:', err);
  process.exit(1);
});
