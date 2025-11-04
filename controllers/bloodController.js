import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import User from '../models/User.js';
import QRCode from 'qrcode';

export const createBloodRequest = async (req, res) => {
  try {
    const { bloodType, units, urgency, reason, hospital } = req.body;
    
    const bloodRequest = await BloodRequest.create({
      recipient: req.user._id,
      bloodType,
      units,
      urgency,
      reason,
      hospital
    });

    // Notify matching donors via Socket.IO
    const io = req.app.get('io');
    io.emit('new-blood-request', {
      request: bloodRequest,
      message: `Urgent ${bloodType} blood needed!`
    });

    res.status(201).json({
      success: true,
      data: bloodRequest
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
    const { lat, lng, bloodType, radius = 10 } = req.query;

    // Simple distance calculation (for demo purposes)
    const donors = await User.find({
      role: 'donor',
      bloodType,
      eligibleToDonate: true,
      isActive: true
    }).select('name bloodType phone address badgeLevel');

    res.json({
      success: true,
      data: donors
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
