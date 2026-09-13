const rawApiKey = import.meta.env.VITE_API_KEY;

// Production fallback: key is the same as backend default (app.py line ~162)
// Set VITE_API_KEY in Render env vars to override this.
const FALLBACK_API_KEY = 'saarthi-secret-api-key-2026';

if (!rawApiKey) {
  console.warn(
    '[apiClient] VITE_API_KEY not set — using built-in fallback key. ' +
    'Set VITE_API_KEY in Render environment variables to suppress this warning.'
  );
}

export const API_KEY = rawApiKey || FALLBACK_API_KEY;

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://saarthifinancial-1.onrender.com/api');

export const fetchWithApiKey = async (url, options = {}) => {
  if (!API_KEY) {
    console.warn(`[apiClient] Initiating request to ${url} without VITE_API_KEY configured.`);
  }

  const headers = {
    'X-API-Key': API_KEY,
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
};

export default fetchWithApiKey;
