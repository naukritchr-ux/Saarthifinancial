/**
 * routes/reports.js — Tally, 26AS, Saarthi 360, FY-wise, TAN-wise, and TAN-wise-by-FY reports.
 * Mounted at /api/tds-26as via the barrel routes/tds26asRoutes.js
 */
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getTallyReportHandler,
  getAs26ReportHandler,
  getSaarthi360ReportHandler,
  getFyWiseReportHandler,
  getTanWiseReportHandler,
  getTanWiseByFyReportHandler
} from '../controllers/reportsController.js';

const router = express.Router();

// ── 3 Main Report Options ──────────────────────────────────────────────────────
router.get('/reports/tally', asyncHandler(getTallyReportHandler));
router.get('/reports/26as', asyncHandler(getAs26ReportHandler));
router.get('/reports/saarthi360', asyncHandler(getSaarthi360ReportHandler));

// ── Aggregated & Breakdown Reports ─────────────────────────────────────────────
router.get('/reports/fy-wise', asyncHandler(getFyWiseReportHandler));
router.get('/reports/tan-wise', asyncHandler(getTanWiseReportHandler));
router.get('/reports/tan-wise-by-fy', asyncHandler(getTanWiseByFyReportHandler));

export default router;
