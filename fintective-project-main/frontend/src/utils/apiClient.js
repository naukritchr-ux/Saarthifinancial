const rawApiKey = import.meta.env.VITE_API_KEY;

if (!rawApiKey) {
  console.error(
    'CRITICAL CONFIGURATION ERROR: VITE_API_KEY is not defined in environment variables. ' +
    'API calls to the backend will fail authentication. ' +
    'Please set VITE_API_KEY in your frontend/.env file or deployment environment variables.'
  );
}

export const API_KEY = rawApiKey || '';

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
