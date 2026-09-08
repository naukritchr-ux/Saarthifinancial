import express from 'express';
import multer from 'multer';
import {
  seedDatabaseEndpoint,
  upload26as,
  uploadTally,
  getDashboardSummary,
  getCleaningQueue,
  getCleaningQueueCount,
  resolveCleaningItem,
  getReconciliationReport,
  overrideReconciliationStatus,
  getUploadHistory,
  exportReconciliationCSV,
  purgeUploadData,
  deleteUploadBatch,
  syncSaarthiLiveApi,
  syncSarthiLiveApi,
  toggleFollowupDone
} from '../controllers/tds26asController.js';

const router = express.Router();

// Multer stores uploaded 26AS/Tally files to disk so the controller can
// read them with xlsx.readFile(file.path)
const upload = multer({ dest: 'uploads/' });

// Seeding
router.post('/seed', seedDatabaseEndpoint);

// File uploads
router.post('/upload-26as', upload.single('file'), upload26as);
router.post('/upload-tally', upload.single('file'), uploadTally);

// Dashboard
router.get('/dashboard-summary', getDashboardSummary);

// Cleaning queue
router.get('/cleaning-queue/count', getCleaningQueueCount);   // fast badge count
router.get('/cleaning-queue', getCleaningQueue);
router.put('/cleaning-queue/:id', resolveCleaningItem);

// Reconciliation report
router.get('/report', getReconciliationReport);
router.put('/override', overrideReconciliationStatus);
router.put('/report/:id/followup-done', toggleFollowupDone);
router.patch('/report/:id/followup-done', toggleFollowupDone);

// Export
router.get('/export', exportReconciliationCSV);

// Upload history / batches
router.get('/batches', getUploadHistory);
router.delete('/batches/:id', deleteUploadBatch);

// Data purge
router.post('/purge', purgeUploadData);
router.delete('/purge', purgeUploadData);

// Live Saarthi/Sarthi CRM sync (frontend tries both spellings)
router.post('/sync-sarthi', syncSarthiLiveApi);
router.post('/sync-saarthi', syncSaarthiLiveApi);

export default router;