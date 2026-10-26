const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Playbook = require('../models/Playbook');
const Goal = require('../models/Goal');
const OtpToken = require('../models/OtpToken');
const { generateOtp, sendOtp } = require('../services/otpService');

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
        avatar: user.avatar || '',
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

    if (!user) {
      await bcrypt.compare(password, '$2a$10$e8O6nB55N3l3sA7Hj2z79e5Z0u4U9i0k4W7y3Q5e7u1I3o5q7y9W2').catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid User ID or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
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
        avatar: user.avatar || '',
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
    const { settings, name, dob, email, userId, tradingExperience, avatar } = req.body;
    const updateFields = {};

    if (settings) {
      updateFields.settings = { ...req.user.settings, ...settings };
    }

    if (avatar !== undefined) {
      updateFields.avatar = typeof avatar === 'string' ? avatar.trim() : '';
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
        avatar: user.avatar || '',
        settings: user.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Social / OAuth Login (Google & Apple)
// @route   POST /api/auth/social
// @access  Public
const socialLogin = async (req, res, next) => {
  try {
    const { provider, name, email } = req.body;
    const providerKey = (provider || 'google').toLowerCase();
    const isApple = providerKey === 'apple';
    const providerName = isApple ? 'Apple' : 'Google';
    const defaultEmail = isApple ? 'trader.apple@tradejourn.com' : 'trader.google@tradejourn.com';
    const handle = isApple ? '@apple_trader' : '@google_trader';
    const userEmail = (email && email.trim()) ? email.trim().toLowerCase() : defaultEmail;

    let user = await User.findOne({
      $or: [{ email: userEmail }, { userId: handle }]
    });

    if (!user) {
      user = await User.create({
        name: name || `${providerName} Trader`,
        userId: handle,
        dob: '1998-06-20',
        tradingExperience: 'Intermediate',
        email: userEmail,
        password: 'SocialOAuth2026PasswordSecure!',
        role: 'pro'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
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
        avatar: user.avatar || '',
        settings: user.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate & send OTP for Forgot Password
// @route   POST /api/auth/forgot-password/send-otp
// @access  Public
const forgotPasswordSendOtp = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your registered User ID or Email' });
    }

    const clean = identifier.trim().toLowerCase();
    const withAt = clean.startsWith('@') ? clean : `@${clean}`;
    const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;

    const user = await User.findOne({
      $or: [
        { userId: withAt },
        { userId: withoutAt },
        { email: clean }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found matching this User ID or Email'
      });
    }

    // Generate secure 6-digit OTP
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    // Remove any previous active OTPs for this user
    await OtpToken.deleteMany({ userId: user._id });

    // Store in OtpToken with 10-minute expiry
    const destination = user.email || `${withoutAt}@tradejourn.local`;
    await OtpToken.create({
      userId: user._id,
      identifier: clean,
      channel: destination.includes('@') ? 'email' : 'sms',
      destination,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    // Send OTP via Twilio / Nodemailer / Dev Fallback
    const result = await sendOtp({
      destination,
      otp,
      userName: user.name || user.userId
    });

    res.json({
      success: true,
      message: `Verification code sent to ${result.maskedDestination}`,
      destination: result.maskedDestination,
      channel: result.channel,
      devOtp: result.devOtp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for Forgot Password
// @route   POST /api/auth/forgot-password/verify-otp
// @access  Public
const forgotPasswordVerifyOtp = async (req, res, next) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide both User ID/Email and the 6-digit OTP' });
    }

    const clean = identifier.trim().toLowerCase();
    const withAt = clean.startsWith('@') ? clean : `@${clean}`;
    const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;

    const user = await User.findOne({
      $or: [
        { userId: withAt },
        { userId: withoutAt },
        { email: clean }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const otpRecord = await OtpToken.findOne({
      userId: user._id,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired or was not requested. Please request a new code.'
      });
    }

    if (otpRecord.attempts >= 5) {
      await OtpToken.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. For security, please request a fresh code.'
      });
    }

    const isMatch = await bcrypt.compare(otp.trim(), otpRecord.otpHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // OTP matched! Generate one-time reset token valid for 15 minutes
    const resetToken = crypto.randomBytes(32).toString('hex');
    otpRecord.verified = true;
    otpRecord.resetToken = resetToken;
    otpRecord.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await otpRecord.save();

    res.json({
      success: true,
      message: 'Code verified successfully! You can now set a new password.',
      resetToken
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using verified reset token
// @route   POST /api/auth/forgot-password/reset-password
// @access  Public
const forgotPasswordReset = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide reset token and your new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const otpRecord = await OtpToken.findOne({
      resetToken,
      verified: true,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Password reset session has expired or is invalid. Please request a new verification code.'
      });
    }

    const user = await User.findById(otpRecord.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    // Consume & destroy the OTP token
    await OtpToken.deleteOne({ _id: otpRecord._id });

    res.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.',
      userId: user.userId
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
  demoLogin,
  socialLogin,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset
};

