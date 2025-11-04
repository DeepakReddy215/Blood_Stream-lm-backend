import express from 'express';
import {
  getAssignedDeliveries,
  updateDeliveryStatus,
  createDelivery,
  getDeliveryTracking
} from '../controllers/deliveryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/assigned', protect, authorize('delivery'), getAssignedDeliveries);
router.post('/create', protect, authorize('delivery', 'admin'), createDelivery);
router.put('/status/:deliveryId', protect, authorize('delivery'), updateDeliveryStatus);
router.get('/track/:deliveryId', getDeliveryTracking);

export default router;
