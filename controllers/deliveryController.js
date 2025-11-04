import Delivery from '../models/Delivery.js';
import BloodRequest from '../models/BloodRequest.js';

export const getAssignedDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ 
      deliveryPerson: req.user._id 
    })
      .populate('bloodRequest')
      .sort('-createdAt');

    res.json({
      success: true,
      data: deliveries
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status, location, notes } = req.body;

    const delivery = await Delivery.findById(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({ 
        success: false, 
        message: 'Delivery not found' 
      });
    }

    // Update status
    delivery.status = status;
    if (notes) delivery.notes = notes;

    // Add to tracking history
    if (location) {
      delivery.trackingHistory.push({
        status,
        location,
        timestamp: new Date()
      });
    }

    // Update actual delivery time if delivered
    if (status === 'delivered') {
      delivery.actualDeliveryTime = new Date();
      
      // Update blood request status
      await BloodRequest.findByIdAndUpdate(delivery.bloodRequest, {
        status: 'fulfilled'
      });
    }

    await delivery.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('delivery-updated', {
      deliveryId: delivery._id,
      status: delivery.status,
      location
    });

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const createDelivery = async (req, res) => {
  try {
    const { bloodRequestId, pickupLocation, dropLocation, estimatedDeliveryTime } = req.body;

    const delivery = await Delivery.create({
      bloodRequest: bloodRequestId,
      deliveryPerson: req.user._id,
      pickupLocation,
      dropLocation,
      estimatedDeliveryTime
    });

    // Update blood request status
    await BloodRequest.findByIdAndUpdate(bloodRequestId, {
      status: 'in-delivery'
    });

    res.status(201).json({
      success: true,
      data: delivery
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getDeliveryTracking = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    
    const delivery = await Delivery.findById(deliveryId)
      .populate('bloodRequest')
      .populate('deliveryPerson', 'name phone');

    if (!delivery) {
      return res.status(404).json({ 
        success: false, 
        message: 'Delivery not found' 
      });
    }

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
