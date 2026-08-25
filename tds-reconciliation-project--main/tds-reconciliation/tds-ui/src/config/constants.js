// API base URL configuration
export const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://saarthifinancial-1.onrender.com');
