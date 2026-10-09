const Trade = require('../models/Trade');

// @desc    Get all trades for logged-in user with filtering, pagination & search
// @route   GET /api/trades
// @access  Private
const getTrades = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'date',
      order = 'desc',
      search,
      session,
      setupRating,
      result,
      instrument,
      emotion,
      view,
      startDate,
      endDate
    } = req.query;

    const query = { userId: req.user._id };

    // Search query
    if (search) {
      query.$or = [
        { tradeName: { $regex: search, $options: 'i' } },
        { instrument: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { levelTraded: { $regex: search, $options: 'i' } }
      ];
    }

    // Filters
    if (session) query.session = session;
    if (setupRating) query.setupRating = setupRating;
    if (result) query.result = result;
    if (instrument) query.instrument = instrument;
    if (emotion) query.emotion = emotion;

    // Date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    // Pre-defined quick view filters
    const now = new Date();
    if (view === 'Today') {
      const todayStr = now.toISOString().slice(0, 10);
      query.date = todayStr;
    } else if (view === 'This Week') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      query.date = { $gte: past7.toISOString().slice(0, 10) };
    } else if (view === 'This Month') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      query.date = { $gte: past30.toISOString().slice(0, 10) };
    } else if (view === 'Winning Trades') {
      query.result = 'WIN';
    } else if (view === 'Losing Trades') {
      query.result = 'LOSS';
    } else if (view === 'A+ Trades') {
      query.setupRating = 'A+';
    } else if (view === 'Early Exits') {
      query.$or = [
        { reasonEarlyExit: { $nin: ['None', '', null] } },
        { mistakes: { $in: ['Early Exit', 'Moved SL', 'Cut Winner Early'] } }
      ];
    } else if (view === 'Emotional Trades') {
      query.$or = [
        { emotion: { $in: ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Overconfident', 'Frustrated', 'Anxious', 'Hesitant', 'Bored'] } },
        { mistakes: { $in: ['FOMO', 'Revenge Trading', 'Emotional Execution', 'Greed'] } }
      ];
    } else if (view === 'Mistake Trades') {
      query.mistakes = { $elemMatch: { $nin: ['None', ''] } };
    } else if (view === 'London Session') {
      query.session = { $in: ['London', 'London + New York'] };
    } else if (view === 'New York Session') {
      query.session = { $in: ['New York', 'London + New York'] };
    } else if (view === 'Asian Session') {
      query.session = 'Asian';
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    if (sortBy !== 'time') {
      sortOptions.time = -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let [trades, totalCount] = await Promise.all([
      Trade.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Trade.countDocuments(query)
    ]);


    res.json({
      success: true,
      count: trades.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      trades
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single trade by ID
// @route   GET /api/trades/:id
// @access  Private
const getTradeById = async (req, res, next) => {
  try {
    const trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    res.json({ success: true, trade });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new trade
// @route   POST /api/trades
// @desc    Create new trade
// @route   POST /api/trades
// @access  Private
const createTrade = async (req, res, next) => {
  try {
    const rawTp = req.body.takeProfit !== undefined && req.body.takeProfit !== null && req.body.takeProfit !== ''
      ? Number(req.body.takeProfit)
      : (req.body.takeProfitUSD !== undefined && req.body.takeProfitUSD !== null && req.body.takeProfitUSD !== '' ? Number(req.body.takeProfitUSD) : 0);

    const tradeData = {
      ...req.body,
      takeProfit: rawTp,
      takeProfitUSD: rawTp,
      userId: req.user._id
    };

    const trade = new Trade(tradeData);
    await trade.save();

    res.status(201).json({ success: true, trade });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing trade
// @route   PUT /api/trades/:id
// @access  Private
const updateTrade = async (req, res, next) => {
  try {
    let trade = await Trade.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    if (req.body.takeProfit !== undefined || req.body.takeProfitUSD !== undefined) {
      const rawTp = req.body.takeProfit !== undefined && req.body.takeProfit !== null && req.body.takeProfit !== ''
        ? Number(req.body.takeProfit)
        : (req.body.takeProfitUSD !== undefined && req.body.takeProfitUSD !== null && req.body.takeProfitUSD !== '' ? Number(req.body.takeProfitUSD) : 0);
      req.body.takeProfit = rawTp;
      req.body.takeProfitUSD = rawTp;
    }

    Object.assign(trade, req.body);
    await trade.save();

    res.json({ success: true, trade });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete trade
// @route   DELETE /api/trades/:id
// @access  Private
const deleteTrade = async (req, res, next) => {
  try {
    const trade = await Trade.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade not found' });
    }

    res.json({ success: true, message: 'Trade removed successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all trades for logged in user
// @route   DELETE /api/trades
// @access  Private
const clearAllTrades = async (req, res, next) => {
  try {
    await Trade.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'All trades cleared successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Export all trades as CSV
// @route   GET /api/trades/export/csv
// @access  Private
const exportTradesCSV = async (req, res, next) => {
  try {
    const trades = await Trade.find({ userId: req.user._id }).sort({ date: -1, time: -1 });

    const headers = [
      'Trade Name',
      'Date',
      'Time',
      'Instrument',
      'Session',
      'Setup Rating',
      'Bias',
      'Result',
      'RR',
      'R Result',
      'Pips',
      'Take Profit (USD)',
      'Entry Type',
      'Confirmation',
      'Emotion',
      'Reason Early Exit',
      'Market Condition',
      'Mistakes',
      'Discipline Score',
      'Grade',
      'Notes'
    ];

    const rows = trades.map(t => [
      `"${(t.tradeName || '').replace(/"/g, '""')}"`,
      t.date,
      t.time,
      t.instrument,
      t.session,
      t.setupRating,
      t.bias,
      t.result,
      t.rr,
      t.rResult,
      t.pips,
      t.takeProfit || t.takeProfitUSD || 0,
      t.entryType,
      t.confirmation,
      t.emotion,
      `"${(t.reasonEarlyExit || '').replace(/"/g, '""')}"`,
      t.marketCondition,
      `"${(t.mistakes || []).join('; ').replace(/"/g, '""')}"`,
      t.disciplineScore,
      t.tradeGrade,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tradejourn_export.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

const getOffsetDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDynamicSampleTrades = () => [
  {
    tradeName: 'EURUSD London Liquidity Reversal',
    date: getOffsetDate(0),
    time: '08:30',
    instrument: 'EURUSD',
    levelTraded: 'Previous Day Low Sweep',
    session: 'London',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.4,
    pips: 32,
    setupRating: 'A+',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None'],
    notes: 'Clean sweep of Asian low followed by 5m MSS.'
  },
  {
    tradeName: 'XAUUSD NY Open Breakout',
    date: getOffsetDate(0),
    time: '14:45',
    instrument: 'XAUUSD',
    levelTraded: 'Daily Resistance 2640',
    session: 'New York',
    bias: 'Bullish',
    result: 'WIN',
    rr: 1.8,
    pips: 85,
    setupRating: 'A',
    entryType: 'Breakout',
    confirmation: 'Yes',
    emotion: 'Confident',
    reasonEarlyExit: 'None',
    marketCondition: 'Volatile',
    mistakes: ['None'],
    notes: 'Entered on retest of 2640 level.'
  },
  {
    tradeName: 'GBPUSD Early Impulse Chasing',
    date: getOffsetDate(1),
    time: '07:15',
    instrument: 'GBPUSD',
    levelTraded: 'Mid-range Pivot',
    session: 'Asian',
    bias: 'Bearish',
    result: 'LOSS',
    rr: 1.5,
    pips: -18,
    setupRating: 'C',
    entryType: 'Early Entry',
    confirmation: 'No',
    emotion: 'FOMO',
    reasonEarlyExit: 'Impatience',
    marketCondition: 'Choppy',
    mistakes: ['Early Entry', 'FOMO', 'Entered Without Setup'],
    notes: 'Chased candle before London open.'
  },
  {
    tradeName: 'NAS100 London Rejection',
    date: getOffsetDate(2),
    time: '09:15',
    instrument: 'NAS100',
    levelTraded: 'H4 Order Block',
    session: 'London',
    bias: 'Bearish',
    result: 'WIN',
    rr: 3.1,
    pips: 110,
    setupRating: 'A+',
    entryType: 'Liquidity Sweep',
    confirmation: 'Yes',
    emotion: 'Focused',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None'],
    notes: 'Patience paid off.'
  },
  {
    tradeName: 'USDJPY Retest Fear Exit',
    date: getOffsetDate(3),
    time: '13:30',
    instrument: 'USDJPY',
    levelTraded: '152.00 Psychological Level',
    session: 'London + New York',
    bias: 'Bullish',
    result: 'WIN',
    rr: 0.8,
    pips: 14,
    setupRating: 'B+',
    entryType: 'Retest',
    confirmation: 'Yes',
    emotion: 'Fear',
    reasonEarlyExit: 'Fear',
    marketCondition: 'Ranging',
    mistakes: ['Early Exit'],
    notes: 'Exited early because 1m candle showed wick rejection.'
  },
  {
    tradeName: 'XAUUSD Post-Loss Revenge',
    date: getOffsetDate(4),
    time: '16:00',
    instrument: 'XAUUSD',
    levelTraded: 'Random 1m Support',
    session: 'New York',
    bias: 'Bullish',
    result: 'LOSS',
    rr: 1.2,
    pips: -45,
    setupRating: 'D',
    entryType: 'Other',
    confirmation: 'No',
    emotion: 'Revenge',
    reasonEarlyExit: 'None',
    marketCondition: 'Choppy',
    mistakes: ['Revenge Trading', 'Entered Without Setup'],
    notes: 'Took trade right after losing stop-out.'
  },
  {
    tradeName: 'EURUSD New York Continuation',
    date: getOffsetDate(5),
    time: '15:15',
    instrument: 'EURUSD',
    levelTraded: '1.0850 Demand Zone',
    session: 'New York',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.0,
    pips: 26,
    setupRating: 'A',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None'],
    notes: 'Respected trend continuation.'
  },
  {
    tradeName: 'US30 Breakout Hesitation',
    date: getOffsetDate(7),
    time: '14:30',
    instrument: 'US30',
    levelTraded: 'Opening Range High',
    session: 'New York',
    bias: 'Bullish',
    result: 'BE',
    rr: 1.5,
    pips: 5,
    setupRating: 'B',
    entryType: 'Breakout',
    confirmation: 'Partial',
    emotion: 'Hesitant',
    reasonEarlyExit: 'Moved SL',
    marketCondition: 'Volatile',
    mistakes: ['Moved SL'],
    notes: 'Moved stop loss to breakeven too fast.'
  },
  {
    tradeName: 'GBPUSD Asian Range Expansion',
    date: getOffsetDate(10),
    time: '02:30',
    instrument: 'GBPUSD',
    levelTraded: 'Tokyo High Sweep',
    session: 'Asian',
    bias: 'Bearish',
    result: 'WIN',
    rr: 1.6,
    pips: 20,
    setupRating: 'B+',
    entryType: 'Liquidity Sweep',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Ranging',
    mistakes: ['None']
  },
  {
    tradeName: 'EURUSD London Continuation',
    date: getOffsetDate(14),
    time: '08:45',
    instrument: 'EURUSD',
    levelTraded: '1.0810 Order Block',
    session: 'London',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.2,
    pips: 28,
    setupRating: 'A+',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Confident',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None']
  },
  {
    tradeName: 'XAUUSD August Macro Rally',
    date: getOffsetDate(18),
    time: '14:00',
    instrument: 'XAUUSD',
    levelTraded: '2600 Breakout',
    session: 'New York',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.8,
    pips: 140,
    setupRating: 'A+',
    entryType: 'Breakout',
    confirmation: 'Yes',
    emotion: 'Focused',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None']
  },
  {
    tradeName: 'EURUSD Jackson Hole Sweep',
    date: getOffsetDate(24),
    time: '13:00',
    instrument: 'EURUSD',
    levelTraded: 'Daily Fair Value Gap',
    session: 'New York',
    bias: 'Bearish',
    result: 'WIN',
    rr: 2.1,
    pips: 45,
    setupRating: 'A',
    entryType: 'Liquidity Sweep',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Volatile',
    mistakes: ['None']
  },
  {
    tradeName: 'GBPUSD Support Breakdown',
    date: getOffsetDate(32),
    time: '09:00',
    instrument: 'GBPUSD',
    levelTraded: '1.2950 Support',
    session: 'London',
    bias: 'Bearish',
    result: 'LOSS',
    rr: 1.5,
    pips: -25,
    setupRating: 'C',
    entryType: 'Breakout',
    confirmation: 'Partial',
    emotion: 'Anxious',
    reasonEarlyExit: 'None',
    marketCondition: 'Choppy',
    mistakes: ['Late Entry']
  },
  {
    tradeName: 'US30 July Index Ramp',
    date: getOffsetDate(42),
    time: '15:30',
    instrument: 'US30',
    levelTraded: '41,500 Support',
    session: 'New York',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.5,
    pips: 95,
    setupRating: 'A',
    entryType: 'Retest',
    confirmation: 'Yes',
    emotion: 'Confident',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None']
  },
  {
    tradeName: 'EURUSD Mid-Summer Range',
    date: getOffsetDate(55),
    time: '10:15',
    instrument: 'EURUSD',
    levelTraded: 'Weekly Range EQ',
    session: 'London',
    bias: 'Bearish',
    result: 'WIN',
    rr: 1.7,
    pips: 24,
    setupRating: 'B+',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Ranging',
    mistakes: ['None']
  },
  {
    tradeName: 'XAUUSD June Pullback',
    date: getOffsetDate(75),
    time: '11:00',
    instrument: 'XAUUSD',
    levelTraded: '2540 Resistance',
    session: 'Asian',
    bias: 'Bearish',
    result: 'LOSS',
    rr: 1.5,
    pips: -35,
    setupRating: 'B',
    entryType: 'Early Entry',
    confirmation: 'No',
    emotion: 'Impatient',
    reasonEarlyExit: 'Greed',
    marketCondition: 'Choppy',
    mistakes: ['Early Entry']
  },
  {
    tradeName: 'EURUSD May Liquidity Cleanse',
    date: getOffsetDate(95),
    time: '08:15',
    instrument: 'EURUSD',
    levelTraded: 'Asian Low Sweep',
    session: 'London',
    bias: 'Bullish',
    result: 'WIN',
    rr: 2.3,
    pips: 38,
    setupRating: 'A+',
    entryType: 'Liquidity Sweep',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None']
  }
];

const seedTradesForUser = async (userId) => {
  await Trade.deleteMany({ userId });
  const sampleTrades = getDynamicSampleTrades();
  const createdTrades = [];
  for (const item of sampleTrades) {
    const trade = new Trade({
      ...item,
      userId
    });
    await trade.save();
    createdTrades.push(trade);
  }
  return createdTrades;
};

    // @desc    Seed realistic sample trades for the currently logged in user
    // @route   POST /api/trades/seed
    // @access  Private
    const seedSampleTrades = async (req, res, next) => {
      try {
        const userId = req.user._id;
        const createdTrades = await seedTradesForUser(userId);

        res.status(201).json({
          success: true,
          message: `Successfully seeded ${createdTrades.length} institutional sample trades.`,
          count: createdTrades.length,
          trades: createdTrades
        });
      } catch (error) {
        next(error);
      }
    };

module.exports = {
  getTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade,
  clearAllTrades,
  exportTradesCSV,
  seedSampleTrades,
  seedTradesForUser
};
