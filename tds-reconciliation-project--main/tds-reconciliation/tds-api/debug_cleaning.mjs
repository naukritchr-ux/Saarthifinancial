import db from './config/db.js';
async function run() {
  // Total tds in tds_dues
  const [[s]] = await db.execute(`SELECT SUM(tds) as total, COUNT(*) as cnt, SUM(CASE WHEN tds > 0 THEN 1 ELSE 0 END) as with_tds FROM tds_dues`);
  console.log('tds_dues.tds column — total:', s.total, '| rows with tds > 0:', s.with_tds, '/ total:', s.cnt);

  // Check what the reconciliation service writes into books_tds
  // Look at how it builds the reconciliation row
  const [recs] = await db.execute(`
    SELECT tr.id, tr.tan_no, tr.books_tds, tr.as26_tds, tr.tally_tds, tr.tds_dues_id,
           d.tds as dues_tds, d.company_name
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    WHERE tr.tds_dues_id IS NOT NULL
    LIMIT 5
  `);
  console.log('\nSample recs with linked dues:');
  recs.forEach(r => console.log(`  rec.books_tds=${r.books_tds} | dues.tds=${r.dues_tds} | company=${r.company_name}`));

  // Check what the reconciliation service writes from tds_dues
  // Look for any rows in tds_reconciliation_results that have tds_dues_id != null
  const [[linkStats]] = await db.execute(`
    SELECT COUNT(*) as with_link, 
           SUM(CASE WHEN tds_dues_id IS NULL THEN 1 ELSE 0 END) as without_link
    FROM tds_reconciliation_results
  `);
  console.log('\nRecs with tds_dues_id:', with_link, '| without:', without_link);

  process.exit(0);
}
run();
