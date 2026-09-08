import db from './config/db.js';
async function run() {
  const [[{cnt}]] = await db.execute(`
    SELECT COUNT(*) as cnt
    FROM tds_reconciliation_results tr
    LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
    WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
      AND (COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)
      AND (
        tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10
        OR tr.tan_no LIKE 'NO_TAN_%' OR tr.tan_no LIKE '%UNKNOWN%'
        OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = ''
      )
      AND tr.tan_no NOT IN ('COMPANYNAME', 'TANNO', 'TAN_NO', 'PANNO', 'TAN')
      AND UPPER(COALESCE(d.company_name, '')) NOT IN ('UNKNOWN CLIENT', 'COMPANYNAME')
  `);
  console.log('Cleaning queue count (CSV-only, no CRM):', cnt);
  process.exit(0);
}
run();
