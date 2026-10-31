const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Playbook = require('../models/Playbook');
const Goal = require('../models/Goal');
const OtpToken = require('../models/OtpToken');
const { generateOtp, sendOtp } = require('../services/otpService');
const { verifyOAuthIdToken } = require('../services/oauthService');

const generateToken = (id, tokenVersion = 0) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable is not defined in production.');
    }
    return jwt.sign(
      { id, tokenVersion },
      'super_secret_trading_command_center_jwt_token_2026_secure',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }
  return jwt.sign(
    { id, tokenVersion },
    secret,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const { name, userId, dob, tradingExperience, password, email, phoneNumber, securityPin } = req.body;

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

    const cleanPin = (securityPin && typeof securityPin === 'string') ? securityPin.trim() : '';

    const user = await User.create({
      name: name.trim(),
      userId: formattedUserId,
      dob,
      tradingExperience: validExperience,
      email: userEmail,
      phoneNumber: (phoneNumber && typeof phoneNumber === 'string') ? phoneNumber.trim() : '',
      securityPin: cleanPin,
      password
    });

    // Create default playbook & goals for the user
    await Playbook.create({ userId: user._id });
    await Goal.create({ userId: user._id });

    const token = generateToken(user._id, user.tokenVersion || 0);

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
        phoneNumber: user.phoneNumber || '',
        role: user.role,
        avatar: user.avatar || '',
        settings: user.settings,
        hasSecurityPin: Boolean(cleanPin)
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
    }).select('+password +securityPin');

    if (!user) {
      await bcrypt.compare(password, '$2a$12$e8O6nB55N3l3sA7Hj2z79e5Z0u4U9i0k4W7y3Q5e7u1I3o5q7y9W2').catch(() => {});
      return res.status(401).json({ success: false, message: 'Invalid User ID or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid User ID or password' });
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

    const isDemo = user.role === 'demo' || user.isDemo || user.email === 'protrader@tradejourn.com' || user.userId === '@protrader' || (user.name && user.name.toLowerCase().includes('demo'));

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
        phoneNumber: user.phoneNumber || '',
        role: isDemo ? 'demo' : user.role,
        isDemo: Boolean(isDemo),
        avatar: user.avatar || '',
        settings: user.settings,
        hasSecurityPin: Boolean(user.securityPin)
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
    const user = await User.findById(req.user.id).select('+securityPin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isDemo = user.role === 'demo' || user.isDemo || user.email === 'protrader@tradejourn.com' || user.userId === '@protrader' || (user.name && user.name.toLowerCase().includes('demo'));
    const userObj = user.toObject();
    if (isDemo) {
      userObj.isDemo = true;
      userObj.role = 'demo';
    }
    userObj.hasSecurityPin = Boolean(user.securityPin);
    delete userObj.securityPin;
    res.json({
      success: true,
      user: userObj
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
    const { settings, name, dob, email, phoneNumber, userId, tradingExperience, avatar, password, securityPin } = req.body;
    const user = await User.findById(req.user.id).select('+securityPin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (settings) {
      user.settings = { ...user.settings, ...settings };
    }

    if (avatar !== undefined) {
      user.avatar = typeof avatar === 'string' ? avatar.trim() : '';
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (dob !== undefined) {
      user.dob = dob.trim();
    }

    if (tradingExperience) {
      user.tradingExperience = tradingExperience;
    }

    if (email !== undefined && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      // Check if email is used by another user
      const existingEmail = await User.findOne({ email: cleanEmail, _id: { $ne: req.user.id } });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'This email is already associated with another account' });
      }
      user.email = cleanEmail;
    }

    if (phoneNumber !== undefined) {
      user.phoneNumber = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
    }

    if (securityPin !== undefined && securityPin !== null && securityPin !== '') {
      const cleanPin = securityPin.toString().trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return res.status(400).json({ success: false, message: 'Security PIN must be exactly 4 digits (e.g. 1234)' });
      }
      user.securityPin = cleanPin;
    }

    if (userId && userId.trim()) {
      const cleanUserId = userId.trim().toLowerCase();
      const withAt = cleanUserId.startsWith('@') ? cleanUserId : `@${cleanUserId}`;
      // Check if userId is taken by another user
      const existingUserId = await User.findOne({ userId: withAt, _id: { $ne: req.user.id } });
      if (existingUserId) {
        return res.status(400).json({ success: false, message: 'This User ID / Handle is already taken' });
      }
      user.userId = withAt;
    }

    const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
    if (!isDemo && password && password.trim()) {
      if (password.trim().length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
      }
      user.password = password.trim(); // Will be hashed by pre-save hook with 12 rounds
      user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all previous sessions
    }

    await user.save();

    const userObj = user.toObject();
    userObj.hasSecurityPin = Boolean(user.securityPin);
    delete userObj.securityPin;

    res.json({
      success: true,
      user: userObj
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
        role: 'demo'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
    } else if (!user.userId) {
      user.userId = '@protrader';
      user.dob = user.dob || '1996-01-15';
      user.tradingExperience = user.tradingExperience || 'Expert';
      await user.save();
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

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
        phoneNumber: user.phoneNumber || '',
        role: 'demo',
        isDemo: true,
        avatar: user.avatar || '',
        settings: user.settings,
        hasSecurityPin: true
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
    const { provider, idToken } = req.body;

    if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Missing required OAuth idToken parameter.'
      });
    }

    // SEC-02 Hardening: Cryptographically verify the OAuth token server-side (signature, audience, issuer, exp)
    // Enforced across ALL environments (dev, test, staging, production)
    let verifiedProfile;
    try {
      verifiedProfile = await verifyOAuthIdToken({ provider, idToken });
    } catch (verifErr) {
      return res.status(401).json({
        success: false,
        message: `OAuth authentication failed: ${verifErr.message}`
      });
    }

    const { email: verifiedEmail, name: verifiedName, sub } = verifiedProfile;

    // Securely find user by cryptographically verified email
    let user = await User.findOne({ email: verifiedEmail }).select('+securityPin');

    if (!user) {
      const providerTag = (provider || 'google').toLowerCase();
      const generatedHandle = `@${providerTag}_${(sub || crypto.randomBytes(4).toString('hex')).slice(-6)}`;
      const secureRandomPassword = crypto.randomBytes(32).toString('hex') + 'Aa1!';

      user = await User.create({
        name: verifiedName,
        userId: generatedHandle,
        dob: '2000-01-01',
        tradingExperience: 'Intermediate',
        email: verifiedEmail,
        password: secureRandomPassword,
        role: 'pro'
      });
      await Playbook.create({ userId: user._id });
      await Goal.create({ userId: user._id });
    }

    const token = generateToken(user._id, user.tokenVersion || 0);

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
        phoneNumber: user.phoneNumber || '',
        role: user.role,
        avatar: user.avatar || '',
        settings: user.settings,
        hasSecurityPin: Boolean(user.securityPin)
      }
    });
  } catch (error) {
    next(error);
  }
};

// In-memory sliding window rate-limiter per identifier to prevent OTP bombing and SMS cost abuse
const otpRequestTracker = new Map();

const checkIdentifierOtpLimit = (targetIdentifier) => {
  const now = Date.now();
  const history = (otpRequestTracker.get(targetIdentifier) || []).filter(
    (ts) => now - ts < 15 * 60 * 1000 // 15-minute rolling window
  );

  // 1. Enforce 10-minute (600 seconds) cooldown between consecutive requests
  if (history.length > 0) {
    const lastRequest = history[history.length - 1];
    const elapsedSec = Math.floor((now - lastRequest) / 1000);
    if (elapsedSec < 600) {
      const remainingSec = 600 - elapsedSec;
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      return {
        allowed: false,
        message: `Please wait ${timeStr} before requesting another verification code.`
      };
    }
  }

  // 2. Enforce maximum 3 OTP requests per 15 minutes per phone/email identifier
  if (history.length >= 3) {
    return {
      allowed: false,
      message: 'Maximum OTP requests exceeded for this account. Please try again after 15 minutes.'
    };
  }

  history.push(now);
  otpRequestTracker.set(targetIdentifier, history);
  return { allowed: true };
};

// @desc    Generate & send OTP for Forgot Password
// @route   POST /api/auth/forgot-password/send-otp
// @access  Public
const forgotPasswordSendOtp = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your registered User ID, Email, or Phone Number' });
    }

    const clean = identifier.trim().toLowerCase();
    const withAt = clean.startsWith('@') ? clean : `@${clean}`;
    const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;
    const cleanDigits = clean.replace(/[^0-9+]/g, '');
    const lastDigits = clean.replace(/[^0-9]/g, '').slice(-10);

    const user = await User.findOne({
      $or: [
        { userId: withAt },
        { userId: withoutAt },
        { email: clean },
        ...(cleanDigits.length >= 7 ? [
          { phoneNumber: cleanDigits },
          { phoneNumber: clean },
          { phoneNumber: cleanDigits.replace(/^\+/, '') },
          { phoneNumber: `+${cleanDigits.replace(/^\+/, '')}` },
          ...(lastDigits.length >= 7 ? [{ phoneNumber: { $regex: `${lastDigits}$` } }] : [])
        ] : [])
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found matching this User ID, Email, or Phone Number'
      });
    }

    // SEC-DEMO: Shared demo account password cannot be reset
    const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
    if (isDemo) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_READ_ONLY',
        message: 'Password reset is disabled for the public demonstration account.'
      });
    }

    // Determine destination and preferred channel
    const isPhoneQuery = /^[+]?[0-9\s\-()]{7,18}$/.test(identifier.trim());
    let destination = '';
    let preferredChannel = 'email';

    if (isPhoneQuery && user.phoneNumber) {
      destination = user.phoneNumber;
      preferredChannel = 'sms';
    } else if (user.phoneNumber && !user.email) {
      destination = user.phoneNumber;
      preferredChannel = 'sms';
    } else if (user.email) {
      destination = user.email;
      preferredChannel = 'email';
    } else if (user.phoneNumber) {
      destination = user.phoneNumber;
      preferredChannel = 'sms';
    } else {
      destination = `${withoutAt}@tradejourn.local`;
      preferredChannel = 'email';
    }

    // SEC-OTP: Enforce per-identifier rate limiting & cooldown to prevent OTP bombing and SMS toll fraud
    const rateCheck = checkIdentifierOtpLimit(destination.toLowerCase());
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        code: 'OTP_RATE_LIMITED',
        message: rateCheck.message
      });
    }

    // Generate secure 6-digit OTP
    const otp = generateOtp();
    const salt = await bcrypt.genSalt(12);
    const otpHash = await bcrypt.hash(otp, salt);

    // Remove any previous active OTPs for this user
    await OtpToken.deleteMany({ userId: user._id });

    // Store in OtpToken with 10-minute expiry
    await OtpToken.create({
      userId: user._id,
      identifier: clean,
      channel: preferredChannel,
      destination,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    // Send OTP via Twilio / Nodemailer / Dev Fallback
    const result = await sendOtp({
      destination,
      otp,
      userName: user.name || user.userId,
      preferredChannel
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
      return res.status(400).json({ success: false, message: 'Please provide both User ID/Email/Phone and the 6-digit OTP' });
    }

    const clean = identifier.trim().toLowerCase();
    const withAt = clean.startsWith('@') ? clean : `@${clean}`;
    const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;
    const cleanDigits = clean.replace(/[^0-9+]/g, '');
    const lastDigits = clean.replace(/[^0-9]/g, '').slice(-10);

    const user = await User.findOne({
      $or: [
        { userId: withAt },
        { userId: withoutAt },
        { email: clean },
        ...(cleanDigits.length >= 7 ? [
          { phoneNumber: cleanDigits },
          { phoneNumber: clean },
          { phoneNumber: cleanDigits.replace(/^\+/, '') },
          { phoneNumber: `+${cleanDigits.replace(/^\+/, '')}` },
          ...(lastDigits.length >= 7 ? [{ phoneNumber: { $regex: `${lastDigits}$` } }] : [])
        ] : [])
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

    // SEC-DEMO: Shared demo account password cannot be reset
    const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
    if (isDemo) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_READ_ONLY',
        message: 'Password reset is disabled for the public demonstration account.'
      });
    }

    // Set new password (pre-save hook will hash it with 12 rounds)
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior sessions on password reset
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

// @desc    Reset password directly using 4-digit Security PIN
// @route   POST /api/auth/forgot-password/reset-with-pin
// @access  Public
const forgotPasswordResetWithPin = async (req, res, next) => {
  try {
    const { identifier, securityPin, newPassword } = req.body;
    if (!identifier || !securityPin || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, 4-digit security PIN, and new password are required.'
      });
    }

    const cleanPin = securityPin.toString().trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return res.status(400).json({
        success: false,
        message: 'Security PIN must be exactly 4 digits (e.g. 1234).'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long.'
      });
    }

    const cleanIdent = identifier.trim().toLowerCase();
    const withAt = cleanIdent.startsWith('@') ? cleanIdent : `@${cleanIdent}`;
    const withoutAt = cleanIdent.startsWith('@') ? cleanIdent.slice(1) : cleanIdent;
    const cleanDigits = identifier.replace(/[^0-9+]/g, '');

    const queryOr = [
      { userId: withAt },
      { userId: withoutAt },
      { email: cleanIdent }
    ];
    if (cleanDigits.length >= 7) {
      queryOr.push(
        { phoneNumber: cleanDigits },
        { phoneNumber: `+${cleanDigits.replace(/^\+/, '')}` },
        { phoneNumber: cleanDigits.replace(/^\+/, '') }
      );
    }

    const user = await User.findOne({ $or: queryOr }).select('+password +securityPin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No trader account found with this User ID, Email, or Mobile Number.'
      });
    }

    // SEC-DEMO: Shared demo account password cannot be reset
    const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
    if (isDemo) {
      return res.status(403).json({
        success: false,
        code: 'DEMO_READ_ONLY',
        message: 'Password reset is disabled for the public demonstration account.'
      });
    }

    if (!user.securityPin) {
      return res.status(400).json({
        success: false,
        code: 'NO_PIN_CONFIGURED',
        message: 'No 4-digit Security PIN has been configured for this account. Please use OTP verification or contact support.'
      });
    }

    // Brute-force lockout protection (15 minutes after 5 failed attempts)
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.pinLockedUntil - new Date()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many incorrect PIN attempts. Security PIN recovery is locked for ${waitMinutes} more minute${waitMinutes === 1 ? '' : 's'}.`
      });
    }

    const isMatch = await user.comparePin(cleanPin);
    if (!isMatch) {
      user.pinAttempts = (user.pinAttempts || 0) + 1;
      if (user.pinAttempts >= 5) {
        user.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.pinAttempts = 0;
        await user.save();
        return res.status(429).json({
          success: false,
          message: 'Too many incorrect PIN attempts. Your account PIN recovery is locked for 15 minutes.'
        });
      }
      await user.save();
      const remaining = 5 - user.pinAttempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect 4-digit Security PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // PIN matched! Reset attempts and update password
    user.pinAttempts = 0;
    user.pinLockedUntil = null;
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful using 4-digit Security PIN! You can now log in with your new password.',
      userId: user.userId
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user and invalidate active session tokens
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      const isDemo = req.user.isDemo || req.user.role === 'demo' || req.user.email === 'protrader@tradejourn.com';
      if (!isDemo) {
        await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
      }
    }
    res.json({
      success: true,
      message: 'Logged out successfully. Active sessions invalidated.'
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
  logoutUser,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  forgotPasswordResetWithPin
};

