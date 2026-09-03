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

const API_KEY = import.meta.env.VITE_API_KEY || 'saarthi-secret-api-key-2026';

// Fetch wrapper with 15s timeout to allow Render free tier cold-starts to wake up
const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    'X-API-Key': API_KEY,
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

export const triggerSeed = async () => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/seed`);
    return await response.json();
  } catch (err) {
    return { success: false, error: err.message || 'Failed to trigger seed' };
  }
};

/** Dashboard API */
export const getDashboardSummary = async (fy = '') => {
  try {
    const q = buildQuery({ fy });
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/dashboard-summary?${q}`);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to load dashboard summary' };
  } catch (err) {
    return { success: false, error: err.message || 'Error connecting to dashboard service' };
  }
};

/** Cleaning Queue API */
export const getCleaningQueue = async () => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/cleaning-queue`);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to load cleaning queue', count: 0, data: [] };
  } catch (err) {
    return { success: false, error: err.message || 'Error connecting to cleaning queue', count: 0, data: [] };
  }
};

export const resolveCleaningItem = async (id, data) => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/cleaning-queue/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await response.json();
    if (response.ok && resData && resData.success !== false) return resData;
    return { success: false, error: resData?.error || 'Failed to resolve cleaning item' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error resolving item' };
  }
};

/** Reconciliation Report API */
export const getReconciliationReport = async (filters = {}) => {
  try {
    const q = buildQuery(filters);
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/report?${q}`);
    const data = await response.json();
    if (response.ok && data && data.success !== false && Array.isArray(data.data)) {
      return data;
    }
    return { success: false, error: data?.error || 'Failed to load reconciliation report', data: [], total: 0 };
  } catch (err) {
    return { success: false, error: err.message || 'Error connecting to reconciliation service', data: [], total: 0 };
  }
};

export const applyStatusOverride = async (overrideData) => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrideData)
    });
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to apply status override' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error applying status override' };
  }
};

export const getCsvExportUrl = (filters = {}) => {
  const q = buildQuery(filters);
  return `${API_URL}/api/tds-26as/export?${q}`;
};

export const syncSaarthiLiveApi = async () => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/sync-saarthi`, {
      method: 'POST'
    }, 60000);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to sync live Saarthi data' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error syncing live Saarthi data' };
  }
};

/** File Upload API */
export const upload26as = async (file, modeOrFy = 'update', modeParam = 'update') => {
  let importMode = 'update';
  let financialYear = '';
  if (modeOrFy === 'clean' || modeOrFy === 'update') importMode = modeOrFy;
  else if (modeOrFy) financialYear = modeOrFy;
  if (modeParam === 'clean' || modeParam === 'update') importMode = modeParam;

  const formData = new FormData();
  formData.append('file', file);
  if (financialYear) formData.append('financialYear', financialYear);
  formData.append('importMode', importMode);

  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/upload-26as`, {
      method: 'POST',
      body: formData
    }, 60000);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to upload 26AS file' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error during 26AS upload' };
  }
};

export const uploadTally = async (file, modeOrFy = 'update', modeParam = 'update') => {
  let importMode = 'update';
  let financialYear = '';
  if (modeOrFy === 'clean' || modeOrFy === 'update') importMode = modeOrFy;
  else if (modeOrFy) financialYear = modeOrFy;
  if (modeParam === 'clean' || modeParam === 'update') importMode = modeParam;

  const formData = new FormData();
  formData.append('file', file);
  if (financialYear) formData.append('financialYear', financialYear);
  formData.append('importMode', importMode);

  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/upload-tally`, {
      method: 'POST',
      body: formData
    }, 60000);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to upload Tally file' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error during Tally upload' };
  }
};

export const purgeData = async (target = 'all') => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    }, 60000);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to purge data on server' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error purging data' };
  }
};

/** Upload History API */
export const getUploadHistory = async () => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/batches`);
    const data = await response.json();
    if (response.ok && data && data.success !== false && Array.isArray(data.data)) {
      return data;
    }
    return { success: false, error: data?.error || 'Failed to fetch upload history from server', data: [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching upload history', data: [] };
  }
};

export const deleteUploadBatch = async (id, batchId = null) => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/tds-26as/batches/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId })
    });
    const data = await response.json();
    if (response.ok && data && data.success !== false) {
      return data;
    }
    return { success: false, error: data?.error || data?.message || 'Failed to delete upload batch from server' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error deleting upload batch' };
  }
};

/** Follow-up API */
export const getFollowupSummary = async () => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/followups/summary`);
    const data = await response.json();
    if (response.ok && data && data.success !== false) return data;
    return { success: false, error: data?.error || 'Failed to fetch follow-up summary' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching follow-up summary' };
  }
};

export const getFollowups = async (filters = {}) => {
  try {
    const q = buildQuery(filters);
    const response = await fetchWithTimeout(`${API_URL}/api/followups?${q}`);
    const data = await response.json();
    if (response.ok && data && data.success !== false && Array.isArray(data.data)) {
      return data;
    }
    return { success: false, error: data?.error || 'Failed to fetch follow-ups', data: [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error fetching follow-ups', data: [] };
  }
};

export const createFollowup = async (data) => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await response.json();
    if (response.ok && resData && resData.success !== false) return resData;
    return { success: false, error: resData?.error || 'Failed to save follow-up on server' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error saving follow-up' };
  }
};

export const updateFollowup = async (id, data) => {
  try {
    const response = await fetchWithTimeout(`${API_URL}/api/followups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await response.json();
    if (response.ok && resData && resData.success !== false) return resData;
    return { success: false, error: resData?.error || 'Failed to update follow-up on server' };
  } catch (err) {
    return { success: false, error: err.message || 'Network error updating follow-up' };
  }
};
