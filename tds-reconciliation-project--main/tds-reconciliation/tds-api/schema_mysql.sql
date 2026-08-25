-- MySQL Schema definition for shared database integration

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
  voucher_date DATE,
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
  books_vs_26as_status ENUM('Excess','Less Paid','Not Received','Matched'),
  books_vs_tally_status ENUM('Excess','Less Paid','Not Received','Matched'),
  as26_vs_tally_status ENUM('Excess','Less Paid','Not Received','Matched'),
  overall_status ENUM('All Matched','Partial Mismatch','Major Mismatch') NOT NULL,
  as26_batch_id VARCHAR(50),
  tally_batch_id VARCHAR(50),
  is_manually_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tds_dues_id) REFERENCES tds_dues(id),
  UNIQUE KEY unique_batch_due (as26_batch_id, tally_batch_id, tds_dues_id),
  INDEX idx_overall (overall_status),
  INDEX idx_tan (tan_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tds_reconciliation_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reconciliation_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  changed_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reconciliation_id) REFERENCES tds_reconciliation_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
