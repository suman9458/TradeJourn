/**
 * Migration 001: Initialize MetaTrader 5 (MT5) Schema & Indexes
 * Up: Creates collections, validates schemas, builds unique compound indexes
 * Down: Drops MT5 collections and cleans indexes
 */

const MT5Account = require('../models/MT5Account');
const MT5Deal = require('../models/MT5Deal');
const MT5Position = require('../models/MT5Position');
const MT5AuditLog = require('../models/MT5AuditLog');
const Trade = require('../models/Trade');

async function up(db) {
  console.log('  [UP] Initializing MT5 collections & indexes...');

  // 1. Ensure indexes for MT5Account
  await MT5Account.init();
  console.log('  ✓ MT5Account indexes initialized (unique compound: userId + serverName + login)');

  // 2. Ensure indexes for MT5Deal
  await MT5Deal.init();
  console.log('  ✓ MT5Deal indexes initialized (unique compound: accountId + dealTicket)');

  // 3. Ensure indexes for MT5Position
  await MT5Position.init();
  console.log('  ✓ MT5Position indexes initialized (unique compound: accountId + positionId)');

  // 4. Ensure indexes for MT5AuditLog
  await MT5AuditLog.init();
  console.log('  ✓ MT5AuditLog indexes initialized');

  // 5. Ensure indexes for Trade (MT5 linkage)
  await Trade.init();
  console.log('  ✓ Trade MT5 linkage indexes initialized');

  return { success: true, message: 'MT5 collections & indexes initialized' };
}

async function down(db) {
  console.log('  [DOWN] Reverting MT5 collections & indexes...');

  const collections = ['mt5accounts', 'mt5deals', 'mt5positions', 'mt5auditlogs'];
  for (const colName of collections) {
    try {
      await db.dropCollection(colName);
      console.log(`  ✓ Dropped collection: ${colName}`);
    } catch (err) {
      if (err.code === 26 || err.message.includes('ns not found')) {
        console.log(`  - Collection ${colName} did not exist, skipped.`);
      } else {
        console.warn(`  ! Could not drop ${colName}: ${err.message}`);
      }
    }
  }

  return { success: true, message: 'MT5 collections dropped successfully' };
}

module.exports = { id: '001_mt5_schema_init', up, down };
