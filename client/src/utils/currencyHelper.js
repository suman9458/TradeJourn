/**
 * Global Currencies Reference & Symbol Helpers for TradeJourn
 */

export const CURRENCY_GROUPS = [
  {
    group: 'Popular & Major',
    currencies: [
      { code: 'USD', symbol: '$', name: 'US Dollar' },
      { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
      { code: 'EUR', symbol: '€', name: 'Euro' },
      { code: 'GBP', symbol: '£', name: 'British Pound' },
      { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
      { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
      { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
      { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' }
    ]
  },
  {
    group: 'Asia & Pacific',
    currencies: [
      { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
      { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
      { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
      { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
      { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
      { code: 'THB', symbol: '฿', name: 'Thai Baht' },
      { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
      { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
      { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
      { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
      { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
      { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
      { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
      { code: 'NPR', symbol: 'रू', name: 'Nepalese Rupee' },
      { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar' }
    ]
  },
  {
    group: 'Middle East & Africa',
    currencies: [
      { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
      { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
      { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
      { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
      { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
      { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
      { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
      { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
      { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
      { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
      { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
      { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' }
    ]
  },
  {
    group: 'Europe & Americas',
    currencies: [
      { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
      { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
      { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
      { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
      { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
      { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
      { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
      { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
      { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso' },
      { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
      { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
      { code: 'ARS', symbol: 'Arg$', name: 'Argentine Peso' }
    ]
  },
  {
    group: 'Crypto & Stablecoins',
    currencies: [
      { code: 'USDT', symbol: '₮', name: 'Tether USD' },
      { code: 'USDC', symbol: '$', name: 'USD Coin' },
      { code: 'BTC', symbol: '₿', name: 'Bitcoin' },
      { code: 'ETH', symbol: 'Ξ', name: 'Ethereum' }
    ]
  }
];

export const ALL_CURRENCIES = CURRENCY_GROUPS.flatMap(g => g.currencies);

const SYMBOL_MAP = ALL_CURRENCIES.reduce((acc, c) => {
  acc[c.code] = c.symbol;
  return acc;
}, {});

export const getCurrencySymbol = (code) => {
  if (!code) return '$';
  const upper = String(code).toUpperCase().trim();
  return SYMBOL_MAP[upper] || upper;
};
