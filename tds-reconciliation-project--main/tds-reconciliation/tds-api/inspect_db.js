import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function inspect() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'crm_db',
      port: parseInt(process.env.DB_PORT || '3306')
    });
    
    console.log('✅ Connected to database. Describing table tds_dues:');
    const [rows] = await connection.execute('DESCRIBE tds_dues');
    console.log(JSON.stringify(rows, null, 2));

  } catch (err) {
    console.error('❌ Error inspecting database:', err);
  } finally {
    if (connection) await connection.end();
  }
}

inspect();
