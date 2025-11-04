import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  donor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodRequest'
  },
  bloodBank: {
    name: String,
    address: String
  },
  units: {
    type: Number,
    required: true,
    default: 1
  },
  donationType: {
    type: String,
    enum: ['whole-blood', 'platelets', 'plasma', 'red-cells'],
    default: 'whole-blood'
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  completedDate: Date,
  certificate: {
    issued: { type: Boolean, default: false },
    url: String
  },
  notes: String
}, {
  timestamps: true
});

const Donation = mongoose.model('Donation', donationSchema);
export default Donation;
