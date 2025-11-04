import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema({
  bloodRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodRequest',
    required: true
  },
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pickupLocation: {
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  dropLocation: {
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  status: {
    type: String,
    enum: ['assigned', 'picked-up', 'in-transit', 'delivered', 'cancelled'],
    default: 'assigned'
  },
  trackingHistory: [{
    status: String,
    location: {
      lat: Number,
      lng: Number
    },
    timestamp: { type: Date, default: Date.now }
  }],
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  temperature: Number,
  notes: String
}, {
  timestamps: true
});

const Delivery = mongoose.model('Delivery', deliverySchema);
export default Delivery;
