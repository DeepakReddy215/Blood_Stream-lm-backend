import express from 'express';
import {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAnalytics
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:userId/status', updateUserStatus);
router.get('/analytics', getAnalytics);

export default router;
