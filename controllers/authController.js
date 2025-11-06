import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, bloodType, phone, address } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
    }

    // Prepare user data
    const userData = {
      name,
      email,
      password,
      role: role || 'donor',
      phone,
      address
    };

    // Only add bloodType if it's provided and role requires it
    if (role === 'donor' || role === 'recipient') {
      if (!bloodType) {
        return res.status(400).json({
          success: false,
          message: 'Blood type is required for donors and recipients'
        });
      }
      userData.bloodType = bloodType;
    } else if (role === 'delivery' || role === 'admin') {
      // Don't include bloodType for delivery and admin roles
      // Even if it's sent as empty string from frontend
      delete userData.bloodType;
    }

    // Create user
    const user = await User.create(userData);

    if (user) {
      const token = generateToken(user._id);
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          bloodType: user.bloodType,
          token
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const token = generateToken(user._id);
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bloodType: user.bloodType,
        badgeLevel: user.badgeLevel,
        donationCount: user.donationCount,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
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

export const updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    
    // Prevent changing critical fields
    delete updates.email;
    delete updates.role;
    delete updates.password;
    
    // Handle bloodType update based on role
    if (req.user.role === 'delivery' || req.user.role === 'admin') {
      delete updates.bloodType;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
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
