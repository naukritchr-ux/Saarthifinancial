// Fintective Secure API Client
const rawApiKey = import.meta.env.VITE_API_KEY;

// NEVER bundle a hardcoded secret in client assets
export const API_KEY = rawApiKey ? rawApiKey.trim() : '';

export const isApiKeyConfigured = () => Boolean(API_KEY);

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0')
    ? 'http://localhost:5000/api' 
    : '/api')).replace(/\/+$/, '');

/**
 * Log API calls and failures in one consistent, diagnose-friendly format
 */
export const logApiDiagnostic = (type, details) => {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  if (type === 'error') {
    console.error(`[Fintective API Error ${ts}] URL: ${details.url} | Status: ${details.status || 'NETWORK_FAIL'} | HTML: ${Boolean(details.isHtml)} | Reason: ${details.message}`);
  } else {
    console.log(`[Fintective API ${ts}] URL: ${details.url} | Status: ${details.status}`);
  }
};

/**
 * Fetch wrapper that attaches X-API-Key and validates against HTML responses (e.g. Vercel SPA index.html rewrite)
 */
export const fetchWithApiKey = async (url, options = {}) => {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    ...(options.headers || {})
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (netErr) {
    logApiDiagnostic('error', {
      url,
      status: 0,
      isHtml: false,
      message: `Network error or timeout: ${netErr.message}`
    });
    throw netErr;
  }

  const contentType = res.headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html');

  if (!res.ok) {
    let errBody = '';
    try {
      errBody = isHtml ? 'Returned HTML document instead of JSON (likely 404 or Vercel rewrite)' : await res.text();
    } catch {
      errBody = 'Unable to parse error response';
    }

    logApiDiagnostic('error', {
      url,
      status: res.status,
      isHtml,
      message: `HTTP ${res.status}: ${errBody.slice(0, 160)}`
    });

    if (res.status === 401) {
      const err = new Error('Unauthorized (401): Invalid or missing X-API-Key. Please verify VITE_API_KEY.');
      err.status = 401;
      err.isAuthError = true;
      throw err;
    }

    if (isHtml) {
      const err = new Error(`API call returned HTML (status ${res.status}) instead of JSON. Ensure VITE_API_URL points to the backend server.`);
      err.status = res.status;
      err.isHtml = true;
      throw err;
    }
  }

  return res;
};

/**
 * Helper to fetch and safely parse JSON, detecting if body starts with HTML doctype
 */
export const fetchJsonWithApiKey = async (url, options = {}) => {
  const res = await fetchWithApiKey(url, options);
  const text = await res.text();
  const trimmed = text.trim();

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
    const err = new Error(`Expected JSON but received HTML from ${url}. Check API routing configuration.`);
    err.isHtml = true;
    err.status = res.status;
    logApiDiagnostic('error', { url, status: res.status, isHtml: true, message: err.message });
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch (jsonErr) {
    const err = new Error(`JSON parse failure from ${url}: ${jsonErr.message}. Snippet: ${trimmed.slice(0, 120)}`);
    logApiDiagnostic('error', { url, status: res.status, isHtml: false, message: err.message });
    throw err;
  }
};

export default fetchWithApiKey;
