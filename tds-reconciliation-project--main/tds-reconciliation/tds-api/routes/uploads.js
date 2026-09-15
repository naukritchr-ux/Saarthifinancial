/**
 * routes/uploads.js — file upload, batch management, and seeding routes.
 *
 * Mounted at /api/tds-26as via the barrel routes/tds26asRoutes.js
 */
import express from 'express';
import multer from 'multer';
import asyncHandler from '../middleware/asyncHandler.js';
import { validateId } from '../middleware/validate.js';
import {
  seedDatabaseEndpoint,
  upload26as,
  uploadTally,
  getUploadHistory,
  deleteUploadBatch,
  purgeUploadData
} from '../controllers/tds26asController.js';

import os from 'os';

const router = express.Router();

// Multer — temporary disk storage with 50 MB limit
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ── Seeding ──────────────────────────────────────────────────────────────────
router.post('/seed', asyncHandler(seedDatabaseEndpoint));

// ── File uploads ─────────────────────────────────────────────────────────────
router.post('/upload-26as',  upload.single('file'), asyncHandler(upload26as));
router.post('/upload-tally', upload.single('file'), asyncHandler(uploadTally));

// ── Upload history / batch management ────────────────────────────────────────
router.get('/batches',        asyncHandler(getUploadHistory));
router.delete('/batches/:id', validateId, asyncHandler(deleteUploadBatch));

// ── Data purge (supports both DELETE and POST for browser compatibility) ──────
router.post('/purge',   asyncHandler(purgeUploadData));
router.delete('/purge', asyncHandler(purgeUploadData));

export default router;
