CREATE TABLE IF NOT EXISTS manual_cash_entries (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    type VARCHAR(10) NOT NULL,
    category VARCHAR(100),
    subCategory VARCHAR(100),
    date DATE NOT NULL,
    paymentMode VARCHAR(100),
    referenceId VARCHAR(255),
    description TEXT,
    companyName VARCHAR(255),
    bdAgentId VARCHAR(100),
    franchiseeId VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
