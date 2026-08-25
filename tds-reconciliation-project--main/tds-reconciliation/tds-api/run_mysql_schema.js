import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const runSchema = async () => {
  console.log('🔄 Connecting to MySQL database...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'crm_db',
      port: parseInt(process.env.DB_PORT || '3306'),
      multipleStatements: true // Enable multiple statements execution
    });

    console.log('🔌 Connection established. Reading schema_mysql.sql...');
    const schemaPath = path.resolve('schema_mysql.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Could not find schema_mysql.sql at path: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚙️ Executing SQL statements on MySQL database...');
    await connection.query(schemaSql);
    
    console.log('✅ MySQL schema initialized successfully. All tables created and ready.');

  } catch (error) {
    console.error('❌ Error executing MySQL schema migrations:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Connection closed.');
    }
  }
};

runSchema();
