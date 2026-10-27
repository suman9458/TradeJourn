import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  MAJOR_CURRENCIES,
  DEFAULT_EXCHANGE_RATES,
  getCurrencySymbol,
  fetchLiveExchangeRates,
  convertAmount,
  convertToUSD,
  formatCurrencyAmount
} from '../utils/currencyHelper';

export const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const { user, updateUserSettings } = useAuth();

  // 1. Initial currency from user settings or localStorage or fallback to USD
  const [currency, setCurrencyState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tradejourn_currency');
      if (saved && MAJOR_CURRENCIES.some(c => c.code === saved)) {
        return saved;
      }
    }
    return user?.settings?.currency || 'USD';
  });

  // 2. Exchange rates state with fallback and cached live rates
  const [rates, setRates] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('tradejourn_exchange_rates');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.rates && Date.now() - (parsed.timestamp || 0) < 3600000) {
            return { ...DEFAULT_EXCHANGE_RATES, ...parsed.rates };
          }
        }
      } catch (e) {
        // Ignore JSON error
      }
    }
    return DEFAULT_EXCHANGE_RATES;
  });

  // 3. Keep in sync when user profile finishes loading or updates from server
  useEffect(() => {
    if (user?.settings?.currency && user.settings.currency !== currency) {
      if (MAJOR_CURRENCIES.some(c => c.code === user.settings.currency)) {
        setCurrencyState(user.settings.currency);
        localStorage.setItem('tradejourn_currency', user.settings.currency);
      }
    }
  }, [user?.settings?.currency]);

  // 4. Fetch live exchange rates in background
  useEffect(() => {
    let isMounted = true;
    fetchLiveExchangeRates().then(newRates => {
      if (isMounted && newRates) {
        setRates(prev => ({ ...prev, ...newRates }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // 5. Change currency handler - updates state, localStorage, and user settings
  const setCurrency = useCallback((newCode) => {
    const valid = MAJOR_CURRENCIES.find(c => c.code === newCode)?.code || 'USD';
    setCurrencyState(valid);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradejourn_currency', valid);
      // Dispatch storage event so all tabs/windows sync instantly
      window.dispatchEvent(new Event('tradejourn:currency_changed'));
    }
    if (user && updateUserSettings) {
      updateUserSettings({ currency: valid }).catch(err => {
        console.warn('Could not persist currency preference to backend:', err.message);
      });
    }
  }, [user, updateUserSettings]);

  // Listen for local currency change events
  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem('tradejourn_currency');
      if (saved && saved !== currency && MAJOR_CURRENCIES.some(c => c.code === saved)) {
        setCurrencyState(saved);
      }
    };
    window.addEventListener('tradejourn:currency_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('tradejourn:currency_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [currency]);

  const symbol = useMemo(() => getCurrencySymbol(currency), [currency]);
  const rate = useMemo(() => rates[currency] || 1.0, [rates, currency]);

  // Helper functions bound to active currency and rate:
  const convert = useCallback((amountUSD) => {
    return convertAmount(amountUSD, currency, rates);
  }, [currency, rates]);

  const convertFrom = useCallback((amountTargetCurrency) => {
    return convertToUSD(amountTargetCurrency, currency, rates);
  }, [currency, rates]);

  const format = useCallback((amountUSD, options = {}) => {
    return formatCurrencyAmount(amountUSD, currency, { ...options, rates, alreadyConverted: false });
  }, [currency, rates]);

  const formatConverted = useCallback((amountConverted, options = {}) => {
    return formatCurrencyAmount(amountConverted, currency, { ...options, rates, alreadyConverted: true });
  }, [currency, rates]);

  const formatCompact = useCallback((amountUSD, forceSign = true) => {
    return formatCurrencyAmount(amountUSD, currency, { forceSign, compact: true, rates, alreadyConverted: false });
  }, [currency, rates]);

  const formatCompactConverted = useCallback((amountConverted, forceSign = true) => {
    return formatCurrencyAmount(amountConverted, currency, { forceSign, compact: true, rates, alreadyConverted: true });
  }, [currency, rates]);

  const contextValue = useMemo(() => ({
    currency,
    symbol,
    rate,
    rates,
    setCurrency,
    convert,
    convertFrom,
    format,
    formatConverted,
    formatCompact,
    formatCompactConverted,
    currencies: MAJOR_CURRENCIES
  }), [
    currency,
    symbol,
    rate,
    rates,
    setCurrency,
    convert,
    convertFrom,
    format,
    formatConverted,
    formatCompact,
    formatCompactConverted
  ]);

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    return {
      currency: 'USD',
      symbol: '$',
      rate: 1.0,
      rates: DEFAULT_EXCHANGE_RATES,
      setCurrency: () => {},
      convert: (v) => Number(v || 0),
      convertFrom: (v) => Number(v || 0),
      format: (v) => `$${Number(v || 0).toLocaleString()}`,
      formatConverted: (v) => `$${Number(v || 0).toLocaleString()}`,
      formatCompact: (v) => `$${Number(v || 0).toLocaleString()}`,
      formatCompactConverted: (v) => `$${Number(v || 0).toLocaleString()}`,
      currencies: MAJOR_CURRENCIES
    };
  }
  return context;
};
