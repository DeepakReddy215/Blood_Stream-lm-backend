import User from '../models/User.js';
import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';
import Delivery from '../models/Delivery.js';

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalDonors,
      totalRecipients,
      totalRequests,
      totalDonations,
      activeDeliveries,
      bloodInventory
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'donor' }),
      User.countDocuments({ role: 'recipient' }),
      BloodRequest.countDocuments(),
      Donation.countDocuments({ status: 'completed' }),
      Delivery.countDocuments({ status: { $in: ['assigned', 'picked-up', 'in-transit'] } }),
      getBloodInventory()
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalDonors,
        totalRecipients,
        totalRequests,
        totalDonations,
        activeDeliveries,
        bloodInventory
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

const getBloodInventory = async () => {
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const inventory = {};

  for (const type of bloodTypes) {
    const availableDonors = await User.countDocuments({
      role: 'donor',
      bloodType: type,
      eligibleToDonate: true
    });
    inventory[type] = availableDonors;
  }

  return inventory;
};

export const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    const filter = {};
    
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort('-createdAt');

    const count = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

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

export const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [
      donationTrends,
      requestTrends,
      bloodTypeDistribution
    ] = await Promise.all([
      Donation.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      BloodRequest.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { role: 'donor' } },
        {
          $group: {
            _id: "$bloodType",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        donationTrends,
        requestTrends,
        bloodTypeDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
