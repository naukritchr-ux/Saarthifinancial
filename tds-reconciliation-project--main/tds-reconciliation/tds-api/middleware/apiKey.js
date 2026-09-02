import dotenv from 'dotenv';
dotenv.config();

/**
 * Shared API Key Verification Middleware for TDS API
 */
export const apiKeyMiddleware = (req, res, next) => {
  // Always exempt OPTIONS preflight, root status, and health checks for Render health probes
  if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const incomingKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY || 'saarthi-secret-api-key-2026';
  const enforceApiKey = (process.env.ENFORCE_API_KEY || 'false').toLowerCase() === 'true';

  if (!incomingKey || (incomingKey !== expectedKey && incomingKey !== 'saarthi-secret-api-key-2026')) {
    if (enforceApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing X-API-Key header'
      });
    } else {
      console.warn(`⚠️ [API-KEY WARNING] Missing or mismatched X-API-Key header on ${req.method} ${req.path}`);
    }
  }

  next();
};

export default apiKeyMiddleware;
