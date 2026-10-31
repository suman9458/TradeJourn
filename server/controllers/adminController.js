const User = require('../models/User');
const Trade = require('../models/Trade');
const Goal = require('../models/Goal');
const Playbook = require('../models/Playbook');
const Feedback = require('../models/Feedback');
const MT5Account = require('../models/MT5Account');

// @desc    Get all users with live profile metadata, telemetry, and trade aggregates (Admin only)
// @route   GET /api/admin/users
// @access  Private / Admin
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-password +securityPin')
      .sort({ createdAt: -1 })
      .lean();

    // 1. Live Aggregate trade metrics per user (Wins, Losses, BE, PnL, Pips, Last Trade)
    const tradeAgg = await Trade.aggregate([
      {
        $group: {
          _id: '$userId',
          totalTrades: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'LOSS'] }, 1, 0] } },
          breakevens: { $sum: { $cond: [{ $eq: ['$result', 'BE'] }, 1, 0] } },
          totalPnL: { $sum: '$takeProfitUSD' },
          totalPips: { $sum: '$pips' },
          lastTradeDate: { $max: '$date' }
        }
      }
    ]);
    const tradeStatsMap = new Map(tradeAgg.map(t => [t._id ? t._id.toString() : '', t]));

    // 2. Auxiliary counts: Goals, Playbooks, Feedbacks, MT5 Accounts
    const [goalCounts, playbookCounts, feedbackCounts, mt5Counts] = await Promise.all([
      Goal.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]),
      Playbook.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]),
      Feedback.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }]),
      MT5Account.aggregate([{ $group: { _id: '$userId', count: { $sum: 1 } } }])
    ]);

    const goalMap = new Map(goalCounts.map(g => [g._id ? g._id.toString() : '', g.count]));
    const playbookMap = new Map(playbookCounts.map(p => [p._id ? p._id.toString() : '', p.count]));
    const feedbackMap = new Map(feedbackCounts.map(f => [f._id ? f._id.toString() : '', f.count]));
    const mt5Map = new Map(mt5Counts.map(m => [m._id ? m._id.toString() : '', m.count]));

    const formattedUsers = users.map(u => {
      const uIdStr = u._id.toString();
      const tStats = tradeStatsMap.get(uIdStr) || {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        totalPnL: 0,
        totalPips: 0,
        lastTradeDate: null
      };

      const winRate = tStats.totalTrades > 0
        ? Math.round((tStats.wins / tStats.totalTrades) * 100)
        : 0;

      return {
        id: u._id,
        name: u.name,
        userId: u.userId,
        email: u.email || '',
        phoneNumber: u.phoneNumber || '',
        role: u.role || 'user',
        tradingExperience: u.tradingExperience || 'Intermediate',
        dob: u.dob || '',
        avatar: u.avatar || '',
        hasSecurityPin: Boolean(u.hasSecurityPin || u.securityPin),
        totalTrades: tStats.totalTrades,
        wins: tStats.wins,
        losses: tStats.losses,
        breakevens: tStats.breakevens,
        winRate,
        totalPnL: Math.round(tStats.totalPnL * 100) / 100,
        totalPips: Math.round(tStats.totalPips * 10) / 10,
        lastTradeDate: tStats.lastTradeDate,
        goalsCount: goalMap.get(uIdStr) || 0,
        playbookCount: playbookMap.get(uIdStr) || 0,
        feedbackCount: feedbackMap.get(uIdStr) || 0,
        mt5Connected: (mt5Map.get(uIdStr) || 0) > 0,
        mt5AccountsCount: mt5Map.get(uIdStr) || 0,
        settings: u.settings || {},
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      };
    });

    const totalPlatformTrades = formattedUsers.reduce((sum, u) => sum + u.totalTrades, 0);
    const totalPlatformPnL = Math.round(formattedUsers.reduce((sum, u) => sum + u.totalPnL, 0) * 100) / 100;
    const activeTradersCount = formattedUsers.filter(u => u.totalTrades > 0).length;

    const stats = {
      totalUsers: formattedUsers.length,
      adminCount: formattedUsers.filter(u => u.role === 'admin').length,
      proCount: formattedUsers.filter(u => u.role === 'pro').length,
      userCount: formattedUsers.filter(u => u.role === 'user').length,
      demoCount: formattedUsers.filter(u => u.role === 'demo').length,
      activeTradersCount,
      totalTradesAcrossAll: totalPlatformTrades,
      totalPlatformPnL
    };

    res.json({
      success: true,
      stats,
      users: formattedUsers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get complete deep details, recent trades, and platform telemetry for a single user (Admin only)
// @route   GET /api/admin/users/:id
// @access  Private / Admin
const getUserDeepDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password +securityPin')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 1. Fetch user's recent logged trades (up to 30)
    const recentTrades = await Trade.find({ userId: id })
      .sort({ date: -1, createdAt: -1 })
      .limit(30)
      .select('tradeName date time instrument direction session result pips takeProfitUSD setupRating rr emotion notes')
      .lean();

    // 2. Aggregate instrument performance breakdown
    const instrumentBreakdown = await Trade.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$instrument',
          tradesCount: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalPnL: { $sum: '$takeProfitUSD' },
          totalPips: { $sum: '$pips' }
        }
      },
      { $sort: { tradesCount: -1 } },
      { $limit: 8 }
    ]);

    // 3. Aggregate session performance breakdown
    const sessionBreakdown = await Trade.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$session',
          tradesCount: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalPnL: { $sum: '$takeProfitUSD' }
        }
      },
      { $sort: { tradesCount: -1 } }
    ]);

    // 4. Lifetime stats
    const lifetimeAgg = await Trade.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalTrades: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'LOSS'] }, 1, 0] } },
          breakevens: { $sum: { $cond: [{ $eq: ['$result', 'BE'] }, 1, 0] } },
          totalPnL: { $sum: '$takeProfitUSD' },
          totalPips: { $sum: '$pips' },
          grossProfit: {
            $sum: { $cond: [{ $gt: ['$takeProfitUSD', 0] }, '$takeProfitUSD', 0] }
          },
          grossLoss: {
            $sum: { $cond: [{ $lt: ['$takeProfitUSD', 0] }, { $abs: '$takeProfitUSD' }, 0] }
          }
        }
      }
    ]);

    const lt = lifetimeAgg[0] || {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      totalPnL: 0,
      totalPips: 0,
      grossProfit: 0,
      grossLoss: 0
    };

    const profitFactor = lt.grossLoss > 0
      ? Math.round((lt.grossProfit / lt.grossLoss) * 100) / 100
      : lt.grossProfit > 0 ? 99.9 : 0;

    const winRate = lt.totalTrades > 0
      ? Math.round((lt.wins / lt.totalTrades) * 100)
      : 0;

    // 5. Fetch Auxiliaries: Goals, Playbook, MT5 Accounts, Feedbacks
    const [goal, playbook, mt5Accounts, feedbacks] = await Promise.all([
      Goal.findOne({ userId: id }).lean(),
      Playbook.findOne({ userId: id }).lean(),
      MT5Account.find({ userId: id }).select('-password -investorPassword').lean(),
      Feedback.find({ userId: id }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role || 'user',
        tradingExperience: user.tradingExperience || 'Intermediate',
        dob: user.dob || '',
        avatar: user.avatar || '',
        hasSecurityPin: Boolean(user.hasSecurityPin || user.securityPin),
        settings: user.settings || {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      performance: {
        totalTrades: lt.totalTrades,
        wins: lt.wins,
        losses: lt.losses,
        breakevens: lt.breakevens,
        winRate,
        totalPnL: Math.round(lt.totalPnL * 100) / 100,
        totalPips: Math.round(lt.totalPips * 10) / 10,
        grossProfit: Math.round(lt.grossProfit * 100) / 100,
        grossLoss: Math.round(lt.grossLoss * 100) / 100,
        profitFactor,
        instruments: instrumentBreakdown.map(i => ({
          instrument: i._id || 'Unknown',
          tradesCount: i.tradesCount,
          winRate: i.tradesCount > 0 ? Math.round((i.wins / i.tradesCount) * 100) : 0,
          totalPnL: Math.round(i.totalPnL * 100) / 100,
          totalPips: Math.round(i.totalPips * 10) / 10
        })),
        sessions: sessionBreakdown.map(s => ({
          session: s._id || 'Unknown',
          tradesCount: s.tradesCount,
          winRate: s.tradesCount > 0 ? Math.round((s.wins / s.tradesCount) * 100) : 0,
          totalPnL: Math.round(s.totalPnL * 100) / 100
        }))
      },
      recentTrades,
      goal: goal || null,
      playbook: playbook || null,
      mt5Accounts: mt5Accounts || [],
      feedbacks: feedbacks || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user's role (Admin only)
// @route   PATCH /api/admin/users/:id/role
// @access  Private / Admin
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ['user', 'admin', 'pro', 'demo'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${allowedRoles.join(', ')}`
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protection: Prevent demoting primary admin or oneself
    if (targetUser._id.toString() === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own admin privileges.'
      });
    }
    if (targetUser.userId === '@sumansingh9458' && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'The primary system admin account (@sumansingh9458) cannot be demoted.'
      });
    }

    targetUser.role = role;
    await targetUser.save();

    res.json({
      success: true,
      message: `User role updated to ${role} successfully.`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        userId: targetUser.userId,
        role: targetUser.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user account and purge their data (Admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private / Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Protection: Prevent deleting yourself or the primary admin
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account while logged in.'
      });
    }
    if (targetUser.userId === '@sumansingh9458') {
      return res.status(400).json({
        success: false,
        message: 'The primary system admin account (@sumansingh9458) cannot be deleted.'
      });
    }

    // Purge associated user documents
    await Trade.deleteMany({ userId: targetUser._id });
    await Goal.deleteMany({ userId: targetUser._id });
    await Playbook.deleteMany({ userId: targetUser._id });
    await Feedback.deleteMany({ userId: targetUser._id });
    await MT5Account.deleteMany({ userId: targetUser._id });
    await User.deleteOne({ _id: targetUser._id });

    res.json({
      success: true,
      message: `User account @${targetUser.userId.replace(/^@/, '')} and associated records purged successfully.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserDeepDetails,
  updateUserRole,
  deleteUser
};
