/**
 * routes/reconciliation.js — dashboard, report, override, export, and CRM sync routes.
 *
 * Mounted at /api/tds-26as via the barrel routes/tds26asRoutes.js
 */
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { validateId } from '../middleware/validate.js';
import {
  getDashboardSummary,
  getReconciliationReport,
  overrideReconciliationStatus,
  exportReconciliationCSV,
  toggleFollowupDone,
  syncSaarthiLiveApi,
  syncSarthiLiveApi
} from '../controllers/tds26asController.js';

const router = express.Router();

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard-summary', asyncHandler(getDashboardSummary));

// ── Reconciliation report & overrides ─────────────────────────────────────────
router.get('/report',    asyncHandler(getReconciliationReport));
router.put('/override',  asyncHandler(overrideReconciliationStatus));

// Follow-up done toggle — support both PUT and PATCH for backward compat
router.put('/report/:id/followup-done',   validateId, asyncHandler(toggleFollowupDone));
router.patch('/report/:id/followup-done', validateId, asyncHandler(toggleFollowupDone));

// ── Export ────────────────────────────────────────────────────────────────────
router.get('/export', asyncHandler(exportReconciliationCSV));

// ── CRM sync (frontend tries both spellings historically) ─────────────────────
router.post('/sync-saarthi', asyncHandler(syncSaarthiLiveApi));
router.post('/sync-sarthi',  asyncHandler(syncSarthiLiveApi));

export default router;
