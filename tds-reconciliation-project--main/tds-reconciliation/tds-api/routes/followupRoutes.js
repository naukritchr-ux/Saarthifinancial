import express from 'express';
import {
  getFollowupSummary,
  getFollowups,
  createFollowup,
  updateFollowup
} from '../controllers/followupController.js';

const router = express.Router();

router.get('/summary', getFollowupSummary);
router.get('/', getFollowups);
router.post('/', createFollowup);
router.put('/:id', updateFollowup);

export default router;
