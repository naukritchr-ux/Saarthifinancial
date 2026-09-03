import express from 'express';
import {
  getFollowupSummary,
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  purgeFollowups
} from '../controllers/followupController.js';

const router = express.Router();

router.get('/summary', getFollowupSummary);
router.get('/', getFollowups);
router.post('/', createFollowup);
router.put('/:id', updateFollowup);
router.delete('/purge', purgeFollowups);
router.post('/purge', purgeFollowups);
router.delete('/:id', deleteFollowup);

export default router;
