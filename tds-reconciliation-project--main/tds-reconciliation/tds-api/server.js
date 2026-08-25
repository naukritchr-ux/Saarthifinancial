import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load unified route definitions
import tds26asRoutes from './routes/tds26asRoutes.js';

// Load environment variables
dotenv.config();

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

// Mount modular TDS routes
app.use('/api/tds-26as', tds26asRoutes);

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
app.listen(PORT, () => {
  console.log(`🚀 Standalone TDS backend server is listening on port ${PORT}`);
});
