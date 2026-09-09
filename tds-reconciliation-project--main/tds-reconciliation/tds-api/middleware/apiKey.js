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

  const expectedKey = process.env.API_KEY || 'saarthi-secret-api-key-2026';
  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable: API key not configured on server'
    });
  }

  const incomingKey = req.headers['x-api-key'];
  if (!incomingKey || incomingKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing X-API-Key header'
    });
  }

  next();
};

export default apiKeyMiddleware;
