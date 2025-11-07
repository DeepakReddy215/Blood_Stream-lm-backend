import express from 'express';
import {
  createBloodRequest,
  getBloodRequests,
  getCompatibleRequests,
  acceptBloodRequest,
  declineBloodRequest,
  scheduleDonation,
  respondToBloodRequest,
  getDonationHistory,
  generateBloodCard,
  getHeroes,
  getLeaderboard,
  getNearbyDonors,
  getNearbyBloodBanks,
  updateLocation,
  getLiveUsersInRange
} from '../controllers/bloodController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Blood Request Routes
router.post('/request', protect, authorize('recipient'), createBloodRequest);
router.get('/requests', protect, getBloodRequests);
router.get('/requests/compatible', protect, authorize('donor'), getCompatibleRequests);
router.post('/request/:requestId/accept', protect, authorize('donor'), acceptBloodRequest);
router.post('/request/:requestId/decline', protect, authorize('donor'), declineBloodRequest);

// Donation Routes
router.post('/donate', protect, authorize('donor'), scheduleDonation);
router.post('/respond/:requestId', protect, authorize('donor'), respondToBloodRequest);
router.get('/donations', protect, getDonationHistory);

// Public Routes
router.get('/card/:userId?', generateBloodCard);
router.get('/heroes', getHeroes);
router.get('/leaderboard', getLeaderboard); // Keep for backward compatibility

// Location Routes
router.get('/nearby-donors', protect, getNearbyDonors);
router.get('/nearby-bloodbanks', getNearbyBloodBanks);
router.get('/live-users', protect, getLiveUsersInRange);
router.put('/update-location', protect, updateLocation);

export default router;
