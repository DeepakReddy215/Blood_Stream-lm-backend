import mongoose from 'mongoose';

const bloodRequestSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  units: {
    type: Number,
    required: true,
    min: 1
  },
  urgency: {
    type: String,
    enum: ['critical', 'urgent', 'normal'],
    default: 'normal'
  },
  reason: {
    type: String,
    required: true
  },
  hospital: {
    name: String,
    address: String,
    contact: String
  },
  location: {
    lat: Number,
    lng: Number
  },
  status: {
    type: String,
    enum: ['pending', 'matched', 'in-delivery', 'fulfilled', 'cancelled'],
    default: 'pending'
  },
  matchedDonors: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'declined'],
      default: 'pending'
    },
    distance: Number,
    notifiedAt: Date,
    respondedAt: Date
  }],
  fulfilledBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7*24*60*60*1000)
  }
}, {
  timestamps: true
});

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
export default BloodRequest;
