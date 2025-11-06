import express from 'express';
import {
  getAvailableDeliveries,
  acceptDelivery,
  getAssignedDeliveries,
  updateDeliveryStatus,
  createDelivery,
  getDeliveryTracking
} from '../controllers/deliveryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/available', protect, authorize('delivery'), getAvailableDeliveries);
router.post('/accept/:deliveryId', protect, authorize('delivery'), acceptDelivery);
router.get('/assigned', protect, authorize('delivery'), getAssignedDeliveries);
router.put('/status/:deliveryId', protect, authorize('delivery'), updateDeliveryStatus);
router.post('/create', protect, authorize('delivery', 'admin'), createDelivery);
router.get('/track/:deliveryId', getDeliveryTracking);

export default router;
