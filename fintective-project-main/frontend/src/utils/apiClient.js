const rawApiKey = import.meta.env.VITE_API_KEY;

export const API_KEY = rawApiKey || 'saarthi-secret-api-key-2026';

if (!rawApiKey) {
  console.warn(
    '[apiClient] VITE_API_KEY not configured in environment. Using default fallback API key.'
  );
}

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0')
    ? 'http://localhost:5000/api' 
    : 'https://saarthifinancial.onrender.com/api');

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
