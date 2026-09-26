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
  syncSarthiLiveApi,
  createCrmBookEntry,
  getFilterOptions,
  getCompanyEntries,
  updateReconciliationEntry,
  getCompanyTransactions,
  updateBillStatus
} from '../controllers/tds26asController.js';

const router = express.Router();

// ── Dashboard & Filters ───────────────────────────────────────────────────────
router.get('/dashboard-summary', asyncHandler(getDashboardSummary));
router.get('/filter-options',    asyncHandler(getFilterOptions));
router.get('/company-entries',   asyncHandler(getCompanyEntries));
router.get('/company-transactions', asyncHandler(getCompanyTransactions));

// ── Reconciliation report & updates ───────────────────────────────────────────
router.get('/report',          asyncHandler(getReconciliationReport));
router.put('/entry/:id',       validateId, asyncHandler(updateReconciliationEntry));
router.put('/bill/:id',        validateId, asyncHandler(updateBillStatus));
router.put('/override',        asyncHandler(overrideReconciliationStatus));
router.post('/crm-book-entry', asyncHandler(createCrmBookEntry));

// Follow-up done toggle — support both PUT and PATCH for backward compat
router.put('/report/:id/followup-done',   validateId, asyncHandler(toggleFollowupDone));
router.patch('/report/:id/followup-done', validateId, asyncHandler(toggleFollowupDone));

// ── Export ────────────────────────────────────────────────────────────────────
router.get('/export', asyncHandler(exportReconciliationCSV));

// ── CRM sync (frontend tries both spellings historically) ─────────────────────
router.post('/sync-saarthi', asyncHandler(syncSaarthiLiveApi));
router.post('/sync-sarthi',  asyncHandler(syncSarthiLiveApi));

export default router;

