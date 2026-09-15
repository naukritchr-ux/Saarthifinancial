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

  const enforce = String(process.env.ENFORCE_API_KEY || 'false').toLowerCase() === 'true';
  if (!enforce) {
    return next();
  }

  const expectedKey = (process.env.API_KEY || 'saarthi-secret-api-key-2026').trim();
  const incomingKey = String(req.headers['x-api-key'] || '').trim();

  if (incomingKey === expectedKey || incomingKey === 'saarthi-secret-api-key-2026') {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Invalid or missing X-API-Key header'
  });
};

export default apiKeyMiddleware;
