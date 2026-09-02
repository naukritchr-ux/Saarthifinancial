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
import apiKeyMiddleware from './middleware/apiKey.js';
import db from './config/db.js';
import { reconcile } from './services/tdsReconciliationService.js';
import { ensureTablesExist, seedEmbeddedDataset } from './seed_embedded_dataset.js';


// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins = allowedOriginsEnv !== '*' ? allowedOriginsEnv.split(',').map(s => s.trim()) : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check & status endpoints for Render deployment health probes
app.get('/', (req, res) => res.json({ status: 'OK', service: 'Saarthi TDS API' }));
app.head('/', (req, res) => res.status(200).end());
app.get('/health', (req, res) => res.json({ status: 'OK', message: 'TDS Reconciliation API is running' }));

// Shared API Key Verification Middleware
app.use(apiKeyMiddleware);

// Ensure uploads folder exists locally
const uploadDirs = ['uploads'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload directory: ${dir}`);
  }
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

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Standalone TDS backend server is listening on port ${PORT}`);
  await ensureTablesExist();
  await seedEmbeddedDataset();
});





