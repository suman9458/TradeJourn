/**
 * auditLegacyRecords.js
 * ============================================================================
 * Read-only database audit script to inspect legacy seeded, demo, admin, and
 * MT5 connector records in MongoDB.
 * 
 * ZERO-LEAKAGE GUARANTEE:
 *   - NEVER selects, logs, or prints password hashes or secret keys.
 *   - Strictly read-only: performs zero writes, updates, drops, or deletions.
 * 
 * Usage:
 *   node server/scripts/auditLegacyRecords.js
 * ============================================================================
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const auditLegacyData = async () => {
  const uri = process.env.MONGODB_URI?.trim();
  console.log('🔍 [AUDIT SCRIPT] Starting Read-Only Inspection of Database Records...\n');

  if (!uri) {
    console.log('ℹ️ MONGODB_URI not set. Attempting connection to local/embedded MongoDB...');
  }

  try {
    const mongoUri = uri || 'mongodb://127.0.0.1:27017/tradejourn';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ Connected to Database: ${mongoose.connection.name} (${mongoose.connection.host})\n`);

    const User = require('../models/User');
    const MT5Account = require('../models/MT5Account');
    const Trade = require('../models/Trade');
    const Goal = require('../models/Goal');
    const Playbook = require('../models/Playbook');
    const OtpToken = require('../models/OtpToken');

    // ------------------------------------------------------------------------
    // 1. Audit Users with Admin Role
    // ------------------------------------------------------------------------
    const adminUsers = await User.find({ role: 'admin' }).select('-password').lean();

    console.log('========================================================================');
    console.log(`🛡️  SECTION 1: USERS WITH ADMIN ROLE (Total: ${adminUsers.length})`);
    console.log('========================================================================');
    if (adminUsers.length === 0) {
      console.log('   (No users with role "admin" found in database)');
    } else {
      adminUsers.forEach((u, i) => {
        console.log(`[${i + 1}] ID:        ${u._id}`);
        console.log(`    Name:      ${u.name}`);
        console.log(`    Username:  ${u.userId}`);
        console.log(`    Email:     ${u.email || '(None)'}`);
        console.log(`    Role:      ${u.role}`);
        console.log(`    CreatedAt: ${u.createdAt ? new Date(u.createdAt).toISOString() : 'Unknown'}`);
        console.log('------------------------------------------------------------------------');
      });
    }

    // ------------------------------------------------------------------------
    // 2. Audit Users Matching Old Seeded Admin & Demo Identities
    // ------------------------------------------------------------------------
    const oldSeededSignatures = [
      'suman9458@tradejourn.com',
      '@suman9458',
      'suman9458',
      'admin@tradejourn.com',
      'protrader@tradejourn.com',
      '@protrader',
      'trader.google@tradejourn.com',
      'trader.apple@tradejourn.com'
    ];

    const seededUsers = await User.find({
      $or: [
        { email: { $in: oldSeededSignatures } },
        { userId: { $in: oldSeededSignatures } }
      ]
    }).select('-password').lean();

    console.log('\n========================================================================');
    console.log(`🌱 SECTION 2: USERS MATCHING SEEDED / LEGACY IDENTITIES (Total: ${seededUsers.length})`);
    console.log('========================================================================');
    if (seededUsers.length === 0) {
      console.log('   (No legacy or seeded identities found)');
    } else {
      seededUsers.forEach((u, i) => {
        const isLegacyAdmin = u.email === 'suman9458@tradejourn.com' || u.userId === '@suman9458' || u.userId === 'suman9458';
        console.log(`[${i + 1}] ID:        ${u._id}`);
        console.log(`    Name:      ${u.name}`);
        console.log(`    Username:  ${u.userId}`);
        console.log(`    Email:     ${u.email || '(None)'}`);
        console.log(`    Role:      ${u.role}`);
        console.log(`    Type:      ${isLegacyAdmin ? 'Old Seeded Admin Identity' : 'Seeded / Mock Account'}`);
        console.log(`    CreatedAt: ${u.createdAt ? new Date(u.createdAt).toISOString() : 'Unknown'}`);
        console.log('------------------------------------------------------------------------');
      });
    }

    // ------------------------------------------------------------------------
    // 3. Audit All MT5 Connector & API Key Records
    // ------------------------------------------------------------------------
    // Strictly omit apiKeyHash - never select or print hashes or secrets
    const mt5Accounts = await MT5Account.find({}).select('-apiKeyHash').lean();

    // Map user lookup details
    const mt5UserIds = mt5Accounts.map(a => a.userId).filter(Boolean);
    const linkedUsers = await User.find({ _id: { $in: mt5UserIds } }).select('-password').lean();
    const userMap = new Map(linkedUsers.map(u => [u._id.toString(), u]));

    console.log('\n========================================================================');
    console.log(`📡 SECTION 3: ALL MT5 CONNECTOR & API KEY RECORDS (Total: ${mt5Accounts.length})`);
    console.log('========================================================================');
    if (mt5Accounts.length === 0) {
      console.log('   (No MT5 connector accounts found in database)');
    } else {
      mt5Accounts.forEach((acc, i) => {
        const linkedUser = userMap.get(acc.userId?.toString());
        console.log(`[${i + 1}] Account ID:    ${acc._id}`);
        console.log(`    Account Name:  ${acc.accountName || '(Unnamed)'}`);
        console.log(`    Broker Login:  #${acc.login}`);
        console.log(`    Broker Server: ${acc.serverName}`);
        console.log(`    Trade Mode:    ${acc.tradeMode || 'demo'}`);
        console.log(`    API Key ID:    ${acc.apiKeyId} (Public ID)`);
        console.log(`    Linked User:   ${linkedUser ? `${linkedUser.name} (${linkedUser.userId} | ${linkedUser.email})` : `User ID: ${acc.userId}`}`);
        console.log(`    Is Active:     ${acc.isActive}`);
        console.log(`    Created At:    ${acc.createdAt ? new Date(acc.createdAt).toISOString() : 'Unknown'}`);
        console.log('------------------------------------------------------------------------');
      });
    }

    // ------------------------------------------------------------------------
    // 4. Associated Legacy Data Counts
    // ------------------------------------------------------------------------
    const flaggedUserIds = seededUsers.map(u => u._id);
    const tradeCount = await Trade.countDocuments({ userId: { $in: flaggedUserIds } });
    const goalCount = await Goal.countDocuments({ userId: { $in: flaggedUserIds } });
    const playbookCount = await Playbook.countDocuments({ userId: { $in: flaggedUserIds } });
    const otpCount = await OtpToken.countDocuments({});

    console.log('\n========================================================================');
    console.log('📊 SECTION 4: ASSOCIATED LEGACY DATA COUNTS');
    console.log('========================================================================');
    console.log(`    Trades bound to flagged users:    ${tradeCount}`);
    console.log(`    Goals bound to flagged users:     ${goalCount}`);
    console.log(`    Playbooks bound to flagged users: ${playbookCount}`);
    console.log(`    Pending / Stored OTP Tokens:      ${otpCount}`);
    console.log('========================================================================');
    console.log('\n✅ Audit completed successfully. All operations were strictly read-only.');
    console.log('🔒 Zero secrets, password hashes, or API key secrets were selected or printed.\n');

  } catch (err) {
    console.error('❌ Database inspection failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

auditLegacyData();
