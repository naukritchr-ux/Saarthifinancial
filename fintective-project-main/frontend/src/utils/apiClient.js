// Fintective Secure, Zero-Crash API Client
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
export const fetchWithApiKey = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const maxRetries = options.retries !== undefined ? options.retries : (method === 'GET' ? 3 : 1);
  const timeoutMs = options.timeoutMs || 45000; // 45s allows cold Render instance to finish boot
  const baseDelayMs = options.retryDelayMs || 1500;

  const headers = {
    Accept: 'application/json, text/plain, */*',
    ...(options.headers || {})
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      const isHtml = contentType.includes('text/html');

      // 401 Unauthorized: fatal credential issue, do not retry
      if (res.status === 401) {
        const err = new Error('Unauthorized (401): Invalid or missing X-API-Key. Please verify VITE_API_KEY.');
        err.status = 401;
        err.isAuthError = true;
        logApiDiagnostic('error', { url, status: 401, isHtml, message: err.message });
        throw err;
      }

      // Vercel SPA index.html rewrite or misrouted endpoint
      if (isHtml) {
        const err = new Error(`API call returned HTML (status ${res.status}) instead of JSON. Ensure VITE_API_URL points to the backend server.`);
        err.status = res.status;
        err.isHtml = true;
        logApiDiagnostic('error', { url, status: res.status, isHtml: true, message: err.message });
        throw err;
      }

      // Success or non-recoverable 4xx client errors (e.g. 400 Bad Request, 404 Not Found)
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        return res;
      }

      // 502 Bad Gateway / 503 Unavailable / 504 Gateway Timeout: Render is spinning up!
      const errText = await res.text().catch(() => '');
      lastError = new Error(`HTTP ${res.status}: ${errText.slice(0, 160)}`);
      lastError.status = res.status;
    } catch (netErr) {
      clearTimeout(timer);
      lastError = netErr;
      if (netErr.isAuthError || netErr.isHtml) {
        throw netErr;
      }
    }

    // If retries remain and error was transient/recoverable, pause with backoff
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Fintective Resilient Client] Attempt ${attempt}/${maxRetries} failed for ${url} (${lastError.message}). Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  logApiDiagnostic('error', {
    url,
    status: lastError.status || 0,
    isHtml: Boolean(lastError.isHtml),
    message: `All ${maxRetries} attempts failed: ${lastError.message}`
  });

  throw lastError;
};

/**
 * Resilient JSON fetcher: parses JSON safely, saves to SWR cache,
 * and automatically returns cached baseline if network is temporarily unreachable.
 */
export const fetchJsonWithApiKey = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const allowCached = method === 'GET' && options.allowCached !== false;

  try {
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

    const data = JSON.parse(text);
    if (allowCached && data) {
      setCachedApiResponse(url, data);
    }
    return data;
  } catch (err) {
    if (allowCached) {
      const cached = getCachedApiResponse(url);
      if (cached) {
        console.warn(`[Fintective SWR] Offline/Delay on ${url}. Seamlessly rendering saved cache. Notice:`, err.message);
        return {
          ...cached,
          _isStale: true,
          _cachedAt: Date.now()
        };
      }
    }
    throw err;
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
