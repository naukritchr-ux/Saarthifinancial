
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import db from './config/db.js';

const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;

const FYS = [
  'FY 2019-20',
  'FY 2020-21',
  'FY 2021-22',
  'FY 2022-23',
  'FY 2023-24',
  'FY 2024-25'
];

const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;

  const num = parseFloat(String(val).replace(/,/g, '').trim());

  return Number.isFinite(num) ? num : 0;
};

const normalizeTan = (value) => {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
};

const parseDateValue = (dateVal) => {
  if (dateVal === null || dateVal === undefined || dateVal === '') {
    return '2024-04-01';
  }

  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - 25569) * 86400 * 1000);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  const value = String(dateVal).trim();

  // Already in YYYY-MM-DD format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Handle DD-MM-YYYY and DD/MM/YYYY.
  const match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  return value;
};

const safeExecuteMigration = async (query) => {
  try {
    await db.execute(query);
    console.log(`Migration successful: ${query}`);
  } catch (err) {
    const isIgnorable =
      err.code === 'ER_DUP_FIELDNAME' ||
      err.code === 'ER_DUP_KEYNAME' ||
      err.errno === 1060 ||
      err.errno === 1061 ||
      err.message?.toLowerCase().includes('duplicate column') ||
      err.message?.toLowerCase().includes('duplicate key name');

    if (isIgnorable) {
      console.log(`Migration already applied: ${query}`);
      return;
    }

    console.error(`Migration failed: ${query}`, err.message || err);
    throw err;
  }
};

const getSqliteColumns = async (tableName) => {
  const [rows] = await db.execute(`PRAGMA table_info(${tableName})`);
  return Array.isArray(rows) ? rows.map((column) => column.name) : [];
};

const addSqliteColumnIfMissing = async (tableName, columnName, definition) => {
  const columns = await getSqliteColumns(tableName);

  if (!columns.includes(columnName)) {
    await db.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );

    console.log(`Added ${columnName} to ${tableName}`);
  }
};

export async function ensureTablesExist() {
  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase();

  if (dbType === 'mysql') {
    // Existing table migrations.
    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN designation VARCHAR(100)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN financial_year VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN contact_person_name VARCHAR(100)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN contact_number VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN email_id VARCHAR(255)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN teamleader VARCHAR(100)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN pan_no VARCHAR(20)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD COLUMN gst_num VARCHAR(30)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_reconciliation_results ADD COLUMN financial_year VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_reconciliation_results ADD COLUMN is_followup_done BOOLEAN DEFAULT FALSE'
    );

    // Widen TAN columns to accommodate complete TAN values.
    await safeExecuteMigration(
      'ALTER TABLE tds_reconciliation_results MODIFY COLUMN tan_no VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_dues MODIFY COLUMN tan_no VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_26as_entries MODIFY COLUMN tan_no VARCHAR(50)'
    );

    await safeExecuteMigration(
      'ALTER TABLE tds_tally_entries MODIFY COLUMN tan_no VARCHAR(50)'
    );

    // Add transaction_date to existing 26AS tables.
    await safeExecuteMigration(
      'ALTER TABLE tds_26as_entries ADD COLUMN transaction_date DATE NULL'
    );

    // Keep only one unique index on the dues table.
    // Do not add a second equivalent index.
    await safeExecuteMigration(
      'ALTER TABLE tds_dues ADD UNIQUE KEY unique_tan_fy (tan_no, financial_year)'
    );

    // WARNING:
    // The reconciliation table may contain multiple records per TAN/FY.
    // Do not add a unique index here unless your business rules guarantee
    // exactly one reconciliation record per TAN/FY.

    try {
      await db.execute(`
        UPDATE tds_dues
        SET contact_person_name = NULL
        WHERE contact_person_name IN (
          'HR & Accounts Lead',
          'Unknown',
          'HR Manager'
        )
      `);

      await db.execute(`
        UPDATE tds_dues
        SET designation = NULL
        WHERE designation IN (
          'Finance Lead',
          'Finance Manager',
          'Accounts Lead'
        )
      `);

      await db.execute(`
        UPDATE tds_dues
        SET contact_number = NULL
        WHERE contact_number LIKE '%98201%54321%'
      `);

      await db.execute(`
        UPDATE tds_reconciliation_results tr
        JOIN tds_dues d ON tr.tds_dues_id = d.id
        SET tr.financial_year = d.financial_year
        WHERE d.financial_year IS NOT NULL
          AND d.financial_year != ''
          AND (
            tr.financial_year IS NULL
            OR tr.financial_year = ''
          )
      `);
    } catch (error) {
      console.error('Existing data cleanup warning:', error.message);
    }

    console.log('MySQL table migrations completed.');
    return;
  }

  // SQLITE TABLE CREATION AND MIGRATIONS

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_dues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saarthi_client_id INTEGER,
        invoice_id TEXT UNIQUE,
        bill_number TEXT,
        bill_date TEXT,
        company_name TEXT,
        total_bill_amount DECIMAL(15,2),
        tds DECIMAL(15,2),
        contact_number TEXT,
        teamleader TEXT,
        payment_date TEXT,
        tan_no TEXT,
        pan_no TEXT,
        gst_num TEXT,
        amount_received DECIMAL(15,2),
        status TEXT,
        contact_person_name TEXT,
        designation TEXT,
        email_id TEXT,
        note TEXT,
        financial_year TEXT
      )
    `);

    await addSqliteColumnIfMissing(
      'tds_dues',
      'saarthi_client_id',
      'INTEGER'
    );

    await addSqliteColumnIfMissing('tds_dues', 'email_id', 'TEXT');
    await addSqliteColumnIfMissing('tds_dues', 'designation', 'TEXT');
    await addSqliteColumnIfMissing('tds_dues', 'pan_no', 'TEXT');
    await addSqliteColumnIfMissing('tds_dues', 'gst_num', 'TEXT');
    await addSqliteColumnIfMissing('tds_dues', 'financial_year', 'TEXT');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_26as_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tan_no TEXT NOT NULL,
        deductor_name TEXT,
        amount_paid DECIMAL(15,2),
        tds_deducted DECIMAL(15,2) NOT NULL,
        section TEXT,
        quarter TEXT,
        transaction_date TEXT,
        upload_batch_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addSqliteColumnIfMissing(
      'tds_26as_entries',
      'transaction_date',
      'TEXT'
    );

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_tally_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tan_no TEXT NOT NULL,
        party_name TEXT,
        gst_num TEXT,
        pan_no TEXT,
        voucher_date TEXT,
        amount DECIMAL(15,2),
        tds_amount DECIMAL(15,2) NOT NULL,
        ledger_name TEXT,
        upload_batch_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addSqliteColumnIfMissing('tds_tally_entries', 'gst_num', 'TEXT');
    await addSqliteColumnIfMissing('tds_tally_entries', 'pan_no', 'TEXT');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_reconciliation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tds_dues_id INTEGER NOT NULL,
        tan_no TEXT NOT NULL,
        books_tds DECIMAL(15,2) NOT NULL,
        as26_tds DECIMAL(15,2) DEFAULT 0.00,
        tally_tds DECIMAL(15,2) DEFAULT 0.00,
        books_vs_26as_status TEXT,
        books_vs_tally_status TEXT,
        as26_vs_tally_status TEXT,
        overall_status TEXT NOT NULL,
        as26_batch_id TEXT,
        tally_batch_id TEXT,
        is_manually_edited INTEGER DEFAULT 0,
        is_followup_done INTEGER DEFAULT 0,
        financial_year TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addSqliteColumnIfMissing(
      'tds_reconciliation_results',
      'is_followup_done',
      'INTEGER DEFAULT 0'
    );

    await addSqliteColumnIfMissing(
      'tds_reconciliation_results',
      'financial_year',
      'TEXT'
    );

    await db.execute(`
      CREATE TABLE IF NOT EXISTS upload_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_by TEXT NOT NULL DEFAULT 'System',
        status TEXT NOT NULL DEFAULT 'Completed',
        metadata TEXT,
        upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tan_no TEXT NOT NULL,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        department TEXT,
        contact_number TEXT,
        accountant_person TEXT,
        accountant_number TEXT,
        method TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        followup_date TEXT NOT NULL,
        next_followup_date TEXT,
        created_by TEXT DEFAULT 'System',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addSqliteColumnIfMissing(
      'tds_followups',
      'accountant_person',
      'TEXT'
    );

    await addSqliteColumnIfMissing(
      'tds_followups',
      'accountant_number',
      'TEXT'
    );

    console.log('SQLite table schemas verified.');
  } catch (err) {
    console.error('Error ensuring SQLite tables exist:', err.message);
    throw err;
  }
}

const PURGED_FLAG_FILE = path.resolve('uploads/tds_purged.flag');

export function markPurgedFlag() {
  try {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }

    fs.writeFileSync(PURGED_FLAG_FILE, 'purged', 'utf8');
  } catch (error) {
    console.error('Unable to create purged flag:', error.message);
  }
}

export function clearPurgedFlag() {
  try {
    if (fs.existsSync(PURGED_FLAG_FILE)) {
      fs.unlinkSync(PURGED_FLAG_FILE);
    }
  } catch (error) {
    console.error('Unable to remove purged flag:', error.message);
  }
}

export function isPurgedFlag() {
  return fs.existsSync(PURGED_FLAG_FILE);
}

export async function seedEmbeddedDataset(force = false) {
  try {
    await ensureTablesExist();

    if (isPurgedFlag() && !force) {
      console.log('Database has been purged. Automatic seeding blocked.');
      return;
    }

    if (!force) {
      console.log(
        'Automatic database seeding disabled. Ready for user file uploads.'
      );
      return;
    }

    console.log('Explicitly seeding database...');

    clearPurgedFlag();

    await seedEmbeddedDatasetFallback();
  } catch (err) {
    console.error('Error seeding database:', err);
    throw err;
  }
}

/*
 * WARNING:
 * This function deletes existing data and inserts sample/demo records.
 * Call it only when you explicitly intend to reset the database with demo data.
 */
async function seedEmbeddedDatasetFallback() {
  try {
    await db.execute('DELETE FROM tds_reconciliation_results');
    await db.execute('DELETE FROM tds_dues');
    await db.execute('DELETE FROM tds_26as_entries');
    await db.execute('DELETE FROM tds_tally_entries');
    await db.execute('DELETE FROM upload_history');
    await db.execute('DELETE FROM tds_followups');

    const entities = [
      { tan: 'AHMS32413D', tallyName: 'SEA BAUFORMAT INDIA PRIVATE LIMITED', as26Name: 'SEA BAUFORMAT INDIA PRIVATE LIMITED', fyIdx: 3, tallyTds: 4410, as26Tds: 4875, booksTds: 4410, phone: '+91 98201 44512', contact: 'Rajesh Sharma' },
      { tan: 'DELT10133E', tallyName: 'TARAASHNA FINANCIAL SERVICES LIMITED', as26Name: 'TARAASHNA FINANCIAL SERVICES LIMITED', fyIdx: 4, tallyTds: 18603, as26Tds: 24067, booksTds: 18603, phone: '+91 98112 33490', contact: 'Vikram Malhotra' },
      { tan: 'MUMF08127A', tallyName: 'FOURTH QUADRANT LEARNING SOLUTIONS', as26Name: 'FOURTH QUADRANT LEARNING SOLUTIONS', fyIdx: 3, tallyTds: 14994, as26Tds: 14994, booksTds: 14994, phone: '+91 98210 99423', contact: 'Anish Gupta' },
      { tan: 'RTKC02915D', tallyName: 'CREATIVE LIPI WEBTECH PRIVATE LIMITED', as26Name: 'CREATIVE LIPI WEBTECH PRIVATE LIMITED', fyIdx: 3, tallyTds: 7081, as26Tds: 7081, booksTds: 7081, phone: '+91 97170 55431', contact: 'Sanjay Dixit' },
      { tan: 'MUML11282F', tallyName: 'LUXIFER BEAUTY NUTRITION PRIVATE LIMITED', as26Name: 'LUXIFER BEAUTY NUTRITION PRIVATE LIMITED', fyIdx: 0, tallyTds: 563, as26Tds: 563, booksTds: 563, phone: '+91 99304 12890', contact: 'Pooja Mehta' },
      { tan: 'MUMQ01239A', tallyName: 'QUODECK TECHNOLOGIES PRIVATE LIMITED', as26Name: 'QUODECK TECHNOLOGIES PRIVATE LIMITED', fyIdx: 0, tallyTds: 1499, as26Tds: 1499, booksTds: 1499, phone: '+91 98205 66712', contact: 'Kamal Roy' },
      { tan: 'BLRA08721G', tallyName: 'ATIMI SOFTWARE (INDIA) PRIVATE LIMITED', as26Name: 'ATIMI SOFTWARE (INDIA) PRIVATE LIMITED', fyIdx: 2, tallyTds: 69580, as26Tds: 53660, booksTds: 69580, phone: '+91 80 4123 9901', contact: 'Sunil Kumar' },
      { tan: 'BLRA01292E', tallyName: 'ALIMENT SOFTWARE TECHNOLOGIES PVT LTD', as26Name: 'ALIMENT SOFTWARE TECHNOLOGIES PVT LTD', fyIdx: 4, tallyTds: 14845, as26Tds: 14845, booksTds: 14845, phone: '+91 80 2341 8820', contact: 'Meera Nair' },
      { tan: 'CALA06799C', tallyName: 'ALUDECOR LAMINATION PRIVATE LIMITED', as26Name: 'ALUDECOR LAMINATION PRIVATE LIMITED', fyIdx: 4, tallyTds: 101970, as26Tds: 101970, booksTds: 101970, phone: '+91 33 4001 2290', contact: 'Amitabh Banerjee' },
      { tan: 'CHEG07464C', tallyName: 'KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED', as26Name: 'KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED', fyIdx: 3, tallyTds: 167859, as26Tds: 167850, booksTds: 167859, phone: '+91 44 2450 1199', contact: 'Karthik Raja' },
      { tan: 'DELB13122E', tallyName: 'BIGFOOT RETAIL SOLUTIONS PRIVATE LIMITED', as26Name: 'BIGFOOT RETAIL SOLUTIONS PRIVATE LIMITED', fyIdx: 2, tallyTds: 3748, as26Tds: 16244, booksTds: 3748, phone: '+91 11 4980 3341', contact: 'Rohan Kapoor' },
      { tan: 'DELM26337D', tallyName: 'MIND ITSYS PRIVATE LIMITED', as26Name: 'MIND ITSYS PRIVATE LIMITED', fyIdx: 2, tallyTds: 41094, as26Tds: 28292, booksTds: 41094, phone: '+91 11 2618 9012', contact: 'Neha Verma' },
      { tan: 'HYDM09642D', tallyName: 'MAZIK TECH SOLUTIONS PVT LTD', as26Name: 'MAZIK TECH SOLUTIONS PVT LTD', fyIdx: 3, tallyTds: 54460, as26Tds: 54460, booksTds: 54460, phone: '+91 40 6678 1200', contact: 'Srinivas Rao' },
      { tan: 'MUMA58959F', tallyName: 'ASIAN ENERGY SERVICES LIMITED', as26Name: 'ASIAN ENERGY SERVICES LIMITED', fyIdx: 3, tallyTds: 125900, as26Tds: 121072, booksTds: 125900, phone: '+91 22 6123 8800', contact: 'Pradeep Joshi' },
      { tan: 'MUMN09514B', tallyName: 'NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED', as26Name: 'NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED', fyIdx: 4, tallyTds: 23148, as26Tds: 23149, booksTds: 23148, phone: '+91 22 6634 1100', contact: 'Deepak Shah' },
      { tan: 'PNEU06707B', tallyName: 'UNIPART SERVICES INDIA PRIVATE LIMITED', as26Name: 'UNIPART SERVICES INDIA PRIVATE LIMITED', fyIdx: 3, tallyTds: 94654, as26Tds: 94653, booksTds: 94654, phone: '+91 20 6711 4400', contact: 'Ganesh Kulkarni' },
      { tan: 'UNKNOWN_TAN_1', tallyName: 'UNMATCHED DEDUCTOR SERVICES LTD', as26Name: '', fyIdx: 4, tallyTds: 12500, as26Tds: 0, booksTds: 12500, phone: '+91 99000 11122', contact: 'Unknown' },
      { tan: 'INVALID123', tallyName: 'NAME DISCREPANCY CORP', as26Name: 'NAME DISCREPANCY INDIA PVT LTD', fyIdx: 4, tallyTds: 8900, as26Tds: 8900, booksTds: 8900, phone: '+91 98888 77766', contact: 'Suresh P' }
    ];

    const as26BatchId = `batch_26as_seed_${Date.now()}`;
    const tallyBatchId = `batch_tally_seed_${Date.now()}`;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const fyStr = FYS[e.fyIdx] || 'FY 2023-24';
      const invoiceId = `INV_SEED_${Date.now()}_${1001 + i}`;
      const billNo = `INV-2024-${1001 + i}`;

      const statusVal =
        e.booksTds === e.as26Tds && e.booksTds > 0
          ? 'Received'
          : e.booksTds > e.as26Tds
            ? 'Less Paid'
            : 'Excess';

      const [dueRes] = await db.execute(`
        INSERT INTO tds_dues
        (
          invoice_id,
          bill_number,
          bill_date,
          company_name,
          total_bill_amount,
          tds,
          contact_number,
          tan_no,
          status,
          contact_person_name,
          financial_year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        billNo,
        '2024-04-15',
        e.tallyName,
        e.booksTds * 10,
        e.booksTds,
        e.phone,
        e.tan,
        statusVal,
        e.contact,
        fyStr
      ]);

      const dueId = dueRes.insertId;

      if (e.as26Tds > 0) {
        await db.execute(`
          INSERT INTO tds_26as_entries
          (
            tan_no,
            deductor_name,
            amount_paid,
            tds_deducted,
            section,
            quarter,
            upload_batch_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          e.tan,
          e.as26Name || e.tallyName,
          e.as26Tds * 10,
          e.as26Tds,
          '194C',
          'Q1',
          as26BatchId
        ]);
      }

      if (e.tallyTds > 0) {
        await db.execute(`
          INSERT INTO tds_tally_entries
          (
            tan_no,
            party_name,
            voucher_date,
            amount,
            tds_amount,
            ledger_name,
            upload_batch_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          e.tan,
          e.tallyName,
          '2024-04-10',
          e.tallyTds * 10,
          e.tallyTds,
          'TDS Payable',
          tallyBatchId
        ]);
      }

      const booksVs26as =
        e.as26Tds === 0
          ? 'Not Received'
          : Math.abs(e.booksTds - e.as26Tds) <= 1
            ? 'Matched'
            : e.booksTds > e.as26Tds
              ? 'Less Paid'
              : 'Excess';

      const booksVsTally =
        Math.abs(e.booksTds - e.tallyTds) <= 1
          ? 'Matched'
          : e.booksTds > e.tallyTds
            ? 'Less Paid'
            : 'Excess';

      const as26VsTally =
        Math.abs(e.as26Tds - e.tallyTds) <= 1
          ? 'Matched'
          : e.as26Tds > e.tallyTds
            ? 'Excess'
            : 'Less Paid';

      const overallStatus =
        booksVs26as === 'Matched' &&
        booksVsTally === 'Matched' &&
        as26VsTally === 'Matched'
          ? 'All Matched'
          : 'Partial Mismatch';

      await db.execute(`
        INSERT INTO tds_reconciliation_results
        (
          tds_dues_id,
          tan_no,
          books_tds,
          as26_tds,
          tally_tds,
          books_vs_26as_status,
          books_vs_tally_status,
          as26_vs_tally_status,
          overall_status,
          as26_batch_id,
          tally_batch_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dueId,
        e.tan,
        e.booksTds,
        e.as26Tds,
        e.tallyTds,
        booksVs26as,
        booksVsTally,
        as26VsTally,
        overallStatus,
        as26BatchId,
        tallyBatchId
      ]);
    }

    console.log('Demo dataset inserted successfully.');
  } catch (err) {
    console.error('Error in fallback seed:', err);
    throw err;
  }
}

async function seedFromMasterExcel(excelPath) {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  const workbook = xlsx.readFile(excelPath, {
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetRows: 5000
  });

  const masterSheetName = workbook.SheetNames.includes('Master Data')
    ? 'Master Data'
    : workbook.SheetNames[0];

  if (!masterSheetName || !workbook.Sheets[masterSheetName]) {
    throw new Error('No valid worksheet found in the Excel file.');
  }

  const masterSheet = workbook.Sheets[masterSheetName];

  const masterData = xlsx.utils.sheet_to_json(masterSheet, {
    header: 1,
    defval: ''
  });

  if (masterData.length <= 1) {
    throw new Error('The Excel file does not contain importable data rows.');
  }

  const as26BatchId = `batch_as26_real_${Date.now()}`;
  const tallyBatchId = `batch_tally_real_${Date.now()}`;
  const runId = Date.now().toString().slice(-6);

  let duesInserted = 0;
  let as26Inserted = 0;
  let tallyInserted = 0;

  // Start transaction before deleting existing records.
  await db.beginTransaction();

  try {
    await db.execute('DELETE FROM tds_reconciliation_results');
    await db.execute('DELETE FROM tds_dues');
    await db.execute('DELETE FROM tds_26as_entries');
    await db.execute('DELETE FROM tds_tally_entries');
    await db.execute('DELETE FROM upload_history');
    await db.execute('DELETE FROM tds_followups');

    for (let r = 1; r < masterData.length; r++) {
      const row = masterData[r];

      if (!row || row.length === 0) continue;

      const tallyName = String(row[0] || '').trim();
      const tallyTan = normalizeTan(row[1]);
      const entryDate = parseDateValue(row[2]);
      const fy = String(row[3] || 'FY 2023-24').trim();
      const tallyTds = cleanNumber(row[4]);
      const tallySource = String(row[5] || '').trim();

      const as26Name = String(row[7] || '').trim();
      const as26Tan = normalizeTan(row[8]);
      const as26Fy = String(row[9] || fy).trim();
      const as26Tds = cleanNumber(row[10]);
      const as26Source = String(row[11] || '').trim();

      const validTallyTan = tanRegex.test(tallyTan) ? tallyTan : null;
      const validAs26Tan = tanRegex.test(as26Tan) ? as26Tan : null;

      const validTan = validTallyTan || validAs26Tan;

      const companyName =
        (tallyName && tallyName !== 'Client Entity')
          ? tallyName
          : (as26Name && as26Name !== 'Client Entity')
            ? as26Name
            : null;

      if (!validTan && !companyName) continue;

      const tanToUse = validTan || `TAN_PENDING_${r}`;

      // Preserve legitimate zero values.
      const booksTds = tallyTds;

      const statusVal =
        booksTds === as26Tds && booksTds > 0
          ? 'Received'
          : booksTds > as26Tds
            ? 'Less Paid'
            : 'Excess';

      const invoiceId = `INV_REAL_${runId}_${r}`;
      const billNo = `INV-${fy.replace(/\s+/g, '')}-${1000 + r}`;

      const [dueRes] = await db.execute(`
        INSERT INTO tds_dues
        (
          invoice_id,
          bill_number,
          bill_date,
          company_name,
          total_bill_amount,
          tds,
          contact_number,
          tan_no,
          status,
          contact_person_name,
          financial_year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        billNo,
        entryDate,
        companyName || 'Unidentified Entity',
        booksTds * 10,
        booksTds,
        null,
        tanToUse,
        statusVal,
        null,
        fy
      ]);

      const dueId = dueRes?.insertId;

      if (!dueId) {
        throw new Error(`Unable to insert dues record for Excel row ${r + 1}`);
      }

      duesInserted++;

      if (validAs26Tan && (as26Source === '26AS' || as26Tds > 0)) {
        await db.execute(`
          INSERT INTO tds_26as_entries
          (
            tan_no,
            deductor_name,
            amount_paid,
            tds_deducted,
            section,
            quarter,
            transaction_date,
            upload_batch_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          validAs26Tan,
          as26Name || companyName,
          as26Tds * 10,
          as26Tds,
          '194C',
          'Q1',
          entryDate,
          as26BatchId
        ]);

        as26Inserted++;
      }

      if (validTallyTan && (tallySource === 'Tally' || tallyTds > 0)) {
        await db.execute(`
          INSERT INTO tds_tally_entries
          (
            tan_no,
            party_name,
            voucher_date,
            amount,
            tds_amount,
            ledger_name,
            upload_batch_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          validTallyTan,
          tallyName || companyName,
          entryDate,
          tallyTds * 10,
          tallyTds,
          'TDS Payable',
          tallyBatchId
        ]);

        tallyInserted++;
      }

      const booksVs26as =
        as26Tds === 0
          ? 'Not Received'
          : Math.abs(booksTds - as26Tds) <= 1
            ? 'Matched'
            : booksTds > as26Tds
              ? 'Less Paid'
              : 'Excess';

      const booksVsTally =
        Math.abs(booksTds - tallyTds) <= 1
          ? 'Matched'
          : booksTds > tallyTds
            ? 'Less Paid'
            : 'Excess';

      const as26VsTally =
        Math.abs(as26Tds - tallyTds) <= 1
          ? 'Matched'
          : as26Tds > tallyTds
            ? 'Excess'
            : 'Less Paid';

      const overallStatus =
        booksVs26as === 'Matched' &&
        booksVsTally === 'Matched' &&
        as26VsTally === 'Matched'
          ? 'All Matched'
          : 'Partial Mismatch';

      await db.execute(`
        INSERT INTO tds_reconciliation_results
        (
          tds_dues_id,
          tan_no,
          books_tds,
          as26_tds,
          tally_tds,
          books_vs_26as_status,
          books_vs_tally_status,
          as26_vs_tally_status,
          overall_status,
          as26_batch_id,
          tally_batch_id,
          financial_year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        dueId,
        tanToUse,
        booksTds,
        as26Tds,
        tallyTds,
        booksVs26as,
        booksVsTally,
        as26VsTally,
        overallStatus,
        as26BatchId,
        tallyBatchId,
        fy
      ]);
    }

    await db.execute(`
      INSERT INTO upload_history
      (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      path.basename(excelPath),
      excelPath,
      'System Importer',
      'Completed',
      JSON.stringify({
        upload_type: 'MASTER_EXCEL',
        upload_batch_id: as26BatchId,
        total_rows: duesInserted,
        as26_records: as26Inserted,
        tally_records: tallyInserted
      })
    ]);

    await db.commit();

    console.log(
      `MASTER EXCEL IMPORT COMPLETE: ${duesInserted} dues, ${as26Inserted} 26AS records, ${tallyInserted} Tally records.`
    );

    return {
      duesInserted,
      as26Inserted,
      tallyInserted
    };
  } catch (err) {
    try {
      await db.rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }

    console.error('Error importing from Master Excel:', err);
    throw err;
  }
}
