import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables first so everything below picks them up
dotenv.config();

// Routes
import tds26asRoutes from './routes/tds26asRoutes.js';
import followupRoutes from './routes/followupRoutes.js';

// Middleware
import apiKeyMiddleware from './middleware/apiKey.js';
import { centralErrorHandler } from './middleware/errorHandler.js';

// DB / startup
import db from './config/db.js';
import { ensureTablesExist } from './seed_embedded_dataset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '*';
const allowedOrigins    = allowedOriginsEnv !== '*'
  ? allowedOriginsEnv.split(',').map(s => s.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Health / status (exempt from API key) ─────────────────────────────────────
app.get('/',       (req, res) => res.json({ status: 'OK', service: 'Saarthi TDS API' }));
app.head('/',      (req, res) => res.status(200).end());
app.get('/health', (req, res) => res.json({ status: 'OK', message: 'TDS Reconciliation API is running' }));

// ── API key verification ──────────────────────────────────────────────────────
app.use(apiKeyMiddleware);

// ── Ensure uploads directory exists ──────────────────────────────────────────
['uploads'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload directory: ${dir}`);
  }
});

// ── Route mounting ───────────────────────────────────────────────────────────
app.use('/api/tds-26as', tds26asRoutes);
app.use('/api/tds',      tds26asRoutes);   // legacy alias
app.use('/api/followups', followupRoutes);

// ── 404 — must come after all routes ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ── Centralised error handler — must be last (4-arg signature) ────────────────
app.use(centralErrorHandler);

// ── Server startup ────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀 TDS backend listening on port ${PORT}`);
  await ensureTablesExist();
  console.log('✅ Ready.');
});

// ── Process-level guards — prevent silent crashes ─────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Promise Rejection:', reason);
  // Don't exit — log and continue; Render will restart if truly fatal
});

process.on('uncaughtException', (err) => {
  console.error('💀 Uncaught Exception:', err);
  process.exit(1); // genuinely unrecoverable — let the platform restart
});
