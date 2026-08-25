import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

// Load unified route definitions
import tds26asRoutes from './routes/tds26asRoutes.js';
import followupRoutes from './routes/followupRoutes.js';
import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*', // Allow all origins for standalone dev convenience
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists locally
const uploadDirs = ['uploads'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload directory: ${dir}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'TDS Reconciliation API is running' });
});

// Mount modular TDS & Followup routes
app.use('/api/tds-26as', tds26asRoutes);
app.use('/api/tds', tds26asRoutes);
app.use('/api/followups', followupRoutes);


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('💥 Express Error Handled:', err);
  res.status(500).json({
    success: false,
    error: 'An internal server error occurred',
    message: err.message
  });
});

// ─── Auto-seed SQLite from bundled Excel on first startup ─────────────────────
const autoSeedIfEmpty = async () => {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM tds_26as_entries');
    const count = rows[0]?.count ?? 0;
    if (count > 0) {
      console.log(`✅ SQLite already seeded with ${count} 26AS entries. Skipping seed.`);
      return;
    }

    const excelPath = path.join(__dirname, 'TDS Mearge Data 2019-2024.xlsx');
    if (!fs.existsSync(excelPath)) {
      console.warn('⚠️  Seed Excel file not found, skipping auto-seed.');
      return;
    }

    console.log('🌱 DB is empty — auto-seeding from bundled Excel file...');
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });

    const cleanNumber = (val) => {
      if (!val && val !== 0) return 0;
      const num = parseFloat(String(val).replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };

    // Detect header row
    let headerRowIdx = -1;
    let colMap = { tan_no: -1, deductor_name: -1, amount_paid: -1, tds_deducted: -1, section: -1, quarter: -1 };
    const tanRegex = /^[A-Z]{4}\d{5}[A-Z]$/i;

    for (let r = 0; r < Math.min(100, rawData.length); r++) {
      const row = rawData[r];
      if (!row) continue;
      let hasTan = false, hasTds = false;
      row.forEach(cell => {
        const t = String(cell || '').toLowerCase();
        if (t.includes('tan')) hasTan = true;
        if (t.includes('tds') || t.includes('tax') || t.includes('deducted')) hasTds = true;
      });
      if (hasTan && hasTds) {
        headerRowIdx = r;
        row.forEach((cell, col) => {
          const t = String(cell || '').toLowerCase().trim();
          if (t === 'tan' || t.includes('tan no') || t.includes('tan number') || t.includes('deductor tan')) colMap.tan_no = col;
          if (t.includes('deductor name') || t === 'company name' || t.includes('party name')) colMap.deductor_name = col;
          if (t.includes('amount paid') || t.includes('amount credited') || t.includes('total amount')) colMap.amount_paid = col;
          if (t.includes('tds') || t.includes('tax deducted') || t.includes('deducted')) colMap.tds_deducted = col;
          if (t.includes('section')) colMap.section = col;
          if (t.includes('quarter') || t.includes('period')) colMap.quarter = col;
        });
        break;
      }
    }

    if (colMap.tan_no === -1) {
      colMap = { tan_no: 0, deductor_name: 1, amount_paid: 2, tds_deducted: 3, section: 4, quarter: 5 };
    }

    const uploadBatchId = `batch_seed_${Date.now()}`;
    let inserted = 0;

    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;
      const tan = String(row[colMap.tan_no] || '').trim().toUpperCase().replace(/\s+/g, '');
      if (!tan || !tanRegex.test(tan)) continue;

      try {
        await db.execute(
          'INSERT INTO tds_26as_entries (tan_no, deductor_name, amount_paid, tds_deducted, section, quarter, upload_batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            tan,
            colMap.deductor_name !== -1 ? String(row[colMap.deductor_name] || '').trim() : 'Unknown',
            colMap.amount_paid !== -1 ? cleanNumber(row[colMap.amount_paid]) : 0,
            cleanNumber(row[colMap.tds_deducted]),
            colMap.section !== -1 ? String(row[colMap.section] || '').trim() : 'N/A',
            colMap.quarter !== -1 ? String(row[colMap.quarter] || '').trim() : 'N/A',
            uploadBatchId
          ]
        );
        inserted++;
      } catch (e) {
        // skip duplicate / bad rows
      }
    }

    console.log(`✅ Seeded ${inserted} 26AS entries into SQLite.`);

    if (inserted > 0) {
      await db.execute(
        'INSERT INTO upload_history (file_name, file_path, uploaded_by, status, metadata) VALUES (?, ?, ?, ?, ?)',
        ['TDS Mearge Data 2019-2024.xlsx', excelPath, 'System-AutoSeed', 'Completed',
          JSON.stringify({ upload_batch_id: uploadBatchId, total_rows: inserted })]
      );
      await reconcile(uploadBatchId, null);
      console.log('✅ Reconciliation triggered for seeded data.');
    }
  } catch (err) {
    console.error('⚠️  Auto-seed failed (non-fatal):', err.message);
  }
};

import { seedEmbeddedDataset } from './seed_embedded_dataset.js';

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Standalone TDS backend server is listening on port ${PORT}`);
  await autoSeedIfEmpty();
  await seedEmbeddedDataset();
});


