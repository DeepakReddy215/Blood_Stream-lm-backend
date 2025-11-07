import mongoose from 'mongoose';

/**
 * Maximum number of connection retry attempts
 */
const MAX_RETRIES = 3;

/**
 * Delay between retry attempts in milliseconds
 */
const RETRY_DELAY = 5000;

/**
 * Connects to MongoDB with retry logic and connection event monitoring
 * 
 * This function attempts to establish a connection to MongoDB with automatic
 * retry logic. It also sets up event listeners to monitor the connection state.
 * 
 * @param {number} retryCount - Current retry attempt (used internally for recursion)
 * @returns {Promise<void>}
 */
const connectDB = async (retryCount = 0) => {
  try {
    console.log(`🔌 Attempting to connect to MongoDB... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
    
    // Validate that MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    // Connect to MongoDB with additional options for better stability
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30
      socketTimeoutMS: 45000,          // Close sockets after 45 seconds of inactivity
    });
    
    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Port: ${conn.connection.port}`);
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (Attempt ${retryCount + 1}/${MAX_RETRIES}):`);
    console.error(`   Message: ${error.message}`);
    
    // Check if this is a network/connection error that might be temporary
    const isRetryableError = 
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoServerSelectionError' ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT');
    
    // Retry logic for temporary network errors
    if (isRetryableError && retryCount < MAX_RETRIES - 1) {
      console.log(`⏳ Retrying connection in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(retryCount + 1);
    }
    
    // If all retries failed or it's a non-retryable error, exit the process
    console.error('💥 Failed to connect to MongoDB after all retry attempts.');
    console.error('   Please check:');
    console.error('   1. MONGODB_URI is correct in your .env file');
    console.error('   2. MongoDB server is running and accessible');
    console.error('   3. Network connectivity is working');
    console.error('   4. Database credentials are valid');
    process.exit(1);
  }
};

/**
 * Set up MongoDB connection event listeners for monitoring
 * 
 * These listeners help track the connection state and provide useful
 * debugging information when connection issues occur.
 */
export const setupConnectionListeners = () => {
  // Listen for successful connection
  mongoose.connection.on('connected', () => {
    console.log('📡 Mongoose connected to MongoDB');
  });
  
  // Listen for connection errors after initial connection
  mongoose.connection.on('error', (error) => {
    console.error('❌ Mongoose connection error:', error.message);
  });
  
  // Listen for disconnection events
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  Mongoose disconnected from MongoDB');
  });
  
  // Listen for reconnection events
  mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
  });
  
  // Handle application termination - close MongoDB connection gracefully
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('📴 Mongoose connection closed through app termination (SIGINT)');
    } catch (error) {
      console.error('Error closing MongoDB connection:', error.message);
    }
  });
};

export default connectDB;
