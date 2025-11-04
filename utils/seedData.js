import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import BloodRequest from '../models/BloodRequest.js';
import Donation from '../models/Donation.js';

dotenv.config();

const seedUsers = [
  {
    name: 'John Donor',
    email: 'donor@test.com',
    password: 'password123',
    role: 'donor',
    bloodType: 'O+',
    phone: '1234567890',
    donationCount: 15,
    badgeLevel: 'gold',
    address: {
      city: 'New York',
      state: 'NY',
      coordinates: { lat: 40.7128, lng: -74.0060 }
    }
  },
  {
    name: 'Jane Recipient',
    email: 'recipient@test.com',
    password: 'password123',
    role: 'recipient',
    bloodType: 'A+',
    phone: '0987654321',
    address: {
      city: 'Los Angeles',
      state: 'CA',
      coordinates: { lat: 34.0522, lng: -118.2437 }
    }
  },
  {
    name: 'Mike Delivery',
    email: 'delivery@test.com',
    password: 'password123',
    role: 'delivery',
    phone: '5555555555',
    address: {
      city: 'Chicago',
      state: 'IL',
      coordinates: { lat: 41.8781, lng: -87.6298 }
    }
  },
  {
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin',
    phone: '1111111111',
    address: {
      city: 'Houston',
      state: 'TX',
      coordinates: { lat: 29.7604, lng: -95.3698 }
    }
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Clear existing data
    await User.deleteMany({});
    await BloodRequest.deleteMany({});
    await Donation.deleteMany({});
    
    // Insert seed data
    const users = await User.create(seedUsers);
    
    console.log('Database seeded successfully!');
    console.log('Test accounts created:');
    console.log('- Donor: donor@test.com / password123');
    console.log('- Recipient: recipient@test.com / password123');
    console.log('- Delivery: delivery@test.com / password123');
    console.log('- Admin: admin@test.com / admin123');
    
    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
