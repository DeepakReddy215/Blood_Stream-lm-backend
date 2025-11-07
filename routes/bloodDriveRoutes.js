import express from 'express';
import {
  createBloodDrive,
  joinBloodDrive,
  getActiveBloodDrives,
  getBloodDriveLeaderboard,
  updateDonationStatus,
  shareOnSocial
} from '../controllers/bloodDriveController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/create', protect, createBloodDrive);
router.post('/:driveId/join', protect, joinBloodDrive);
router.get('/active', getActiveBloodDrives);
router.get('/:driveId/leaderboard', getBloodDriveLeaderboard);
router.put('/:driveId/donation/:userId', protect, authorize('admin', 'organizer'), updateDonationStatus);
router.post('/:driveId/share', protect, shareOnSocial);

export default router;
