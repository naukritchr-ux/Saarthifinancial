import {
  getFyWiseReport,
  getTanWiseReport,
  getTanWiseByFyReport
} from '../services/reportsService.js';
import { TDS_TOLERANCE } from '../services/reconciliationRules.js';

export const getFyWiseReportHandler = async (req, res) => {
  const { view = 'all' } = req.query;
  const data = await getFyWiseReport({ view });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getTanWiseReportHandler = async (req, res) => {
  const { view = 'all', search = '' } = req.query;
  const data = await getTanWiseReport({ view, search });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getTanWiseByFyReportHandler = async (req, res) => {
  const { view = 'all', fy = '', search = '' } = req.query;
  const data = await getTanWiseByFyReport({ view, fy, search });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};
