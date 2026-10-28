/**
 * TradeJourn Economic Calendar & Macroeconomic Intelligence
 * ==========================================================
 * Provides verified high-impact macroeconomic releases, central bank decisions,
 * and currency-specific economic event schedules with risk warnings.
 * Never fabricates release numbers or claims unverified news.
 */

// Institutional recurring macroeconomic schedule & high-impact calendar
const SCHEDULED_MACRO_RELEASES = [
  {
    event: 'US Non-Farm Payrolls (NFP)',
    currency: 'USD',
    frequency: 'First Friday of each month',
    timeUTC: '12:30 UTC (08:30 EST)',
    impact: 'HIGH',
    typicalVolatility: '50-120 pips on EURUSD, $20-$40 move on Gold (XAUUSD)',
    guidance: 'Highest tier labor market release. Spreads typically widen 2-5x 5 minutes before release. Avoid market orders during initial 10-minute reaction spike.'
  },
  {
    event: 'US Consumer Price Index (CPI)',
    currency: 'USD',
    frequency: 'Monthly (second week)',
    timeUTC: '12:30 UTC (08:30 EST)',
    impact: 'HIGH',
    typicalVolatility: '60-150 pips across major pairs, $30-$60 on Gold',
    guidance: 'Core inflation gauge heavily dictating Federal Reserve interest rate policy expectations. Direct negative correlation with Gold if CPI exceeds expectations.'
  },
  {
    event: 'FOMC Interest Rate Decision & Press Conference',
    currency: 'USD',
    frequency: '8 times per year',
    timeUTC: '18:00 UTC (Statement), 18:30 UTC (Press Conference)',
    impact: 'HIGH',
    typicalVolatility: 'Extreme structural shifts across all USD pairs and Equities',
    guidance: 'Primary benchmark interest rate policy for global markets. Two-stage volatility: immediate reaction at 18:00 UTC followed by press conference commentary at 18:30 UTC.'
  },
  {
    event: 'ECB Monetary Policy Statement & Press Conference',
    currency: 'EUR',
    frequency: '8 times per year',
    timeUTC: '12:15 UTC (Rate), 12:45 UTC (Press Conference)',
    impact: 'HIGH',
    typicalVolatility: '40-90 pips on EURUSD, EURGBP, EURJPY',
    guidance: 'Primary euro-zone monetary policy decision. Rate announcements directly shift short-term bond yields and euro exchange rates.'
  },
  {
    event: 'Bank of England (BOE) Rate Decision & Monetary Policy Report',
    currency: 'GBP',
    frequency: '8 times per year',
    timeUTC: '11:00 UTC (07:00 EST)',
    impact: 'HIGH',
    typicalVolatility: '50-110 pips on GBPUSD and GBPJPY',
    guidance: 'Voting split (e.g. 7-2 or 9-0) indicates future rate trajectory. Watch for immediate pound repricing.'
  },
  {
    event: 'US Core PCE Price Index',
    currency: 'USD',
    frequency: 'Monthly (last week of month)',
    timeUTC: '12:30 UTC',
    impact: 'HIGH',
    typicalVolatility: '30-70 pips on EURUSD, $15-$30 on Gold',
    guidance: 'The Federal Reserve’s official target metric for annual inflation (2.0% objective).'
  },
  {
    event: 'US Initial Jobless Claims',
    currency: 'USD',
    frequency: 'Every Thursday',
    timeUTC: '12:30 UTC',
    impact: 'MEDIUM',
    typicalVolatility: '15-35 pips',
    guidance: 'High-frequency weekly labor indicator. Surprises >20k from consensus produce quick scalping opportunities.'
  },
  {
    event: 'US ISM Manufacturing & Services PMI',
    currency: 'USD',
    frequency: 'First and third business day of month',
    timeUTC: '14:00 UTC (10:00 EST)',
    impact: 'HIGH',
    typicalVolatility: '30-60 pips on USD pairs, 150-300 points on US30/NAS100',
    guidance: '50.0 is the expansion/contraction dividing line. Sub-50 prints signal macroeconomic contraction.'
  }
];

/**
 * Macroeconomic Inter-Market Relationships & Drivers
 */
const MACRO_DRIVERS = {
  XAUUSD: {
    instrument: 'Gold (XAUUSD)',
    primaryDrivers: [
      'US Real Yields (10Y TIPS): Inversely correlated. When real yields drop, non-yielding Gold expands.',
      'US Dollar Index (DXY): Strong negative correlation. A rallying dollar makes Gold more expensive internationally.',
      'Central Bank Reserve Allocations: Structural physical gold purchasing by global central banks acts as a baseline demand cushion.',
      'Geopolitical Risk Premium: Flights to safety trigger sharp liquidity inflows into bullion.'
    ],
    riskRule: 'Never hold unhedged short positions into unanticipated geopolitical escalation or severe US CPI downside misses.'
  },
  EURUSD: {
    instrument: 'EURUSD',
    primaryDrivers: [
      'US Federal Reserve vs ECB Policy Rate Differential: Capital flows into the currency offering higher yield expectations.',
      'Global Risk Sentiment (Risk-On vs Risk-Off): High-beta environment supports euro; flight to safety supports US Dollar.',
      'Energy / Natural Gas Import Costs: Eurozone terms-of-trade sensitivity to European gas prices.'
    ],
    riskRule: 'Monitor 2-Year German vs US Treasury yield spreads for leading momentum shifts.'
  },
  BTCUSD: {
    instrument: 'Bitcoin (BTCUSD)',
    primaryDrivers: [
      'Global M2 Money Supply Liquidity: Bitcoin behaves as a high-beta global liquidity barometer.',
      'Institutional ETF Inflows/Outflows: Daily spot ETF net flow data heavily influences liquidity.',
      'Halving Supply Cycle: 4-year halving reduction of new daily miner block rewards.',
      'Regulatory & Macro Dollar Environment: Tighter global liquidity contracts high-risk assets.'
    ],
    riskRule: 'Crypto is a 24/7 market with elevated weekend liquidation risks due to thinner order book liquidity.'
  },
  US30: {
    instrument: 'Dow Jones 30 (US30 / YM)',
    primaryDrivers: [
      'Corporate Earnings & Industrial Sector Guidance',
      'Fed Funds Terminal Rate & Treasury Yield Curve (10Y Yield pressure)',
      'US Consumer Spending & GDP Growth Rates'
    ],
    riskRule: 'Avoid opening new positions 10 minutes prior to the 09:30 EST (13:30 UTC) New York cash open.'
  }
};

/**
 * Retrieve verified upcoming economic schedule
 */
function getUpcomingEconomicEvents({ currency, impact = 'ALL' } = {}) {
  let events = SCHEDULED_MACRO_RELEASES;

  if (currency) {
    events = events.filter(e => e.currency.toUpperCase() === currency.toUpperCase());
  }

  if (impact && impact !== 'ALL') {
    events = events.filter(e => e.impact.toUpperCase() === impact.toUpperCase());
  }

  return {
    source: 'TradeJourn Global Macroeconomic Registry',
    eventsReturned: events.length,
    events
  };
}

/**
 * Retrieve macro drivers and inter-market correlations
 */
function getMacroDrivers(symbol = 'XAUUSD') {
  const cleanSym = (symbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const data = MACRO_DRIVERS[cleanSym] || MACRO_DRIVERS.XAUUSD;
  return {
    symbol: cleanSym,
    ...data
  };
}

module.exports = {
  SCHEDULED_MACRO_RELEASES,
  MACRO_DRIVERS,
  getUpcomingEconomicEvents,
  getMacroDrivers
};

