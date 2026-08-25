import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const fixSchema = async () => {
  let connection;
  try {
    console.log('🔄 Connecting to MySQL database to fix schema...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'crm_db',
      port: parseInt(process.env.DB_PORT || '3306')
    });

    console.log('🗑️ Dropping old tds_26as_entries table...');
    // Disable foreign keys temporarily if needed (not needed for 26as, but safe)
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DROP TABLE IF EXISTS tds_26as_entries');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🏗️ Recreating tds_26as_entries with correct columns...');
    await connection.execute(`
      CREATE TABLE tds_26as_entries (
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
    `);

    console.log('✅ Schema fixed successfully. tds_26as_entries is now in sync with specification.');

  } catch (error) {
    console.error('❌ Error fixing MySQL schema:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
  }
};

fixSchema();
