/**
 * TradeJourn Conversation Context Manager
 * ========================================
 * High-performance multi-turn conversation orchestrator for TradeJourn AI Coach:
 * - Per-user, per-conversation state management with strict multi-tenant isolation.
 * - Understands references to earlier messages (e.g. "Only the last month",
 *   "Now compare that with the previous month", "What was my biggest mistake?").
 * - Maintains active constraints (symbol, session, playbook rules) without forgetting underlying tasks.
 * - Clear architectural separation between historical chat dialogue, freshly queried
 *   verified journal metrics, and live external market snapshots.
 * - Never treats old AI responses as authoritative financial data.
 * - Rolling context summarization for long conversations to prevent token budget explosion.
 * - Graceful handling of deleted or expired conversations.
 */

const mongoose = require('mongoose');
const Conversation = require('../../models/Conversation');
const { MARKET_SYMBOLS_MAP } = require('./intentClassifier');

// In-memory conversation repository for unit tests or when MongoDB is offline
const inMemoryConversationStore = new Map();

/**
 * Check if MongoDB connection is truly open and active
 */
function isMongooseConnected() {
  return mongoose.connection.readyState === 1 && Boolean(mongoose.connection.db);
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `conv_${ts}_${rand}`;
}

/**
 * Helper to get in-memory key strictly partitioned by user
 */
function getMemoryKey(userId, conversationId) {
  return `${String(userId)}:${String(conversationId)}`;
}

/**
 * Normalize Date to YYYY-MM-DD
 */
function formatDateISO(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Parse natural language date constraints relative to a reference date
 * Supports:
 * - "last month" / "previous month" / "past month" / "pichhle mahine"
 * - "this month" / "current month" / "is mahine"
 * - "last week" / "past week" / "pichhle hafte"
 * - "this week" / "is hafte"
 * - "last 30 days" / "past 30 days" / "30 din"
 * - "last 7 days" / "past 7 days"
 * - Explicit year-month (e.g. "2026-10", "October 2026")
 * - Specific ranges ("between 2026-10-01 and 2026-10-15")
 */
function extractDateConstraint(rawText, referenceDate = new Date()) {
  if (!rawText) return { hasDateConstraint: false };
  const lower = rawText.toLowerCase().trim();
  const ref = new Date(referenceDate);
  const currentYear = ref.getFullYear();
  const currentMonth = ref.getMonth(); // 0-indexed

  // 1. Explicit dates (YYYY-MM-DD to YYYY-MM-DD)
  const rangeMatch = lower.match(/\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|and)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (rangeMatch) {
    return {
      hasDateConstraint: true,
      startDate: rangeMatch[1],
      endDate: rangeMatch[2],
      dateRangeLabel: `${rangeMatch[1]} to ${rangeMatch[2]}`
    };
  }

  // 2. "last 30 days" / "past 30 days" / "pichhle 30 din"
  if (/\b(?:last|past|pichhle)\s+30\s+(?:days?|din)\b/i.test(lower)) {
    const start = new Date(ref);
    start.setDate(start.getDate() - 30);
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(ref),
      dateRangeLabel: 'Last 30 Days'
    };
  }

  // 3. "last 7 days" / "past 7 days"
  if (/\b(?:last|past|pichhle)\s+7\s+(?:days?|din)\b/i.test(lower)) {
    const start = new Date(ref);
    start.setDate(start.getDate() - 7);
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(ref),
      dateRangeLabel: 'Last 7 Days'
    };
  }

  // 4. "this month" / "current month" / "is mahine"
  if (/\b(?:this|current|is)\s+month\b|\bis\s+mahine\b/i.test(lower)) {
    const start = new Date(Date.UTC(currentYear, currentMonth, 1));
    const end = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(end),
      dateRangeLabel: 'This Month'
    };
  }

  // 5. "last month" / "past month" / "previous month" / "pichhle mahine"
  if (/\b(?:only\s+|just\s+)?(?:the\s+)?(?:last|past|previous|prior)\s+month\b|\bpichhle\s+mahine\b/i.test(lower)) {
    // Determine prior calendar month
    const start = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const end = new Date(Date.UTC(currentYear, currentMonth, 0));
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(end),
      dateRangeLabel: 'Last Month'
    };
  }

  // 6. "this week"
  if (/\b(?:this|is)\s+week\b|\bis\s+hafte\b/i.test(lower)) {
    const day = ref.getDay();
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const start = new Date(ref);
    start.setDate(diff);
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(ref),
      dateRangeLabel: 'This Week'
    };
  }

  // 7. "last week"
  if (/\b(?:last|past|previous)\s+week\b|\bpichhle\s+hafte\b/i.test(lower)) {
    const start = new Date(ref);
    start.setDate(start.getDate() - 7);
    return {
      hasDateConstraint: true,
      startDate: formatDateISO(start),
      endDate: formatDateISO(ref),
      dateRangeLabel: 'Last Week'
    };
  }

  // 8. Named month detection (e.g. "October", "September")
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  for (let m = 0; m < months.length; m++) {
    const regex = new RegExp(`\\b${months[m]}\\b`, 'i');
    if (regex.test(lower)) {
      const start = new Date(Date.UTC(currentYear, m, 1));
      const end = new Date(Date.UTC(currentYear, m + 1, 0));
      return {
        hasDateConstraint: true,
        startDate: formatDateISO(start),
        endDate: formatDateISO(end),
        dateRangeLabel: months[m].charAt(0).toUpperCase() + months[m].slice(1)
      };
    }
  }

  return { hasDateConstraint: false };
}

/**
 * Extract Symbol from text using MARKET_SYMBOLS_MAP
 */
function extractSymbolFromText(text) {
  if (!text) return null;
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const words = clean.split(/\s+/);
  for (const w of words) {
    if (MARKET_SYMBOLS_MAP[w]) {
      return MARKET_SYMBOLS_MAP[w];
    }
  }
  return null;
}

/**
 * Extract Session from text (London, New York, Asian)
 */
function extractSessionFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\blondon\b/i.test(lower)) return 'London';
  if (/\b(new\s*york|ny)\b/i.test(lower)) return 'New York';
  if (/\b(asian|tokyo)\b/i.test(lower)) return 'Asian';
  if (/\bsydney\b/i.test(lower)) return 'Sydney';
  return null;
}

/**
 * Extract Timeframe from text
 */
function extractTimeframeFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(15\s*m(?:in|inutes?)?|15m)\b/i.test(lower)) return '15m';
  if (/\b(4\s*h(?:ours?)?|4h)\b/i.test(lower)) return '4h';
  if (/\b(1\s*d(?:ay)?|1d|daily)\b/i.test(lower)) return '1d';
  if (/\b(1\s*h(?:our)?|1h|60\s*m(?:in)?)\b/i.test(lower)) return '1h';
  return null;
}

/**
 * Detect follow-up pattern type and ambiguous reference intent
 */
function analyzeFollowUpPattern(question, priorContext) {
  const lower = (question || '').toLowerCase().trim();

  // 1. Date constraint follow-up ("Only the last month", "Just the last 30 days", "Sirf pichhle mahine")
  const isDateConstraint = /\b(only|just|for|in|filter\s+by|sirf|bas)\s+(the\s+)?(last\s+month|previous\s+month|past\s+month|last\s+\d+\s+days|this\s+month|this\s+week|last\s+week|october|september|pichhle\s+mahine)\b/i.test(lower)
    || /^(only\s+(the\s+)?|just\s+(the\s+)?)?(last\s+month|previous\s+month|this\s+month|last\s+\d+\s+days|this\s+week|last\s+week|pichhle\s+mahine)[.?!]*$/i.test(lower);

  // 2. Comparative follow-up ("Now compare that with the previous month", "Compare with last month", "Compare to earlier", "Ab pichhle mahine se compare karo")
  const isSetupOrStrategy = /\b(setups?|strategies|strategy|entry\s+type)\b/i.test(lower);
  const isComparativeFollowUp = !isSetupOrStrategy && (
    /\b(now\s+)?compare\s+(that|it|this|them)\s*(with|to|against)?/i.test(lower)
    || /\bcompare\s+(with|to|against)\s+(the\s+)?(previous|prior|last)\s+month\b/i.test(lower)
    || /\b(now\s+)?compare\s+(with\s+)?(the\s+)?(previous\s+month|prior\s+month|pichhle\s+mahine)\b/i.test(lower)
    || /\b(ab\s+)?(use|usko|usse)\s+(pichhle\s+mahine\s+se\s+)?compare\s+karo\b/i.test(lower)
  );

  // 3. Diagnostic / Mistake follow-up ("What was my biggest mistake?", "Which mistake cost the most?", "Sabse bada mistake kya tha?")
  const isMistakeDiagnostic = /\b(what\s+(was|is)\s+my\s+(biggest|worst|top|most\s+costly)\s+mistake|my\s+biggest\s+mistake|which\s+mistake\s+cost\s+me|sabse\s+bada\s+mistake|meri\s+sabse\s+badi\s+galti)\b/i.test(lower);

  // 4. Trade review drill-down ("Was the stop loss technically sound?", "What about my exit?", "Did I follow confirmation?")
  const isTradeReviewDrilldown = /\b(was\s+(the|my)\s+stop\s*loss|sl\s+sound|was\s+my\s+sl|what\s+about\s+(the\s+|my\s+)?(exit|entry|take\s*profit|tp)|did\s+i\s+follow\s+(my\s+)?(confirmation|rules))\b/i.test(lower);

  // 5. Symbol switch ("What about EURUSD?", "Now do Gold", "Check GBPUSD")
  const isSymbolSwitch = /\b(what\s+about|how\s+about|now\s+do|check|switch\s+to|ab)\s+([a-z0-9]+)\b/i.test(lower);

  // 6. Session filter follow-up ("Only London session", "What about New York?")
  const isSessionFilter = /\b(only\s+|just\s+)?(london|new\s*york|asian|tokyo)\s+(session|trades)?\b/i.test(lower) && !isComparativeFollowUp;

  // 7. Timeframe switch ("Use the 15m timeframe", "On 4h chart")
  const isTimeframeSwitch = /\b(use\s+(the\s+)?|on\s+(the\s+)?|check\s+(the\s+)?)(15m|1h|4h|1d|daily)\s+(timeframe|chart)?\b/i.test(lower);

  return {
    isDateConstraint,
    isComparativeFollowUp,
    isMistakeDiagnostic,
    isTradeReviewDrilldown,
    isSymbolSwitch,
    isSessionFilter,
    isTimeframeSwitch,
    isFollowUp: isDateConstraint || isComparativeFollowUp || isMistakeDiagnostic || isTradeReviewDrilldown || isSymbolSwitch || isSessionFilter || isTimeframeSwitch
  };
}

/**
 * Resolve Multi-Turn Conversation Context
 * Combines current question, prior context, and history to resolve references to earlier messages.
 * Supports both named object `{ currentQuestion, historyMessages, priorContextState, rawIntentResult, referenceDate }`
 * and positional parameters `(question, priorContextState, historyMessages, referenceDate, rawIntentResult)`.
 */
function resolveMultiTurnContext(optionsOrQuestion, maybePriorContext, maybeHistory, maybeRefDate, maybeRawIntent) {
  let currentQuestion;
  let historyMessages = [];
  let priorContextState = null;
  let rawIntentResult = null;
  let referenceDate = new Date();

  if (optionsOrQuestion && typeof optionsOrQuestion === 'object' && typeof optionsOrQuestion.cleanQuestion === 'undefined' && (optionsOrQuestion.currentQuestion !== undefined || optionsOrQuestion.question !== undefined)) {
    currentQuestion = optionsOrQuestion.currentQuestion || optionsOrQuestion.question || '';
    historyMessages = optionsOrQuestion.historyMessages || optionsOrQuestion.messages || [];
    priorContextState = optionsOrQuestion.priorContextState || optionsOrQuestion.priorContext || null;
    rawIntentResult = optionsOrQuestion.rawIntentResult || null;
    referenceDate = optionsOrQuestion.referenceDate || new Date();
  } else if (optionsOrQuestion && typeof optionsOrQuestion === 'object' && optionsOrQuestion.intent) {
    // If rawIntentResult was somehow passed first
    rawIntentResult = optionsOrQuestion;
    currentQuestion = maybePriorContext || '';
  } else {
    currentQuestion = optionsOrQuestion || '';
    priorContextState = maybePriorContext || null;
    historyMessages = maybeHistory || [];
    referenceDate = maybeRefDate || new Date();
    rawIntentResult = maybeRawIntent || null;
  }

  const cleanQ = (currentQuestion || '').trim();
  if (!rawIntentResult) {
    const { classifyIntent } = require('./intentClassifier');
    rawIntentResult = classifyIntent(cleanQ);
  }
  const pattern = analyzeFollowUpPattern(cleanQ, priorContextState);

  // Extract explicit entities in current turn
  const explicitSymbol = extractSymbolFromText(cleanQ);
  const explicitSession = extractSessionFromText(cleanQ);
  const explicitTimeframe = extractTimeframeFromText(cleanQ);
  const dateConstraint = extractDateConstraint(cleanQ, referenceDate);

  // Retrieve prior context variables
  const prior = priorContextState || {};
  const priorFilters = prior.activeFilters || {};
  const priorSymbol = prior.activeSymbol || priorFilters.instrument || null;
  const priorRootTask = prior.rootTask || prior.lastIntent || null;

  // Determine active symbol (explicit in this turn -> prior context -> fallback)
  let activeSymbol = explicitSymbol || priorSymbol || null;

  // If still no symbol, scan the last 4 history messages for any mentioned symbol
  if (!activeSymbol && Array.isArray(historyMessages) && historyMessages.length > 0) {
    for (let i = historyMessages.length - 1; i >= Math.max(0, historyMessages.length - 4); i--) {
      const sym = extractSymbolFromText(historyMessages[i].text);
      if (sym) {
        activeSymbol = sym;
        break;
      }
    }
  }

  // Active Timeframe
  const activeTimeframe = explicitTimeframe || prior.activeTimeframe || '1h';

  // Active Session
  const activeSession = explicitSession || priorFilters.session || null;

  // Initialize resolved context state
  const resolved = {
    intent: rawIntentResult.intent,
    rootTask: priorRootTask || rawIntentResult.intent,
    activeSymbol,
    activeTimeframe,
    activeFilters: {
      instrument: activeSymbol,
      session: activeSession,
      setupRating: priorFilters.setupRating || null,
      startDate: priorFilters.startDate || null,
      endDate: priorFilters.endDate || null,
      dateRangeLabel: priorFilters.dateRangeLabel || null
    },
    comparisonConfig: null,
    isFollowUp: pattern.isFollowUp,
    freshQueryNeeded: false,
    needsJournal: rawIntentResult.needsJournal,
    needsMarket: rawIntentResult.needsMarket
  };

  // ---------------------------------------------------------------------------
  // Case A: Follow-up Date Constraint ("Only the last month")
  // ---------------------------------------------------------------------------
  if (pattern.isDateConstraint && (priorRootTask === 'JOURNAL_QUERY' || priorRootTask === 'TRADE_ANALYSIS' || rawIntentResult.needsJournal || !rawIntentResult.fastAnswer)) {
    resolved.intent = 'JOURNAL_QUERY';
    resolved.rootTask = 'JOURNAL_QUERY';
    resolved.needsJournal = true;
    resolved.freshQueryNeeded = true;

    if (dateConstraint.hasDateConstraint) {
      resolved.activeFilters.startDate = dateConstraint.startDate;
      resolved.activeFilters.endDate = dateConstraint.endDate;
      resolved.activeFilters.dateRangeLabel = dateConstraint.dateRangeLabel;
    }
  }

  // ---------------------------------------------------------------------------
  // Case B: Comparative Follow-up ("Now compare that with the previous month")
  // ---------------------------------------------------------------------------
  else if (pattern.isComparativeFollowUp) {
    resolved.intent = 'JOURNAL_COMPARISON';
    resolved.rootTask = 'JOURNAL_COMPARISON';
    resolved.needsJournal = true;
    resolved.freshQueryNeeded = true;

    // Check if comparing sessions (London vs NY) or periods (Last month vs previous month)
    const lower = cleanQ.toLowerCase();
    if (lower.includes('session') || lower.includes('london') || lower.includes('new york')) {
      resolved.comparisonConfig = {
        type: 'SESSIONS',
        filter1: 'London',
        filter2: 'New York',
        instrument: activeSymbol
      };
    } else {
      // Month / Period comparison
      resolved.comparisonConfig = {
        type: 'MONTHS',
        filter1: resolved.activeFilters.dateRangeLabel || 'Last Month',
        filter2: 'Previous Month',
        instrument: activeSymbol
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Case C: Mistake / Psychology Diagnostic ("What was my biggest mistake?")
  // ---------------------------------------------------------------------------
  else if (pattern.isMistakeDiagnostic) {
    resolved.intent = 'TRADING_PSYCHOLOGY';
    resolved.rootTask = 'TRADING_PSYCHOLOGY';
    resolved.needsJournal = true;
    resolved.freshQueryNeeded = true;
  }

  // ---------------------------------------------------------------------------
  // Case D: Trade Review Drilldown ("Was the stop loss technically sound?")
  // ---------------------------------------------------------------------------
  else if (pattern.isTradeReviewDrilldown && (priorRootTask === 'TRADE_REVIEW' || prior.lastIntent === 'TRADE_REVIEW')) {
    resolved.intent = 'TRADE_REVIEW';
    resolved.rootTask = 'TRADE_REVIEW';
    resolved.needsJournal = true;
    resolved.freshQueryNeeded = true;
  }

  // ---------------------------------------------------------------------------
  // Case E: Standalone Greetings, Gratitude & Definitions (Do NOT drag journal stats!)
  // ---------------------------------------------------------------------------
  else if (['GREETING', 'IDENTITY', 'GRATITUDE', 'TRADING_EDUCATION'].includes(rawIntentResult.intent)) {
    // Preserve active filters in background state, but do not force journal queries
    resolved.intent = rawIntentResult.intent;
    resolved.needsJournal = false;
    resolved.freshQueryNeeded = false;
  }

  // ---------------------------------------------------------------------------
  // Case F: Standard Journal Queries
  // ---------------------------------------------------------------------------
  else if (rawIntentResult.needsJournal || rawIntentResult.intent === 'JOURNAL_QUERY') {
    resolved.intent = rawIntentResult.intent;
    resolved.rootTask = 'JOURNAL_QUERY';
    resolved.needsJournal = true;
    resolved.freshQueryNeeded = true;

    if (dateConstraint.hasDateConstraint) {
      resolved.activeFilters.startDate = dateConstraint.startDate;
      resolved.activeFilters.endDate = dateConstraint.endDate;
      resolved.activeFilters.dateRangeLabel = dateConstraint.dateRangeLabel;
    }
  }

  // ---------------------------------------------------------------------------
  // Case G: Market Queries ("Analyse Gold on the 1h timeframe")
  // ---------------------------------------------------------------------------
  else if (rawIntentResult.intent === 'MARKET_QUERY' || pattern.isTimeframeSwitch) {
    resolved.intent = 'MARKET_QUERY';
    resolved.rootTask = 'MARKET_QUERY';
    resolved.needsMarket = true;
  }

  return resolved;
}

/**
 * Generate a rolling summary for conversations exceeding standard message budget
 */
function generateConversationSummary(messages = [], existingSummary = '') {
  if (!Array.isArray(messages) || messages.length < 6) {
    return existingSummary || '';
  }

  const topics = [];
  const constraints = [];

  for (const msg of messages) {
    const text = (msg.text || '').toLowerCase();
    if (text.includes('gold') || text.includes('xauusd')) topics.push('Gold (XAUUSD)');
    if (text.includes('eurusd')) topics.push('EURUSD');
    if (text.includes('gbpusd')) topics.push('GBPUSD');
    if (text.includes('us30')) topics.push('US30');
    if (text.includes('win rate')) topics.push('Win Rate Analysis');
    if (text.includes('mistake')) topics.push('Execution Mistakes');
    if (text.includes('drawdown')) topics.push('Drawdown Audit');
    if (text.includes('compare')) topics.push('Performance Comparison');
    if (text.includes('last month')) constraints.push('Last Month timeframe');
    if (text.includes('previous month')) constraints.push('Previous Month comparison');
    if (text.includes('london')) constraints.push('London Session');
    if (text.includes('new york')) constraints.push('New York Session');
  }

  const uniqueTopics = [...new Set(topics)];
  const uniqueConstraints = [...new Set(constraints)];

  let summary = `[CONVERSATION CONTEXT SUMMARY]: Multi-turn analysis covering ${uniqueTopics.join(', ') || 'personal trade journal'}.`;
  if (uniqueConstraints.length > 0) {
    summary += ` Applied user constraints: ${uniqueConstraints.join(', ')}.`;
  }

  return summary;
}

/**
 * Get or create Conversation with strict user isolation
 * Supports both named object `{ userId, conversationId, title }` and positional `(userId, conversationId, title)`
 */
async function getOrCreateConversation(optionsOrUserId, maybeConvId, maybeTitle) {
  let userId;
  let conversationId;
  let title;

  if (optionsOrUserId && typeof optionsOrUserId === 'object' && optionsOrUserId._id) {
    // In case a mongoose user or user object is passed
    userId = optionsOrUserId._id;
    conversationId = maybeConvId;
    title = maybeTitle || 'New Conversation';
  } else if (optionsOrUserId && typeof optionsOrUserId === 'object') {
    userId = optionsOrUserId.userId;
    conversationId = optionsOrUserId.conversationId;
    title = optionsOrUserId.title || 'New Conversation';
  } else {
    userId = optionsOrUserId;
    conversationId = maybeConvId;
    title = maybeTitle || 'New Conversation';
  }

  if (!userId) {
    throw new Error('userId is strictly required for conversation management.');
  }

  const isDb = isMongooseConnected();

  if (conversationId) {
    // 1. Try Database lookup
    if (isDb) {
      const conv = await Conversation.findOne({ conversationId, userId, isDeleted: false });
      if (!conv) {
        // Check if it was deleted or belonged to another user
        const deletedOrAlien = await Conversation.findOne({ conversationId });
        if (deletedOrAlien) {
          if (String(deletedOrAlien.userId) !== String(userId)) {
            // Strict cross-user protection: conversation exists but belongs to someone else!
            return { forbidden: true, conversation: null };
          }
          if (deletedOrAlien.isDeleted) {
            return { deleted: true, conversation: null };
          }
        }
        return { notFound: true, conversation: null };
      }

      // Check expiration
      if (conv.expiresAt && conv.expiresAt < new Date()) {
        return { expired: true, conversation: null };
      }

      return { conversation: conv, isNew: false };
    }

    // 2. Try In-Memory lookup (for offline mode or isolated unit tests)
    const memKey = getMemoryKey(userId, conversationId);
    const memEntry = inMemoryConversationStore.get(memKey);
    if (memEntry) {
      if (memEntry.isDeleted) return { deleted: true, conversation: null };
      if (memEntry.expiresAt && memEntry.expiresAt < new Date()) return { expired: true, conversation: null };
      return { conversation: memEntry, isNew: false };
    }

    // Check if another user holds this conversation ID in memory
    for (const [key, val] of inMemoryConversationStore.entries()) {
      if (val.conversationId === conversationId && String(val.userId) !== String(userId)) {
        return { forbidden: true, conversation: null };
      }
    }

    return { notFound: true, conversation: null };
  }

  // Create new conversation
  const newId = generateConversationId();
  const newDocData = {
    userId,
    conversationId: newId,
    title,
    messages: [],
    contextState: {
      activeSymbol: null,
      activeTimeframe: '1h',
      activeFilters: {},
      rootTask: null,
      lastIntent: null,
      summary: ''
    },
    summary: '',
    isDeleted: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  };

  if (isDb) {
    const created = await Conversation.create(newDocData);
    return { conversation: created, isNew: true };
  }

  // Memory fallback
  inMemoryConversationStore.set(getMemoryKey(userId, newId), newDocData);
  return { conversation: newDocData, isNew: true };
}

/**
 * Save user and model messages to conversation history with updated context
 */
async function saveConversationTurn({
  userId,
  conversationId,
  userMessage,
  aiResponse,
  resolvedContext,
  intent
}) {
  const isDb = isMongooseConnected();
  const now = new Date();

  const userTurn = {
    role: 'user',
    text: userMessage,
    intent,
    timestamp: now
  };

  const modelTurn = {
    role: 'model',
    text: aiResponse,
    intent,
    timestamp: now
  };

  const updatedContextState = {
    activeSymbol: resolvedContext.activeSymbol || null,
    activeTimeframe: resolvedContext.activeTimeframe || '1h',
    activeFilters: resolvedContext.activeFilters || {},
    rootTask: resolvedContext.rootTask || intent,
    lastIntent: intent,
    lastUpdated: now
  };

  if (isDb) {
    const conv = await Conversation.findOne({ conversationId, userId, isDeleted: false });
    if (conv) {
      conv.messages.push(userTurn, modelTurn);
      conv.contextState = updatedContextState;
      if (conv.messages.length > 8) {
        conv.summary = generateConversationSummary(conv.messages, conv.summary);
      }
      conv.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // refresh 30-day retention
      await conv.save();
      return conv;
    }
  }

  // In-memory fallback
  const memKey = getMemoryKey(userId, conversationId);
  let mem = inMemoryConversationStore.get(memKey);
  if (!mem) {
    mem = {
      userId,
      conversationId,
      title: 'Active Conversation',
      messages: [],
      contextState: updatedContextState,
      summary: '',
      isDeleted: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }
  mem.messages.push(userTurn, modelTurn);
  mem.contextState = updatedContextState;
  if (mem.messages.length > 8) {
    mem.summary = generateConversationSummary(mem.messages, mem.summary);
  }
  inMemoryConversationStore.set(memKey, mem);
  return mem;
}

/**
 * Soft delete conversation with strict user ownership validation
 */
async function deleteConversation(userId, conversationId) {
  const isDb = isMongooseConnected();

  if (isDb) {
    const updated = await Conversation.findOneAndUpdate(
      { conversationId, userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    return !!updated;
  }

  const memKey = getMemoryKey(userId, conversationId);
  const mem = inMemoryConversationStore.get(memKey);
  if (mem && !mem.isDeleted) {
    mem.isDeleted = true;
    inMemoryConversationStore.set(memKey, mem);
    return true;
  }
  return false;
}

/**
 * List active conversations for a user
 */
async function listUserConversations(userId) {
  const isDb = isMongooseConnected();

  if (isDb) {
    return await Conversation.find({
      userId,
      isDeleted: false,
      expiresAt: { $gt: new Date() }
    })
      .sort({ updatedAt: -1 })
      .select('conversationId title summary contextState updatedAt createdAt messages')
      .lean();
  }

  const results = [];
  for (const [key, conv] of inMemoryConversationStore.entries()) {
    if (String(conv.userId) === String(userId) && !conv.isDeleted && (!conv.expiresAt || conv.expiresAt > new Date())) {
      results.push({
        conversationId: conv.conversationId,
        title: conv.title,
        summary: conv.summary,
        contextState: conv.contextState,
        updatedAt: conv.updatedAt || new Date(),
        createdAt: conv.createdAt || new Date(),
        messageCount: conv.messages?.length || 0
      });
    }
  }
  return results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Clear in-memory conversation store (strictly for testing isolation)
 */
function clearInMemoryStore() {
  inMemoryConversationStore.clear();
}

module.exports = {
  extractDateConstraint,
  extractSymbolFromText,
  extractSessionFromText,
  extractTimeframeFromText,
  analyzeFollowUpPattern,
  resolveMultiTurnContext,
  generateConversationSummary,
  getOrCreateConversation,
  saveConversationTurn,
  deleteConversation,
  listUserConversations,
  clearInMemoryStore,
  generateConversationId
};
