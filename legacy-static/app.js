const STORAGE_KEY = 'trading-command-center-trades';

const defaultFormValues = {
  tradeName: '',
  date: '',
  time: '',
  instrument: 'EURUSD',
  levelTraded: 'Support',
  result: 'WIN',
  rr: 1.5,
  session: 'London',
  bias: 'Bullish',
  emotion: 'Calm',
  reasonEarlyExit: 'None',
  setupRating: 'A+',
  pips: 0,
  notes: '',
  confirmation: 'Yes',
  marketCondition: 'Trending',
  tradeQuality: 'Average',
  entryType: 'Confirmation',
  mistakes: []
};

const emotionalRisk = new Set(['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Frustrated', 'Anxious', 'Overconfident']);
const setupOrder = ['A+', 'A', 'B+', 'B', 'C', 'D', 'No Setup'];

function readTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

function normalizeTrade(rawTrade) {
  const trade = { ...rawTrade };
  const result = trade.result || 'BE';
  const rr = Number(trade.rr || 0);
  const setupRating = trade.setupRating || 'No Setup';
  const emotion = trade.emotion || 'Calm';
  const confirmation = trade.confirmation || 'No';
  const mistakes = Array.isArray(trade.mistakes) ? trade.mistakes : [];

  const rResult = result === 'WIN' ? rr : result === 'LOSS' ? -1 : 0;
  const winFlag = result === 'WIN' ? 1 : 0;
  const lossFlag = result === 'LOSS' ? 1 : 0;
  const earlyExitFlag = trade.reasonEarlyExit && trade.reasonEarlyExit !== 'None' ? 1 : 0;
  const aPlusFlag = setupRating === 'A+' ? 1 : 0;
  const emotionalTradeFlag = emotionalRisk.has(emotion) ? 1 : 0;

  const setupScore = ['A+', 'A', 'B+', 'B'].includes(setupRating) ? 25 : 0;
  const confirmationScore = confirmation === 'Yes' ? 25 : confirmation === 'Partial' ? 12.5 : 0;
  const emotionalScore = emotionalTradeFlag === 0 ? 25 : 0;
  const mistakeScore = mistakes.length === 0 || mistakes.includes('None') ? 25 : 0;
  const disciplineScore = Math.min(100, setupScore + confirmationScore + emotionalScore + mistakeScore);

  let tradeGrade = 'Needs Improvement';
  if (disciplineScore >= 90) tradeGrade = 'Elite';
  else if (disciplineScore >= 75) tradeGrade = 'Good';
  else if (disciplineScore >= 60) tradeGrade = 'Average';

  trade.rResult = rResult;
  trade.winFlag = winFlag;
  trade.lossFlag = lossFlag;
  trade.earlyExitFlag = earlyExitFlag;
  trade.aPlusFlag = aPlusFlag;
  trade.emotionalTradeFlag = emotionalTradeFlag;
  trade.disciplineScore = disciplineScore;
  trade.tradeGrade = tradeGrade;
  trade.pips = Number(trade.pips || 0);

  return trade;
}

function deriveStats(trades) {
  const normalized = trades.map(normalizeTrade);

  const totalTrades = normalized.length;
  const winningTrades = normalized.filter(t => t.result === 'WIN').length;
  const losingTrades = normalized.filter(t => t.result === 'LOSS').length;
  const breakEvenTrades = normalized.filter(t => t.result === 'BE').length;
  const totalR = normalized.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
  const avgR = totalTrades ? totalR / totalTrades : 0;
  const totalPips = normalized.reduce((sum, t) => sum + Number(t.pips || 0), 0);
  const avgPips = totalTrades ? totalPips / totalTrades : 0;

  const winTrades = normalized.filter(t => t.result === 'WIN');
  const lossTrades = normalized.filter(t => t.result === 'LOSS');
  const avgWin = winTrades.length ? winTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length ? lossTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / lossTrades.length : 0;
  const profitFactor = Math.abs(lossTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0)) > 0
    ? winTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / Math.abs(lossTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0))
    : 0;

  const winRate = totalTrades ? (winningTrades / totalTrades) * 100 : 0;
  const lossRate = totalTrades ? (losingTrades / totalTrades) * 100 : 0;

  const bestTrade = normalized.length ? Math.max(...normalized.map(t => Number(t.rResult || 0))) : 0;
  const worstTrade = normalized.length ? Math.min(...normalized.map(t => Number(t.rResult || 0))) : 0;

  const aPlusTrades = normalized.filter(t => t.setupRating === 'A+');
  const aPlusWinRate = aPlusTrades.length ? (aPlusTrades.filter(t => t.result === 'WIN').length / aPlusTrades.length) * 100 : 0;

  const earlyExitCount = normalized.filter(t => Number(t.earlyExitFlag) === 1).length;
  const emotionalTradeCount = normalized.filter(t => Number(t.emotionalTradeFlag) === 1).length;

  const currentStreak = computeStreak(normalized, 'WIN');
  const currentLossStreak = computeStreak(normalized, 'LOSS');
  const maxWinStreak = computeMaxStreak(normalized, 'WIN');
  const maxLossStreak = computeMaxStreak(normalized, 'LOSS');

  const disciplineScoreAverage = totalTrades ? normalized.reduce((sum, t) => sum + Number(t.disciplineScore || 0), 0) / totalTrades : 0;

  return {
    normalized,
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate,
    lossRate,
    totalR,
    avgR,
    avgWin,
    avgLoss,
    profitFactor,
    totalPips,
    avgPips,
    bestTrade,
    worstTrade,
    currentWinStreak: currentStreak,
    currentLossStreak: currentLossStreak,
    maxWinStreak,
    maxLossStreak,
    aPlusWinRate,
    earlyExitCount,
    emotionalTradeCount,
    disciplineScoreAverage,
    averageWinningR: winTrades.length ? winTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / winTrades.length : 0,
    averageLosingR: lossTrades.length ? lossTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / lossTrades.length : 0,
    bestSetup: getBestSetup(normalized),
    bestSession: getBestSession(normalized)
  };
}

function computeStreak(trades, type) {
  const ordered = [...trades].sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
  let count = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].result === type) count += 1;
    else break;
  }
  return count;
}

function computeMaxStreak(trades, type) {
  const ordered = [...trades].sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
  let best = 0;
  let current = 0;
  for (const trade of ordered) {
    if (trade.result === type) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function getBestSetup(trades) {
  if (!trades.length) return 'No data';
  const groups = {};
  for (const trade of trades) {
    const key = trade.setupRating || 'No Setup';
    if (!groups[key]) groups[key] = { totalR: 0, count: 0 };
    groups[key].totalR += Number(trade.rResult || 0);
    groups[key].count += 1;
  }
  const best = Object.entries(groups).sort((a, b) => b[1].totalR - a[1].totalR)[0];
  return best ? `${best[0]} (${best[1].totalR.toFixed(1)}R)` : 'No data';
}

function getBestSession(trades) {
  if (!trades.length) return 'No data';
  const groups = {};
  for (const trade of trades) {
    const key = trade.session || 'Other';
    if (!groups[key]) groups[key] = { totalR: 0, count: 0 };
    groups[key].totalR += Number(trade.rResult || 0);
    groups[key].count += 1;
  }
  const best = Object.entries(groups).sort((a, b) => b[1].totalR - a[1].totalR)[0];
  return best ? `${best[0]} (${best[1].totalR.toFixed(1)}R)` : 'No data';
}

function formatNumber(value, digits = 2) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(digits);
  }
  return '0.00';
}

function formatR(value) {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}R`;
}

function getTableRowsForView(trades, viewName) {
  const sorted = [...trades].sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`) - new Date(`${a.date}T${a.time || '00:00'}`));

  switch (viewName) {
    case 'Today':
      return sorted.filter(t => t.date === new Date().toISOString().slice(0, 10));
    case 'This Week':
      return sorted.filter(t => isWithinDays(t.date, 7));
    case 'This Month':
      return sorted.filter(t => isWithinDays(t.date, 30));
    case 'Winning Trades':
      return sorted.filter(t => t.result === 'WIN');
    case 'Losing Trades':
      return sorted.filter(t => t.result === 'LOSS');
    case 'A+ Trades':
      return sorted.filter(t => t.setupRating === 'A+');
    case 'Early Exits':
      return sorted.filter(t => t.reasonEarlyExit && t.reasonEarlyExit !== 'None');
    case 'Emotional Trades':
      return sorted.filter(t => emotionalRisk.has(t.emotion));
    case 'Mistake Trades':
      return sorted.filter(t => Array.isArray(t.mistakes) && t.mistakes.length && !t.mistakes.includes('None'));
    case 'London Session':
      return sorted.filter(t => t.session === 'London');
    case 'New York Session':
      return sorted.filter(t => t.session === 'New York');
    case 'Asian Session':
      return sorted.filter(t => t.session === 'Asian');
    default:
      return sorted;
  }
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  const diffDays = (now - target) / (1000 * 60 * 60 * 24);
  return diffDays <= days && diffDays >= 0;
}

function renderRecentTrades(trades) {
  const table = getTableRowsForView(trades, 'All Trades').slice(0, 8);
  if (!table.length) {
    document.getElementById('recent-trades').innerHTML = '<div class="empty-state">No trades recorded yet. Add your first trade to power the dashboard.</div>';
    return;
  }

  const rows = table.map(trade => `
    <tr>
      <td>${trade.tradeName || 'Untitled'}</td>
      <td>${trade.date}</td>
      <td>${trade.instrument}</td>
      <td>${trade.session}</td>
      <td>${trade.setupRating}</td>
      <td>${trade.result}</td>
      <td>${formatR(trade.rResult)}</td>
      <td>${trade.pips}</td>
    </tr>
  `).join('');

  document.getElementById('recent-trades').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Trade</th>
          <th>Date</th>
          <th>Instrument</th>
          <th>Session</th>
          <th>Setup</th>
          <th>Result</th>
          <th>R</th>
          <th>Pips</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderKpis(trades) {
  const stats = deriveStats(trades);
  const cards = [
    { label: 'Total Trades', value: stats.totalTrades, tone: 'neutral', icon: '📊' },
    { label: 'Winning Trades', value: stats.winningTrades, tone: 'positive', icon: '✅' },
    { label: 'Losing Trades', value: stats.losingTrades, tone: 'negative', icon: '❌' },
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, tone: 'positive', icon: '📈' },
    { label: 'Total R', value: formatR(stats.totalR), tone: stats.totalR >= 0 ? 'positive' : 'negative', icon: '💰' },
    { label: 'Average R', value: formatR(stats.avgR), tone: stats.avgR >= 0 ? 'positive' : 'negative', icon: '⚖️' },
    { label: 'Average Win', value: formatR(stats.avgWin), tone: 'positive', icon: '📈' },
    { label: 'Average Loss', value: formatR(stats.avgLoss), tone: 'negative', icon: '📉' },
    { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), tone: stats.profitFactor >= 1 ? 'positive' : 'negative', icon: '🔢' },
    { label: 'Best Trade', value: formatR(stats.bestTrade), tone: 'positive', icon: '🏆' },
    { label: 'Worst Trade', value: formatR(stats.worstTrade), tone: 'negative', icon: '🧨' },
    { label: 'Current Win Streak', value: stats.currentWinStreak, tone: 'positive', icon: '🔥' },
    { label: 'Current Loss Streak', value: stats.currentLossStreak, tone: 'negative', icon: '📉' },
    { label: 'Best Winning Streak', value: stats.maxWinStreak, tone: 'positive', icon: '🚀' },
    { label: 'Max Losing Streak', value: stats.maxLossStreak, tone: 'negative', icon: '💥' },
    { label: 'Total Pips', value: stats.totalPips.toFixed(0), tone: 'neutral', icon: '🎯' },
    { label: 'Average Pips', value: stats.avgPips.toFixed(0), tone: 'neutral', icon: '📏' },
    { label: 'A+ Setup Win Rate', value: `${stats.aPlusWinRate.toFixed(1)}%`, tone: 'positive', icon: '⭐' },
    { label: 'Early Exit Count', value: stats.earlyExitCount, tone: 'warning', icon: '⏱️' },
    { label: 'Emotional Trade Count', value: stats.emotionalTradeCount, tone: 'warning', icon: '🧠' }
  ];

  document.getElementById('kpi-grid').innerHTML = cards.map(card => `
    <div class="kpi-card ${card.tone}">
      <div class="top">
        <span>${card.label}</span>
        <span class="icon">${card.icon}</span>
      </div>
      <strong>${card.value}</strong>
    </div>
  `).join('');

  document.getElementById('mini-discipline').textContent = `${stats.disciplineScoreAverage.toFixed(0)}`;
  document.getElementById('mini-best-setup').textContent = stats.bestSetup;
  document.getElementById('mini-best-session').textContent = stats.bestSession;
}

function renderSummarySection() {
  const trades = readTrades().map(normalizeTrade);
  const stats = deriveStats(trades);

  const performance = [
    ['Total trades', stats.totalTrades],
    ['Win rate', `${stats.winRate.toFixed(1)}%`],
    ['Loss rate', `${stats.lossRate.toFixed(1)}%`],
    ['Total R', formatR(stats.totalR)],
    ['Average R', formatR(stats.avgR)],
    ['Average win', formatR(stats.avgWin)],
    ['Average loss', formatR(stats.avgLoss)],
    ['Profit factor', stats.profitFactor.toFixed(2)],
    ['Total pips', stats.totalPips.toFixed(0)],
    ['Average pips', stats.avgPips.toFixed(0)]
  ];

  const risk = [
    ['Best trade', formatR(stats.bestTrade)],
    ['Worst trade', formatR(stats.worstTrade)],
    ['Current win streak', stats.currentWinStreak],
    ['Current loss streak', stats.currentLossStreak],
    ['Best win streak', stats.maxWinStreak],
    ['Max loss streak', stats.maxLossStreak],
    ['A+ setup win rate', `${stats.aPlusWinRate.toFixed(1)}%`],
    ['Early exits', stats.earlyExitCount],
    ['Emotional trades', stats.emotionalTradeCount]
  ];

  const discipline = [
    ['Average discipline', `${stats.disciplineScoreAverage.toFixed(0)}/100`],
    ['Best setup', stats.bestSetup],
    ['Best session', stats.bestSession],
    ['No setup trades', trades.filter(t => t.setupRating === 'No Setup').length],
    ['Confirmation discipline', trades.filter(t => t.confirmation === 'Yes').length],
    ['Low emotion trades', trades.filter(t => t.emotionalTradeFlag === 0).length]
  ];

  const psychology = [
    ['Calm', trades.filter(t => t.emotion === 'Calm').length],
    ['Confident', trades.filter(t => t.emotion === 'Confident').length],
    ['Focused', trades.filter(t => t.emotion === 'Focused').length],
    ['Fear', trades.filter(t => t.emotion === 'Fear').length],
    ['FOMO', trades.filter(t => t.emotion === 'FOMO').length],
    ['Revenge', trades.filter(t => t.emotion === 'Revenge').length],
    ['Impatient', trades.filter(t => t.emotion === 'Impatient').length],
    ['Overconfident', trades.filter(t => t.emotion === 'Overconfident').length]
  ];

  document.getElementById('performance-summary').innerHTML = buildMetricList(performance);
  document.getElementById('risk-summary').innerHTML = buildMetricList(risk);
  document.getElementById('discipline-summary').innerHTML = buildMetricList(discipline);
  document.getElementById('psychology-summary').innerHTML = buildMetricList(psychology);
}

function buildMetricList(items) {
  return items.map(([label, value]) => `
    <li><span>${label}</span><strong>${value}</strong></li>
  `).join('');
}

function renderSetupAnalysis(trades) {
  const groups = ['A+', 'A', 'B+', 'B', 'C', 'D'];
  const rows = groups.map(key => {
    const items = trades.filter(t => t.setupRating === key);
    const wins = items.filter(t => t.result === 'WIN').length;
    const winRate = items.length ? (wins / items.length) * 100 : 0;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    const avgR = items.length ? totalR / items.length : 0;
    const avgPips = items.length ? items.reduce((sum, t) => sum + Number(t.pips || 0), 0) / items.length : 0;
    return `<tr><td>${key}</td><td>${items.length}</td><td>${winRate.toFixed(1)}%</td><td>${avgR.toFixed(2)}</td><td>${totalR.toFixed(2)}</td><td>${avgPips.toFixed(0)}</td></tr>`;
  }).join('');

  document.getElementById('setup-analysis').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Setup</th><th>#</th><th>Win%</th><th>Avg R</th><th>Total R</th><th>Avg Pips</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSessionAnalysis(trades) {
  const sessions = ['Asian', 'London', 'New York', 'London + New York'];
  const rows = sessions.map(key => {
    const items = trades.filter(t => t.session === key);
    const wins = items.filter(t => t.result === 'WIN').length;
    const winRate = items.length ? (wins / items.length) * 100 : 0;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    const avgR = items.length ? totalR / items.length : 0;
    return `<tr><td>${key}</td><td>${items.length}</td><td>${winRate.toFixed(1)}%</td><td>${totalR.toFixed(2)}</td><td>${avgR.toFixed(2)}</td></tr>`;
  }).join('');

  document.getElementById('session-analysis').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Session</th><th>#</th><th>Win%</th><th>Total R</th><th>Avg R</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderBiasAnalysis(trades) {
  const biases = ['Bullish', 'Bearish', 'Neutral'];
  const rows = biases.map(key => {
    const items = trades.filter(t => t.bias === key);
    const wins = items.filter(t => t.result === 'WIN').length;
    const winRate = items.length ? (wins / items.length) * 100 : 0;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    return `<tr><td>${key}</td><td>${items.length}</td><td>${winRate.toFixed(1)}%</td><td>${totalR.toFixed(2)}</td></tr>`;
  }).join('');

  document.getElementById('bias-analysis').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Bias</th><th>#</th><th>Win%</th><th>Total R</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderEmotionAnalysis(trades) {
  const emotions = ['Calm', 'Confident', 'Focused', 'Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Overconfident', 'Frustrated', 'Anxious', 'Hesitant'];
  const rows = emotions.map(key => {
    const items = trades.filter(t => t.emotion === key);
    const wins = items.filter(t => t.result === 'WIN').length;
    const winRate = items.length ? (wins / items.length) * 100 : 0;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    const avgR = items.length ? totalR / items.length : 0;
    return `<tr><td>${key}</td><td>${items.length}</td><td>${winRate.toFixed(1)}%</td><td>${avgR.toFixed(2)}</td><td>${totalR.toFixed(2)}</td></tr>`;
  }).join('');

  document.getElementById('emotion-analysis').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Emotion</th><th>#</th><th>Win%</th><th>Avg R</th><th>Total R</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderMistakeAnalysis(trades) {
  const mistakeMap = {};
  for (const trade of trades) {
    const mistakes = Array.isArray(trade.mistakes) ? trade.mistakes.filter(m => m && m !== 'None') : [];
    for (const mistake of mistakes) {
      if (!mistakeMap[mistake]) mistakeMap[mistake] = { count: 0, winCount: 0, totalR: 0 };
      mistakeMap[mistake].count += 1;
      if (trade.result === 'WIN') mistakeMap[mistake].winCount += 1;
      mistakeMap[mistake].totalR += Number(trade.rResult || 0);
    }
  }

  const rows = Object.entries(mistakeMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([mistake, data]) => {
      const winRate = data.count ? (data.winCount / data.count) * 100 : 0;
      const avgR = data.count ? data.totalR / data.count : 0;
      return `<tr><td>${mistake}</td><td>${data.count}</td><td>${winRate.toFixed(1)}%</td><td>${data.totalR.toFixed(2)}</td><td>${avgR.toFixed(2)}</td></tr>`;
    }).join('');

  document.getElementById('mistake-analysis').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Mistake</th><th>Freq</th><th>Win%</th><th>Total R</th><th>Avg R</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No mistakes logged yet.</td></tr>'}</tbody>
    </table>
  `;
}

function renderEarlyExitAnalyzer(trades) {
  const early = trades.filter(t => Number(t.earlyExitFlag) === 1);
  const totalTrades = trades.length;

  if (!totalTrades) {
    document.getElementById('early-exit-analysis').innerHTML = '<div class="empty-state">Not enough data yet.</div>';
    return;
  }

  const earlyExitCount = early.length;
  const pct = totalTrades ? (earlyExitCount / totalTrades) * 100 : 0;
  const totalR = early.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
  const avgR = early.length ? totalR / early.length : 0;

  const reasonMap = {};
  const emotionMap = {};
  const setupMap = {};

  for (const trade of early) {
    const reason = trade.reasonEarlyExit || 'None';
    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    const emotion = trade.emotion || 'Calm';
    emotionMap[emotion] = (emotionMap[emotion] || 0) + 1;
    const setup = trade.setupRating || 'No Setup';
    setupMap[setup] = (setupMap[setup] || 0) + 1;
  }

  const mostCommonReason = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])[0];
  const mostCommonEmotion = Object.entries(emotionMap).sort((a, b) => b[1] - a[1])[0];
  const mostCommonSetup = Object.entries(setupMap).sort((a, b) => b[1] - a[1])[0];

  const patternText = [];
  if (mostCommonEmotion) patternText.push(`Most early exits happen when emotion = ${mostCommonEmotion[0]}.`);
  if (mostCommonSetup) patternText.push(`Most early exits occur on ${mostCommonSetup[0]} setups.`);
  const losingEarly = early.filter(t => t.result === 'LOSS').length;
  if (losingEarly > 0) patternText.push('Most early exits happen on losing trades.');

  const facts = [
    `Number of early exits: ${earlyExitCount}`,
    `Percentage of all trades: ${pct.toFixed(1)}%`,
    `Total R from early exits: ${formatR(totalR)}`,
    `Average R from early exits: ${formatR(avgR)}`,
    `Most common early exit reason: ${mostCommonReason ? mostCommonReason[0] : 'Not enough data yet.'}`,
    `Emotion associated with early exits: ${mostCommonEmotion ? mostCommonEmotion[0] : 'Not enough data yet.'}`,
    `Setup ratings associated with early exits: ${mostCommonSetup ? mostCommonSetup[0] : 'Not enough data yet.'}`
  ];

  document.getElementById('early-exit-analysis').innerHTML = `
    <div class="ai-block">
      <h4>FACT</h4>
      <ul>${facts.map(item => `<li>${item}</li>`).join('')}</ul>
    </div>
    <div class="ai-block">
      <h4>PATTERN</h4>
      <ul>${patternText.length ? patternText.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
  `;
}

function renderAiCoach(trades) {
  if (!trades.length) {
    document.getElementById('ai-coach-output').innerHTML = '<div class="empty-state">No trades yet. Add trades to unlock the AI review.</div>';
    return;
  }

  const normalized = trades.map(normalizeTrade);
  const stats = deriveStats(normalized);

  const strengths = [];
  const aPlus = normalized.filter(t => t.setupRating === 'A+');
  if (aPlus.length) {
    const winRate = (aPlus.filter(t => t.result === 'WIN').length / aPlus.length) * 100;
    strengths.push(`A+ setups show a ${winRate.toFixed(1)}% win rate.`);
  }

  const londonTrades = normalized.filter(t => t.session === 'London');
  if (londonTrades.length) {
    const totalR = londonTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    strengths.push(`London session total R is ${formatR(totalR)} across ${londonTrades.length} trades.`);
  }

  const goodDiscipline = normalized.filter(t => t.disciplineScore >= 75).length;
  if (goodDiscipline) strengths.push(`There are ${goodDiscipline} trades with discipline scores at or above 75.`);

  const mistakes = {};
  for (const trade of normalized) {
    const selection = Array.isArray(trade.mistakes) ? trade.mistakes.filter(m => m && m !== 'None') : [];
    for (const item of selection) {
      mistakes[item] = (mistakes[item] || 0) + 1;
    }
  }
  const repeatedMistakes = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const emotionEffects = [];
  const emotions = ['Calm', 'Fear', 'FOMO', 'Revenge', 'Impatient', 'Overconfident'];
  for (const emotion of emotions) {
    const items = normalized.filter(t => t.emotion === emotion);
    if (!items.length) continue;
    const avgR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0) / items.length;
    emotionEffects.push(`${emotion} trades average ${formatR(avgR)}.`);
  }

  const sessionStats = ['Asian', 'London', 'New York', 'London + New York'].map(session => {
    const items = normalized.filter(t => t.session === session);
    if (!items.length) return null;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    const winRate = (items.filter(t => t.result === 'WIN').length / items.length) * 100;
    return `${session}: ${winRate.toFixed(1)}% win rate, ${formatR(totalR)}`;
  }).filter(Boolean);

  const setupStats = ['A+', 'A', 'B+', 'B', 'C', 'D'].map(setup => {
    const items = normalized.filter(t => t.setupRating === setup);
    if (!items.length) return null;
    const totalR = items.reduce((sum, t) => sum + Number(t.rResult || 0), 0);
    const winRate = (items.filter(t => t.result === 'WIN').length / items.length) * 100;
    return `${setup}: ${winRate.toFixed(1)}% win rate, ${formatR(totalR)}`;
  }).filter(Boolean);

  const behavioralPatterns = [];
  const tradesAfterLoss = normalized.filter((trade, index) => index > 0 && normalized[index - 1]?.result === 'LOSS');
  if (tradesAfterLoss.length) behavioralPatterns.push(`Loss followed by ${tradesAfterLoss.length} additional transactions in the immediate sequence.`);
  const fomoTrades = normalized.filter(t => t.emotion === 'FOMO');
  if (fomoTrades.length) behavioralPatterns.push(`FOMO trades occurred ${fomoTrades.length} times.`);

  const actionSuggestions = [];
  if (normalized.filter(t => Number(t.earlyExitFlag) === 1).length) actionSuggestions.push('Reduce early exits by waiting for the trade plan to confirm before leaving the position.');
  if (repeatedMistakes.some(([name]) => ['FOMO', 'Revenge Trading', 'Moved SL', 'Overtrading'].includes(name))) actionSuggestions.push('Tighten your process around emotional entries and stop-loss management.');
  if (normalized.filter(t => t.confirmation === 'No').length) actionSuggestions.push('Increase confirmation discipline before entering new trades.');
  if (actionSuggestions.length === 0) actionSuggestions.push('Continue following your current process and maintain consistent journaling quality.');

  const output = `
    <div class="ai-block">
      <h4>PERFORMANCE SUMMARY</h4>
      <ul>
        <li>FACT: ${stats.totalTrades} trades recorded, ${stats.winRate.toFixed(1)}% win rate, ${formatR(stats.totalR)} total R.</li>
        <li>PATTERN: ${stats.avgR >= 0 ? 'Average R is positive.' : 'Average R is negative.'}</li>
      </ul>
    </div>
    <div class="ai-block">
      <h4>WHAT I AM DOING WELL</h4>
      <ul>${strengths.length ? strengths.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>REPEATED MISTAKES</h4>
      <ul>${repeatedMistakes.length ? repeatedMistakes.map(([name, count]) => `<li>${name}: ${count} occurrences.</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>EMOTIONAL ANALYSIS</h4>
      <ul>${emotionEffects.length ? emotionEffects.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>SESSION ANALYSIS</h4>
      <ul>${sessionStats.length ? sessionStats.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>SETUP ANALYSIS</h4>
      <ul>${setupStats.length ? setupStats.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>BEHAVIORAL PATTERNS</h4>
      <ul>${behavioralPatterns.length ? behavioralPatterns.map(item => `<li>${item}</li>`).join('') : '<li>Not enough data yet.</li>'}</ul>
    </div>
    <div class="ai-block">
      <h4>IMPROVEMENT SUGGESTIONS</h4>
      <ul>${actionSuggestions.map(item => `<li>${item}</li>`).join('')}</ul>
    </div>
    <div class="ai-block">
      <h4>NEXT TRADING SESSION PLAN</h4>
      <ul>
        <li><strong>Before Trading:</strong> Mental checklist: review bias, risk, and the planned setup. Setup checklist: verify level, context, and confirmation. Risk checklist: confirm position size and max daily loss.</li>
        <li><strong>During Trading:</strong> Confirmation checklist: wait for the valid trigger. Emotion checklist: monitor for fear, revenge, or FOMO. Exit checklist: follow the plan and document any early exit reason.</li>
        <li><strong>After Trading:</strong> Review checklist: log notes, review the decision process, and rate the quality of execution.</li>
      </ul>
    </div>
  `;

  document.getElementById('ai-coach-output').innerHTML = output;
}

function renderDailyReview(trades) {
  if (!trades.length) {
    document.getElementById('daily-review').innerHTML = '<div class="empty-state">No daily review until trades are logged.</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysTrades = trades.filter(t => t.date === today);

  if (!todaysTrades.length) {
    document.getElementById('daily-review').innerHTML = '<div class="empty-state">No trades recorded today.</div>';
    return;
  }

  const stats = deriveStats(todaysTrades);
  const bestTrade = todaysTrades.slice().sort((a, b) => Number(b.rResult) - Number(a.rResult))[0];
  const worstTrade = todaysTrades.slice().sort((a, b) => Number(a.rResult) - Number(b.rResult))[0];
  const biggestMistake = Object.entries(groupMistakes(todaysTrades)).sort((a, b) => b[1] - a[1])[0];
  const mostCommonEmotion = getMostCommonValue(todaysTrades.map(t => t.emotion));
  const bestSession = getBestGroupKey(todaysTrades, 'session');
  const bestSetup = getBestGroupKey(todaysTrades, 'setupRating');
  const discipline = Math.round(stats.disciplineScoreAverage);

  const result = `
    <div class="ai-block">
      <h4>Daily Performance</h4>
      <ul>
        <li>FACT: ${todaysTrades.length} trades, ${stats.winRate.toFixed(1)}% win rate, ${formatR(stats.totalR)} total R.</li>
        <li>Best trade: ${bestTrade?.tradeName || 'None'} (${formatR(bestTrade?.rResult || 0)}).</li>
        <li>Worst trade: ${worstTrade?.tradeName || 'None'} (${formatR(worstTrade?.rResult || 0)}).</li>
        <li>Best decision: ${bestTrade ? 'Followed the plan on the highest-quality execution.' : 'Not enough data yet.'}</li>
        <li>Biggest mistake: ${biggestMistake ? biggestMistake[0] : 'Not enough data yet.'}</li>
        <li>Emotional pattern: ${mostCommonEmotion || 'Not enough data yet.'}</li>
        <li>Setup performance: ${bestSetup || 'Not enough data yet.'}</li>
        <li>Session performance: ${bestSession || 'Not enough data yet.'}</li>
        <li>Discipline score: ${discipline}/100</li>
        <li>Repeat: Continue disciplined execution and wait for confirmation.</li>
        <li>Stop: Avoid emotional exits and revenge behavior.</li>
        <li>Improve tomorrow: Manage fear and confirm the trade setup before entry.</li>
      </ul>
    </div>
  `;

  document.getElementById('daily-review').innerHTML = result;
}

function renderWeeklyReview(trades) {
  const currentWeekTrades = trades.filter(t => isWithinDays(t.date, 7));
  const stats = deriveStats(currentWeekTrades);

  const content = `
    <div class="ai-block">
      <h4>Weekly Snapshot</h4>
      <ul>
        <li>FACT: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate, ${formatR(stats.totalR)} total R.</li>
        <li>Best setup: ${stats.bestSetup}</li>
        <li>Worst setup: ${getWorstGroupKey(currentWeekTrades, 'setupRating')}</li>
        <li>Best session: ${stats.bestSession}</li>
        <li>Worst session: ${getWorstGroupKey(currentWeekTrades, 'session')}</li>
        <li>Most common emotion: ${getMostCommonValue(currentWeekTrades.map(t => t.emotion)) || 'Not enough data yet.'}</li>
        <li>Most common mistake: ${getMostCommonValue(flattenMistakes(currentWeekTrades)) || 'Not enough data yet.'}</li>
        <li>Early exit percentage: ${(currentWeekTrades.length ? (currentWeekTrades.filter(t => Number(t.earlyExitFlag) === 1).length / currentWeekTrades.length) * 100 : 0).toFixed(1)}%</li>
        <li>A+ setup performance: ${currentWeekTrades.filter(t => t.setupRating === 'A+').length ? `${((currentWeekTrades.filter(t => t.setupRating === 'A+' && t.result === 'WIN').length / currentWeekTrades.filter(t => t.setupRating === 'A+').length) * 100).toFixed(1)}% win rate` : 'Not enough data yet.'}</li>
        <li>Discipline score: ${stats.disciplineScoreAverage.toFixed(0)}/100</li>
      </ul>
    </div>
    <div class="ai-block">
      <h4>TOP 3 STRENGTHS</h4>
      <ul>${stats.bestSetup !== 'No data' ? `<li>${stats.bestSetup}</li>` : '<li>Not enough data yet.</li>'}<li>Consistent record keeping</li><li>Process adherence improves with time</li></ul>
    </div>
    <div class="ai-block">
      <h4>TOP 3 MISTAKES</h4>
      <ul>${getMostCommonValue(flattenMistakes(currentWeekTrades)) ? `<li>${getMostCommonValue(flattenMistakes(currentWeekTrades))}</li>` : '<li>Not enough data yet.</li>'}<li>Early exits</li><li>Emotional entries</li></ul>
    </div>
    <div class="ai-block">
      <h4>NEXT WEEK'S FOCUS</h4>
      <ul><li>Reduce early exits.</li><li>Wait for confirmation.</li><li>Keep discipline score above 75.</li></ul>
    </div>
  `;

  document.getElementById('weekly-review').innerHTML = content;
}

function renderMonthlyReview(trades) {
  const currentMonthTrades = trades.filter(t => isWithinDays(t.date, 30));
  const stats = deriveStats(currentMonthTrades);

  const content = `
    <div class="ai-block">
      <h4>Monthly Snapshot</h4>
      <ul>
        <li>Fact: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate, ${formatR(stats.totalR)} total R.</li>
        <li>Average R: ${formatR(stats.avgR)}</li>
        <li>Profit factor: ${stats.profitFactor.toFixed(2)}</li>
        <li>Total pips: ${stats.totalPips.toFixed(0)}</li>
        <li>Best setup: ${stats.bestSetup}</li>
        <li>Best session: ${stats.bestSession}</li>
        <li>Best instrument: ${getMostCommonValue(currentMonthTrades.map(t => t.instrument)) || 'Not enough data yet.'}</li>
        <li>Worst setup: ${getWorstGroupKey(currentMonthTrades, 'setupRating')}</li>
        <li>Worst session: ${getWorstGroupKey(currentMonthTrades, 'session')}</li>
        <li>Most common emotion: ${getMostCommonValue(currentMonthTrades.map(t => t.emotion)) || 'Not enough data yet.'}</li>
        <li>Most common mistake: ${getMostCommonValue(flattenMistakes(currentMonthTrades)) || 'Not enough data yet.'}</li>
        <li>Early exits: ${currentMonthTrades.filter(t => Number(t.earlyExitFlag) === 1).length}</li>
        <li>A+ setup performance: ${currentMonthTrades.filter(t => t.setupRating === 'A+').length ? `${((currentMonthTrades.filter(t => t.setupRating === 'A+' && t.result === 'WIN').length / currentMonthTrades.filter(t => t.setupRating === 'A+').length) * 100).toFixed(1)}% win rate` : 'Not enough data yet.'}</li>
        <li>Maximum losing streak: ${stats.maxLossStreak}</li>
        <li>Maximum winning streak: ${stats.maxWinStreak}</li>
      </ul>
    </div>
    <div class="ai-block">
      <h4>Month vs Previous Month</h4>
      <ul>
        <li>Improved: ${stats.totalR >= 0 ? 'Performance is trending positive.' : 'Not enough data yet.'}</li>
        <li>Declined: ${stats.totalR < 0 ? 'Performance is below target this month.' : 'Not enough data yet.'}</li>
        <li>Unchanged: ${stats.totalR === 0 ? 'Current month is neutral.' : 'No clear pattern based on current data.'}</li>
      </ul>
    </div>
  `;

  document.getElementById('monthly-review').innerHTML = content;
}

function renderGoals(trades) {
  const stats = deriveStats(trades);
  const goals = [
    { label: 'Monthly R Goal', value: stats.totalR, target: 10, color: 'green' },
    { label: 'Weekly R Goal', value: stats.totalR, target: 3, color: 'blue' },
    { label: 'Maximum Trades Per Day', value: stats.totalTrades, target: 6, color: 'amber' },
    { label: 'Maximum Daily Loss', value: 0, target: 3, color: 'red' },
    { label: 'Target Win Rate', value: stats.winRate, target: 55, color: 'green' },
    { label: 'Target Average RR', value: stats.avgR, target: 1.2, color: 'blue' },
    { label: 'Maximum Early Exit %', value: stats.earlyExitCount / Math.max(stats.totalTrades, 1) * 100, target: 20, color: 'amber' },
    { label: 'Target A+ Setup %', value: trades.filter(t => t.setupRating === 'A+').length / Math.max(stats.totalTrades, 1) * 100, target: 35, color: 'green' },
    { label: 'Target Discipline Score', value: stats.disciplineScoreAverage, target: 80, color: 'blue' }
  ];

  const rows = goals.map(goal => {
    const pct = Math.min((goal.value / goal.target) * 100, 100);
    return `
      <div class="progress-row">
        <div class="progress-meta">
          <span>${goal.label}</span>
          <strong>${goal.value.toFixed ? goal.value.toFixed(1) : goal.value}</strong>
        </div>
        <div class="progress-bar"><span class="progress-fill" style="width:${Math.max(0, pct)}%"></span></div>
      </div>
    `;
  }).join('');

  document.getElementById('goals-panel').innerHTML = rows;
}

function groupMistakes(trades) {
  const map = {};
  for (const trade of trades) {
    const items = Array.isArray(trade.mistakes) ? trade.mistakes.filter(Boolean) : [];
    for (const item of items) {
      if (item === 'None') continue;
      map[item] = (map[item] || 0) + 1;
    }
  }
  return map;
}

function flattenMistakes(trades) {
  return trades.flatMap(trade => Array.isArray(trade.mistakes) ? trade.mistakes.filter(Boolean) : []);
}

function getMostCommonValue(items) {
  const counts = {};
  for (const item of items.filter(Boolean)) {
    counts[item] = (counts[item] || 0) + 1;
  }
  const max = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return max ? max[0] : null;
}

function getBestGroupKey(trades, field) {
  const map = {};
  for (const trade of trades) {
    const value = trade[field] || 'Other';
    map[value] = (map[value] || 0) + Number(trade.rResult || 0);
  }
  const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  return best ? `${best[0]} (${best[1].toFixed(2)}R)` : null;
}

function getWorstGroupKey(trades, field) {
  const map = {};
  for (const trade of trades) {
    const value = trade[field] || 'Other';
    map[value] = (map[value] || 0) + Number(trade.rResult || 0);
  }
  const worst = Object.entries(map).sort((a, b) => a[1] - b[1])[0];
  return worst ? `${worst[0]} (${worst[1].toFixed(2)}R)` : null;
}

function renderAllViews(trades) {
  const views = ['All Trades', 'Today', 'This Week', 'This Month', 'Winning Trades', 'Losing Trades', 'A+ Trades', 'Early Exits', 'Emotional Trades', 'Mistake Trades', 'London Session', 'New York Session', 'Asian Session'];
  const viewButtons = views.map(view => `<button class="ghost-btn" data-view="${view}">${view}</button>`).join('');
  document.body.querySelector('.main-panel').insertAdjacentHTML('beforeend', `<div id="view-controls" class="panel"><div class="section-heading"><h3>Database Views</h3></div><div class="view-controls">${viewButtons}</div></div>`);

  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      const viewName = button.dataset.view;
      const rows = getTableRowsForView(trades, viewName);
      const html = rows.length ? rows.slice(0, 20).map(trade => `
        <tr>
          <td>${trade.tradeName || 'Untitled'}</td>
          <td>${trade.date}</td>
          <td>${trade.instrument}</td>
          <td>${trade.setupRating}</td>
          <td>${trade.session}</td>
          <td><span class="badge ${trade.result === 'WIN' ? 'win' : trade.result === 'LOSS' ? 'loss' : 'be'}">${trade.result}</span></td>
          <td>${formatR(trade.rResult)}</td>
          <td>${trade.pips}</td>
        </tr>
      `).join('') : '<tr><td colspan="8">No rows found for this view.</td></tr>';

      document.getElementById('recent-trades').innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Trade</th>
              <th>Date</th>
              <th>Instrument</th>
              <th>Setup</th>
              <th>Session</th>
              <th>Result</th>
              <th>R</th>
              <th>Pips</th>
            </tr>
          </thead>
          <tbody>${html}</tbody>
        </table>
      `;
    });
  });
}

function buildAiPrompt(trades, question = '') {
  const safeTrades = trades.slice(-25).map(t => ({
    tradeName: t.tradeName || 'Untitled',
    date: t.date,
    instrument: t.instrument,
    session: t.session,
    bias: t.bias,
    result: t.result,
    rr: Number(t.rr || 0),
    rResult: Number(t.rResult || 0),
    pips: Number(t.pips || 0),
    setupRating: t.setupRating,
    emotion: t.emotion,
    confirmation: t.confirmation,
    reasonEarlyExit: t.reasonEarlyExit,
    mistakes: Array.isArray(t.mistakes) ? t.mistakes.filter(Boolean) : [],
    notes: t.notes || ''
  }));

  return `
You are an expert trading journal coach. Analyze the following journal data only.

RULES:
- Never invent trade data.
- If there is not enough data, say "Not enough data yet."
- Distinguish FACT, PATTERN, POSSIBLE EXPLANATION, SUGGESTION.
- Do not predict future market moves.
- Keep advice based only on the recorded trades.

TRADE DATA:
${JSON.stringify(safeTrades, null, 2)}

USER QUESTION:
${question || 'Review my recent trading performance and tell me what I should improve.'}

Return a concise but high-quality coaching response with:
1. FACT
2. PATTERN
3. POSSIBLE EXPLANATION
4. SUGGESTION
5. One immediate action to improve tomorrow
`;
}

async function callAiEndpoint(prompt, apiKey, model) {
  if (!apiKey) {
    throw new Error('AI API key is not configured. Add your key in the AI settings panel.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a disciplined trading journal coach. Give advice using only recorded journal facts and never invent trades or guarantees.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from the AI service.';
}

async function renderAiLiveAnalysis(trades) {
  const stats = deriveStats(trades);
  const apiKey = document.getElementById('ai-api-key')?.value?.trim();
  const model = document.getElementById('ai-model')?.value || 'gpt-4o-mini';
  const prompt = buildAiPrompt(trades, 'Review my recent journal, identify biggest mistakes, and suggest what I should improve next session.');

  const output = document.getElementById('ai-live-analysis');

  if (!apiKey) {
    output.innerHTML = `
      <div class="ai-block">
        <h4>LIVE AI JOURNAL REVIEW</h4>
        <ul>
          <li><strong>Fact:</strong> ${stats.totalTrades} trades recorded, ${stats.winRate.toFixed(1)}% win rate, ${formatR(stats.totalR)} total R.</li>
          <li><strong>Pattern:</strong> ${stats.earlyExitCount > 0 ? 'Early exits are present in your journal.' : 'No early exits recorded yet.'}</li>
          <li><strong>Possible explanation:</strong> ${stats.emotionalTradeCount > 0 ? 'Emotional trades are appearing in the journal, which may be affecting execution.' : 'Emotional trading is not yet evident in your recorded trades.'}</li>
          <li><strong>Suggestion:</strong> ${stats.avgR >= 0 ? 'Maintain your process and continue reducing emotional exits.' : 'Focus on improving confirmation discipline and reducing impulsive exits.'}</li>
          <li><strong>AI status:</strong> Add an API key in the field above to activate live AI analysis.</li>
        </ul>
      </div>
    `;
    return;
  }

  output.innerHTML = '<div class="ai-block"><h4>LIVE AI JOURNAL REVIEW</h4><ul><li>Running live AI analysis...</li></ul></div>';

  try {
    const aiReply = await callAiEndpoint(prompt, apiKey, model);
    output.innerHTML = `
      <div class="ai-block">
        <h4>LIVE AI JOURNAL REVIEW</h4>
        <p>${aiReply.replace(/\n/g, '<br>')}</p>
      </div>
    `;
  } catch (error) {
    output.innerHTML = `
      <div class="ai-block">
        <h4>LIVE AI JOURNAL REVIEW</h4>
        <ul>
          <li>AI is configured but an error occurred.</li>
          <li>${error.message}</li>
        </ul>
      </div>
    `;
  }
}

async function askAiCoach() {
  const trades = readTrades().map(normalizeTrade);
  const question = document.getElementById('ai-chat-input').value.trim();
  const output = document.getElementById('ai-chat-output');

  if (!trades.length) {
    output.innerHTML = '<div class="ai-block"><h4>AI COACH</h4><ul><li>Not enough data yet.</li></ul></div>';
    return;
  }

  if (!question) {
    output.innerHTML = '<div class="ai-block"><h4>AI COACH</h4><ul><li>Please ask a specific question about your journal.</li></ul></div>';
    return;
  }

  const apiKey = document.getElementById('ai-api-key')?.value?.trim();
  const model = document.getElementById('ai-model')?.value || 'gpt-4o-mini';
  const prompt = buildAiPrompt(trades, question);

  if (!apiKey) {
    output.innerHTML = `
      <div class="ai-block">
        <h4>AI COACH</h4>
        <ul>
          <li>Fact: your journal contains ${trades.length} trades.</li>
          <li>Pattern: ${deriveStats(trades).earlyExitCount > 0 ? 'Early exits are present.' : 'Early exits are not yet showing in the record.'}</li>
          <li>Suggestion: Add your AI API key above to unlock live question-and-answer coaching.</li>
        </ul>
      </div>
    `;
    return;
  }

  output.innerHTML = '<div class="ai-block"><h4>AI COACH</h4><ul><li>Asking the AI coach...</li></ul></div>';

  try {
    const aiReply = await callAiEndpoint(prompt, apiKey, model);
    output.innerHTML = `
      <div class="ai-block">
        <h4>AI COACH RESPONSE</h4>
        <p>${aiReply.replace(/\n/g, '<br>')}</p>
      </div>
    `;
  } catch (error) {
    output.innerHTML = `
      <div class="ai-block">
        <h4>AI COACH</h4>
        <ul>
          <li>AI chat failed.</li>
          <li>${error.message}</li>
        </ul>
      </div>
    `;
  }
}

function render() {
  const trades = readTrades().map(normalizeTrade);
  renderKpis(trades);
  renderSummarySection();
  renderRecentTrades(trades);
  renderSetupAnalysis(trades);
  renderSessionAnalysis(trades);
  renderBiasAnalysis(trades);
  renderEmotionAnalysis(trades);
  renderMistakeAnalysis(trades);
  renderEarlyExitAnalyzer(trades);
  renderAiCoach(trades);
  renderAiLiveAnalysis(trades);
  renderDailyReview(trades);
  renderWeeklyReview(trades);
  renderMonthlyReview(trades);
  renderGoals(trades);

  const currentView = document.getElementById('view-controls');
  if (currentView) currentView.remove();
  renderAllViews(trades);
}

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const selectedMistakes = formData.getAll('mistakes');
  const rawTrade = {
    id: Date.now().toString(),
    tradeName: formData.get('tradeName') || 'Untitled Trade',
    date: formData.get('date') || new Date().toISOString().slice(0, 10),
    time: formData.get('time') || '00:00',
    instrument: formData.get('instrument') || 'EURUSD',
    levelTraded: formData.get('levelTraded') || 'Support',
    result: formData.get('result') || 'WIN',
    rr: Number(formData.get('rr') || 0),
    session: formData.get('session') || 'London',
    bias: formData.get('bias') || 'Bullish',
    emotion: formData.get('emotion') || 'Calm',
    reasonEarlyExit: formData.get('reasonEarlyExit') || 'None',
    setupRating: formData.get('setupRating') || 'A+',
    pips: Number(formData.get('pips') || 0),
    notes: formData.get('notes') || '',
    confirmation: formData.get('confirmation') || 'No',
    marketCondition: formData.get('marketCondition') || 'Trending',
    entryType: formData.get('entryType') || 'Confirmation',
    mistakes: selectedMistakes.length ? selectedMistakes : ['None'],
    screenshot: formData.get('screenshot') || ''
  };

  const trades = readTrades();
  trades.push(rawTrade);
  saveTrades(trades);
  form.reset();
  render();
}

function resetAllData() {
  if (confirm('Clear all saved trades?')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
}

function populateDateTimeDropdowns() {
  const dateSelect = document.getElementById('trade-date');
  const timeSelect = document.getElementById('trade-time');

  if (!dateSelect || !timeSelect) return;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 30);
  const dates = [];

  for (let i = 0; i <= 60; i += 1) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    dates.push({ value, label });
  }

  dateSelect.innerHTML = dates.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');
  dateSelect.value = today.toISOString().slice(0, 10);

  const times = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      const paddedHour = String(hour).padStart(2, '0');
      const paddedMinute = String(minute).padStart(2, '0');
      const value = `${paddedHour}:${paddedMinute}`;
      times.push({ value, label: value });
    }
  }

  timeSelect.innerHTML = '<option value="">Select time</option>' + times.map(({ value, label }) => `<option value="${value}">${label}</option>`).join('');

  const currentHour = String(today.getHours()).padStart(2, '0');
  const currentMinute = String(Math.round(today.getMinutes() / 15) * 15).padStart(2, '0');
  const defaultTimeValue = `${currentHour}:${currentMinute}`;
  timeSelect.value = defaultTimeValue;
}

document.addEventListener('DOMContentLoaded', () => {
  populateDateTimeDropdowns();
  const form = document.getElementById('trade-form');
  form.addEventListener('submit', handleFormSubmit);
  document.getElementById('clear-data').addEventListener('click', resetAllData);
  document.getElementById('run-ai-analysis').addEventListener('click', async () => {
    const trades = readTrades().map(normalizeTrade);
    await renderAiLiveAnalysis(trades);
  });
  document.getElementById('send-ai-chat').addEventListener('click', async () => {
    await askAiCoach();
  });
  render();
});
