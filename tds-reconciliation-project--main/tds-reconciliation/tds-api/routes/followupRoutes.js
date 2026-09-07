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
router.post('/:id/delete', deleteFollowup);
router.post('/delete/:id', deleteFollowup);
router.delete('/', deleteFollowup);

export default router;
