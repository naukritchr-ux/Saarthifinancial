import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'mysql' or 'sqlite'
let dbAdapter;

if (DB_TYPE === 'sqlite') {
  const dbPath = path.resolve('local.db');
  console.log(`🔌 Initializing SQLite database at: ${dbPath}`);
  
  const sqliteDb = new sqlite3.Database(dbPath);
  
  // Enable foreign key support in SQLite
  sqliteDb.run('PRAGMA foreign_keys = ON;');

  // Translate MySQL-specific SQL functions to SQLite equivalents
  const translateSql = (query) => {
    return query
      .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
      .replace(/JSON_UNQUOTE\(JSON_EXTRACT\(([^,]+),\s*'([^']+)'\)\)/gi, "json_extract($1, '$2')")
      .replace(/ON UPDATE CURRENT_TIMESTAMP/gi, ""); // SQLite handles auto-update via triggers or app-level logic
  };

  dbAdapter = {
    execute: (query, params = []) => {
      const translatedQuery = translateSql(query);
      return new Promise((resolve, reject) => {
        const isSelect = translatedQuery.trim().toUpperCase().startsWith('SELECT') ||
                         translatedQuery.trim().toUpperCase().startsWith('PRAGMA') ||
                         translatedQuery.trim().toUpperCase().startsWith('DESCRIBE');
        
        if (isSelect) {
          sqliteDb.all(translatedQuery, params, (err, rows) => {
            if (err) {
              console.error(`❌ SQLite Exec Error: ${err.message}\nQuery: ${translatedQuery}`);
              reject(err);
            } else {
              resolve([rows]);
            }
          });
        } else {
          sqliteDb.run(translatedQuery, params, function (err) {
            if (err) {
              console.error(`❌ SQLite Exec Error: ${err.message}\nQuery: ${translatedQuery}`);
              reject(err);
            } else {
              // Return metadata compatible with mysql2 result structure
              resolve([{
                affectedRows: this.changes,
                insertId: this.lastID
              }]);
            }
          });
        }
      });
    },
    query: (query, params = []) => {
      return dbAdapter.execute(query, params);
    },
    // Add close helper for clean shutdown
    close: () => {
      return new Promise((resolve, reject) => {
        sqliteDb.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
  
  // Auto-initialize the SQLite database schema if local.db is empty or newly created
  try {
    const schemaSqlPath = path.resolve('schema_sqlite.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      // Split statements by semicolon and run sequentially
      const statements = schemaSql.split(/;\s*$/m);
      for (const statement of statements) {
        if (statement.trim()) {
          sqliteDb.run(statement);
        }
      }
      console.log('✅ Offline SQLite schema verified/loaded.');
    }
  } catch (err) {
    console.error('⚠️ Failed to initialize SQLite schema on startup:', err.message);
  }

} else {
  console.log('🔌 Initializing MySQL database pool');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crm_db',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  dbAdapter = {
    execute: async (query, params = []) => {
      return await pool.execute(query, params);
    },
    query: async (query, params = []) => {
      return await pool.query(query, params);
    },
    close: async () => {
      await pool.end();
    }
  };
}

export default dbAdapter;
