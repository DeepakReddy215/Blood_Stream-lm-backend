import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['donor', 'recipient', 'delivery', 'admin'],
    default: 'donor'
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: function() { 
      return this.role === 'donor' || this.role === 'recipient'; 
    },
    // Only validate enum if bloodType is provided
    validate: {
      validator: function(value) {
        // If no value provided and not required, it's valid
        if (!value && (this.role === 'delivery' || this.role === 'admin')) {
          return true;
        }
        // If value provided, check if it's in the enum
        if (value) {
          return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(value);
        }
        return true;
      },
      message: props => `${props.value} is not a valid blood type`
    }
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  profileImage: {
    type: String,
    default: null
  },
  badgeLevel: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  donationCount: {
    type: Number,
    default: 0
  },
  lastDonationDate: Date,
  eligibleToDonate: {
    type: Boolean,
    default: function() {
      return this.role === 'donor';
    }
  },
  medicalInfo: {
    weight: Number,
    height: Number,
    diseases: [String],
    medications: [String]
  },
  // Delivery-specific fields
  vehicleInfo: {
    type: {
      type: String,
      enum: ['bike', 'car', 'van', 'ambulance']
    },
    number: String,
    model: String
  },
  deliveryStats: {
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    averageDeliveryTime: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  socketId: String,
  notifications: [{
    type: String,
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ 'address.coordinates': '2dsphere' });

userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  
  // Remove bloodType if not needed
  if ((this.role === 'delivery' || this.role === 'admin') && this.bloodType === '') {
    this.bloodType = undefined;
  }
  
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.updateBadge = function() {
  if (this.donationCount >= 20) {
    this.badgeLevel = 'platinum';
  } else if (this.donationCount >= 10) {
    this.badgeLevel = 'gold';
  } else if (this.donationCount >= 5) {
    this.badgeLevel = 'silver';
  } else {
    this.badgeLevel = 'bronze';
  }
};

const User = mongoose.model('User', userSchema);
export default User;
