/**
 * Environment Variable Validation Utility
 * 
 * This module validates that all required environment variables are present
 * before the application starts. It implements a fail-fast approach to ensure
 * the application doesn't run with missing or invalid configuration.
 */

/**
 * List of required environment variables for the application to function
 */
const requiredEnvVars = [
  'JWT_SECRET',      // Secret key for JWT token signing and verification
  'MONGODB_URI',     // MongoDB connection string
  'PORT',            // Server port number
  'CLIENT_URL'       // Frontend client URL for CORS configuration
];

/**
 * Validates that all required environment variables are present and non-empty
 * 
 * @throws {Error} If any required environment variable is missing or empty
 * @returns {void}
 */
export const validateEnv = () => {
  console.log('🔍 Validating environment variables...');
  
  const missingVars = [];
  const emptyVars = [];
  
  // Check each required environment variable
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    
    if (value === undefined) {
      // Variable is not defined at all
      missingVars.push(varName);
    } else if (value.trim() === '') {
      // Variable is defined but empty
      emptyVars.push(varName);
    }
  }
  
  // Build error message if any variables are missing or empty
  if (missingVars.length > 0 || emptyVars.length > 0) {
    let errorMessage = '❌ Environment validation failed:\n\n';
    
    if (missingVars.length > 0) {
      errorMessage += `Missing environment variables:\n`;
      missingVars.forEach(varName => {
        errorMessage += `  - ${varName}\n`;
      });
      errorMessage += '\n';
    }
    
    if (emptyVars.length > 0) {
      errorMessage += `Empty environment variables:\n`;
      emptyVars.forEach(varName => {
        errorMessage += `  - ${varName}\n`;
      });
      errorMessage += '\n';
    }
    
    errorMessage += 'Please check your .env file and ensure all required variables are set.\n';
    errorMessage += 'Required variables: ' + requiredEnvVars.join(', ');
    
    throw new Error(errorMessage);
  }
  
  // Additional validation: Check JWT_SECRET length (should be reasonably long for security)
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET is shorter than recommended (32 characters). Consider using a longer secret for better security.');
  }
  
  // Additional validation: Check if MONGODB_URI looks like a valid MongoDB connection string
  if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    console.warn('⚠️  WARNING: MONGODB_URI does not appear to be a valid MongoDB connection string.');
  }
  
  // Additional validation: Check if PORT is a valid number
  const port = parseInt(process.env.PORT, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`❌ Invalid PORT value: ${process.env.PORT}. PORT must be a number between 1 and 65535.`);
  }
  
  console.log('✅ All required environment variables are present and valid');
  console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET.substring(0, 8)}... (${process.env.JWT_SECRET.length} chars)`);
  console.log(`   - MONGODB_URI: ${process.env.MONGODB_URI.substring(0, 20)}...`);
  console.log(`   - PORT: ${process.env.PORT}`);
  console.log(`   - CLIENT_URL: ${process.env.CLIENT_URL}`);
  console.log('');
};

export default validateEnv;
