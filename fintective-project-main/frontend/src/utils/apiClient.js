import { createApiTransport, normalizeApiBase } from './apiTransport.js';
// Fintective Secure, Zero-Crash API Client
const buildEnv = import.meta.env || {};
const rawApiKey = buildEnv.VITE_API_KEY;

// NEVER bundle a hardcoded secret in client assets
export const API_KEY = rawApiKey ? rawApiKey.trim() : '';

export const isApiKeyConfigured = () => Boolean(API_KEY);

let configurationError = null;
export const API_BASE_URL = (() => {
  try {
    return normalizeApiBase(buildEnv.VITE_API_URL, typeof window !== 'undefined' ? window.location.hostname : '');
  } catch (error) {
    configurationError = error;
    configurationError.isConfigError = true;
    return '/api';
  }
})();

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

// -----------------------------------------------------------------------------
// SWR (Stale-While-Revalidate) Cache Store
// -----------------------------------------------------------------------------
const memoryCache = new Map();
const SWR_PREFIX = 'fintective_swr_cache_';

export const getCachedApiResponse = (url) => {
  if (memoryCache.has(url)) {
    return memoryCache.get(url);
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`${SWR_PREFIX}${url}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(url, parsed.data);
        return parsed.data;
      }
    } catch {}
  }
  return null;
};

export const setCachedApiResponse = (url, data) => {
  memoryCache.set(url, data);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`${SWR_PREFIX}${url}`, JSON.stringify({
        savedAt: Date.now(),
        data
      }));
    } catch {}
  }
};

/**
 * Fetch wrapper that attaches X-API-Key, validates against HTML responses,
 * and transparently retries on transient network/Render-cold-start errors.
 */
const sharedTransport = createApiTransport({apiKey: API_KEY, diagnose: logApiDiagnostic});
export const fetchWithApiKey = (url, options = {}) => configurationError
  ? Promise.reject(configurationError) : sharedTransport(url, options);

/**
 * Resilient JSON fetcher: parses JSON safely, saves to SWR cache,
 * and automatically returns cached baseline if network is temporarily unreachable.
 */
export const fetchJsonWithApiKey = async (url, options = {}) => {
  const allowCached = (options.method || 'GET').toUpperCase() === 'GET' && options.allowCached !== false;
  try {
    const res = await fetchWithApiKey(url, options);
    const data = await res.json();
    if (!res.ok || data?.success === false || data?.error) {
      const error = new Error(data?.error || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    if (allowCached) setCachedApiResponse(url, data);
    return data;
  } catch (error) {
    if (allowCached && !error.isAuthError && !error.isHtml && !error.isConfigError &&
        (!error.status || error.status >= 500 || [408, 429].includes(error.status))) {
      const cached = getCachedApiResponse(url);
      if (cached !== null) return Object.assign(Array.isArray(cached) ? [...cached] : {...cached}, {
        _isStale: true
      });
    }
    throw error;
  }
};

// -----------------------------------------------------------------------------
// Proactive Tab Visibility & Connection Wakeup
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  let lastWakeup = 0;
  const triggerBackendWakeup = () => {
    const now = Date.now();
    // Throttle wakeups to at most once per 90 seconds
    if (now - lastWakeup < 90000) return;
    lastWakeup = now;
    // Silent lightweight ping to keep Render warm
    fetch(`${API_BASE_URL}/warmup`, { method: 'GET', keepalive: true }).catch(() => {});
  };

  // When user returns to tab after inactivity
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerBackendWakeup();
    }
  });

  // When window receives focus or reconnects to WiFi
  window.addEventListener('focus', triggerBackendWakeup);
  window.addEventListener('online', triggerBackendWakeup);

  // Background heartbeat every 6 minutes while tab remains open
  setInterval(triggerBackendWakeup, 6 * 60 * 1000);
}

export default fetchWithApiKey;
