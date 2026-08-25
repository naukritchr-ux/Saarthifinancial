-- Offline mock CRM Books table
CREATE TABLE IF NOT EXISTS tds_dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  status TEXT CHECK(status IN ('pending','paid','overdue','Not Received','Received','Less Paid','Excess')),
  contact_person_name TEXT,
  note TEXT,
  financial_year TEXT
);


-- Parsed Form 26AS entries
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
);

-- Parsed Tally entries
CREATE TABLE IF NOT EXISTS tds_tally_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tan_no TEXT NOT NULL,
  party_name TEXT,
  voucher_date TEXT,
  amount DECIMAL(15,2),
  tds_amount DECIMAL(15,2) NOT NULL,
  ledger_name TEXT,
  upload_batch_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Three-way reconciliation results table
CREATE TABLE IF NOT EXISTS tds_reconciliation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tds_dues_id INTEGER NOT NULL,
  tan_no TEXT NOT NULL,
  books_tds DECIMAL(15,2) NOT NULL,
  as26_tds DECIMAL(15,2) DEFAULT 0.00,
  tally_tds DECIMAL(15,2) DEFAULT 0.00,
  books_vs_26as_status TEXT CHECK(books_vs_26as_status IN ('Excess','Less Paid','Not Received','Matched')),
  books_vs_tally_status TEXT CHECK(books_vs_tally_status IN ('Excess','Less Paid','Not Received','Matched')),
  as26_vs_tally_status TEXT CHECK(as26_vs_tally_status IN ('Excess','Less Paid','Not Received','Matched')),
  overall_status TEXT CHECK(overall_status IN ('All Matched','Partial Mismatch','Major Mismatch')) NOT NULL,
  as26_batch_id TEXT,
  tally_batch_id TEXT,
  is_manually_edited INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tds_dues_id) REFERENCES tds_dues(id) ON DELETE CASCADE,
  UNIQUE(as26_batch_id, tally_batch_id, tds_dues_id)
);

-- Reconciliation overrides audit logs
CREATE TABLE IF NOT EXISTS tds_reconciliation_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reconciliation_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  changed_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reconciliation_id) REFERENCES tds_reconciliation_results(id) ON DELETE CASCADE
);

-- Mock Upload History log
CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT 'System',
  status TEXT NOT NULL DEFAULT 'Completed',
  metadata TEXT,
  upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up Report tracking table
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
);

