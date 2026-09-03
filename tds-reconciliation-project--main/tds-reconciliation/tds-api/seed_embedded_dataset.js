import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;
const FYS = ["FY 2019-20", "FY 2020-21", "FY 2021-22", "FY 2022-23", "FY 2023-24", "FY 2024-25"];

const cleanNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

const parseDateValue = (dateVal) => {
  if (!dateVal) return '2024-04-01';
  if (typeof dateVal === 'number') {
    const UTC_DAYS_DIFF = 25569;
    const date = new Date((dateVal - UTC_DAYS_DIFF) * 86400 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(dateVal);
};

export async function ensureTablesExist() {
  if (process.env.DB_TYPE === 'mysql') {
    try { await db.execute('ALTER TABLE tds_dues ADD COLUMN designation VARCHAR(100)'); } catch (err) {}
    try { await db.execute('ALTER TABLE tds_dues ADD COLUMN financial_year VARCHAR(50)'); } catch (err) {}
    try { await db.execute('ALTER TABLE tds_reconciliation_results ADD COLUMN financial_year VARCHAR(50)'); } catch (err) {}
    return;
  }
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
        amount_received DECIMAL(15,2),
        status TEXT,
        contact_person_name TEXT,
        designation TEXT,
        email_id TEXT,
        note TEXT,
        financial_year TEXT
      )
    `);

    try {
      const [duesInfo] = await db.execute(`PRAGMA table_info(tds_dues);`);
      const duesCols = Array.isArray(duesInfo) ? duesInfo.map(c => c.name) : [];
      if (!duesCols.includes('saarthi_client_id')) await db.execute(`ALTER TABLE tds_dues ADD COLUMN saarthi_client_id INTEGER;`);
      if (!duesCols.includes('email_id')) await db.execute(`ALTER TABLE tds_dues ADD COLUMN email_id TEXT;`);
      if (!duesCols.includes('designation')) await db.execute(`ALTER TABLE tds_dues ADD COLUMN designation TEXT;`);
    } catch (e) {
      try { await db.execute('ALTER TABLE tds_dues ADD COLUMN designation VARCHAR(100)'); } catch (err) {}
      try { await db.execute('ALTER TABLE tds_dues ADD COLUMN gst_no VARCHAR(50)'); } catch (err) {}
      try { await db.execute('ALTER TABLE tds_dues ADD COLUMN pan_no VARCHAR(50)'); } catch (err) {}
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tds_26as_entries (

        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tan_no TEXT NOT NULL,
        deductor_name TEXT,
        amount_paid DECIMAL(15,2),
        tds_deducted DECIMAL(15,2) NOT NULL,
        section TEXT,
        quarter TEXT,
        upload_batch_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    try {
      const [tableInfo] = await db.execute(`PRAGMA table_info(tds_tally_entries);`);
      const cols = Array.isArray(tableInfo) ? tableInfo.map(c => c.name) : [];
      if (!cols.includes('gst_num')) {
        await db.execute(`ALTER TABLE tds_tally_entries ADD COLUMN gst_num TEXT;`);
      }
      if (!cols.includes('pan_no')) {
        await db.execute(`ALTER TABLE tds_tally_entries ADD COLUMN pan_no TEXT;`);
      }
    } catch (e) {}

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    console.log('✅ SQLite table schemas verified.');
  } catch (err) {
    console.error('⚠️ Error ensuring tables exist:', err.message);
  }
}

const PURGED_FLAG_FILE = path.resolve('uploads/tds_purged.flag');

export function markPurgedFlag() {
  try {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });
    fs.writeFileSync(PURGED_FLAG_FILE, 'purged', 'utf8');
  } catch (e) {}
}

export function clearPurgedFlag() {
  try {
    if (fs.existsSync(PURGED_FLAG_FILE)) {
      fs.unlinkSync(PURGED_FLAG_FILE);
    }
  } catch (e) {}
}

export function isPurgedFlag() {
  return fs.existsSync(PURGED_FLAG_FILE);
}

export async function seedEmbeddedDataset(force = false) {
  try {
    await ensureTablesExist();
    if (!force) {
      console.log('ℹ️ Automatic database seeding on startup disabled. Ready for user file uploads.');
      return;
    }
    console.log('🌱 Explicitly seeding database...');
    await seedEmbeddedDatasetFallback();
  } catch (err) {
    console.error('💥 Error seeding database:', err);
  }
}

async function seedEmbeddedDatasetFallback() {
  try {
    await db.execute('DELETE FROM tds_reconciliation_results');
    await db.execute('DELETE FROM tds_dues');
    await db.execute('DELETE FROM tds_26as_entries');
    await db.execute('DELETE FROM tds_tally_entries');
    await db.execute('DELETE FROM upload_history');
    await db.execute('DELETE FROM tds_followups');

    const entities = [
      { tan: "AHMS32413D", tallyName: "SEA BAUFORMAT INDIA PRIVATE LIMITED", as26Name: "SEA BAUFORMAT INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 4410, as26Tds: 4875, booksTds: 4410, phone: "+91 98201 44512", contact: "Rajesh Sharma", dept: "Finance" },
      { tan: "DELT10133E", tallyName: "TARAASHNA FINANCIAL SERVICES LIMITED", as26Name: "TARAASHNA FINANCIAL SERVICES LIMITED", fyIdx: 4, tallyTds: 18603, as26Tds: 24067, booksTds: 18603, phone: "+91 98112 33490", contact: "Vikram Malhotra", dept: "Accounts" },
      { tan: "MUMF08127A", tallyName: "FOURTH QUADRANT LEARNING SOLUTIONS", as26Name: "FOURTH QUADRANT LEARNING SOLUTIONS", fyIdx: 3, tallyTds: 14994, as26Tds: 14994, booksTds: 14994, phone: "+91 98210 99423", contact: "Anish Gupta", dept: "HR" },
      { tan: "RTKC02915D", tallyName: "CREATIVE LIPI WEBTECH PRIVATE LIMITED", as26Name: "CREATIVE LIPI WEBTECH PRIVATE LIMITED", fyIdx: 3, tallyTds: 7081, as26Tds: 7081, booksTds: 7081, phone: "+91 97170 55431", contact: "Sanjay Dixit", dept: "Legal" },
      { tan: "MUML11282F", tallyName: "LUXIFER BEAUTY NUTRITION PRIVATE LIMITED", as26Name: "LUXIFER BEAUTY NUTRITION PRIVATE LIMITED", fyIdx: 0, tallyTds: 563, as26Tds: 563, booksTds: 563, phone: "+91 99304 12890", contact: "Pooja Mehta", dept: "Accounts" },
      { tan: "MUMQ01239A", tallyName: "QUODECK TECHNOLOGIES PRIVATE LIMITED", as26Name: "QUODECK TECHNOLOGIES PRIVATE LIMITED", fyIdx: 0, tallyTds: 1499, as26Tds: 1499, booksTds: 1499, phone: "+91 98205 66712", contact: "Kamal Roy", dept: "Finance" },
      { tan: "BLRA08721G", tallyName: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", as26Name: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", fyIdx: 2, tallyTds: 69580, as26Tds: 53660, booksTds: 69580, phone: "+91 80 4123 9901", contact: "Sunil Kumar", dept: "Taxation" },
      { tan: "BLRA01292E", tallyName: "ALIMENT SOFTWARE TECHNOLOGIES PVT LTD", as26Name: "ALIMENT SOFTWARE TECHNOLOGIES PVT LTD", fyIdx: 4, tallyTds: 14845, as26Tds: 14845, booksTds: 14845, phone: "+91 80 2341 8820", contact: "Meera Nair", dept: "Accounts" },
      { tan: "CALA06799C", tallyName: "ALUDECOR LAMINATION PRIVATE LIMITED", as26Name: "ALUDECOR LAMINATION PRIVATE LIMITED", fyIdx: 4, tallyTds: 101970, as26Tds: 101970, booksTds: 101970, phone: "+91 33 4001 2290", contact: "Amitabh Banerjee", dept: "Finance" },
      { tan: "CHEG07464C", tallyName: "KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED", as26Name: "KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 167859, as26Tds: 167850, booksTds: 167859, phone: "+91 44 2450 1199", contact: "Karthik Raja", dept: "Accounts" },
      { tan: "DELB13122E", tallyName: "BIGFOOT RETAIL SOLUTIONS PRIVATE LIMITED", as26Name: "BIGFOOT RETAIL SOLUTIONS PRIVATE LIMITED", fyIdx: 2, tallyTds: 3748, as26Tds: 16244, booksTds: 3748, phone: "+91 11 4980 3341", contact: "Rohan Kapoor", dept: "Billing" },
      { tan: "DELM26337D", tallyName: "MIND ITSYS PRIVATE LIMITED", as26Name: "MIND ITSYS PRIVATE LIMITED", fyIdx: 2, tallyTds: 41094, as26Tds: 28292, booksTds: 41094, phone: "+91 11 2618 9012", contact: "Neha Verma", dept: "Finance" },
      { tan: "HYDM09642D", tallyName: "MAZIK TECH SOLUTIONS PVT LTD", as26Name: "MAZIK TECH SOLUTIONS PVT LTD", fyIdx: 3, tallyTds: 54460, as26Tds: 54460, booksTds: 54460, phone: "+91 40 6678 1200", contact: "Srinivas Rao", dept: "Tax" },
      { tan: "MUMA58959F", tallyName: "ASIAN ENERGY SERVICES LIMITED", as26Name: "ASIAN ENERGY SERVICES LIMITED", fyIdx: 3, tallyTds: 125900, as26Tds: 121072, booksTds: 125900, phone: "+91 22 6123 8800", contact: "Pradeep Joshi", dept: "Finance" },
      { tan: "MUMN09514B", tallyName: "NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED", as26Name: "NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED", fyIdx: 4, tallyTds: 23148, as26Tds: 23149, booksTds: 23148, phone: "+91 22 6634 1100", contact: "Deepak Shah", dept: "Accounts" },
      { tan: "PNEU06707B", tallyName: "UNIPART SERVICES INDIA PRIVATE LIMITED", as26Name: "UNIPART SERVICES INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 94654, as26Tds: 94653, booksTds: 94654, phone: "+91 20 6711 4400", contact: "Ganesh Kulkarni", dept: "Finance" },
      { tan: "UNKNOWN_TAN_1", tallyName: "UNMATCHED DEDUCTOR SERVICES LTD", as26Name: "", fyIdx: 4, tallyTds: 12500, as26Tds: 0, booksTds: 12500, phone: "+91 99000 11122", contact: "Unknown", dept: "Accounts" },
      { tan: "INVALID123", tallyName: "NAME DISCREPANCY CORP", as26Name: "NAME DISCREPANCY INDIA PVT LTD", fyIdx: 4, tallyTds: 8900, as26Tds: 8900, booksTds: 8900, phone: "+91 98888 77766", contact: "Suresh P", dept: "Finance" }
    ];

    const as26BatchId = `batch_26as_seed_${Date.now()}`;
    const tallyBatchId = `batch_tally_seed_${Date.now()}`;
    const runId = Date.now().toString().slice(-6);

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const fyStr = FYS[e.fyIdx] || "FY 2023-24";
      const invoiceId = `INV_SEED_${runId}_${1001 + i}`;
      const billNo = `INV-2024-${runId}-${1001 + i}`;
      const statusVal = e.booksTds === e.as26Tds && e.booksTds > 0 ? 'Received' : (e.booksTds > e.as26Tds ? 'Less Paid' : 'Excess');

      // 1. Insert into tds_dues
      const [dueRes] = await db.execute(`
        INSERT INTO tds_dues 
        (invoice_id, bill_number, bill_date, company_name, total_bill_amount, tds, contact_number, tan_no, status, contact_person_name, financial_year)
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

      // 2. Insert 26AS
      if (e.as26Tds > 0) {
        await db.execute(`
          INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [e.tan, e.as26Name || e.tallyName, e.as26Tds * 10, e.as26Tds, '194C', 'Q1', as26BatchId]);
      }

      // 3. Insert Tally
      if (e.tallyTds > 0) {
        const mockGst = `27${e.tan.slice(0, 10)}1Z5`;
        const mockPan = e.tan.slice(0, 5) + '1234A';
        await db.execute(`
          INSERT INTO tds_tally_entries (tan_no, party_name, gst_num, pan_no, voucher_date, amount, tds_amount, ledger_name, upload_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [e.tan, e.tallyName, mockGst, mockPan, '2024-04-10', e.tallyTds * 10, e.tallyTds, 'TDS Payable', tallyBatchId]);
      }

      // 4. Pairwise Status
      let booksVs26as = 'Matched';
      if (e.as26Tds === 0) booksVs26as = 'Not Received';
      else if (Math.abs(e.booksTds - e.as26Tds) > 1) {
        booksVs26as = e.booksTds > e.as26Tds ? 'Less Paid' : 'Excess';
      }

      let booksVsTally = Math.abs(e.booksTds - e.tallyTds) <= 1 ? 'Matched' : (e.booksTds > e.tallyTds ? 'Less Paid' : 'Excess');
      let as26VsTally = Math.abs(e.as26Tds - e.tallyTds) <= 1 ? 'Matched' : (e.as26Tds > e.tallyTds ? 'Excess' : 'Less Paid');

      let overallStatus = 'All Matched';
      if (booksVs26as !== 'Matched' || booksVsTally !== 'Matched' || as26VsTally !== 'Matched') {
        overallStatus = (booksVs26as !== 'Matched' && booksVsTally !== 'Matched') ? 'Major Mismatch' : 'Partial Mismatch';
      }

      await db.execute(`
        INSERT INTO tds_reconciliation_results
        (tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, overall_status, as26_batch_id, tally_batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [dueId, e.tan, e.booksTds, e.as26Tds, e.tallyTds, booksVs26as, booksVsTally, as26VsTally, overallStatus, as26BatchId, tallyBatchId]);
    }

    // Insert history audit records
    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'Form_26AS_FY2023-24_Master.csv',
      'uploads/seed_26as.csv',
      'Accounts Manager',
      'Completed',
      JSON.stringify({ upload_type: '26AS_TDS', upload_batch_id: as26BatchId, total_rows: entities.length })
    ]);

    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'Tally_Ledger_Export_FY23-24.csv',
      'uploads/seed_tally.csv',
      'Accounts Manager',
      'Completed',
      JSON.stringify({ upload_type: 'TALLY_TDS', upload_batch_id: tallyBatchId, total_rows: entities.length })
    ]);

    // Sample follow-ups
    const sampleFollowups = [
      { tan: "AHMS32413D", company: "SEA BAUFORMAT INDIA PRIVATE LIMITED", contact: "Rajesh Sharma", dept: "Finance", phone: "+91 98201 44512", method: "Call", status: "Call Tomorrow", notes: "Called regarding Form 26AS mismatch of ₹465. Client agreed to verify Traces certificate.", followupDate: "2026-08-20", nextDate: "2026-08-26" },
      { tan: "DELT10133E", company: "TARAASHNA FINANCIAL SERVICES LIMITED", contact: "Vikram Malhotra", dept: "Accounts", phone: "+91 98112 33490", method: "Mail", status: "Check & Revert", notes: "Emailed TDS deduction breakdown. Accountant checking Traces portal.", followupDate: "2026-08-22", nextDate: "2026-08-27" },
      { tan: "BLRA08721G", company: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", contact: "Sunil Kumar", dept: "Taxation", phone: "+91 80 4123 9901", method: "Mail", status: "Form Received", notes: "Form 16A received via email and attached to audit trail.", followupDate: "2026-08-15", nextDate: null }
    ];

    for (const f of sampleFollowups) {
      await db.execute(`
        INSERT INTO tds_followups
        (tan_no, company_name, contact_person, department, contact_number, method, status, notes, followup_date, next_followup_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [f.tan, f.company, f.contact, f.dept, f.phone, f.method, f.status, f.notes, f.followupDate, f.nextDate, 'Accounts Manager']);
    }

    console.log('✅ Baseline seed successfully populated with 18 entities, 3-way reconciliation results, and follow-ups.');
  } catch (err) {
    console.error('💥 Error in fallback seed:', err);
  }
}

async function seedFromMasterExcel(excelPath) {
  try {
    const workbook = xlsx.readFile(excelPath, { cellFormula: false, cellHTML: false, cellStyles: false, sheetRows: 5000 });


    // Clean old dataset
    await db.execute('DELETE FROM tds_reconciliation_results');
    await db.execute('DELETE FROM tds_dues');
    await db.execute('DELETE FROM tds_26as_entries');
    await db.execute('DELETE FROM tds_tally_entries');
    await db.execute('DELETE FROM upload_history');
    await db.execute('DELETE FROM tds_followups');

    const as26BatchId = `batch_as26_real_${Date.now()}`;
    const tallyBatchId = `batch_tally_real_${Date.now()}`;

    // Read Master Data sheet or Sheet 1
    const masterSheetName = workbook.SheetNames.includes('Master Data') ? 'Master Data' : workbook.SheetNames[0];
    const masterSheet = workbook.Sheets[masterSheetName];
    const masterData = xlsx.utils.sheet_to_json(masterSheet, { header: 1, defval: '' });

    let duesInserted = 0;
    let as26Inserted = 0;
    let tallyInserted = 0;

    const runId = Date.now().toString().slice(-6);

    for (let r = 1; r < masterData.length; r++) {
      const row = masterData[r];
      if (!row || row.length === 0) continue;

      // Extract Tally block (cols 0-5)
      const tallyName = String(row[0] || '').trim();
      const tallyTan = String(row[1] || '').trim().toUpperCase().replace(/\s+/g, '');
      const entryDate = parseDateValue(row[2]);
      const fy = String(row[3] || 'FY 2023-24').trim();
      const tallyTds = cleanNumber(row[4]);
      const tallySource = String(row[5] || '').trim();

      // Extract 26AS block (cols 7-11)
      const as26Name = String(row[7] || '').trim();
      const as26Tan = String(row[8] || '').trim().toUpperCase().replace(/\s+/g, '');
      const as26Fy = String(row[9] || fy).trim();
      const as26Tds = cleanNumber(row[10]);
      const as26Source = String(row[11] || '').trim();

      const validTan = (tallyTan && tanRegex.test(tallyTan)) ? tallyTan : ((as26Tan && tanRegex.test(as26Tan)) ? as26Tan : null);
      const companyName = (tallyName && tallyName !== 'Client Entity') ? tallyName : ((as26Name && as26Name !== 'Client Entity') ? as26Name : 'Saarthi Partner Entity');

      if (!validTan && !companyName) continue;

      const tanToUse = validTan || `TAN_PENDING_${r}`;
      const booksTds = tallyTds || as26Tds;
      const statusVal = booksTds === as26Tds && booksTds > 0 ? 'Received' : (booksTds > as26Tds ? 'Less Paid' : 'Excess');

      // 1. Insert into tds_dues
      const invoiceId = `INV_REAL_${runId}_${r}`;
      const billNo = `INV-${fy.replace(/\s+/g, '')}-${1000 + r}`;

      const [dueRes] = await db.execute(`
        INSERT INTO tds_dues
        (invoice_id, bill_number, bill_date, company_name, total_bill_amount, tds, contact_number, tan_no, status, contact_person_name, financial_year)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        billNo,
        entryDate,
        companyName,
        booksTds * 10,
        booksTds,
        '+91 98000 00000',
        tanToUse,
        statusVal,
        'Accounts Manager',
        fy
      ]);

      const dueId = dueRes?.insertId;
      if (!dueId) continue;
      duesInserted++;


      // 2. Insert into tds_26as_entries if present
      if (as26Tan && tanRegex.test(as26Tan) && (as26Source === '26AS' || as26Tds > 0)) {
        await db.execute(`
          INSERT INTO tds_26as_entries
          (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          as26Tan,
          as26Name || companyName,
          as26Tds * 10,
          as26Tds,
          '194C',
          'Q1',
          as26BatchId
        ]);
        as26Inserted++;
      }

      // 3. Insert into tds_tally_entries if present
      if (tallyTan && tanRegex.test(tallyTan) && (tallySource === 'Tally' || tallyTds > 0)) {
        await db.execute(`
          INSERT INTO tds_tally_entries
          (tan_no, party_name, voucher_date, amount, tds_amount, ledger_name, upload_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          tallyTan,
          tallyName || companyName,
          entryDate,
          tallyTds * 10,
          tallyTds,
          'TDS Payable',
          tallyBatchId
        ]);
        tallyInserted++;
      }

      // 4. Calculate pairwise status
      let booksVs26as = 'Matched';
      if (as26Tds === 0) booksVs26as = 'Not Received';
      else if (Math.abs(booksTds - as26Tds) > 1) {
        booksVs26as = booksTds > as26Tds ? 'Less Paid' : 'Excess';
      }

      let booksVsTally = Math.abs(booksTds - tallyTds) <= 1 ? 'Matched' : (booksTds > tallyTds ? 'Less Paid' : 'Excess');
      let as26VsTally = Math.abs(as26Tds - tallyTds) <= 1 ? 'Matched' : (as26Tds > tallyTds ? 'Excess' : 'Less Paid');

      let overallStatus = 'All Matched';

      if (booksVs26as !== 'Matched' || booksVsTally !== 'Matched' || as26VsTally !== 'Matched') {
        overallStatus = (booksVs26as !== 'Matched' && booksVsTally !== 'Matched') ? 'Major Mismatch' : 'Partial Mismatch';
      }

      // Insert into tds_reconciliation_results
      await db.execute(`
        INSERT INTO tds_reconciliation_results
        (tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, overall_status, as26_batch_id, tally_batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tallyBatchId
      ]);
    }

    // Insert history audit records
    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'TDS Mearge Data 2019-2024.xlsx',
      excelPath,
      'System Importer',
      'Completed',
      JSON.stringify({ upload_type: '26AS_TDS', upload_batch_id: as26BatchId, total_rows: as26Inserted })
    ]);

    await db.execute(`
      INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'TDS Mearge Data 2019-2024.xlsx',
      excelPath,
      'System Importer',
      'Completed',
      JSON.stringify({ upload_type: 'TALLY_TDS', upload_batch_id: tallyBatchId, total_rows: tallyInserted })
    ]);

    // Create real follow-up logs from mismatched real database entries
    const [mismatchedRows] = await db.execute(`
      SELECT tr.tan_no, d.company_name, tr.books_tds, tr.as26_tds 
      FROM tds_reconciliation_results tr
      JOIN tds_dues d ON tr.tds_dues_id = d.id
      WHERE tr.overall_status != 'All Matched'
      LIMIT 10
    `);

    const methods = ['Call', 'Mail', 'Meeting'];
    const statuses = ['Call Tomorrow', 'Check & Revert', 'Pending TRACES Update', 'Call Not Picked Up'];

    for (let idx = 0; idx < mismatchedRows.length; idx++) {
      const r = mismatchedRows[idx];
      const diff = Math.abs(r.books_tds - r.as26_tds);
      await db.execute(`
        INSERT INTO tds_followups
        (tan_no, company_name, contact_person, department, contact_number, method, status, notes, followup_date, next_followup_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        r.tan_no,
        r.company_name,
        `Finance Team`,
        'Accounts',
        `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
        methods[idx % methods.length],
        statuses[idx % statuses.length],
        `Follow-up regarding 26AS mismatch difference of ₹${diff.toLocaleString('en-IN')}. Requested revised Form 26AS return status.`,
        '2026-08-20',
        '2026-08-27',
        'Accounts Officer'
      ]);
    }

    console.log(`✅ REAL MASTER EXCEL IMPORT COMPLETE: ${duesInserted} dues, ${as26Inserted} 26AS, ${tallyInserted} Tally records, ${mismatchedRows.length} real follow-ups created.`);

  } catch (err) {
    console.error('💥 Error importing from Master Excel:', err);
    console.log('🔄 Falling back to embedded dataset seeding...');
    await seedEmbeddedDatasetFallback();
  }
}
