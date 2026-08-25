-- Create database if not exists
CREATE DATABASE IF NOT EXISTS saarthi_finance;
USE saarthi_finance;

-- 1. Upload History Log
CREATE TABLE IF NOT EXISTS upload_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL DEFAULT 'System',
  status VARCHAR(50) NOT NULL DEFAULT 'Completed',
  metadata JSON,
  upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Form 26AS TDS Uploaded Entries
CREATE TABLE IF NOT EXISTS tds_26as_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  upload_batch_id VARCHAR(50) NOT NULL,
  tan_no VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  financial_year VARCHAR(15) DEFAULT NULL,
  tds_deducted DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (upload_batch_id),
  INDEX (tan_no)
);

-- 3. Tally TDS Ledger Uploaded Entries
CREATE TABLE IF NOT EXISTS tds_tally_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  upload_batch_id VARCHAR(50) NOT NULL,
  tan_no VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  entry_date DATE DEFAULT NULL,
  financial_year VARCHAR(15) DEFAULT NULL,
  tds_deducted DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (upload_batch_id),
  INDEX (tan_no)
);

-- 4. Main TDS Dues (Books) Table
CREATE TABLE IF NOT EXISTS tds_dues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tan_no VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  tds DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  contact_person_name VARCHAR(100) DEFAULT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  financial_year VARCHAR(15) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (tan_no)
);

-- 5. TDS Reconciliation Reports
CREATE TABLE IF NOT EXISTS tds_reconciliation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  upload_batch_id VARCHAR(50) NOT NULL,
  tan_no VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  books_tds DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  as26_tds DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  tally_tds DECIMAL(15, 2) DEFAULT NULL,
  system_status VARCHAR(50) NOT NULL DEFAULT 'Matched',
  manual_status VARCHAR(50) DEFAULT NULL,
  tally_status VARCHAR(50) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_batch_tan (upload_batch_id, tan_no),
  INDEX (upload_batch_id),
  INDEX (tan_no)
);

-- 6. Follow-up Report Tracking
CREATE TABLE IF NOT EXISTS tds_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tan_no VARCHAR(15) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  department VARCHAR(100),
  contact_number VARCHAR(20),
  method VARCHAR(30),
  status VARCHAR(30) NOT NULL,
  notes TEXT,
  followup_date DATE NOT NULL,
  next_followup_date DATE,
  created_by VARCHAR(100) DEFAULT 'System',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (tan_no)
);

