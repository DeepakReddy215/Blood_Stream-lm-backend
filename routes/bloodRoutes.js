import express from 'express';
import {
  createBloodRequest,
  getBloodRequests,
  scheduleDonation,
  getDonationHistory,
  generateBloodCard,
  getLeaderboard,
  getNearbyDonors,
  getNearbyBloodBanks,
  updateLocation,
  getLiveUsersInRange
} from '../controllers/bloodController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/request', protect, authorize('recipient'), createBloodRequest);
router.get('/requests', protect, getBloodRequests);
router.post('/donate', protect, authorize('donor'), scheduleDonation);
router.get('/donations', protect, getDonationHistory);
router.get('/card/:userId?', generateBloodCard);
router.get('/leaderboard', getLeaderboard);
router.get('/nearby-donors', protect, getNearbyDonors);
router.get('/nearby-bloodbanks', getNearbyBloodBanks);
router.get('/live-users', protect, getLiveUsersInRange);
router.put('/update-location', protect, updateLocation);

export default router;
