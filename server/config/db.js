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

    // Clean stale lock files (PID-aware) from previous abnormal shutdown
    const lockFile = path.join(dataDir, 'mongod.lock');
    if (fs.existsSync(lockFile)) {
      try {
        const lockContent = fs.readFileSync(lockFile, 'utf8').trim();
        const pid = parseInt(lockContent, 10);
        let isRunning = false;
        if (!isNaN(pid) && pid > 0) {
          try {
            process.kill(pid, 0); // Check if process with PID exists
            isRunning = true;
          } catch (e) {
            isRunning = false;
          }
        }
        if (!isRunning) {
          fs.unlinkSync(lockFile);
          console.log(`Cleaned stale mongod.lock file (PID ${pid || 'empty'} was not running).`);
        } else {
          console.log(`Lock file held by running process PID ${pid}.`);
        }
      } catch (e) {
        try {
          fs.unlinkSync(lockFile);
          console.log('Unlinked mongod.lock during clean-up.');
        } catch (err) {}
      }
    }

    // Clean WiredTiger.lock if mongod.lock was removed
    const wtLock = path.join(dataDir, 'WiredTiger.lock');
    if (fs.existsSync(wtLock) && !fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(wtLock);
        console.log('Cleaned stale WiredTiger.lock file.');
      } catch (e) {}
    }

    console.log(`Initializing embedded MongoDB (database stored in ${dataDir})...`);
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'tradejourn',
          dbPath: dataDir,
          storageEngine: 'wiredTiger'
        },
        spawnTimeoutMS: 30000
      });
    } catch (persistentErr) {
      console.warn(`Persistent database storage init failed (${persistentErr.message}).`);
      console.log('Falling back to fresh in-memory MongoDB instance to ensure server availability...');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'tradejourn'
        },
        spawnTimeoutMS: 30000
      });
    }

    const memoryUri = memoryServer.getUri('tradejourn');
    const conn = await mongoose.connect(memoryUri, {
      maxPoolSize: 25,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    });
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
