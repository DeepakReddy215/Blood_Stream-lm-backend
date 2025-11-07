import mongoose from 'mongoose';

const bloodDriveSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    name: String,
    logo: String,
    type: {
      type: String,
      enum: ['corporate', 'school', 'community', 'religious', 'government'],
      default: 'community'
    }
  },
  description: String,
  goal: {
    donors: { type: Number, default: 50 },
    units: { type: Number, default: 50 }
  },
  progress: {
    donors: { type: Number, default: 0 },
    units: { type: Number, default: 0 }
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    donated: {
      type: Boolean,
      default: false
    },
    donatedAt: Date,
    units: Number
  }],
  teams: [{
    name: String,
    leader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    goal: Number,
    progress: Number
  }],
  rewards: [{
    title: String,
    description: String,
    threshold: Number,
    icon: String
  }],
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  shareCode: {
    type: String,
    unique: true
  },
  statistics: {
    totalDonors: { type: Number, default: 0 },
    totalUnits: { type: Number, default: 0 },
    livesSaved: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Generate unique share code
bloodDriveSchema.pre('save', async function(next) {
  if (!this.shareCode) {
    this.shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

const BloodDrive = mongoose.model('BloodDrive', bloodDriveSchema);
export default BloodDrive;
