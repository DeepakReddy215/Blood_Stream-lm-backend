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

// Get compatible blood types for receiving
const getCompatibleDonorTypes = (recipientType) => {
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
  return compatibility[recipientType] || [];
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
      .populate('matchedDonors.donor', 'name bloodType phone')
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

// Get compatible blood requests for a donor
export const getCompatibleRequests = async (req, res) => {
  try {
    const donor = await User.findById(req.user._id);
    
    // Get blood types this donor can donate to
    const canDonateTo = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+']
    };

    const compatibleBloodTypes = canDonateTo[donor.bloodType] || [];

    // Find requests that match
    const requests = await BloodRequest.find({
      bloodType: { $in: compatibleBloodTypes },
      status: { $in: ['pending', 'matched'] },
      expiresAt: { $gt: new Date() }
    })
    .populate('recipient', 'name phone')
    .populate('matchedDonors.donor', 'name')
    .sort({ urgency: 1, createdAt: -1 }); // Sort by urgency then by newest

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

// Accept blood request
export const acceptBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const donorId = req.user._id;

    const bloodRequest = await BloodRequest.findById(requestId)
      .populate('recipient', 'name email phone');

    if (!bloodRequest) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found'
      });
    }

    // Check if donor already responded
    const donorMatch = bloodRequest.matchedDonors.find(
      m => m.donor.toString() === donorId.toString()
    );

    if (donorMatch && donorMatch.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `You have already ${donorMatch.status} this request`
      });
    }

    // Update or add donor match status
    if (donorMatch) {
      donorMatch.status = 'accepted';
      donorMatch.respondedAt = new Date();
    } else {
      bloodRequest.matchedDonors.push({
        donor: donorId,
        status: 'accepted',
        respondedAt: new Date()
      });
    }

    // Update request status if first acceptance
    if (bloodRequest.status === 'pending') {
      bloodRequest.status = 'matched';
    }

    await bloodRequest.save();

    // Create donation appointment for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // Set to 10 AM

    const donation = await Donation.create({
      donor: donorId,
      bloodRequest: requestId,
      scheduledDate: tomorrow,
      bloodBank: {
        name: bloodRequest.hospital?.name || 'Central Blood Bank',
        address: bloodRequest.hospital?.address || 'Will be provided'
      },
      units: 1,
      status: 'scheduled'
    });

    // Update donor's last donation date (will be updated again when actually donated)
    await User.findByIdAndUpdate(donorId, {
      lastScheduledDonation: tomorrow
    });

    // Notify recipient via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${bloodRequest.recipient._id}`).emit('donor-accepted', {
        donorName: req.user.name,
        requestId: requestId,
        message: `Good news! A donor has accepted your blood request.`
      });
    }

    res.json({
      success: true,
      data: {
        requestId,
        donation,
        recipientId: bloodRequest.recipient._id
      },
      message: 'Blood request accepted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Decline blood request
export const declineBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const donorId = req.user._id;

    const bloodRequest = await BloodRequest.findById(requestId);

    if (!bloodRequest) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found'
      });
    }

    // Find and update donor match status
    const donorMatch = bloodRequest.matchedDonors.find(
      m => m.donor.toString() === donorId.toString()
    );

    if (donorMatch) {
      donorMatch.status = 'declined';
      donorMatch.respondedAt = new Date();
    } else {
      bloodRequest.matchedDonors.push({
        donor: donorId,
        status: 'declined',
        respondedAt: new Date()
      });
    }

    await bloodRequest.save();

    res.json({
      success: true,
      message: 'Blood request declined'
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

export const respondToBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { response } = req.body; // 'accept' or 'decline'

    const bloodRequest = await BloodRequest.findById(requestId);
    
    if (!bloodRequest) {
      return res.status(404).json({
        success: false,
        message: 'Blood request not found'
      });
    }

    // Find the donor in matchedDonors
    const donorIndex = bloodRequest.matchedDonors.findIndex(
      md => md.donor.toString() === req.user._id.toString()
    );

    if (donorIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not matched for this request'
      });
    }

    // Update the donor's response status
    bloodRequest.matchedDonors[donorIndex].status = response === 'accept' ? 'accepted' : 'declined';
    await bloodRequest.save();

    // If accepted, create a donation record
    if (response === 'accept') {
      await Donation.create({
        donor: req.user._id,
        bloodRequest: bloodRequest._id,
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Schedule for next day
        status: 'scheduled'
      });

      // Notify recipient via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${bloodRequest.recipient}`).emit('donor-responded', {
          request: bloodRequest,
          donor: req.user.name,
          response: 'accepted'
        });
      }
    }

    res.json({
      success: true,
      message: response === 'accept' ? 'Request accepted successfully!' : 'Request declined',
      data: bloodRequest
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

// Updated function name for Hall of Heroes
export const getHeroes = async (req, res) => {
  try {
    const topHeroes = await User.find({ role: 'donor' })
      .sort('-donationCount')
      .limit(50) // Get more heroes for the honor roll
      .select('name bloodType donationCount badgeLevel profileImage createdAt');

    res.json({
      success: true,
      data: topHeroes
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Keep the old function for backward compatibility
export const getLeaderboard = getHeroes;

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
    const { lat, lng, isOnline = true } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        'address.coordinates': { lat, lng },
        lastLocationUpdate: new Date(),
        isOnline
      },
      { new: true }
    ).select('-password');

    // Only emit to users within range (50km default)
    const io = req.app.get('io');
    
    // Find users within broadcast range
    const nearbyUsers = await User.find({
      isOnline: true,
      'address.coordinates.lat': { $exists: true },
      _id: { $ne: req.user._id }
    }).select('_id address socketId');

    // Broadcast only to nearby users
    nearbyUsers.forEach(nearbyUser => {
      if (nearbyUser.address?.coordinates) {
        const distance = calculateDistance(
          lat,
          lng,
          nearbyUser.address.coordinates.lat,
          nearbyUser.address.coordinates.lng
        );
        
        // Only broadcast to users within 50km
        if (distance <= 50 && nearbyUser.socketId) {
          io.to(nearbyUser.socketId).emit('user-location-updated', {
            userId: user._id,
            coordinates: { lat, lng },
            role: user.role,
            bloodType: user.bloodType,
            distance: Math.round(distance * 10) / 10
          });
        }
      }
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

export const getLiveUsersInRange = async (req, res) => {
  try {
    const { lat, lng, radius = 25, role, bloodType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates required'
      });
    }

    // Build query filters
    const filter = {
      isOnline: true,
      'address.coordinates.lat': { $exists: true },
      _id: { $ne: req.user._id } // Exclude self
    };

    if (role) filter.role = role;
    if (bloodType) {
      // If searching for donors, get compatible types
      if (role === 'donor') {
        filter.bloodType = { $in: getCompatibleBloodTypes(bloodType) };
      } else {
        filter.bloodType = bloodType;
      }
    }

    // Find users with recent location updates (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    filter.lastLocationUpdate = { $gte: fiveMinutesAgo };

    const users = await User.find(filter)
      .select('name role bloodType address badgeLevel donationCount profileImage lastLocationUpdate')
      .limit(100); // Limit results for performance

    // Filter by distance
    const usersInRange = users
      .map(user => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          user.address.coordinates.lat,
          user.address.coordinates.lng
        );
        
        return {
          ...user.toObject(),
          distance: Math.round(distance * 10) / 10,
          isLive: true,
          lastSeen: user.lastLocationUpdate
        };
      })
      .filter(user => user.distance <= parseFloat(radius))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50); // Maximum 50 users to display

    res.json({
      success: true,
      data: usersInRange,
      count: usersInRange.length,
      searchRadius: parseFloat(radius)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
