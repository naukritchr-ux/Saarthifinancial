import { AppError } from './errorHandler.js';

/**
 * validateId — ensures req.params.id is a positive integer.
 * Returns 422 if invalid so the controller never receives a bad ID.
 *
 * Usage:  router.delete('/batches/:id', validateId, asyncHandler(deleteUploadBatch));
 */
export const validateId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!req.params.id || isNaN(id) || id <= 0) {
    return next(new AppError(`Invalid ID "${req.params.id}" — must be a positive integer.`, 422));
  }
  req.params.id = id; // normalise to number
  next();
};

/**
 * validateBody(fields) — ensures each listed field is present and non-empty in req.body.
 * Returns 422 with a descriptive message if any field is missing.
 *
 * Usage:  router.post('/seed', validateBody(['financialYear']), asyncHandler(seedDatabaseEndpoint));
 */
export const validateBody = (fields = []) => (req, res, next) => {
  const missing = fields.filter(
    (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
  );
  if (missing.length > 0) {
    return next(new AppError(`Missing required field(s): ${missing.join(', ')}`, 422));
  }
  next();
};
