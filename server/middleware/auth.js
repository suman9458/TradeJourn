const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable is not defined in production.');
    }
    return 'super_secret_trading_command_center_jwt_token_2026_secure';
  }
  return secret;
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      if (!token || token.trim() === '' || token === 'null' || token === 'undefined') {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid token format' });
      }

      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found with this token' });
      }

      // SEC-TOKEN: Strictly reject tokens with missing, null, or non-numeric tokenVersion
      if (decoded.tokenVersion === undefined || decoded.tokenVersion === null || typeof decoded.tokenVersion !== 'number') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_INVALIDATED',
          message: 'Token is missing tokenVersion. Please sign in again.'
        });
      }

      // Validate tokenVersion against database user record to enforce immediate revocation on logout or password change
      const userVersion = user.tokenVersion !== undefined ? user.tokenVersion : 0;
      if (decoded.tokenVersion !== userVersion) {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_INVALIDATED',
          message: 'Session has been invalidated due to password change or logout. Please sign in again.'
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
    }
  }

  return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
};

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 * @param  {...string} roles - e.g. 'admin', 'pro', 'user'
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, no authenticated user found' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`
      });
    }
    next();
  };
};

/**
 * Prevents demo/guest accounts from modifying shared demonstration data.
 */
const preventDemoModification = (req, res, next) => {
  const isDemoUser = req.user?.isDemo ||
    req.user?.role === 'demo' ||
    req.user?.email === 'protrader@tradejourn.com';

  if (isDemoUser) {
    return res.status(403).json({
      success: false,
      code: 'DEMO_READ_ONLY',
      message: 'The shared demonstration account is read-only. Please create a free account to log, edit, or delete trades.'
    });
  }
  next();
};

module.exports = { protect, authorize, preventDemoModification, getJwtSecret };
