// Shared transport for finance endpoints. All retries live here.
export function normalizeApiBase(value, hostname = '') {
  const configured = String(value || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  const base = configured || (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)
    ? 'http://localhost:5000/api' : '/api');
  if (base.startsWith('/')) {
    if (base.startsWith('//') || base.includes('?') || base.includes('#')) throw new Error('Invalid finance API URL.');
    const path = base.replace(/\/+$/, '');
    return path.endsWith('/api') ? path : `${path}/api`;
  }
  let parsed;
  try { parsed = new URL(base); } catch { throw new Error('Finance API URL must be an HTTP(S) URL or an absolute path.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Invalid finance API URL.');
  }
  const path = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = path.endsWith('/api') ? path : `${path}/api`;
  return parsed.toString().replace(/\/+$/, '');
}

export function createApiTransport({apiKey = '', fetchImpl = (...args) => fetch(...args),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), diagnose = () => {}} = {}) {
  const activeGets = new Map();
  async function perform(url, options) {
    const {retries, timeoutMs = 60000, retryDelayMs = 750, signal, ...fetchOptions} = options;
    const method = (options.method || 'GET').toUpperCase();
    const attempts = Math.max(1, Math.min(4, Number(retries) || (method === 'GET' ? 2 : 1)));
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    if (apiKey) headers.set('X-API-Key', apiKey);
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal?.aborted) throw signal.reason || new DOMException('Request cancelled', 'AbortError');
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, {once: true});
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {...fetchOptions, method, headers, cache: 'no-store', signal: controller.signal});
        const html = (response.headers.get('content-type') || '').includes('text/html');
        if ([401, 403].includes(response.status)) {
          const error = new Error(`Finance API access denied (${response.status}). Check the application's API credentials and permissions.`);
          error.status = response.status;
          error.isAuthError = true;
          throw error;
        }
        if (response.ok && !html) return response;
        if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status) && !html) return response;
        const error = new Error(html && response.status < 500
          ? 'Finance API returned a webpage instead of data. Check the deployed API address and routing.'
          : `Finance API temporarily unavailable (HTTP ${response.status}). Please retry.`);
        error.status = response.status;
        error.isHtml = html && response.status < 500;
        throw error;
      } catch (error) {
        if (signal?.aborted) throw signal.reason || error;
        lastError = error;
        if (!error.status) {
          lastError = new Error(error.name === 'AbortError'
            ? 'Finance server took too long to respond. Please retry.'
            : 'Cannot reach the finance server. Check your connection and the deployed API address.');
          lastError.cause = error;
        }
        if (error.isAuthError || error.isHtml) throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
      if (attempt + 1 < attempts) await sleep(Math.min(4000, retryDelayMs * 2 ** attempt));
    }
    diagnose('error', {url, status: lastError?.status || 0, isHtml: Boolean(lastError?.isHtml), message: lastError?.message});
    throw lastError;
  }
  return async function request(url, options = {}) {
    // Coalesce overlapping GETs, never cache a completed response or share abort signals.
    if ((options.method || 'GET').toUpperCase() !== 'GET' || options.signal) return perform(url, options);
    const headers = [...new Headers(options.headers || {}).entries()].sort();
    const key = JSON.stringify([url, headers, options.timeoutMs, options.retries]);
    let pending = activeGets.get(key);
    if (!pending) {
      pending = perform(url, options).finally(() => activeGets.delete(key));
      activeGets.set(key, pending);
    }
    return (await pending).clone();
  };
}
