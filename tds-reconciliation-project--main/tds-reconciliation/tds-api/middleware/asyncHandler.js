/**
 * asyncHandler — wraps an async route handler so any unhandled rejection
 * is forwarded to Express's next(err) instead of causing an unhandled
 * promise rejection that silently crashes the process.
 *
 * Usage:  router.get('/path', asyncHandler(myController));
 *
 * Controllers that already have try/catch are unaffected — this is a
 * safety net, not a replacement.
 *
 * @param {Function} fn  async (req, res, next) handler
 * @returns {Function}   express-compatible middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
