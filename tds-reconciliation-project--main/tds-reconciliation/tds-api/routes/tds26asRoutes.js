/**
 * routes/tds26asRoutes.js — barrel router.
 * Mounts the upload, cleaning and reconciliation route groups.
 * Report endpoints must be registered by reconciliation.js using named
 * controller exports from ./reports.js; reports.js is not an Express router.
 */
import express from 'express';
import uploadRoutes from './uploads.js';
import cleaningRoutes from './cleaning.js';
import reconcileRoutes from './reconciliation.js';

const router = express.Router();

router.use('/', uploadRoutes);
router.use('/', cleaningRoutes);
router.use('/', reconcileRoutes);

export default router;
