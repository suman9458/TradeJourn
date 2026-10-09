const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Playbook = require('../models/Playbook');
const Goal = require('../models/Goal');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'super_secret_trading_command_center_jwt_token_2026_secure',
    {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, userId, dob, tradingExperience, password, email } = req.body;

    if (!name || !userId || !password) {
      return res.status(400).json({ success: false, message: 'Please provide Name, User ID, and Password' });
    }

    if (!dob) {
      return res.status(400).json({ success: false, message: 'Please provide Date of Birth' });
    }

    const cleanRaw = userId.trim();
    // Validate English letters + numbers (optional leading @, 3-24 characters)
    if (!/^@?[a-zA-Z0-9_]{3,24}$/.test(cleanRaw)) {
      return res.status(400).json({
        success: false,
        message: 'User ID must contain 3-24 English letters and numbers (e.g. @suman9458)'
      });
    }

    const formattedUserId = cleanRaw.startsWith('@') ? cleanRaw.toLowerCase() : `@${cleanRaw.toLowerCase()}`;
    const cleanWithoutAt = formattedUserId.slice(1);

    // Check if user ID is already taken
    const userExists = await User.findOne({
      $or: [
        { userId: formattedUserId },
        { userId: cleanWithoutAt }
      ]
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: `User ID "${formattedUserId}" is already in use. Please choose another.`
      });
    }

    const userEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : `${cleanWithoutAt}@tradejourn.local`;

    const emailInUse = await User.findOne({ email: userEmail });
    if (emailInUse) {
      return res.status(400).json({ success: false, message: 'Account with this email already exists' });
    }

    const validExperience = ['Beginner', 'Intermediate', 'Expert'].includes(tradingExperience)
      ? tradingExperience
      : 'Intermediate';

    const user = await User.create({
      name: name.trim(),
      userId: formattedUserId,
      dob,
      tradingExperience: validExperience,
      email: userEmail,
      password
    });

    // Create default playbook & goals for the user
    await Playbook.create({ userId: user._id });
    await Goal.create({ userId: user._id });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        dob: user.dob,
        tradingExperience: user.tradingExperience,
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token (supports User ID or Email)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { userId, loginId, email, password } = req.body;
    const identifier = (userId || loginId || email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide your User ID and Password' });
    }

    const clean = identifier.toLowerCase();
    const withAt = clean.startsWith('@') ? clean : `@${clean}`;
    const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;

    const user = await User.findOne({
      $or: [
        { userId: withAt },
        { userId: withoutAt },
        { email: clean }
      ]
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid User ID or password' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId || withAt,
        dob: user.dob || '',
        tradingExperience: user.tradingExperience || 'Intermediate',
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile & settings
// @route   PUT /api/auth/settings
// @access  Private
const updateSettings = async (req, res, next) => {
  try {
    const { settings, name, dob, email, userId, tradingExperience } = req.body;
    const updateFields = {};

    if (settings) {
      updateFields.settings = { ...req.user.settings, ...settings };
    }

    if (name && name.trim()) {
      updateFields.name = name.trim();
    }

    if (dob !== undefined) {
      updateFields.dob = dob.trim();
    }

    if (tradingExperience) {
      updateFields.tradingExperience = tradingExperience;
    }

    if (email !== undefined && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      // Check if email is used by another user
      const existingEmail = await User.findOne({ email: cleanEmail, _id: { $ne: req.user.id } });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'This email is already associated with another account' });
      }
      updateFields.email = cleanEmail;
    }

    if (userId && userId.trim()) {
      const cleanUserId = userId.trim().toLowerCase();
      const withAt = cleanUserId.startsWith('@') ? cleanUserId : `@${cleanUserId}`;
      // Check if userId is taken by another user
      const existingUserId = await User.findOne({ userId: withAt, _id: { $ne: req.user.id } });
      if (existingUserId) {
        return res.status(400).json({ success: false, message: 'This User ID / Handle is already taken' });
      }
      updateFields.userId = withAt;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Instant Demo login for previewing data
// @route   POST /api/auth/demo
// @access  Public
const demoLogin = async (req, res, next) => {
  try {
    const demoEmail = 'protrader@tradejourn.com';
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      user = await User.create({
        name: 'Pro Trader (Demo)',
        userId: '@protrader',
        dob: '1996-01-15',
        tradingExperience: 'Expert',
        email: demoEmail,
        password: 'Password123!',
        role: 'pro'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
    } else if (!user.userId) {
      user.userId = '@protrader';
      user.dob = user.dob || '1996-01-15';
      user.tradingExperience = user.tradingExperience || 'Expert';
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        userId: user.userId,
        dob: user.dob,
        tradingExperience: user.tradingExperience,
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateSettings,
  demoLogin
};
