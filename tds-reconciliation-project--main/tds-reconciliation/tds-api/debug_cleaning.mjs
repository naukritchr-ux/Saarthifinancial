import db from './config/db.js';

async function test() {
  try {
    // Get sample of the 274 genuinely missing items to understand what they are
    const [rows] = await db.execute(`
      SELECT tr.id, tr.tan_no, d.company_name, d.pan_no, d.gst_num, 
             tr.books_tds, tr.as26_tds, tr.tally_tds, tr.financial_year
      FROM tds_reconciliation_results tr
      LEFT JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE (tr.is_manually_edited IS NULL OR tr.is_manually_edited = 0)
        AND (COALESCE(tr.books_tds, 0) > 0 OR COALESCE(tr.as26_tds, 0) > 0 OR COALESCE(tr.tally_tds, 0) > 0)
        AND (tr.tan_no IS NULL OR tr.tan_no = '' OR LENGTH(tr.tan_no) < 10 
          OR tr.tan_no LIKE 'NO_TAN_%' OR tr.tan_no LIKE '%UNKNOWN%'
          OR d.company_name IS NULL OR d.company_name = 'Unknown Company' OR d.company_name = '')
      ORDER BY tr.books_tds DESC
    `);
    
    console.log(`Total genuinely missing: ${rows.length}`);
    
    // Show top ones sorted by books_tds
    const sarthiOnly = rows.filter(r => parseFloat(r.as26_tds) === 0 && parseFloat(r.tally_tds) === 0);
    console.log(`\nSarthi-only (no 26AS, no Tally data) = ${sarthiOnly.length}:`);
    
    // Group by company
    const byCompany = new Map();
    for (const r of sarthiOnly) {
      const co = r.company_name || 'UNKNOWN';
      if (!byCompany.has(co)) byCompany.set(co, { total: 0, count: 0, pan: r.pan_no, gst: r.gst_num });
      const g = byCompany.get(co);
      g.total += parseFloat(r.books_tds || 0);
      g.count++;
    }
    
    // Sort by total descending
    const sorted = Array.from(byCompany.entries()).sort((a, b) => b[1].total - a[1].total);
    console.log('\nTop 20 companies with Sarthi-only data and no TAN anywhere:');
    sorted.slice(0, 20).forEach(([co, info]) => {
      console.log(`  ${co} | PAN:${info.pan || 'N/A'} | GST:${info.gst || 'N/A'} | TDS: ₹${info.total.toFixed(2)} | Rows:${info.count}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

test();
