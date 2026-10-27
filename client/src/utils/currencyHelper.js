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
