import express from 'express';
import {
  createBloodRequest,
  getBloodRequests,
  scheduleDonation,
  respondToBloodRequest,
  getDonationHistory,
  generateBloodCard,
  getHeroes,
  getLeaderboard,
  getNearbyDonors,
  getNearbyBloodBanks,
  updateLocation,
  getLiveUsersInRange,
  getCompatibleRequests,
  acceptBloodRequest,
  declineBloodRequest
} from '../controllers/bloodController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/request', protect, authorize('recipient'), createBloodRequest);
router.get('/requests', protect, getBloodRequests);
router.get('/requests/compatible', protect, authorize('donor'), getCompatibleRequests);
router.post('/request/:requestId/accept', protect, authorize('donor'), acceptBloodRequest);
router.post('/request/:requestId/decline', protect, authorize('donor'), declineBloodRequest);
router.post('/donate', protect, authorize('donor'), scheduleDonation);
router.post('/respond/:requestId', protect, authorize('donor'), respondToBloodRequest);
router.get('/donations', protect, getDonationHistory);
router.get('/card/:userId?', generateBloodCard);
router.get('/heroes', getHeroes); // New endpoint
router.get('/leaderboard', getLeaderboard); // Keep for backward compatibility
router.get('/nearby-donors', protect, getNearbyDonors);
router.get('/nearby-bloodbanks', getNearbyBloodBanks);
router.get('/live-users', protect, getLiveUsersInRange);
router.put('/update-location', protect, updateLocation);

export default router;
