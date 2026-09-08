/**
 * AppError — operational error with an HTTP status code.
 * Throw this anywhere to get a clean JSON error response instead of a 500.
 *
 * Example:
 *   throw new AppError('Batch ID is required', 400);
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes known errors from programming bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * centralErrorHandler — must be registered LAST in Express (4-arg middleware).
 *
 * Handles:
 *  - AppError (operational) → correct status code + message
 *  - multer errors          → 413 (too large) or 415 (wrong type)
 *  - MySQL errors           → 409 (duplicate), 503 (schema missing)
 *  - Everything else        → 500 with stack trace in dev
 */
export const centralErrorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isDev = (process.env.NODE_ENV || 'development') === 'development';

  // --- Multer file upload errors ---
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum allowed size is 10 MB.'
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(415).json({
      success: false,
      error: `Unexpected file field "${err.field}". Use the correct upload field name.`
    });
  }

  // --- MySQL / DB errors ---
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry — this record already exists.'
    });
  }
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({
      success: false,
      error: 'Database schema not ready. Try again in a moment.'
    });
  }
  if (err.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(503).json({
      success: false,
      error: 'Database schema mismatch. Contact support.',
      ...(isDev && { detail: err.sqlMessage })
    });
  }

  // --- Operational / known errors (AppError) ---
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // --- Unknown / programming errors — log in full, hide details in prod ---
  console.error('💥 Unhandled error:', err);
  return res.status(500).json({
    success: false,
    error: 'An unexpected server error occurred.',
    ...(isDev && { detail: err.message, stack: err.stack })
  });
};

export default centralErrorHandler;
