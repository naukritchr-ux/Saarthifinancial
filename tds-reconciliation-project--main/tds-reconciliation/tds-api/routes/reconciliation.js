
/**
 * routes/reconciliation.js — dashboard, report, override, export,
 * CRM sync, and financial TDS report routes.
 *
 * Mounted at /api/tds-26as via routes/tds26asRoutes.js
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
  updateBillStatus,
  updateRecordIdentity
} from '../controllers/tds26asController.js';

// Financial Reports Controller
import {
  getTallyReportHandler,
  getAs26ReportHandler,
  getSaarthi360ReportHandler,
  getFyWiseReportHandler,
  getTanWiseReportHandler,
  getTanWiseByFyReportHandler
} from '../controllers/reportsController.js';

const router = express.Router();

// ── Dashboard & Filters ────────────────────────────────────────
router.get('/dashboard-summary', asyncHandler(getDashboardSummary));
router.get('/filter-options', asyncHandler(getFilterOptions));
router.get('/company-entries', asyncHandler(getCompanyEntries));
router.get('/company-transactions', asyncHandler(getCompanyTransactions));

// ── Reconciliation Report & Updates ────────────────────────────
router.get('/report', asyncHandler(getReconciliationReport));

router.put('/entry/:id', validateId, asyncHandler(updateReconciliationEntry));
router.put('/identity/:id', validateId, asyncHandler(updateRecordIdentity));
router.put('/bill/:id', validateId, asyncHandler(updateBillStatus));

router.put('/override', asyncHandler(overrideReconciliationStatus));
router.post('/crm-book-entry', asyncHandler(createCrmBookEntry));

// Follow-up done toggle
router.put('/report/:id/followup-done', validateId, asyncHandler(toggleFollowupDone));
router.patch('/report/:id/followup-done', validateId, asyncHandler(toggleFollowupDone));

// ── Financial TDS Reports ──────────────────────────────────────
router.get('/reports/tally', asyncHandler(getTallyReportHandler));
router.get('/reports/26as', asyncHandler(getAs26ReportHandler));
router.get('/reports/saarthi360', asyncHandler(getSaarthi360ReportHandler));
router.get('/reports/fy-wise', asyncHandler(getFyWiseReportHandler));
router.get('/reports/tan-wise', asyncHandler(getTanWiseReportHandler));
router.get('/reports/tan-wise-by-fy', asyncHandler(getTanWiseByFyReportHandler));

// ── Export ─────────────────────────────────────────────────────
router.get('/export', asyncHandler(exportReconciliationCSV));

// ── CRM Sync ───────────────────────────────────────────────────
router.post('/sync-saarthi', asyncHandler(syncSaarthiLiveApi));
router.post('/sync-sarthi', asyncHandler(syncSarthiLiveApi));

export default router;
