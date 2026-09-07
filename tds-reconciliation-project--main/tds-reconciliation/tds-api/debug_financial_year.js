/**
 * debug_financial_year.js
 *
 * Diagnostic script — checks whether financial_year data actually landed
 * correctly after the reconciliation pipeline fix, or if things are still
 * collapsing into 'Unspecified' / a single hardcoded year.
 *
 * Usage:
 *   1. Drop this file into tds-api/ (same folder as run_reconciliation_manually.js)
 *   2. Run:  node debug_financial_year.js
 *   3. Paste the full output back for review.
 *
 * Reads DB credentials the same way the rest of the app does (via
 * tds-api/config/db.js + your existing .env), so no extra setup needed.
 */

import db from './config/db.js';

const bar = (title) => {
    console.log('\n' + '='.repeat(70));
    console.log(title);
    console.log('='.repeat(70));
};

const printTable = (rows, label) => {
    if (!rows || rows.length === 0) {
        console.log(`  (no rows — ${label} table is empty or query returned nothing)`);
        return;
    }
    let total = 0;
    rows.forEach(r => {
        const fy = r.financial_year === null || r.financial_year === '' ? '(NULL/blank)' : r.financial_year;
        const count = r.count ?? r.cnt ?? 0;
        total += Number(count);
        console.log(`  ${String(fy).padEnd(22)} ${String(count).padStart(8)}`);
    });
    console.log(`  ${'TOTAL'.padEnd(22)} ${String(total).padStart(8)}`);
};

const run = async () => {
    try {
        // ------------------------------------------------------------------
        // 1. Schema check — do the tables actually have financial_year now?
        // ------------------------------------------------------------------
        bar('1. SCHEMA CHECK — financial_year column presence');
        const tablesToCheck = ['tds_dues', 'tds_26as_entries', 'tds_tally_entries', 'tds_reconciliation_results'];
        for (const table of tablesToCheck) {
            try {
                const [cols] = await db.execute(
                    process.env.DB_TYPE === 'sqlite'
                        ? `PRAGMA table_info(${table});`
                        : `SHOW COLUMNS FROM ${table};`
                );
                const colNames = process.env.DB_TYPE === 'sqlite'
                    ? cols.map(c => c.name)
                    : cols.map(c => c.Field);
                const hasFy = colNames.includes('financial_year');
                console.log(`  ${table.padEnd(30)} ${hasFy ? '✅ has financial_year' : '❌ MISSING financial_year'}`);
            } catch (e) {
                console.log(`  ${table.padEnd(30)} ⚠️ could not inspect (${e.message})`);
            }
        }

        // ------------------------------------------------------------------
        // 2. financial_year distribution per table
        // ------------------------------------------------------------------
        bar('2. tds_reconciliation_results — rows per financial_year');
        const [recRows] = await db.execute(
            `SELECT financial_year, COUNT(*) as count FROM tds_reconciliation_results GROUP BY financial_year ORDER BY financial_year`
        );
        printTable(recRows, 'tds_reconciliation_results');

        bar('3. tds_dues — rows per financial_year');
        const [duesRows] = await db.execute(
            `SELECT financial_year, COUNT(*) as count FROM tds_dues GROUP BY financial_year ORDER BY financial_year`
        );
        printTable(duesRows, 'tds_dues');

        bar('4. tds_26as_entries — rows per financial_year');
        const [as26Rows] = await db.execute(
            `SELECT financial_year, COUNT(*) as count FROM tds_26as_entries GROUP BY financial_year ORDER BY financial_year`
        );
        printTable(as26Rows, 'tds_26as_entries');

        bar('5. tds_tally_entries — rows per financial_year');
        const [tallyRows] = await db.execute(
            `SELECT financial_year, COUNT(*) as count FROM tds_tally_entries GROUP BY financial_year ORDER BY financial_year`
        );
        printTable(tallyRows, 'tds_tally_entries');

        // ------------------------------------------------------------------
        // 3. Sanity check — does one company now have multiple year-rows?
        //    (Confirms per-(tan, fy) grouping is actually working, not just
        //    that a financial_year column exists.)
        // ------------------------------------------------------------------
        bar('6. Spot check — TANs with more than one financial_year row');
        console.log('  (If the pipeline is working, companies with multi-year data should');
        console.log('   show up here with 2+ rows. If this is empty, everything is still');
        console.log('   collapsing to one row per TAN regardless of year.)\n');
        const [multiYearTans] = await db.execute(`
      SELECT tan_no, COUNT(*) as fy_count, GROUP_CONCAT(financial_year SEPARATOR ', ') as years
      FROM tds_reconciliation_results
      WHERE tan_no IS NOT NULL AND tan_no != ''
      GROUP BY tan_no
      HAVING COUNT(*) > 1
      ORDER BY fy_count DESC
      LIMIT 15
    `);
        if (multiYearTans.length === 0) {
            console.log('  ⚠️  No TAN has more than 1 row — either data hasn\'t been rebuilt yet,');
            console.log('      or every company genuinely only has one year of data.');
        } else {
            multiYearTans.forEach(r => {
                console.log(`  ${r.tan_no.padEnd(15)} ${String(r.fy_count).padStart(3)} rows   [${r.years}]`);
            });
        }

        // ------------------------------------------------------------------
        // 4. Expected vs actual — compare against the known source-file counts
        // ------------------------------------------------------------------
        bar('7. Expected reference counts (from the uploaded source Excel files)');
        console.log('  26AS file:  2019-20: 717   2020-21: 457   2021-22: 960');
        console.log('              2022-23: 1208  2023-24: 604   2024-25: 931');
        console.log('  Tally file: 2019-20: 549   2020-21: 323   2021-22: 787');
        console.log('              2022-23: 1081  2023-24: 1082');
        console.log('\n  Compare these against sections 4 and 5 above. If tds_26as_entries /');
        console.log('  tds_tally_entries counts don\'t roughly match, the source files still');
        console.log('  need to be (re-)imported through the fixed pipeline.');

        bar('DONE');
        console.log('Copy everything above this line and share it for review.\n');

    } catch (err) {
        console.error('❌ Diagnostic script failed:', err);
    } finally {
        if (db.close) await db.close();
        process.exit(0);
    }
};

run();