// API base URL configuration for TDS App
const rawUrl = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' 
    : 'https://saarthifinancial-1.onrender.com');

// Strip trailing '/api' and trailing slashes so ${API_URL}/api/... is always constructed cleanly
export const API_URL = (rawUrl || 'https://saarthifinancial-1.onrender.com')
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');
