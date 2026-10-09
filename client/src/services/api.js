const API_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '') 
  : '';
const BASE_URL = API_BASE ? `${API_BASE}/api` : '/api';

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
        if (!API_BASE) {
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
  if (!token && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register') && !endpoint.startsWith('/auth/demo')) {
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
    if (!API_BASE && (response.status === 502 || response.status === 503 || response.status === 504)) {
      throw new Error('VITE_PROXY_502');
    }
  } catch (netErr) {
    if (API_BASE) {
      throw new Error(`Connection failed. Backend API server at ${API_BASE} is unreachable.`);
    }
    // If proxy failed on local dev, retry directly against backend port 5000 (both 127.0.0.1 and localhost)
    try {
      response = await fetch(`http://127.0.0.1:5000/api${endpoint}`, config);
    } catch (e1) {
      try {
        response = await fetch(`http://localhost:5000/api${endpoint}`, config);
      } catch (directErr) {
        throw new Error('Backend server on port 5000 is unreachable or offline. Please make sure backend is running (run "npm run dev").');
      }
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
        throw new Error('Backend server unreachable (502 Bad Gateway). Please verify backend is running on port 5000.');
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
  getMe: () => request('/auth/me'),
  updateSettings: (payload) => {
    const body = (payload?.settings || payload?.name || payload?.dob || payload?.email || payload?.userId || payload?.tradingExperience)
      ? payload
      : { settings: payload };
    return request('/auth/settings', { method: 'PUT', body: JSON.stringify(body) });
  },

  // Trades
  getTrades: (params = {}) => {
    const query = new URLSearchParams(params).toString();
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

  // Health
  checkHealth: () => request('/health')
};
