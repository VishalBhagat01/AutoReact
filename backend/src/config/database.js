import mongoose from 'mongoose';

/**
 * Centralized MongoDB Connection Manager using Mongoose
 */

let isConnecting = false;

/**
 * Configure Mongoose connection event listeners
 */
const setupConnectionEvents = () => {
  mongoose.connection.on('connected', () => {
    if (process.env.NODE_ENV !== 'test') {
      const { host, port, name } = mongoose.connection;
      console.log(`🍃 MongoDB connected: ${host}:${port}/${name}`);
    }
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('⚠️ MongoDB disconnected.');
    }
  });
};

// Initialize event listeners once
setupConnectionEvents();

/**
 * Connect to MongoDB
 * @param {string} [customUri] - Optional custom connection string
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async (customUri) => {
  // If already connected (readyState === 1), return active instance
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Prevent multiple concurrent connection attempts
  if (isConnecting) {
    return new Promise((resolve, reject) => {
      const checkConnected = () => {
        if (mongoose.connection.readyState === 1) {
          resolve(mongoose);
        } else if (!isConnecting) {
          reject(new Error('MongoDB connection attempt failed'));
        } else {
          setTimeout(checkConnected, 100);
        }
      };
      checkConnected();
    });
  }

  const uri = customUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/reagmat';

  try {
    isConnecting = true;
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: process.env.NODE_ENV !== 'production', // Build indexes in dev/test
    });
    return conn;
  } catch (error) {
    console.error(`❌ Failed to connect to MongoDB: ${error.message}`);
    throw error;
  } finally {
    isConnecting = false;
  }
};

/**
 * Disconnect cleanly from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

/**
 * Helper to check connection state
 * @returns {boolean} True if connected
 */
export const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Graceful process termination handler
 * @param {import('http').Server} [server] - Optional HTTP server to close
 */
export const setupGracefulShutdown = (server) => {
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    if (server && server.listening) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('🔌 HTTP server closed.');
          resolve();
        });
      });
    }

    try {
      await disconnectDB();
      console.log('🍃 MongoDB connection closed.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }

    process.exit(0);
  };

  // Register signal listeners (avoid duplicate listeners in test runner)
  if (process.env.NODE_ENV !== 'test') {
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }
};

export default connectDB;

