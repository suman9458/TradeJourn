const User = require('../models/User');
const Playbook = require('../models/Playbook');
const Goal = require('../models/Goal');
const Trade = require('../models/Trade');
const { seedTradesForUser } = require('../controllers/tradeController');

const seedDemoData = async () => {
  try {
    // 1. Seed or Ensure Admin User (@suman9458)
    const adminUserId = '@suman9458';
    const adminEmail = 'suman9458@tradejourn.com';
    let adminUser = await User.findOne({
      $or: [
        { userId: '@suman9458' },
        { userId: 'suman9458' },
        { email: adminEmail }
      ]
    });

    if (!adminUser) {
      adminUser = await User.create({
        name: 'Suman Sharma (Admin)',
        userId: adminUserId,
        dob: '1998-05-15',
        tradingExperience: 'Expert',
        email: adminEmail,
        password: 'Skumar9458@',
        role: 'admin'
      });
      await Playbook.create({ userId: adminUser._id });
      await Goal.create({ userId: adminUser._id });
      console.log('✅ Created Admin user (@suman9458).');
    } else {
      adminUser.role = 'admin';
      adminUser.userId = adminUserId;
      adminUser.password = 'Skumar9458@';
      await adminUser.save();
      console.log('✅ Admin user (@suman9458) verified with admin privileges.');
    }

    // 2. Seed Demo User
    const demoEmail = 'protrader@tradejourn.com';
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      user = await User.create({
        name: 'Pro Trader (Demo)',
        userId: '@protrader',
        dob: '1996-01-15',
        tradingExperience: 'Expert',
        email: demoEmail,
        password: 'Password123!',
        role: 'pro'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
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

    if (adminUser) {
      const adminTradeCount = await Trade.countDocuments({ userId: adminUser._id });
      if (adminTradeCount === 0) {
        console.log(`Seeding initial trade ledger for Admin @suman9458...`);
        await seedTradesForUser(adminUser._id);
      }
    }
  } catch (err) {
    console.error('Error during demo/admin user setup:', err.message);
  }
};

module.exports = { seedDemoData };
