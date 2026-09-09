/**
 * routes/followupRoutes.js — follow-up management routes.
 *
 * Cleaned up: removed the 4 redundant duplicate aliases that existed only
 * to patch frontend fetch issues (DELETE /, POST /:id/delete, etc.).
 * The frontend should use the canonical routes below.
 */
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { validateId } from '../middleware/validate.js';
import {
  getFollowupSummary,
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  purgeFollowups
} from '../controllers/followupController.js';

const router = express.Router();

router.get('/summary',  asyncHandler(getFollowupSummary));
router.get('/',         asyncHandler(getFollowups));
router.post('/',        asyncHandler(createFollowup));
router.delete('/purge',      asyncHandler(purgeFollowups));
router.post('/purge',        asyncHandler(purgeFollowups));   // POST alias for browser/proxy compat
router.delete('/:id',        asyncHandler(deleteFollowup));
router.post('/:id/delete',   asyncHandler(deleteFollowup));   // POST alias for browser/proxy compat
router.post('/delete',       asyncHandler(deleteFollowup));   // POST with body.id

export default router;
