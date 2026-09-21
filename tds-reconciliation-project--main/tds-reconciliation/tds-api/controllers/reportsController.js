import {
  getTallyDataReport,
  getAs26DataReport,
  getSaarthi360DataReport,
  getFyWiseReport,
  getTanWiseReport,
  getTanWiseByFyReport
} from '../services/reportsService.js';
import { TDS_TOLERANCE } from '../services/reconciliationRules.js';

export const getTallyReportHandler = async (req, res) => {
  const { view = 'all', fy = '', company = '', pan = '', search = '' } = req.query;
  const data = await getTallyDataReport({ view, fy, company, pan, search });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getAs26ReportHandler = async (req, res) => {
  const { view = 'all', fy = '', company = '', pan = '', search = '' } = req.query;
  const data = await getAs26DataReport({ view, fy, company, pan, search });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getSaarthi360ReportHandler = async (req, res) => {
  const { view = 'all', fy = '', company = '', pan = '', search = '' } = req.query;
  const data = await getSaarthi360DataReport({ view, fy, company, pan, search });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getFyWiseReportHandler = async (req, res) => {
  const { view = 'all', fy = '' } = req.query;
  const data = await getFyWiseReport({ view, fy });
  res.json({
    success: true,
    data,
    tolerance: TDS_TOLERANCE
  });
};

export const getTanWiseReportHandler = async (req, res) => {
  const { view = 'all', fy = '', search = '' } = req.query;
  const data = await getTanWiseReport({ view, fy, search });
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
