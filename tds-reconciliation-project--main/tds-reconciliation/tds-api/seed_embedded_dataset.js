import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

// Embedded dataset from user prompt
const FYS = ["FY 2019-20", "FY 2020-21", "FY 2021-22", "FY 2022-23", "FY 2023-24", "FY 2024-25"];

export async function seedEmbeddedDataset(force = false) {
  try {
    const [recCountRows] = await db.execute('SELECT COUNT(*) as count FROM tds_reconciliation_results');
    const recCount = recCountRows[0]?.count ?? 0;

    if (recCount > 0 && !force) {
      console.log(`✅ Database already seeded with ${recCount} reconciliation records. Skipping dataset seed.`);
      return;
    }

    console.log('🌱 Seeding database with full embedded TDS reconciliation dataset...');


    // Sample entities representing major categories (matching dataset TANs)
    const entities = [
      { tan: "AHMS32413D", tallyName: "SEA BAUFORMAT INDIA PRIVATE LIMITED", as26Name: "SEA BAUFORMAT INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 4410, as26Tds: 4875, booksTds: 4410, phone: "+91 98201 44512", contact: "Rajesh Sharma", dept: "Finance" },
      { tan: "DELT10133E", tallyName: "TARAASHNA FINANCIAL SERVICES LIMITED", as26Name: "TARAASHNA FINANCIAL SERVICES LIMITED", fyIdx: 4, tallyTds: 18603, as26Tds: 24067, booksTds: 18603, phone: "+91 98112 33490", contact: "Vikram Malhotra", dept: "Accounts" },
      { tan: "MUMF08127A", tallyName: "FOURTH QUADRANT LEARNING SOLUTIONS", as26Name: "FOURTH QUADRANT LEARNING SOLUTIONS", fyIdx: 3, tallyTds: 14994, as26Tds: 14994, booksTds: 14994, phone: "+91 98210 99423", contact: "Anish Gupta", dept: "HR" },
      { tan: "RTKC02915D", tallyName: "CREATIVE LIPI WEBTECH PRIVATE LIMITED", as26Name: "CREATIVE LIPI WEBTECH PRIVATE LIMITED", fyIdx: 3, tallyTds: 7081, as26Tds: 7081, booksTds: 7081, phone: "+91 97170 55431", contact: "Sanjay Dixit", dept: "Legal" },
      { tan: "MUML11282F", tallyName: "Luxifer Beauty Nutrition Private limited", as26Name: "LUXIFER BEAUTY NUTRITION PRIVATE LIMITED", fyIdx: 0, tallyTds: 563, as26Tds: 563, booksTds: 563, phone: "+91 99304 12890", contact: "Pooja Mehta", dept: "Accounts" },
      { tan: "MUMQ01239A", tallyName: "QUODECK TECHNOLOGIES PRIVATE LIMITED", as26Name: "QUODECK TECHNOLOGIES PRIVATE LIMITED", fyIdx: 0, tallyTds: 1499, as26Tds: 1499, booksTds: 1499, phone: "+91 98205 66712", contact: "Kamal Roy", dept: "Finance" },
      { tan: "BLRA08721G", tallyName: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", as26Name: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", fyIdx: 2, tallyTds: 69580, as26Tds: 53660, booksTds: 69580, phone: "+91 80 4123 9901", contact: "Sunil Kumar", dept: "Taxation" },
      { tan: "BLRA01292E", tallyName: "ALIMENT SOFTWARE TECHNOLOGIES PVT LTD", as26Name: "ALIMENT SOFTWARE TECHNOLOGIES PVT LTD", fyIdx: 4, tallyTds: 14845, as26Tds: 14845, booksTds: 14845, phone: "+91 80 2341 8820", contact: "Meera Nair", dept: "Accounts" },
      { tan: "CALA06799C", tallyName: "ALUDECOR LAMINATION PRIVATE LIMITED", as26Name: "ALUDECOR LAMINATION PRIVATE LIMITED", fyIdx: 4, tallyTds: 101970, as26Tds: 101970, booksTds: 101970, phone: "+91 33 4001 2290", contact: "Amitabh Banerjee", dept: "Finance" },
      { tan: "CHEG07464C", tallyName: "KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED", as26Name: "KANINI SOFTWARE SOLUTIONS INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 167859, as26Tds: 167850, booksTds: 167859, phone: "+91 44 2450 1199", contact: "Karthik Raja", dept: "Accounts" },
      { tan: "DELB13122E", tallyName: "BigFoot Retail Solutions Private Limited", as26Name: "SHIPROCKET PRIVATE LIMITED", fyIdx: 2, tallyTds: 3748, as26Tds: 16244, booksTds: 3748, phone: "+91 11 4980 3341", contact: "Rohan Kapoor", dept: "Billing" },
      { tan: "DELM26337D", tallyName: "MIND ITSYS PRIVATE LIMITED", as26Name: "MIND ITSYS PRIVATE LIMITED", fyIdx: 2, tallyTds: 41094, as26Tds: 28292, booksTds: 41094, phone: "+91 11 2618 9012", contact: "Neha Verma", dept: "Finance" },
      { tan: "HYDM09642D", tallyName: "MAZIK TECH SOLUTIONS PVT LTD", as26Name: "MAZIK TECH SOLUTIONS PVT LTD", fyIdx: 3, tallyTds: 54460, as26Tds: 54460, booksTds: 54460, phone: "+91 40 6678 1200", contact: "Srinivas Rao", dept: "Tax" },
      { tan: "MUMA58959F", tallyName: "ASIAN ENERGY SERVICES LIMITED", as26Name: "ASIAN ENERGY SERVICES LIMITED", fyIdx: 3, tallyTds: 125900, as26Tds: 121072, booksTds: 125900, phone: "+91 22 6123 8800", contact: "Pradeep Joshi", dept: "Finance" },
      { tan: "MUMN09514B", tallyName: "NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED", as26Name: "NATIONAL COMMODITY AND DERIVATIVES EXCHANGE LIMITED", fyIdx: 4, tallyTds: 23148, as26Tds: 23149, booksTds: 23148, phone: "+91 22 6634 1100", contact: "Deepak Shah", dept: "Accounts" },
      { tan: "PNEU06707B", tallyName: "UNIPART SERVICES INDIA PRIVATE LIMITED", as26Name: "UNIPART SERVICES INDIA PRIVATE LIMITED", fyIdx: 3, tallyTds: 94654, as26Tds: 94653, booksTds: 94654, phone: "+91 20 6711 4400", contact: "Ganesh Kulkarni", dept: "Finance" },
      { tan: "UNKNOWN_TAN_1", tallyName: "Unmatched Deductor Services Ltd", as26Name: "", fyIdx: 4, tallyTds: 12500, as26Tds: 0, booksTds: 12500, phone: "+91 99000 11122", contact: "Unknown", dept: "Accounts" },
      { tan: "INVALID123", tallyName: "Name Discrepancy Corp", as26Name: "Name Discrepancy India Pvt Ltd", fyIdx: 4, tallyTds: 8900, as26Tds: 8900, booksTds: 8900, phone: "+91 98888 77766", contact: "Suresh P", dept: "Finance" }
    ];

    const as26BatchId = `batch_26as_seed_2024`;
    const tallyBatchId = `batch_tally_seed_2024`;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const fyStr = FYS[e.fyIdx] || "FY 2023-24";
      const billNo = `INV-2024-${1001 + i}`;

      // 1. Insert into tds_dues (Saarthi 360)
      const [dueRes] = await db.execute(`
        INSERT INTO tds_dues 
        (invoice_id, bill_number, bill_date, company_name, total_bill_amount, tds, contact_number, tan_no, status, contact_person_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `INV_ID_${1001 + i}`,
        billNo,
        '2024-04-15',
        e.tallyName,
        e.booksTds * 10,
        e.booksTds,
        e.phone,
        e.tan,
        e.booksTds === e.as26Tds ? 'Matched' : (e.booksTds > e.as26Tds ? 'Less Paid' : 'Excess'),
        e.contact
      ]);

      const dueId = dueRes.insertId;

      // 2. Insert into tds_26as_entries if non-zero
      if (e.as26Tds > 0) {
        await db.execute(`
          INSERT INTO tds_26as_entries
          (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id)
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

      // 3. Insert into tds_tally_entries if non-zero
      if (e.tallyTds > 0) {
        await db.execute(`
          INSERT INTO tds_tally_entries
          (tan_no, party_name, voucher_date, amount, tds_amount, ledger_name, upload_batch_id)
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

      // 4. Calculate pairwise statuses
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

      // Insert into tds_reconciliation_results
      await db.execute(`
        INSERT INTO tds_reconciliation_results
        (tds_dues_id, tan_no, books_tds, as26_tds, tally_tds, books_vs_26as_status, books_vs_tally_status, as26_vs_tally_status, overall_status, as26_batch_id, tally_batch_id)
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

    // 5. Seed upload history
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

    // 6. Seed sample follow-up logs
    const sampleFollowups = [
      { tan: "AHMS32413D", company: "SEA BAUFORMAT INDIA PRIVATE LIMITED", contact: "Rajesh Sharma", dept: "Finance", phone: "+91 98201 44512", method: "Call", status: "Call Tomorrow", notes: "Called regarding Form 26AS mismatch of ₹465. Client agreed to verify Traces certificate.", followupDate: "2026-08-20", nextDate: "2026-08-26" },
      { tan: "DELT10133E", company: "TARAASHNA FINANCIAL SERVICES LIMITED", contact: "Vikram Malhotra", dept: "Accounts", phone: "+91 98112 33490", method: "Mail", status: "Check & Revert", notes: "Emailed TDS deduction breakdown. Accountant checking Traces portal.", followupDate: "2026-08-22", nextDate: "2026-08-27" },
      { tan: "DELB13122E", company: "SHIPROCKET PRIVATE LIMITED", contact: "Rohan Kapoor", dept: "Billing", phone: "+91 11 4980 3341", method: "Call", status: "Call Not Picked Up", notes: "No answer on primary landline. Scheduled retry for tomorrow morning.", followupDate: "2026-08-24", nextDate: "2026-08-25" },
      { tan: "DELM26337D", company: "MIND ITSYS PRIVATE LIMITED", contact: "Neha Verma", dept: "Finance", phone: "+91 11 2618 9012", method: "Call", status: "TDS Paid", notes: "Confirmed credit deposited in Q2 filing. Revised 26AS updated.", followupDate: "2026-08-18", nextDate: null },
      { tan: "BLRA08721G", company: "ATIMI SOFTWARE (INDIA) PRIVATE LIMITED", contact: "Sunil Kumar", dept: "Taxation", phone: "+91 80 4123 9901", method: "Mail", status: "Form Received", notes: "Form 16A received via email and attached to audit trail.", followupDate: "2026-08-15", nextDate: null }
    ];

    for (const f of sampleFollowups) {
      await db.execute(`
        INSERT INTO tds_followups
        (tan_no, company_name, contact_person, department, contact_number, method, status, notes, followup_date, next_followup_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [f.tan, f.company, f.contact, f.dept, f.phone, f.method, f.status, f.notes, f.followupDate, f.nextDate, 'Accounts Manager']);
    }

    console.log('✅ Successfully seeded embedded dataset with 18 entities, 2 upload batches, and 5 follow-up records.');

  } catch (err) {
    console.error('💥 Error seeding embedded dataset:', err);
  }
}
