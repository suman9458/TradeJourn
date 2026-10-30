/**
 * TradeJourn AI Coach - Multi-Turn Conversation & Context Continuity Test Suite
 * ==============================================================================
 * Comprehensive evaluation of:
 * 1. The canonical 4-turn sequence:
 *    Turn 1: "Analyse my Gold trades."
 *    Turn 2: "Only the last month."
 *    Turn 3: "Now compare that with the previous month."
 *    Turn 4: "What was my biggest mistake?"
 * 2. Conversational context continuity without losing underlying task or entity filters.
 * 3. Fresh database queries on changed constraints (zero trust in previous AI dialogue).
 * 4. Multi-tenant isolation and strict protection against cross-user context leakage.
 * 5. Handling of soft-deleted and expired conversation sessions.
 * 6. Rolling summarization for long multi-turn sessions (preventing context bloat).
 * 7. Full Hindi/Hinglish multi-turn conversational comprehension.
 */

const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Trade = require('../models/Trade');
const {
  resolveMultiTurnContext,
  extractDateConstraint,
  analyzeFollowUpPattern,
  generateConversationSummary,
  getOrCreateConversation,
  saveConversationTurn,
  deleteConversation,
  listUserConversations,
  clearInMemoryStore,
  generateConversationId
} = require('../services/ai/conversationContextManager');
const { processAiCoachChat } = require('../services/ai/aiCoachService');
const { getTradeStats, compareTradingPeriods, getMistakesAndEmotions } = require('../services/ai/journalTools');

// Fixed reference date: 2026-10-30 for deterministic date math
const FIXED_REF_DATE = new Date('2026-10-30T12:00:00Z');

// User IDs
const USER_A_ID = '67100000000000000000000a';
const USER_B_ID = '67100000000000000000000b';

const mockUserA = {
  _id: USER_A_ID,
  name: 'Trader Suman',
  username: 'suman_trader',
  role: 'trader',
  settings: {
    accountBalance: 10000,
    riskPerTrade: 1.0,
    aiModel: 'gemini-2.0-flash'
  }
};

const mockUserB = {
  _id: USER_B_ID,
  name: 'Trader Alex',
  username: 'alex_trader',
  role: 'trader'
};

// Synthetic trades dataset for User A
const userATrades = [
  // Last Month (September 2026) Gold Trades
  {
    _id: 't_g_sep_1',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'BUY',
    date: '2026-09-10',
    time: '09:30',
    session: 'London',
    result: 'WIN',
    profitUSD: 450,
    rResult: 2.25,
    setupRating: 'A+',
    mistakes: [],
    confirmation: 'Yes'
  },
  {
    _id: 't_g_sep_2',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'SELL',
    date: '2026-09-18',
    time: '14:30',
    session: 'New York',
    result: 'WIN',
    profitUSD: 350,
    rResult: 1.75,
    setupRating: 'A',
    mistakes: [],
    confirmation: 'Yes'
  },
  {
    _id: 't_g_sep_3',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'BUY',
    date: '2026-09-24',
    time: '10:00',
    session: 'London',
    result: 'LOSS',
    profitUSD: -200,
    rResult: -1.0,
    setupRating: 'B',
    mistakes: ['Moved SL', 'FOMO'],
    confirmation: 'No'
  },
  {
    _id: 't_g_sep_4',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'BUY',
    date: '2026-09-28',
    time: '15:00',
    session: 'New York',
    result: 'LOSS',
    profitUSD: -250,
    rResult: -1.25,
    setupRating: 'B',
    mistakes: ['Moved SL'],
    confirmation: 'No'
  },

  // Previous Month (August 2026) Gold Trades
  {
    _id: 't_g_aug_1',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'BUY',
    date: '2026-08-05',
    time: '09:00',
    session: 'London',
    result: 'WIN',
    profitUSD: 300,
    rResult: 1.5,
    setupRating: 'A',
    mistakes: [],
    confirmation: 'Yes'
  },
  {
    _id: 't_g_aug_2',
    userId: USER_A_ID,
    instrument: 'XAUUSD',
    direction: 'SELL',
    date: '2026-08-14',
    time: '14:00',
    session: 'New York',
    result: 'LOSS',
    profitUSD: -300,
    rResult: -1.5,
    setupRating: 'B',
    mistakes: ['Chasing Price'],
    confirmation: 'No'
  },

  // Other instruments (EURUSD)
  {
    _id: 't_eu_oct_1',
    userId: USER_A_ID,
    instrument: 'EURUSD',
    direction: 'BUY',
    date: '2026-10-02',
    time: '08:45',
    session: 'London',
    result: 'WIN',
    profitUSD: 200,
    rResult: 2.0,
    setupRating: 'A+',
    mistakes: [],
    confirmation: 'Yes'
  }
];

// Helper to filter synthetic trades in memory for tests
function filterMockTrades(query = {}) {
  return userATrades.filter(t => {
    if (query.userId && String(t.userId) !== String(query.userId)) return false;
    if (query.instrument) {
      const re = query.instrument instanceof RegExp ? query.instrument : new RegExp(`^${query.instrument}$`, 'i');
      if (!re.test(t.instrument)) return false;
    }
    if (query.session) {
      const re = query.session instanceof RegExp ? query.session : new RegExp(`^${query.session}$`, 'i');
      if (!re.test(t.session)) return false;
    }
    if (query.date) {
      if (query.date.$gte && t.date < query.date.$gte) return false;
      if (query.date.$lte && t.date > query.date.$lte) return false;
    }
    return true;
  });
}

describe('TradeJourn AI Coach - Multi-Turn Conversation & Context Continuity Suite', () => {

  let originalReadyState;

  before(() => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // Intercept Trade Mongoose operations for deterministic test isolation
    Trade.find = function (query = {}) {
      const results = filterMockTrades(query);
      return {
        sort: () => ({
          skip: (offset = 0) => ({
            limit: (limit = 10) => ({
              lean: async () => results.slice(offset, offset + limit)
            }),
            lean: async () => results.slice(offset)
          }),
          limit: (limit = 10) => ({
            lean: async () => results.slice(0, limit)
          }),
          lean: async () => results
        }),
        lean: async () => results
      };
    };

    Trade.findOne = function (query = {}) {
      const results = filterMockTrades(query);
      return {
        lean: async () => results[0] || null
      };
    };
  });

  beforeEach(() => {
    clearInMemoryStore();
  });

  after(() => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
  });

  // =========================================================================
  // 1. CANONICAL 4-TURN SEQUENCE
  // =========================================================================

  test('1. Turn 1: "Analyse my Gold trades." initializes Gold context and returns fresh stats', async () => {
    const convId = 'conv_canonical_test';

    const res = await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.intent, 'JOURNAL_QUERY');
    assert.equal(res.conversationId, convId);
    assert.equal(res.activeContext.activeSymbol, 'XAUUSD');
    assert.equal(res.activeContext.activeFilters.instrument, 'XAUUSD');

    // Should include Gold stats
    assert.ok(res.answer.includes('AUDITED WIN RATE') || res.answer.includes('WIN RATE'));
    assert.ok(res.answer.includes('6 closed trades') || res.answer.includes('Win Rate'));
  });

  test('2. Turn 2: "Only the last month." applies date constraint to Gold trades without forgetting instrument', async () => {
    const convId = 'conv_canonical_test_2';

    // Seed Turn 1
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Execute Turn 2: Ambiguous date constraint follow-up
    const res = await processAiCoachChat({
      question: 'Only the last month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.intent, 'JOURNAL_QUERY');
    assert.equal(res.activeContext.activeSymbol, 'XAUUSD', 'Must retain activeSymbol XAUUSD');
    assert.equal(res.activeContext.activeFilters.instrument, 'XAUUSD', 'Filter instrument must remain XAUUSD');
    assert.ok(res.activeContext.activeFilters.startDate, 'Must have computed startDate for last month');
    assert.ok(res.activeContext.activeFilters.endDate, 'Must have computed endDate for last month');

    // September 2026 has 4 trades for User A (2 wins, 2 losses -> 50% win rate)
    assert.ok(res.answer.includes('50.0%') || res.answer.includes('50%'), 'Must compute 50% win rate for last month');
    assert.ok(res.answer.includes('4 closed trades'), 'Must analyze exactly 4 trades in September');
    assert.ok(res.answer.includes('2026-09') || res.answer.includes('Audit Window'), 'Must show date range');
  });

  test('3. Turn 3: "Now compare that with the previous month." compares September vs August for Gold', async () => {
    const convId = 'conv_canonical_test_3';

    // Seed Turn 1 & 2
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    await processAiCoachChat({
      question: 'Only the last month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Execute Turn 3: Comparative follow-up
    const res = await processAiCoachChat({
      question: 'Now compare that with the previous month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.intent, 'JOURNAL_COMPARISON');
    assert.equal(res.activeContext.activeSymbol, 'XAUUSD');
    assert.ok(res.answer.includes('TRADING SESSION COMPARISON') || res.answer.includes('COMPARISON'));
    assert.ok(res.answer.includes('Win Rate') && res.answer.includes('Profit Factor'));
  });

  test('4. Turn 4: "What was my biggest mistake?" diagnoses top recurring error on Gold trades', async () => {
    const convId = 'conv_canonical_test_4';

    // Seed Turn 1, 2, 3
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    await processAiCoachChat({
      question: 'Only the last month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    await processAiCoachChat({
      question: 'Now compare that with the previous month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Execute Turn 4: Diagnostic follow-up
    const res = await processAiCoachChat({
      question: 'What was my biggest mistake?',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.intent, 'TRADING_PSYCHOLOGY');
    // Top mistake on User A Gold trades is 'Moved SL' (2 occurrences, -$450 impact)
    assert.ok(res.answer.includes('Moved SL'), 'Must identify "Moved SL" as top mistake');
    assert.ok(res.answer.includes('BIGGEST RECURRING MISTAKE') || res.answer.includes('RECURRING EXECUTION MISTAKES'));
    assert.ok(res.answer.includes('Causal Mechanism'));
    assert.ok(res.answer.includes('Actionable Remedy'));
  });

  // =========================================================================
  // 2. CHANGED FILTERS & INTENT TRANSITIONS
  // =========================================================================

  test('5. Switching instrument to EURUSD updates active symbol cleanly', async () => {
    const convId = 'conv_filter_switch';

    // Turn 1 on Gold
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Turn 2: Switch to EURUSD
    const res = await processAiCoachChat({
      question: 'Now show my EURUSD performance.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.activeContext.activeSymbol, 'EURUSD');
    assert.equal(res.activeContext.activeFilters.instrument, 'EURUSD');
  });

  test('6. Session constraint "Only London session" refines session filter without dropping symbol', async () => {
    const convId = 'conv_session_refine';

    // Turn 1 on Gold
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Turn 2: Refine session
    const res = await processAiCoachChat({
      question: 'Only London session.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.equal(res.activeContext.activeSymbol, 'XAUUSD');
    assert.equal(res.activeContext.activeFilters.session, 'London');
  });

  // =========================================================================
  // 3. ZERO TRUST IN OLD AI STATS (FRESH DB QUERIES)
  // =========================================================================

  test('7. Old AI answers in chat history are never treated as authoritative financial data', async () => {
    const convId = 'conv_zero_trust';

    // Inject a fake dialogue history into the conversation where previous turn claimed 95% win rate
    const fakeMessages = [
      { sender: 'user', text: 'What was my win rate on Gold?' },
      { sender: 'ai', text: 'Your win rate on Gold was 95% with +$10,000 profit.' }
    ];

    const res = await processAiCoachChat({
      question: 'What is my actual win rate on Gold?',
      messages: fakeMessages,
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    // Real data has 3 wins / 3 losses across 6 trades = 50.0%, NOT 95%
    assert.ok(res.answer.includes('50.0%') || res.answer.includes('50%'), 'Must compute real 50% win rate from DB');
    assert.ok(!res.answer.includes('95%'), 'Must NEVER repeat fake 95% stat from history');
  });

  // =========================================================================
  // 4. MULTI-TENANT ISOLATION & PERMISSION SECURITY
  // =========================================================================

  test('8. Protection against cross-user context leakage (User B cannot access User A conversation)', async () => {
    const convIdA = 'conv_private_user_a';

    // User A creates conversation
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convIdA,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // User B tries to hijack User A's conversation ID
    const resB = await processAiCoachChat({
      question: 'Only the last month.',
      conversationId: convIdA,
      user: mockUserB,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(resB.success, false, 'User B request must fail');
    assert.equal(resB.code, 'FORBIDDEN', 'Must return FORBIDDEN code');
    assert.ok(resB.error.includes('Access denied'), 'Must explain access denied');

    // Direct check on getOrCreateConversation
    const directCheck = await getOrCreateConversation({ userId: USER_B_ID, conversationId: convIdA });
    assert.equal(directCheck.forbidden, true, 'directCheck must flag forbidden');
  });

  test('9. User B delete on User A conversation fails safely', async () => {
    const convIdA = 'conv_delete_protect';

    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convIdA,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    const deleted = await deleteConversation(USER_B_ID, convIdA);
    assert.equal(deleted, false, 'User B must NOT be able to delete User A conversation');
  });

  // =========================================================================
  // 5. DELETED & EXPIRED CONVERSATIONS
  // =========================================================================

  test('10. Deleted conversation is handled gracefully by starting fresh session', async () => {
    const convId = 'conv_to_delete';

    // Seed conversation
    await processAiCoachChat({
      question: 'Analyse my Gold trades.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    // Delete conversation
    const delOk = await deleteConversation(USER_A_ID, convId);
    assert.equal(delOk, true);

    // Subsequent request with the deleted conversation ID must reset gracefully without crashing
    const res = await processAiCoachChat({
      question: 'Only the last month.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(res.success, true);
    assert.notEqual(res.conversationId, convId, 'Must generate fresh conversation ID');
  });

  test('11. Expired conversation triggers safe session reset', async () => {
    // Seed conversation
    const { conversation } = await getOrCreateConversation({
      userId: USER_A_ID
    });

    assert.ok(conversation);
    const convId = conversation.conversationId;

    // Manually expire it
    conversation.expiresAt = new Date(Date.now() - 1000);

    const lookup = await getOrCreateConversation({
      userId: USER_A_ID,
      conversationId: convId
    });

    assert.equal(lookup.expired, true);
    assert.equal(lookup.conversation, null);
  });

  // =========================================================================
  // 6. ROLLING SUMMARIZATION FOR LONG CONVERSATIONS
  // =========================================================================

  test('12. Conversations with >= 8 messages produce a concise rolling summary', () => {
    const longMessages = [
      { role: 'user', text: 'Analyse my Gold trades.' },
      { role: 'model', text: 'You have 6 closed Gold trades with a 50% win rate.' },
      { role: 'user', text: 'Only the last month.' },
      { role: 'model', text: 'In September 2026, you had 4 trades with 50% win rate and +$350 net profit.' },
      { role: 'user', text: 'Now compare that with the previous month.' },
      { role: 'model', text: 'August had 2 trades with 50% win rate and $0 net profit.' },
      { role: 'user', text: 'What was my biggest mistake?' },
      { role: 'model', text: 'Your biggest mistake was Moved SL costing -$450.' },
      { role: 'user', text: 'How do I enforce a rule against moving stop losses?' },
      { role: 'model', text: 'To enforce stop loss discipline, remove trade modification buttons after entry.' }
    ];

    const summary = generateConversationSummary(longMessages);
    assert.ok(summary, 'Summary must not be empty');
    assert.ok(summary.length < 500, 'Summary must be compact and under 500 characters');
    assert.ok(summary.includes('Gold') || summary.includes('trades'), 'Summary must capture topics');
  });

  // =========================================================================
  // 7. NATURAL HINGLISH MULTI-TURN COMPREHENSION
  // =========================================================================

  test('13. Multi-turn conversation in Hinglish resolves entities and filters accurately', async () => {
    const convId = 'conv_hinglish_multi';

    // Turn 1 in Hinglish
    const turn1 = await processAiCoachChat({
      question: 'Mere Gold ke trades analyse karo.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(turn1.success, true);
    assert.equal(turn1.activeContext.activeSymbol, 'XAUUSD');

    // Turn 2 in Hinglish: "Sirf pichhle mahine ka dikhao"
    const turn2 = await processAiCoachChat({
      question: 'Sirf pichhle mahine ka dikhao.',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(turn2.success, true);
    assert.equal(turn2.intent, 'JOURNAL_QUERY');
    assert.equal(turn2.activeContext.activeSymbol, 'XAUUSD', 'Must retain Gold symbol in Hinglish follow-up');
    assert.ok(turn2.activeContext.activeFilters.startDate, 'Must apply date filter for pichhle mahine');

    // Turn 3 in Hinglish: "Meri sabse badi galti kya thi?"
    const turn3 = await processAiCoachChat({
      question: 'Meri sabse badi galti kya thi?',
      conversationId: convId,
      user: mockUserA,
      userApiKey: 'offline',
      referenceDate: FIXED_REF_DATE
    });

    assert.equal(turn3.success, true);
    assert.equal(turn3.intent, 'TRADING_PSYCHOLOGY');
    assert.ok(turn3.answer.includes('Moved SL'), 'Must identify Moved SL as top mistake in Hinglish');
  });

});
