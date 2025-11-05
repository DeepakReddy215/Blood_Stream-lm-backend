import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import QRCode from 'qrcode';

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Get compatible blood types for donation
const getCompatibleBloodTypes = (bloodType) => {
  const compatibility = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
  };
  return compatibility[bloodType] || [];
};

export const createBloodRequest = async (req, res) => {
  try {
    const { bloodType, units, urgency, reason, hospital, location } = req.body;
    
    const bloodRequest = await BloodRequest.create({
      recipient: req.user._id,
      bloodType,
      units,
      urgency,
      reason,
      hospital,
      location // Save location with request
    });

    // Find nearby donors with matching blood type
    const compatibleTypes = getCompatibleBloodTypes(bloodType);
    const nearbyDonors = await User.find({
      role: 'donor',
      bloodType: { $in: compatibleTypes },
      eligibleToDonate: true,
      'address.coordinates.lat': { $exists: true }
    });

    // Filter donors within 50km radius
    const matchedDonors = nearbyDonors.filter(donor => {
      if (location && donor.address?.coordinates) {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          donor.address.coordinates.lat,
          donor.address.coordinates.lng
        );
        return distance <= 50; // 50km radius
      }
      return false;
    });

    // Update request with matched donors
    bloodRequest.matchedDonors = matchedDonors.map(donor => ({
      donor: donor._id,
      status: 'pending',
      distance: calculateDistance(
        location.lat,
        location.lng,
        donor.address.coordinates.lat,
        donor.address.coordinates.lng
      )
    }));
    await bloodRequest.save();

    // Notify matching donors via Socket.IO
    const io = req.app.get('io');
    matchedDonors.forEach(donor => {
      io.to(`user-${donor._id}`).emit('new-blood-request', {
        request: bloodRequest,
        message: `Urgent ${bloodType} blood needed within ${Math.round(calculateDistance(
          location.lat,
          location.lng,
          donor.address.coordinates.lat,
          donor.address.coordinates.lng
        ))}km from your location!`
      });
    });

    res.status(201).json({
      success: true,
      data: bloodRequest,
      matchedDonors: matchedDonors.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getBloodRequests = async (req, res) => {
  try {
    const { status, bloodType, urgency } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (bloodType) filter.bloodType = bloodType;
    if (urgency) filter.urgency = urgency;

    const requests = await BloodRequest.find(filter)
      .populate('recipient', 'name email phone')
      .sort('-createdAt');

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const scheduleDonation = async (req, res) => {
  try {
    const { bloodRequestId, scheduledDate, bloodBank } = req.body;

    const donation = await Donation.create({
      donor: req.user._id,
      bloodRequest: bloodRequestId,
      scheduledDate,
      bloodBank
    });

    // Update user's last donation date
    await User.findByIdAndUpdate(req.user._id, {
      lastDonationDate: scheduledDate
    });

    res.status(201).json({
      success: true,
      data: donation
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getDonationHistory = async (req, res) => {
  try {
    const donations = await Donation.find({ donor: req.user._id })
      .populate('bloodRequest')
      .sort('-createdAt');

    res.json({
      success: true,
      data: donations
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const generateBloodCard = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId || req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Generate QR code
    const qrData = `${process.env.CLIENT_URL}/card/${user._id}`;
    const qrCode = await QRCode.toDataURL(qrData);

    const cardData = {
      id: user._id,
      name: user.name,
      bloodType: user.bloodType,
      donationCount: user.donationCount,
      badgeLevel: user.badgeLevel,
      qrCode,
      joinDate: user.createdAt
    };

    res.json({
      success: true,
      data: cardData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const topDonors = await User.find({ role: 'donor' })
      .sort('-donationCount')
      .limit(10)
      .select('name bloodType donationCount badgeLevel profileImage');

    res.json({
      success: true,
      data: topDonors
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getNearbyDonors = async (req, res) => {
  try {
    const { lat, lng, bloodType, radius = 50 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates required'
      });
    }

    // Get compatible blood types
    const compatibleTypes = getCompatibleBloodTypes(bloodType);

    // Find all eligible donors with compatible blood types
    const donors = await User.find({
      role: 'donor',
      bloodType: { $in: compatibleTypes },
      eligibleToDonate: true,
      isActive: true,
      'address.coordinates.lat': { $exists: true }
    }).select('name bloodType phone address badgeLevel donationCount profileImage');

    // Calculate distance and filter by radius
    const nearbyDonors = donors
      .map(donor => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          donor.address.coordinates.lat,
          donor.address.coordinates.lng
        );
        return {
          ...donor.toObject(),
          distance: Math.round(distance * 10) / 10 // Round to 1 decimal
        };
      })
      .filter(donor => donor.distance <= parseFloat(radius))
      .sort((a, b) => a.distance - b.distance); // Sort by distance

    res.json({
      success: true,
      data: nearbyDonors,
      count: nearbyDonors.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getNearbyBloodBanks = async (req, res) => {
  try {
    const { lat, lng, radius = 20 } = req.query;

    // For demo, return static blood bank locations
    // In production, these would come from a database
    const bloodBanks = [
      {
        name: 'City Blood Bank',
        address: '123 Main St, Downtown',
        coordinates: { lat: parseFloat(lat) + 0.01, lng: parseFloat(lng) + 0.01 },
        phone: '+91 80 1234 5678',
        availableTypes: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
        type: 'bloodBank'
      },
      {
        name: 'Red Cross Center',
        address: '456 Oak Ave',
        coordinates: { lat: parseFloat(lat) - 0.02, lng: parseFloat(lng) + 0.02 },
        phone: '+91 80 1234 5679',
        availableTypes: ['A+', 'B+', 'O+', 'O-'],
        type: 'bloodBank'
      },
      {
        name: 'Community Hospital Blood Center',
        address: '789 Pine Rd',
        coordinates: { lat: parseFloat(lat) + 0.03, lng: parseFloat(lng) - 0.01 },
        phone: '+91 80 1234 5680',
        availableTypes: ['A+', 'A-', 'B+', 'O+', 'O-'],
        type: 'bloodBank'
      }
    ];

    // Calculate distances
    const nearbyBloodBanks = bloodBanks.map(bank => ({
      ...bank,
      distance: calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        bank.coordinates.lat,
        bank.coordinates.lng
      )
    })).filter(bank => bank.distance <= parseFloat(radius));

    res.json({
      success: true,
      data: nearbyBloodBanks
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'address.coordinates': { lat, lng },
        lastLocationUpdate: new Date()
      },
      { new: true }
    ).select('-password');

    // Emit location update to all connected users
    const io = req.app.get('io');
    io.emit('user-location-updated', {
      userId: user._id,
      coordinates: { lat, lng },
      role: user.role,
      bloodType: user.bloodType
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
