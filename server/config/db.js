const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let memoryServer = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    try {
      console.log('Connecting to configured MongoDB...');
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.warn(`Configured MongoDB connection failed: ${err.message}.`);
      console.log('Falling back to automated embedded MongoDB with disk persistence...');
    }
  } else {
    console.log('No MONGODB_URI configured. Starting embedded MongoDB with persistent storage...');
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const dataDir = path.resolve(__dirname, '../data/db');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Clean stale empty lock file if left over from previous abnormal shutdown
    const lockFile = path.join(dataDir, 'mongod.lock');
    if (fs.existsSync(lockFile)) {
      try {
        const stats = fs.statSync(lockFile);
        if (stats.size === 0) {
          fs.unlinkSync(lockFile);
          console.log('Cleaned stale zero-byte mongod.lock file.');
        }
      } catch (e) {
        console.warn('Could not inspect lock file:', e.message);
      }
    }

    console.log(`Initializing embedded MongoDB (database stored in ${dataDir})...`);
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'tradejourn',
          dbPath: dataDir,
          storageEngine: 'wiredTiger'
        },
        spawnTimeoutMS: 60000
      });
    } catch (persistentErr) {
      console.warn(`Persistent database storage init failed (${persistentErr.message}).`);
      console.log('Falling back to fresh in-memory MongoDB instance to ensure server availability...');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'tradejourn'
        },
        spawnTimeoutMS: 60000
      });
    }

    const memoryUri = memoryServer.getUri('tradejourn');
    const conn = await mongoose.connect(memoryUri);
    console.log(`Connected to persistent MongoDB at: ${conn.connection.host}`);
    console.log('Your accounts, trades, and settings are saved permanently in server/data/db.');
  } catch (error) {
    console.error(`Database Connection Critical Error: ${error.message}`);
    // Do not crash server process; express can still serve health check and error statuses
  }
};

const disconnectDB = async () => {
  try {
    if (mongoose.connection?.readyState === 1) {
      try {
        await mongoose.connection.db.admin().command({ fsync: 1 });
      } catch (e) {}
    }
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop({ doCleanup: false });
    }
  } catch (error) {
    console.error('Error during DB disconnect:', error);
  }
};

module.exports = { connectDB, disconnectDB };
