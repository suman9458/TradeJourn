const crypto = require('crypto');
const User = require('../models/User');
const Playbook = require('../models/Playbook');
const Goal = require('../models/Goal');
const Trade = require('../models/Trade');
const { seedTradesForUser } = require('../controllers/tradeController');

const seedDemoData = async () => {
  // SEC-04 Hardening: In production, skip mock credentials seeding, but ensure admin identity & email stay synchronized
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'sumantd9458@gmail.com';
      const adminUser = await User.findOne({
        $or: [
          { userId: '@sumansingh9458' },
          { role: 'admin' },
          { email: 'sumantd9458@gmail.com' },
          { email: 'sumansingh9458@tradejourn.com' },
          { email: 'suman9458@tradejourn.com' }
        ]
      });
      if (adminUser) {
        let changed = false;
        if (adminUser.email !== adminEmail) {
          adminUser.email = adminEmail;
          changed = true;
        }
        if (adminUser.role !== 'admin') {
          adminUser.role = 'admin';
          changed = true;
        }
        if (adminUser.userId !== '@sumansingh9458') {
          adminUser.userId = '@sumansingh9458';
          changed = true;
        }
        if (changed) {
          await adminUser.save();
          console.log(`✅ Production Admin account synchronized to ${adminUser.userId} (${adminUser.email}).`);
        }
      }
    } catch (prodErr) {
      console.warn('Production admin email sync warning:', prodErr.message);
    }
    console.log('🔒 Production mode: automatic credential seeding is disabled for security.');
    return;
  }

  try {
    // 1. Seed or Ensure Single Authoritative Admin User (@sumansingh9458)
    const adminUserId = '@sumansingh9458';
    const adminEmail = process.env.ADMIN_EMAIL || 'sumantd9458@gmail.com';
    const adminName = 'Suman Singh (Admin)';
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || (`Admin_${crypto.randomBytes(8).toString('hex')}!`);

    let adminUser = await User.findOne({
      $or: [
        { userId: '@sumansingh9458' },
        { userId: 'sumansingh9458' },
        { email: 'sumantd9458@gmail.com' },
        { email: 'sumansingh9458@tradejourn.com' },
        { userId: '@suman9458' },
        { userId: 'suman9458' },
        { email: 'suman9458@tradejourn.com' },
        { email: adminEmail },
        { role: 'admin' }
      ]
    }).select('+password +securityPin');

    if (!adminUser) {
      adminUser = await User.create({
        name: adminName,
        userId: adminUserId,
        dob: '1998-05-15',
        tradingExperience: 'Expert',
        email: adminEmail,
        password: adminPassword,
        securityPin: '1234',
        role: 'admin'
      });
      await Playbook.create({ userId: adminUser._id });
      await Goal.create({ userId: adminUser._id });
      console.log('✅ Created Admin user (@sumansingh9458).');
    } else {
      let needsSave = false;
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        needsSave = true;
      }
      if (adminUser.userId !== adminUserId) {
        adminUser.userId = adminUserId;
        needsSave = true;
      }
      if (adminUser.email !== adminEmail) {
        adminUser.email = adminEmail;
        needsSave = true;
      }
      if (adminUser.name === 'Suman Sharma (Admin)' || adminUser.name === 'Suman Kumar (Admin)') {
        adminUser.name = adminName;
        needsSave = true;
      }
      if (!adminUser.securityPin) {
        adminUser.securityPin = '1234';
        needsSave = true;
      }
      if (needsSave) {
        await adminUser.save();
      }
      console.log(`✅ Admin user (@sumansingh9458) verified with admin privileges (${adminUser.email}).`);
    }

    // 1b. Purge any duplicate legacy accounts to guarantee strictly ONE admin exists
    await User.deleteMany({
      _id: { $ne: adminUser._id },
      $or: [
        { userId: '@suman9458' },
        { userId: 'suman9458' },
        { email: 'suman9458@tradejourn.com' },
        { email: 'sumansingh9458@tradejourn.com' }
      ]
    });

    // 2. Seed Demo User
    const demoEmail = 'protrader@tradejourn.com';
    const demoPassword = process.env.DEMO_SEED_PASSWORD || 'Password123!';
    let user = await User.findOne({ email: demoEmail }).select('+securityPin');

    if (!user) {
      user = await User.create({
        name: 'Pro Trader (Demo)',
        userId: '@protrader',
        dob: '1996-01-15',
        tradingExperience: 'Expert',
        email: demoEmail,
        password: demoPassword,
        securityPin: '1234',
        role: 'demo'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
    } else {
      let needsDemoSave = false;
      if (user.role !== 'demo') {
        user.role = 'demo';
        needsDemoSave = true;
      }
      if (!user.securityPin) {
        user.securityPin = '1234';
        needsDemoSave = true;
      }
      if (needsDemoSave) {
        await user.save();
      }
    }

    if (user) {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const todayTrade = await Trade.findOne({ userId: user._id, date: todayStr });
      const tradeCount = await Trade.countDocuments({ userId: user._id });

      if (tradeCount === 0 || !todayTrade) {
        console.log(`Refreshing dynamic demo trades for ${demoEmail}...`);
        await seedTradesForUser(user._id);
        console.log(`Dynamic demo trades for ${demoEmail} refreshed successfully.`);
      }
    }

    // 3. Seed or Ensure MT5 Account for Desktop Connector Sync
    const MT5Account = require('../models/MT5Account');
    const crypto = require('crypto');
    const defaultApiKeyId = 'mt5_key_' + crypto.randomBytes(8).toString('hex');
    const defaultApiKeyHash = crypto.randomBytes(32).toString('hex');

    const targetUser = adminUser || user;
    let mt5Account = await MT5Account.findOne({ userId: targetUser?._id, isActive: true });

    if (!mt5Account && targetUser) {
      mt5Account = await MT5Account.create({
        userId: targetUser._id,
        serverName: 'Exness-MT5Trial7',
        login: 434413217,
        accountName: 'Exness MT5 Real/Trial',
        tradeMode: 'demo',
        currency: 'USD',
        leverage: 1000,
        balance: 10000,
        equity: 10000,
        status: 'standby',
        connectionMethod: 'vps',
        apiKeyId: defaultApiKeyId,
        apiKeyHash: defaultApiKeyHash,
        isActive: true
      });
      console.log('✅ Created default MT5 connector account in database.');
    } else if (mt5Account && targetUser) {
      // Restore ownership to primary admin/target user in case it was incorrectly re-assigned
      mt5Account.userId = targetUser._id;
      if (!mt5Account.apiKeyHash) {
        mt5Account.apiKeyHash = defaultApiKeyHash;
      }
      await mt5Account.save();
    }
  } catch (err) {
    console.error('Error during demo/admin user setup:', err.message);
  }
};

module.exports = { seedDemoData };
