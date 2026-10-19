const MT5Account = require('../models/MT5Account');
const MT5Deal = require('../models/MT5Deal');
const MT5Position = require('../models/MT5Position');
const MT5AuditLog = require('../models/MT5AuditLog');
const Trade = require('../models/Trade');

/**
 * Normalizes broker symbols with special suffixes (e.g., EURUSD.raw, BTCUSD.m, XAUUSD_pro)
 */
function normalizeSymbol(symbol) {
  if (!symbol) return '';
  return symbol.replace(/[._\-].*$/, '').toUpperCase();
}

/**
 * Calculate Pip difference for forex pairs and metals
 */
function calculatePips(symbol, direction, entryPrice, exitPrice) {
  if (!entryPrice || !exitPrice) return 0;
  const norm = normalizeSymbol(symbol);
  let pipSize = 0.0001;
  if (norm.includes('JPY') || norm.includes('XAU') || norm.includes('GOLD')) {
    pipSize = 0.01;
  } else if (norm.includes('BTC') || norm.includes('ETH') || norm.includes('US30') || norm.includes('NAS')) {
    pipSize = 1.0;
  }

  const diff = direction === 'Buy' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
  return Number((diff / pipSize).toFixed(1));
}

/**
 * Process raw deals batch and aggregate into positions
 */
async function processDealsBatch(account, userId, deals) {
  if (!Array.isArray(deals) || deals.length === 0) {
    return { insertedCount: 0, positionsUpdated: 0, closedPositions: [] };
  }

  // Sort deals chronologically to maintain causality
  const sortedDeals = [...deals].sort((a, b) => {
    const timeA = new Date(a.timeUTC || a.timeBroker || 0).getTime();
    const timeB = new Date(b.timeUTC || b.timeBroker || 0).getTime();
    return timeA - timeB;
  });

  let insertedCount = 0;
  let positionsUpdated = 0;
  const newlyClosedPositions = [];

  for (const rawDeal of sortedDeals) {
    const dealTicket = Number(rawDeal.dealTicket);
    const positionId = Number(rawDeal.positionId);
    if (!dealTicket || !positionId) continue;

    const symbol = rawDeal.symbol || '';
    const normSymbol = normalizeSymbol(symbol);
    const volume = Number(rawDeal.volume) || 0;
    const price = Number(rawDeal.price) || 0;
    const profit = Number(rawDeal.profit) || 0;
    const commission = Number(rawDeal.commission) || 0;
    const swap = Number(rawDeal.swap) || 0;
    const fee = Number(rawDeal.fee) || 0;
    const entry = rawDeal.entry || 'IN'; // IN, OUT, INOUT, OUT_BY
    const type = rawDeal.type || 'BUY'; // BUY, SELL
    const timeBroker = rawDeal.timeBroker ? new Date(rawDeal.timeBroker) : new Date();
    const timeUTC = rawDeal.timeUTC ? new Date(rawDeal.timeUTC) : new Date();

    // 1. Idempotently insert raw deal record
    const existingDeal = await MT5Deal.findOne({ accountId: account._id, dealTicket });
    if (existingDeal) {
      // Deal already processed and aggregated; skip to guarantee strict idempotency
      continue;
    }

    let dealRecord;
    try {
      dealRecord = await MT5Deal.create({
        accountId: account._id,
        userId,
        dealTicket,
        orderTicket: Number(rawDeal.orderTicket) || 0,
        positionId,
        symbol,
        normalizedSymbol: normSymbol,
        type,
        entry,
        volume,
        price,
        timeBroker,
        timeUTC,
        profit,
        commission,
        swap,
        fee,
        magic: Number(rawDeal.magic) || 0,
        comment: rawDeal.comment || '',
        reason: rawDeal.reason || '',
        rawPayload: rawDeal.rawPayload || rawDeal
      });
      insertedCount++;
    } catch (err) {
      if (err.code === 11000) {
        // Unique constraint race condition safety
        continue;
      }
      throw err;
    }

    // 2. Position Aggregation Engine
    // Check if position exists
    let position = await MT5Position.findOne({ accountId: account._id, positionId });

    if (entry === 'IN') {
      // Opening or scaling in
      const direction = type === 'BUY' ? 'Buy' : 'Sell';
      if (!position) {
        // Initial entry
        position = new MT5Position({
          accountId: account._id,
          userId,
          positionId,
          symbol,
          normalizedSymbol: normSymbol,
          direction,
          volume,
          closedVolume: 0,
          remainingVolume: volume,
          openPrice: price,
          openTimeBroker: timeBroker,
          openTimeUTC: timeUTC,
          initialSL: Number(rawDeal.sl) || 0,
          initialTP: Number(rawDeal.tp) || 0,
          grossProfit: profit,
          commission,
          swap,
          fee,
          netProfit: profit + commission + swap + fee,
          dealTickets: [dealTicket],
          status: 'open',
          isFullyClosed: false,
          journalStatus: 'pending'
        });
      } else {
        // Scale-in (add volume & update volume-weighted average price)
        const totalVol = position.volume + volume;
        position.openPrice = Number(((position.openPrice * position.volume + price * volume) / totalVol).toFixed(5));
        position.volume = totalVol;
        position.remainingVolume += volume;
        position.commission += commission;
        position.swap += swap;
        position.fee += fee;
        position.netProfit += (profit + commission + swap + fee);
        if (!position.dealTickets.includes(dealTicket)) {
          position.dealTickets.push(dealTicket);
        }
      }
      await position.save();
      positionsUpdated++;
    } else if (entry === 'OUT' || entry === 'OUT_BY') {
      // Partial or full exit
      if (!position) {
        // Edge case: OUT received before IN due to network delay or historical import
        position = new MT5Position({
          accountId: account._id,
          userId,
          positionId,
          symbol,
          normalizedSymbol: normSymbol,
          direction: type === 'BUY' ? 'Sell' : 'Buy', // Closing Buy means position was Sell
          volume,
          closedVolume: volume,
          remainingVolume: 0,
          openPrice: price,
          openTimeBroker: timeBroker,
          openTimeUTC: timeUTC,
          grossProfit: 0,
          commission: 0,
          swap: 0,
          fee: 0,
          netProfit: 0,
          dealTickets: []
        });
      }

      position.closedVolume += volume;
      position.remainingVolume = Math.max(0, Number((position.volume - position.closedVolume).toFixed(4)));
      position.closePrice = price;
      position.closeTimeBroker = timeBroker;
      position.closeTimeUTC = timeUTC;
      position.grossProfit += profit;
      position.commission += commission;
      position.swap += swap;
      position.fee += fee;
      position.netProfit = Number((position.grossProfit + position.commission + position.swap + position.fee).toFixed(2));

      if (!position.dealTickets.includes(dealTicket)) {
        position.dealTickets.push(dealTicket);
      }

      // Check if position is fully closed (net volume = 0)
      if (position.remainingVolume <= 0.00001) {
        const wasClosed = position.isFullyClosed;
        position.isFullyClosed = true;
        position.status = 'closed';

        await position.save();
        positionsUpdated++;

        // Only create pending journal if it wasn't already closed
        if (!wasClosed) {
          const createdJournal = await ensurePendingJournalForPosition(account, userId, position);
          newlyClosedPositions.push({ position, journal: createdJournal });
        }
      } else {
        await position.save();
        positionsUpdated++;
      }
    } else if (entry === 'INOUT') {
      // Netting account reversal (position flips direction)
      // 1. Close out the existing position
      if (position && position.status === 'open') {
        const closedVolumePart = position.remainingVolume;
        position.closedVolume += closedVolumePart;
        position.remainingVolume = 0;
        position.closePrice = price;
        position.closeTimeBroker = timeBroker;
        position.closeTimeUTC = timeUTC;
        position.grossProfit += profit;
        position.commission += commission;
        position.swap += swap;
        position.netProfit = Number((position.grossProfit + position.commission + position.swap + position.fee).toFixed(2));
        position.isFullyClosed = true;
        position.status = 'closed';
        if (!position.dealTickets.includes(dealTicket)) {
          position.dealTickets.push(dealTicket);
        }
        await position.save();

        const createdJournal = await ensurePendingJournalForPosition(account, userId, position);
        newlyClosedPositions.push({ position, journal: createdJournal });
      }

      // 2. Open a new opposite position for the remaining reversed volume
      const remainingReversedVol = Math.max(0, Number((volume - (position ? position.closedVolume : 0)).toFixed(4)));
      if (remainingReversedVol > 0) {
        const newDirection = type === 'BUY' ? 'Buy' : 'Sell';
        const nextPositionId = positionId + 10000000; // Distinct synthetic ticket for reversed leg
        const reversedPosition = new MT5Position({
          accountId: account._id,
          userId,
          positionId: nextPositionId,
          symbol,
          normalizedSymbol: normSymbol,
          direction: newDirection,
          volume: remainingReversedVol,
          closedVolume: 0,
          remainingVolume: remainingReversedVol,
          openPrice: price,
          openTimeBroker: timeBroker,
          openTimeUTC: timeUTC,
          grossProfit: 0,
          commission: 0,
          swap: 0,
          fee: 0,
          netProfit: 0,
          dealTickets: [dealTicket],
          status: 'open',
          isFullyClosed: false,
          journalStatus: 'pending'
        });
        await reversedPosition.save();
        positionsUpdated++;
      }
    }
  }

  // Update account lastSyncTime
  await MT5Account.findByIdAndUpdate(account._id, { lastSyncTime: new Date() });

  return { insertedCount, positionsUpdated, closedPositions: newlyClosedPositions };
}

/**
 * Ensures exactly ONE pending journal entry exists for a fully closed position (idempotent)
 */
async function ensurePendingJournalForPosition(account, userId, position) {
  if (!position.isFullyClosed) return null;

  // Check if Trade already linked
  let existingTrade = await Trade.findOne({
    userId,
    mt5PositionId: position.positionId,
    mt5AccountId: account._id
  });

  if (existingTrade) {
    // If trade already exists, check if MT5 data was corrected/changed
    const hasChanged =
      existingTrade.takeProfitUSD !== position.netProfit ||
      existingTrade.exitPrice !== position.closePrice;

    if (hasChanged) {
      existingTrade.takeProfit = position.netProfit;
      existingTrade.takeProfitUSD = position.netProfit;
      existingTrade.exitPrice = position.closePrice;
      existingTrade.commission = position.commission;
      existingTrade.swap = position.swap;
      existingTrade.mt5DataChanged = true;
      await existingTrade.save();
    }
    return existingTrade;
  }

  // Format date and time
  const closeDate = position.closeTimeUTC || new Date();
  const dateStr = closeDate.toISOString().split('T')[0];
  const timeStr = closeDate.toISOString().split('T')[1].substring(0, 5);

  const pips = calculatePips(position.symbol, position.direction, position.openPrice, position.closePrice);
  const result = position.netProfit > 0.01 ? 'WIN' : position.netProfit < -0.01 ? 'LOSS' : 'BE';
  const rr = position.initialSL && position.openPrice
    ? Math.abs((position.closePrice - position.openPrice) / (position.openPrice - position.initialSL))
    : 1.5;

  const newTrade = new Trade({
    userId,
    tradeName: `MT5 #${position.positionId} (${position.normalizedSymbol})`,
    date: dateStr,
    time: timeStr,
    instrument: position.normalizedSymbol,
    direction: position.direction,
    levelTraded: 'Key Level',
    session: 'London',
    bias: position.direction === 'Buy' ? 'Bullish' : 'Bearish',
    result,
    rr: Number(rr.toFixed(2)),
    rResult: result === 'WIN' ? Number(rr.toFixed(2)) : result === 'LOSS' ? -1 : 0,
    pips,
    takeProfit: position.netProfit,
    takeProfitUSD: position.netProfit,
    setupRating: 'A+',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None'],
    notes: `Imported via MetaTrader 5 Bridge.\nBroker Ticket: #${position.positionId}\nGross P&L: $${position.grossProfit}\nCommission: $${position.commission}\nSwap: $${position.swap}`,
    screenshotUrl: '',
    imageUrl: '',
    // MT5 link metadata
    mt5PositionId: position.positionId,
    mt5AccountId: account._id,
    isFromMT5: true,
    journalStatus: 'pending',
    lotSize: position.volume,
    commission: position.commission,
    swap: position.swap,
    entryPrice: position.openPrice,
    exitPrice: position.closePrice,
    disciplineScore: 100,
    tradeGrade: 'Elite'
  });

  await newTrade.save();

  // Link back to position
  position.journalId = newTrade._id;
  position.journalStatus = 'pending';
  await position.save();

  return newTrade;
}

module.exports = {
  normalizeSymbol,
  calculatePips,
  processDealsBatch,
  ensurePendingJournalForPosition
};
