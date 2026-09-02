-- MySQL Schema definition for shared Aiven database integration

CREATE TABLE IF NOT EXISTS tds_dues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id VARCHAR(50) UNIQUE,
  bill_number VARCHAR(50),
  bill_date VARCHAR(30),
  company_name VARCHAR(255),
  total_bill_amount DECIMAL(15,2),
  tds DECIMAL(15,2),
  contact_number VARCHAR(30),
  teamleader VARCHAR(100),
  payment_date VARCHAR(30),
  tan_no VARCHAR(20),
  amount_received DECIMAL(15,2),
  status VARCHAR(50),
  contact_person_name VARCHAR(100),
  note TEXT,
  financial_year VARCHAR(20),
  INDEX idx_tan (tan_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tds_26as_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tan_no VARCHAR(20) NOT NULL,
  deductor_name VARCHAR(255),
  amount_paid DECIMAL(15,2),
  tds_deducted DECIMAL(15,2) NOT NULL,
  section VARCHAR(20),
  quarter VARCHAR(10),
  upload_batch_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tan (tan_no),
  INDEX idx_batch (upload_batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tds_tally_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tan_no VARCHAR(20),
  party_name VARCHAR(255),
  gst_num VARCHAR(30),
  pan_no VARCHAR(20),
  voucher_date VARCHAR(30),
  amount DECIMAL(15,2),
  tds_amount DECIMAL(15,2) NOT NULL,
  ledger_name VARCHAR(255),
  upload_batch_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tan (tan_no),
  INDEX idx_batch (upload_batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tds_reconciliation_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tds_dues_id INT NOT NULL,
  tan_no VARCHAR(20) NOT NULL,
  books_tds DECIMAL(15,2) NOT NULL,
  as26_tds DECIMAL(15,2) DEFAULT 0.00,
  tally_tds DECIMAL(15,2) DEFAULT 0.00,
  books_vs_26as_status VARCHAR(50),
  books_vs_tally_status VARCHAR(50),
  as26_vs_tally_status VARCHAR(50),
  overall_status VARCHAR(50) NOT NULL,
  as26_batch_id VARCHAR(50),
  tally_batch_id VARCHAR(50),
  is_manually_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_overall (overall_status),
  INDEX idx_tan (tan_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS upload_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL DEFAULT 'System',
  status VARCHAR(50) NOT NULL DEFAULT 'Completed',
  metadata JSON,
  upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tds_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tan_no VARCHAR(20) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  department VARCHAR(100),
  contact_number VARCHAR(30),
  method VARCHAR(30),
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  followup_date VARCHAR(30) NOT NULL,
  next_followup_date VARCHAR(30),
  created_by VARCHAR(100) DEFAULT 'System',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tan (tan_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
