import { API_URL } from '../config/constants';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      if (Array.isArray(params[key])) {
        if (params[key].length > 0) query.append(key, params[key].join(','));
      } else {
        query.append(key, params[key]);
      }
    }
  });
  return query.toString();
};

export const triggerSeed = async () => {
  const response = await fetch(`${API_URL}/api/tds-26as/seed`);
  return await response.json();
};

/** Dashboard API */
export const getDashboardSummary = async (fy = '') => {
  const q = buildQuery({ fy });
  const response = await fetch(`${API_URL}/api/tds-26as/dashboard-summary?${q}`);
  return await response.json();
};


/** Cleaning Queue API */
export const getCleaningQueue = async () => {
  const response = await fetch(`${API_URL}/api/tds-26as/cleaning-queue`);
  return await response.json();
};

export const resolveCleaningItem = async (id, data) => {
  const response = await fetch(`${API_URL}/api/tds-26as/cleaning-queue/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
};

/** Reconciliation Report API */
export const getReconciliationReport = async (filters = {}) => {
  const q = buildQuery(filters);
  const response = await fetch(`${API_URL}/api/tds-26as/report?${q}`);
  return await response.json();
};

export const applyStatusOverride = async (overrideData) => {
  const response = await fetch(`${API_URL}/api/tds-26as/override`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrideData)
  });
  return await response.json();
};

export const getCsvExportUrl = (filters = {}) => {
  const q = buildQuery(filters);
  return `${API_URL}/api/tds-26as/export?${q}`;
};

/** File Upload API */
export const upload26as = async (file, financialYear) => {
  const formData = new FormData();
  formData.append('file', file);
  if (financialYear) formData.append('financialYear', financialYear);
  const response = await fetch(`${API_URL}/api/tds-26as/upload-26as`, {
    method: 'POST',
    body: formData
  });
  return await response.json();
};

export const uploadTally = async (file, financialYear) => {
  const formData = new FormData();
  formData.append('file', file);
  if (financialYear) formData.append('financialYear', financialYear);
  const response = await fetch(`${API_URL}/api/tds-26as/upload-tally`, {
    method: 'POST',
    body: formData
  });
  return await response.json();
};

/** Upload History API */
export const getUploadHistory = async () => {
  const response = await fetch(`${API_URL}/api/tds-26as/batches`);
  return await response.json();
};

/** Follow-up API */
export const getFollowupSummary = async () => {
  const response = await fetch(`${API_URL}/api/followups/summary`);
  return await response.json();
};

export const getFollowups = async (filters = {}) => {
  const q = buildQuery(filters);
  const response = await fetch(`${API_URL}/api/followups?${q}`);
  return await response.json();
};

export const createFollowup = async (data) => {
  const response = await fetch(`${API_URL}/api/followups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
};

export const updateFollowup = async (id, data) => {
  const response = await fetch(`${API_URL}/api/followups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
};
