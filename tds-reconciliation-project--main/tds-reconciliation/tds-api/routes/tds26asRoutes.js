import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateUser } from '../middleware/auth2.js';
import {
  upload26as,
  uploadTally,
  getReconciliationReport,
  overrideReconciliationStatus,
  getUploadHistory,
  exportReconciliationCSV,
  getDashboardSummary,
  getCleaningQueue,
  resolveCleaningItem,
  seedDatabaseEndpoint,
  purgeUploadData,
  deleteUploadBatch,
  syncSaarthiLiveApi
} from '../controllers/tds26asController.js';

const router = express.Router();

// Local multer config for file uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  }
});

// Mount endpoints
router.get('/seed', seedDatabaseEndpoint);
router.post('/seed', seedDatabaseEndpoint);
router.get('/sync-saarthi', syncSaarthiLiveApi);
router.post('/sync-saarthi', syncSaarthiLiveApi);
router.post('/upload-26as', upload.single('file'), upload26as);
router.post('/upload-tally', upload.single('file'), uploadTally);
router.get('/purge', purgeUploadData);
router.post('/purge', purgeUploadData);
router.delete('/purge', purgeUploadData);
router.get('/dashboard-summary', getDashboardSummary);
router.get('/cleaning-queue', getCleaningQueue);
router.put('/cleaning-queue/:id', resolveCleaningItem);
router.get('/report', getReconciliationReport);
router.put('/override', overrideReconciliationStatus);
router.get('/batches', getUploadHistory);
router.delete('/batches/:id', deleteUploadBatch);
router.get('/export', exportReconciliationCSV);



export default router;
