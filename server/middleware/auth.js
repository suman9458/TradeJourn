const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'super_secret_trading_command_center_jwt_token_2026_secure'
      );

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found with this token' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.warn('JWT verification failed, falling back to demo user:', error.message);
      const demoUser = await User.findOne({ email: 'protrader@tradejourn.com' });
      if (demoUser) {
        req.user = demoUser;
        return next();
      }
      return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' });
    }
  }

  if (!token) {
    // Graceful fallback for initial guest / demo usage
    try {
      let demoUser = await User.findOne({ email: 'protrader@tradejourn.com' });
      if (!demoUser) {
        demoUser = await User.create({
          name: 'Pro Trader (Demo)',
          email: 'protrader@tradejourn.com',
          password: 'Password123!',
          role: 'pro'
        });
      }
      req.user = demoUser;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }
  }
};

module.exports = { protect };
