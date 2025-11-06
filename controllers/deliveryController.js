import Delivery from '../models/Delivery.js';
import BloodRequest from '../models/BloodRequest.js';
import User from '../models/User.js';

export const getAvailableDeliveries = async (req, res) => {
  try {
    // Find blood requests that need delivery but don't have a delivery person assigned yet
    const pendingRequests = await BloodRequest.find({
      status: { $in: ['pending', 'matched'] },
      'matchedDonors.status': 'accepted'
    }).populate('recipient', 'name phone address');

    // Create available deliveries from pending requests
    const availableDeliveries = [];
    
    for (const request of pendingRequests) {
      // Check if delivery already exists for this request
      const existingDelivery = await Delivery.findOne({ bloodRequest: request._id });
      
      if (!existingDelivery) {
        availableDeliveries.push({
          _id: request._id,
          bloodRequest: {
            _id: request._id,
            bloodType: request.bloodType,
            units: request.units,
            urgency: request.urgency
          },
          pickupLocation: {
            name: 'Central Blood Bank',
            address: '123 Medical Center Drive',
            coordinates: {
              lat: request.recipient.address?.coordinates?.lat || 40.7128,
              lng: request.recipient.address?.coordinates?.lng || -74.0060
            }
          },
          dropLocation: {
            name: request.hospital?.name || 'Hospital',
            address: request.hospital?.address || request.recipient.address?.street,
            coordinates: {
              lat: (request.recipient.address?.coordinates?.lat || 40.7128) + 0.01,
              lng: (request.recipient.address?.coordinates?.lng || -74.0060) + 0.01
            }
          },
          urgency: request.urgency,
          createdAt: request.createdAt
        });
      }
    }

    res.json({
      success: true,
      data: availableDeliveries
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const acceptDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    
    // Check if this is a blood request ID (for creating new delivery)
    const bloodRequest = await BloodRequest.findById(deliveryId);
    
    if (bloodRequest) {
      // Create new delivery
      const delivery = await Delivery.create({
        bloodRequest: bloodRequest._id,
        deliveryPerson: req.user._id,
        pickupLocation: {
          name: 'Central Blood Bank',
          address: '123 Medical Center Drive',
          coordinates: {
            lat: 40.7128,
            lng: -74.0060
          }
        },
        dropLocation: {
          name: bloodRequest.hospital?.name || 'Hospital',
          address: bloodRequest.hospital?.address,
          coordinates: {
            lat: 40.7328,
            lng: -74.0160
          }
        },
        status: 'assigned',
        estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });

      // Update blood request status
      bloodRequest.status = 'in-delivery';
      await bloodRequest.save();

      // Update delivery person stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'deliveryStats.totalDeliveries': 1 }
      });

      // Emit socket event
      const io = req.app.get('io');
      io.emit('delivery-accepted', {
        delivery,
        deliveryPerson: req.user.name
      });

      res.status(201).json({
        success: true,
        data: delivery,
        message: 'Delivery accepted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Delivery request not found'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

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
