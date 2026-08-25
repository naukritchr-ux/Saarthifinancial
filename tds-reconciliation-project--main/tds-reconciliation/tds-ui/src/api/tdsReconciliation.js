import { API_URL } from '../config/constants';

// Helper to construct query string
const buildQuery = (params) => {
  const query = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      query.append(key, params[key]);
    }
  });
  return query.toString();
};

/**
 * Upload Form 26AS CSV file
 */
export const upload26as = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/api/tds-26as/upload-26as`, {
    method: 'POST',
    body: formData,
  });
  return await response.json();
};

/**
 * Upload Tally CSV file
 */
export const uploadTally = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}/api/tds-26as/upload-tally`, {
    method: 'POST',
    body: formData,
  });
  return await response.json();
};

/**
 * Get Paginated Reconciliation Results
 */
export const getReconciliationReport = async (filters) => {
  const queryStr = buildQuery(filters);
  const response = await fetch(`${API_URL}/api/tds-26as/report?${queryStr}`);
  return await response.json();
};

/**
 * Manually Override Pairwise/Overall status
 */
export const applyStatusOverride = async (overrideData) => {
  const response = await fetch(`${API_URL}/api/tds-26as/override`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(overrideData),
  });
  return await response.json();
};

/**
 * Get historical upload batches
 */
export const getUploadHistory = async () => {
  const response = await fetch(`${API_URL}/api/tds-26as/batches`);
  return await response.json();
};

/**
 * Get CSV download link URL
 */
export const getCsvExportUrl = (filters) => {
  const queryStr = buildQuery(filters);
  return `${API_URL}/api/tds-26as/export?${queryStr}`;
};
