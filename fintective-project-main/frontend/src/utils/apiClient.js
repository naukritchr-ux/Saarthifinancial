const rawApiKey = import.meta.env.VITE_API_KEY;

if (!rawApiKey) {
  if (import.meta.env.PROD) {
    throw new Error(
      'CRITICAL SECURITY CONFIGURATION: VITE_API_KEY environment variable is required in production builds. ' +
      'Configure VITE_API_KEY in your deployment environment variables.'
    );
  } else {
    console.warn(
      '[apiClient] VITE_API_KEY not configured in development mode. ' +
      'Ensure VITE_API_KEY is defined in .env for local requests.'
    );
  }
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
