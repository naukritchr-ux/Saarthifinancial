/**
 * routes/tds26asRoutes.js — barrel router.
 *
 * Mounts three domain-scoped sub-routers so server.js keeps a single
 * app.use('/api/tds-26as', tds26asRoutes) line while the actual route
 * definitions live in focused, maintainable files.
 *
 *   uploads.js        → /upload-26as, /upload-tally, /batches, /purge, /seed
 *   cleaning.js       → /cleaning-queue, /cleaning-queue/count
 *   reconciliation.js → /dashboard-summary, /report, /override, /export,
 *                        /sync-saarthi, /sync-sarthi
 */
import express from 'express';
import uploadRoutes       from './uploads.js';
import cleaningRoutes     from './cleaning.js';
import reconcileRoutes    from './reconciliation.js';
import reportsRoutes      from './reports.js';

const router = express.Router();

router.use('/', uploadRoutes);
router.use('/', cleaningRoutes);
router.use('/', reconcileRoutes);
router.use('/', reportsRoutes);

export default router;