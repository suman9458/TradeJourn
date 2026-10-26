const API_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '') 
  : '';
const BASE_URL = API_BASE ? `${API_BASE}/api` : '/api';

const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname === '::1');

const getToken = () => localStorage.getItem('tradejourn_token');

const ensureToken = async () => {
  let token = getToken();
  if (!token) {
    try {
      let res;
      try {
        res = await fetch(`${BASE_URL}/auth/demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (!API_BASE && isLocal) {
          res = await fetch(`http://localhost:5000/api/auth/demo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          throw e;
        }
      }
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('tradejourn_token', data.token);
        token = data.token;
      }
    } catch (e) {
      console.warn('Auto demo auth failed:', e);
    }
  }
  return token;
};

const request = async (endpoint, options = {}, isRetry = false) => {
  let token = getToken();
  
  // For protected routes, ensure token exists before sending
  if (!token && !endpoint.startsWith('/auth')) {
    token = await ensureToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
    if (isLocal && !API_BASE && (response.status === 502 || response.status === 503 || response.status === 504)) {
      throw new Error('VITE_PROXY_502');
    }
  } catch (netErr) {
    if (API_BASE) {
      throw new Error(`Connection failed. Backend API server at ${API_BASE} is unreachable.`);
    }
    // Only retry localhost / 127.0.0.1 during local development
    if (isLocal) {
      try {
        response = await fetch(`http://127.0.0.1:5000/api${endpoint}`, config);
      } catch (e1) {
        try {
          response = await fetch(`http://localhost:5000/api${endpoint}`, config);
        } catch (directErr) {
          throw new Error('Backend server on port 5000 is unreachable or offline. Please make sure backend is running (run "npm run dev").');
        }
      }
    } else {
      throw new Error('TradeJourn backend server is unreachable. If waking up from sleep, please wait a moment and refresh.');
    }
  }

  // If 401 unauthorized, refresh demo token and retry once (only for app data endpoints, never auth endpoints)
  if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth')) {
    localStorage.removeItem('tradejourn_token');
    const newToken = await ensureToken();
    if (newToken) {
      return request(endpoint, options, true);
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    if (!response.ok) {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(isLocal
          ? 'Backend server unreachable (502 Bad Gateway). Please verify backend is running on port 5000.'
          : 'TradeJourn server is waking up or temporarily unavailable (502/503). Please wait a few moments and try again.');
      }
      throw new Error(`Backend error (${response.status}): ${response.statusText || 'Server responded with invalid data'}`);
    }
    throw new Error('Failed to parse server response as JSON');
  }

  if (!response.ok) {
    const err = new Error(data.message || 'API request failed');
    err.status = response.status;
    throw err;
  }

  return data;
};

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  demoLogin: () => request('/auth/demo', { method: 'POST' }),
  socialLogin: (payload) => request('/auth/social', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPasswordSendOtp: (payload) => request('/auth/forgot-password/send-otp', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPasswordVerifyOtp: (payload) => request('/auth/forgot-password/verify-otp', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPasswordReset: (payload) => request('/auth/forgot-password/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request('/auth/me'),
  updateSettings: (payload) => {
    const body = (payload?.settings || payload?.name || payload?.dob || payload?.email || payload?.userId || payload?.tradingExperience || payload?.avatar !== undefined)
      ? payload
      : { settings: payload };
    return request('/auth/settings', { method: 'PUT', body: JSON.stringify(body) });
  },

  // Trades
  getTrades: (params = {}) => {
    const cleanParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'undefined' && val !== 'null') {
        cleanParams.append(key, val);
      }
    });
    const query = cleanParams.toString();
    return request(`/trades${query ? `?${query}` : ''}`);
  },
  getTradeById: (id) => request(`/trades/${id}`),
  createTrade: (trade) => request('/trades', { method: 'POST', body: JSON.stringify(trade) }),
  updateTrade: (id, trade) => request(`/trades/${id}`, { method: 'PUT', body: JSON.stringify(trade) }),
  deleteTrade: (id) => request(`/trades/${id}`, { method: 'DELETE' }),
  clearAllTrades: () => request('/trades', { method: 'DELETE' }),
  seedSampleTrades: () => request('/trades/seed', { method: 'POST' }),

  // Analytics
  getKPIs: () => request('/analytics/kpis'),
  getBreakdowns: () => request('/analytics/breakdowns'),
  getEarlyExits: () => request('/analytics/early-exits'),
  getEquityCurve: () => request('/analytics/equity-curve'),

  // Reviews
  getReviews: () => request('/reviews'),

  // Playbook & Goals
  getPlaybook: () => request('/playbook'),
  updatePlaybook: (data) => request('/playbook', { method: 'PUT', body: JSON.stringify(data) }),
  getGoals: () => request('/goals'),
  updateGoals: (data) => request('/goals', { method: 'PUT', body: JSON.stringify(data) }),

  // AI Coach
  getRuleBasedCoach: () => request('/ai/coach'),
  askAiCoach: (payload) => request('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),

  // MetaTrader 5 (MT5) Integration
  connectMT5CloudAccount: (payload) => request('/mt5/cloud/connect', { method: 'POST', body: JSON.stringify(payload) }),
  getMT5Accounts: () => request('/mt5/accounts'),
  getMT5OpenPositions: (id) => request(`/mt5/accounts/${id}/positions`),
  getMT5ConnectorConfig: (id) => request(id ? `/mt5/accounts/${id}/connector-config` : '/mt5/connector-config'),
  updateMT5Account: (id, payload) => request(`/mt5/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getMT5PendingJournals: () => request('/mt5/pending-journals'),
  updateMT5Journal: (id, payload) => request(`/mt5/positions/${id}/journal`, { method: 'POST', body: JSON.stringify(payload) }),
  linkMT5ManualTrade: (id, payload) => request(`/mt5/positions/${id}/link-trade`, { method: 'POST', body: JSON.stringify(payload) }),
  disconnectMT5Account: (id, deleteData = false) => request(`/mt5/accounts/${id}?deleteData=${deleteData}`, { method: 'DELETE' }),

  // Health
  checkHealth: () => request('/health'),

  // Cloudinary Image Storage
  uploadImage: (base64OrDataUrl) => request('/upload/image', {
    method: 'POST',
    body: JSON.stringify({ image: base64OrDataUrl })
  }),
  deleteUploadedImage: (publicId) => request('/upload/image', {
    method: 'DELETE',
    body: JSON.stringify({ publicId })
  })
};
