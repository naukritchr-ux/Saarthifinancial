export const API_KEY = import.meta.env.VITE_API_KEY || 'saarthi-secret-api-key-2026';
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const fetchWithApiKey = async (url, options = {}) => {
  const headers = {
    'X-API-Key': API_KEY,
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
};

export default fetchWithApiKey;
