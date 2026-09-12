/**
 * routes/reports.js — FY-wise, TAN-wise, and TAN-wise-by-FY aggregated reports.
 * Mounted at /api/tds-26as via the barrel routes/tds26asRoutes.js
 */
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getFyWiseReportHandler,
  getTanWiseReportHandler,
  getTanWiseByFyReportHandler
} from '../controllers/reportsController.js';

const router = express.Router();

router.get('/reports/fy-wise', asyncHandler(getFyWiseReportHandler));
router.get('/reports/tan-wise', asyncHandler(getTanWiseReportHandler));
router.get('/reports/tan-wise-by-fy', asyncHandler(getTanWiseByFyReportHandler));

export default router;
