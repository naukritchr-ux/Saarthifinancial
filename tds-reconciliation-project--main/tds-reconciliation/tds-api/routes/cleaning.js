/**
 * routes/cleaning.js — data-cleaning queue routes.
 *
 * Mounted at /api/tds-26as via the barrel routes/tds26asRoutes.js
 */
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { validateId } from '../middleware/validate.js';
import {
  getCleaningQueueCount,
  getCleaningQueue,
  resolveCleaningItem
} from '../controllers/tds26asController.js';

const router = express.Router();

// Fast badge count — pure COUNT(*), cheap. Must be registered before /:id.
router.get('/cleaning-queue/count', asyncHandler(getCleaningQueueCount));

// Full queue (paginated)
router.get('/cleaning-queue', asyncHandler(getCleaningQueue));

// Resolve a single cleaning item
router.put('/cleaning-queue/:id', validateId, asyncHandler(resolveCleaningItem));

export default router;
