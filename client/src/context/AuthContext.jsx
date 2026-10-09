import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tradejourn_token'));
  const [loading, setLoading] = useState(true);

  const initAuth = async (retryCount = 0) => {
    try {
      const existingToken = localStorage.getItem('tradejourn_token');
      if (existingToken) {
        const data = await api.getMe();
        setUser(data.user);
      } else {
        // No token present - show Authentication Gateway
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      // If server is temporarily booting up, retry once after a short delay before assuming invalid session
      if ((err.message?.includes('unreachable') || err.message?.includes('failed to fetch')) && retryCount < 2) {
        console.warn(`Backend connecting... Retrying auth check (attempt ${retryCount + 1})...`);
        setTimeout(() => initAuth(retryCount + 1), 1500);
        return;
      }

      if (err.status === 401 || err.status === 404 || err.message?.includes('token') || err.message?.includes('not found')) {
        console.warn('Session expired or user account not found:', err.message);
        localStorage.removeItem('tradejourn_token');
        setToken(null);
        setUser(null);
      } else {
        console.warn('Temporary connection issue, preserving session token:', err.message);
      }
    } finally {
      if (retryCount === 0 || !localStorage.getItem('tradejourn_token')) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    initAuth();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials) => {
    const data = await api.login(credentials);
    localStorage.setItem('tradejourn_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await api.register(userData);
    localStorage.setItem('tradejourn_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const switchDemo = async () => {
    setLoading(true);
    try {
      const data = await api.demoLogin();
      localStorage.setItem('tradejourn_token', data.token);
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('tradejourn_token');
    setToken(null);
    setUser(null);
  };

  const updateUserSettings = async (newSettings) => {
    const data = await api.updateSettings(newSettings);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        demoLogin: switchDemo,
        logout,
        updateUserSettings
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
