/**
 * Currencies Reference & Symbol Helpers for TradeJourn
 * Kept strictly to the 8 Major & Popular Currencies requested:
 * USD, INR, EUR, GBP, JPY, AUD, CAD, CHF
 */

export const MAJOR_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' }
];

export const CURRENCY_GROUPS = [
  {
    group: 'Popular & Major',
    currencies: MAJOR_CURRENCIES
  }
];

export const ALL_CURRENCIES = MAJOR_CURRENCIES;

const SYMBOL_MAP = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  USDT: '₮'
};

export const getCurrencySymbol = (code) => {
  if (!code) return '$';
  const upper = String(code).toUpperCase().trim();
  return SYMBOL_MAP[upper] || upper;
};

// Fallback baseline exchange rates (USD base = 1.0)
export const DEFAULT_EXCHANGE_RATES = {
  USD: 1.0,
  INR: 95.27,
  EUR: 0.894,
  GBP: 0.749,
  JPY: 157.44,
  AUD: 1.55,
  CAD: 1.40,
  CHF: 0.88
};

/**
 * Fetch live exchange rates from free open API with localStorage 1-hour cache
 */
export const fetchLiveExchangeRates = async () => {
  try {
    const cached = localStorage.getItem('tradejourn_exchange_rates');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.rates && Date.now() - (parsed.timestamp || 0) < 3600000) {
        return parsed.rates;
      }
    }

    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.rates) {
      const newRates = { ...DEFAULT_EXCHANGE_RATES };
      for (const cur of MAJOR_CURRENCIES) {
        if (data.rates[cur.code]) {
          newRates[cur.code] = Number(data.rates[cur.code]);
        }
      }
      localStorage.setItem('tradejourn_exchange_rates', JSON.stringify({
        timestamp: Date.now(),
        rates: newRates
      }));
      return newRates;
    }
  } catch (err) {
    console.warn('Using baseline exchange rates (offline or rate API unreachable):', err.message);
  }
  return DEFAULT_EXCHANGE_RATES;
};

/**
 * Convert USD amount to target currency
 */
export const convertAmount = (amountInUSD, targetCurrency = 'USD', rates = DEFAULT_EXCHANGE_RATES) => {
  const num = Number(amountInUSD || 0);
  if (isNaN(num) || num === 0) return 0;
  const rate = rates[targetCurrency] || 1.0;
  return num * rate;
};

/**
 * Convert target currency amount back to base USD
 */
export const convertToUSD = (amountInTarget, sourceCurrency = 'USD', rates = DEFAULT_EXCHANGE_RATES) => {
  const num = Number(amountInTarget || 0);
  if (isNaN(num) || num === 0) return 0;
  const rate = rates[sourceCurrency] || 1.0;
  return num / (rate || 1.0);
};

/**
 * Format currency amount with symbol, proper decimal places, compact k/M formatting, and signs
 */
export const formatCurrencyAmount = (
  rawAmount,
  currencyCode = 'USD',
  {
    forceSign = false,
    compact = false,
    decimals = null,
    showSymbol = true,
    alreadyConverted = false,
    rates = DEFAULT_EXCHANGE_RATES
  } = {}
) => {
  if (rawAmount === null || rawAmount === undefined || isNaN(Number(rawAmount))) {
    const sym = showSymbol ? getCurrencySymbol(currencyCode) : '';
    return `${sym}0`;
  }

  const baseNum = Number(rawAmount);
  const targetNum = alreadyConverted ? baseNum : convertAmount(baseNum, currencyCode, rates);
  const symbol = showSymbol ? getCurrencySymbol(currencyCode) : '';
  const sign = targetNum > 0 ? (forceSign ? '+' : '') : targetNum < 0 ? '-' : '';
  const abs = Math.abs(targetNum);

  // Compact k/M notation for charts and badges
  if (compact) {
    let formatted;
    if (abs >= 1000000) {
      formatted = `${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    } else if (abs >= 1000) {
      formatted = `${(abs / 1000).toFixed(abs >= 10000 || abs % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}k`;
    } else {
      formatted = abs >= 100 || currencyCode === 'JPY' ? Math.round(abs).toLocaleString('en-US') : abs.toFixed(decimals !== null ? decimals : 1).replace(/\.0$/, '');
    }
    return `${sign}${symbol}${formatted}`;
  }

  // Standard detailed notation
  let fractionDigits = 2;
  if (decimals !== null) {
    fractionDigits = decimals;
  } else if (currencyCode === 'JPY') {
    fractionDigits = 0;
  } else if (abs >= 10000 && Number.isInteger(abs)) {
    fractionDigits = 0;
  }

  const numStr = abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });

  return `${sign}${symbol}${numStr}`;
};
