/**
 * TradeJourn Migration Runner
 * Usage:
 *   node server/migrations/runner.js up
 *   node server/migrations/runner.js down
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');

const migrations = [
  require('./001_mt5_schema_init')
];

async function run() {
  const direction = (process.argv[2] || 'up').toLowerCase();

  if (!['up', 'down'].includes(direction)) {
    console.error('Usage: node runner.js [up|down]');
    process.exit(1);
  }

  console.log(`=======================================================`);
  console.log(`🚀 TradeJourn Database Migration Runner: [${direction.toUpperCase()}]`);
  console.log(`=======================================================`);

  let memoryServer = null;
  const uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    console.log('Connecting to configured MongoDB for migration...');
    await mongoose.connect(uri);
  } else {
    // Isolated migration runner instance (no lock collision with dev server)
    console.log('Starting isolated database instance for migration testing...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'tradejourn' },
      spawnTimeoutMS: 30000
    });
    const memUri = memoryServer.getUri('tradejourn');
    await mongoose.connect(memUri);
  }
  const db = mongoose.connection.db;

  try {
    if (direction === 'up') {
      for (const m of migrations) {
        console.log(`Running migration UP: ${m.id}`);
        await m.up(db);
        console.log(`✓ Migration ${m.id} completed successfully.\n`);
      }
    } else if (direction === 'down') {
      const reversed = [...migrations].reverse();
      for (const m of reversed) {
        console.log(`Running migration DOWN (Rollback): ${m.id}`);
        await m.down(db);
        console.log(`✓ Migration ${m.id} rolled back successfully.\n`);
      }
    }
    console.log(`=======================================================`);
    console.log(`✨ All migrations executed cleanly.`);
    console.log(`=======================================================`);
  } catch (err) {
    console.error(`❌ Migration failed:`, err);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
      if (memoryServer) {
        await memoryServer.stop();
      }
    } catch (e) {}
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, migrations };
