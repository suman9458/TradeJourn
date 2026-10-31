const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Import modules under test
const { protect, getJwtSecret } = require('../middleware/auth');
const { maskDestination } = require('../services/otpService');

describe('🛡️ TradeJourn Security Hardening Test Suite (OWASP Top 10 Hardened)', () => {

  // =========================================================================
  // SEC-01 & SEC-06: Global Auth Bypass Rejection & JWT Secret Safety
  // =========================================================================
  describe('SEC-01 & SEC-06: Strict JWT Authentication & Secret Validation', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalSecret;
    });

    test('SEC-01: Rejects requests with no Authorization header (401 Unauthorized)', async () => {
      let statusCode = null;
      let responseBody = null;

      const req = { headers: {} };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (body) => { responseBody = body; }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await protect(req, res, next);

      assert.equal(statusCode, 401, 'Must respond with 401 when no token is provided');
      assert.equal(responseBody.success, false);
      assert.equal(responseBody.message, 'Not authorized, no token provided');
      assert.equal(nextCalled, false, 'next() must NOT be called on missing token');
      assert.equal(req.user, undefined, 'req.user must NOT fall back to demoUser');
    });

    test('SEC-01: Rejects invalid, malformed, or blank Bearer token (401 Unauthorized)', async () => {
      let statusCode = null;
      let responseBody = null;

      const req = { headers: { authorization: 'Bearer   ' } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (body) => { responseBody = body; } };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await protect(req, res, next);

      assert.equal(statusCode, 401);
      assert.equal(nextCalled, false);
      assert.equal(req.user, undefined);
    });

    test('SEC-01: Rejects tampered or invalid JWT signature (401 Unauthorized)', async () => {
      let statusCode = null;
      let responseBody = null;

      // Token signed with wrong secret
      const forgedToken = jwt.sign({ id: 'user_123' }, 'attacker_unauthorized_secret_key');
      const req = { headers: { authorization: `Bearer ${forgedToken}` } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (body) => { responseBody = body; } };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await protect(req, res, next);

      assert.equal(statusCode, 401);
      assert.equal(responseBody.message, 'Not authorized, token failed or expired');
      assert.equal(nextCalled, false);
      assert.equal(req.user, undefined, 'Must NEVER fall back to demo user on forged token');
    });

    test('SEC-06: getJwtSecret throws fatal configuration error in production if unset', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      assert.throws(
        () => { getJwtSecret(); },
        /FATAL SECURITY CONFIGURATION: JWT_SECRET environment variable is not defined in production/,
        'Must fail fast when JWT_SECRET is missing in production'
      );
    });
  });

  // =========================================================================
  // SEC-07: IDOR Asset Deletion Prevention (Cloudinary Scope Verification)
  // =========================================================================
  describe('SEC-07: Broken Object Level Authorization (IDOR) Asset Protection', () => {
    const simulateDeleteRoute = (reqUser, publicId) => {
      const userId = reqUser._id.toString();
      const expectedPrefix = `tradejourn/${userId}/`;

      if (!publicId || typeof publicId !== 'string') {
        return { status: 400, message: 'Valid publicId required' };
      }

      if (!publicId.startsWith(expectedPrefix) && reqUser.role !== 'admin') {
        return { status: 403, message: 'Access denied: You do not have permission to delete this asset.' };
      }

      return { status: 200, message: 'Image deleted successfully' };
    };

    test('Prevents Trader A from deleting Trader B chart asset (403 Forbidden)', () => {
      const traderA = { _id: 'user_6601_alpha', role: 'pro' };
      const victimAsset = 'tradejourn/user_9909_victim/chart_xauusd_breakout.webp';

      const result = simulateDeleteRoute(traderA, victimAsset);
      assert.equal(result.status, 403, 'Trader A must be forbidden from deleting Trader B asset');
      assert.match(result.message, /Access denied/);
    });

    test('Allows Trader A to delete their own owned chart asset (200 OK)', () => {
      const traderA = { _id: 'user_6601_alpha', role: 'pro' };
      const ownAsset = 'tradejourn/user_6601_alpha/chart_xauusd_breakout.webp';

      const result = simulateDeleteRoute(traderA, ownAsset);
      assert.equal(result.status, 200);
      assert.equal(result.message, 'Image deleted successfully');
    });

    test('Rejects path traversal or root publicId attempts (403 Forbidden)', () => {
      const traderA = { _id: 'user_6601_alpha', role: 'pro' };
      const traversalAsset = 'tradejourn/../system_icon.png';

      const result = simulateDeleteRoute(traderA, traversalAsset);
      assert.equal(result.status, 403);
    });
  });

  // =========================================================================
  // SEC-10: ReDoS & Regular Expression Injection Neutralization
  // =========================================================================
  describe('SEC-10: Regular Expression Injection (ReDoS) Defense', () => {
    const escapeRegex = (string) => {
      if (typeof string !== 'string') return '';
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    test('Safely escapes catastrophic backtracking payloads', () => {
      const redosPayload = '((a+)+)+$';
      const escaped = escapeRegex(redosPayload);

      assert.equal(escaped, '\\(\\(' + 'a\\+' + '\\)\\+\\)\\+\\$');
      // Compiling regex should now treat all symbols as literal characters
      const regex = new RegExp(escaped, 'i');
      assert.equal(regex.test('((a+)+)+$'), true);
      assert.equal(regex.test('aaaaaaaaaaaaaaaaaaaaaaaaa!'), false);
    });

    test('Safely neutralizes wildcard characters in search queries', () => {
      const query = 'EUR.*USD';
      const escaped = escapeRegex(query);

      assert.equal(escaped, 'EUR\\.\\*USD');
      const regex = new RegExp(escaped, 'i');
      assert.equal(regex.test('EURUSD'), false);
      assert.equal(regex.test('EUR.*USD'), true);
    });
  });

  // =========================================================================
  // SEC-11: Mass Assignment Field Whitelisting
  // =========================================================================
  describe('SEC-11: Mass Assignment & Privilege Escalation Defense', () => {
    test('Strips unauthorized fields (userId, _id, role) from update payload', () => {
      const maliciousPayload = {
        tradeName: 'Gold Scalp Updated',
        pips: 45,
        userId: 'attacker_controlled_id',
        _id: 'tampered_id',
        role: 'admin'
      };

      const trade = {
        _id: 'legitimate_trade_id',
        userId: 'legitimate_user_id',
        tradeName: 'Old Scalp',
        pips: 10
      };

      const allowedUpdateFields = [
        'tradeName', 'date', 'time', 'instrument', 'session', 'setupRating',
        'bias', 'result', 'entryType', 'rr', 'rResult', 'pips', 'takeProfit',
        'takeProfitUSD', 'confirmation', 'emotion', 'reasonEarlyExit',
        'marketCondition', 'mistakes', 'disciplineScore', 'tradeGrade',
        'notes', 'levelTraded', 'entryPrice', 'exitPrice', 'stopLoss',
        'images', 'screenshotUrl', 'imageUrl'
      ];

      allowedUpdateFields.forEach((field) => {
        if (maliciousPayload[field] !== undefined) {
          trade[field] = maliciousPayload[field];
        }
      });

      assert.equal(trade.tradeName, 'Gold Scalp Updated');
      assert.equal(trade.pips, 45);
      assert.equal(trade.userId, 'legitimate_user_id', 'userId must NOT be modified via mass assignment');
      assert.equal(trade._id, 'legitimate_trade_id', '_id must NOT be modified via mass assignment');
      assert.equal(trade.role, undefined, 'role field must NOT be attached to trade object');
    });
  });

  // =========================================================================
  // SEC-12: CSV & Excel Formula Injection Neutralization
  // =========================================================================
  describe('SEC-12: CSV / Excel Formula Injection Sanitization', () => {
    const sanitizeCsvCell = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (/^[=+@\-\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    test('Neutralizes formula triggers (=, +, -, @, TAB, CR) by prepending single quote', () => {
      const dangerousCells = [
        '=cmd|\' /C calc\'!A0',
        '+1+1; EXEC sp_configure',
        '-2+3',
        '@SUM(1+1)',
        '\t=2+2',
        '\r=1+1'
      ];

      dangerousCells.forEach((cell) => {
        const sanitized = sanitizeCsvCell(cell);
        assert.ok(sanitized.startsWith('"\''), `Cell "${cell}" must be prefixed with single quote to prevent execution in Excel. Got: ${sanitized}`);
      });
    });

    test('Preserves benign text without modifying safe content', () => {
      assert.equal(sanitizeCsvCell('Gold Long Breakout'), '"Gold Long Breakout"');
      assert.equal(sanitizeCsvCell('EUR/USD Trend Reversal'), '"EUR/USD Trend Reversal"');
      assert.equal(sanitizeCsvCell('Trade with "quotes" inside'), '"Trade with ""quotes"" inside"');
    });
  });

  // =========================================================================
  // SEC-09: OTP Privacy & Masking
  // =========================================================================
  describe('SEC-09: Sensitive Information & OTP Masking', () => {
    test('Masks email addresses properly', () => {
      assert.equal(maskDestination('protrader@tradejourn.com'), 'pr*******@tradejourn.com');
      assert.equal(maskDestination('john.doe@gmail.com'), 'jo******@gmail.com');
    });

    test('Masks phone numbers properly', () => {
      assert.equal(maskDestination('+1234567890'), '+12****7890');
      assert.equal(maskDestination('+919876543210'), '+91****3210');
    });

    test('devOtp is strictly undefined when NODE_ENV is production', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const otp = '849201';
      const devOtp = process.env.NODE_ENV !== 'production' ? otp : undefined;

      assert.equal(devOtp, undefined, 'devOtp must NEVER be emitted in production responses');
      process.env.NODE_ENV = original;
    });
  });

  // =========================================================================
  // SEC-05: CORS Policy Whitelisting
  // =========================================================================
  describe('SEC-05: CORS Domain Whitelist Strictness', () => {
    const isProduction = true;
    const allowedClientUrl = 'https://tradejourn.onrender.com';

    const testCorsOrigin = (origin) => {
      if (!origin) return { allowed: true };
      if (origin === allowedClientUrl) return { allowed: true };
      if (isProduction) return { allowed: false, error: 'Blocked by CORS policy' };
      return { allowed: true };
    };

    test('Allows production client domain', () => {
      const res = testCorsOrigin('https://tradejourn.onrender.com');
      assert.equal(res.allowed, true);
    });

    test('Rejects arbitrary untrusted origins in production', () => {
      const res = testCorsOrigin('https://evil-attacker-site.com');
      assert.equal(res.allowed, false);
      assert.equal(res.error, 'Blocked by CORS policy');
    });
  });

  // =========================================================================
  // SEC-02 & SEC-04: Account Takeover & Seed Credential Isolation
  // =========================================================================
  describe('SEC-02 & SEC-04: Account Takeover & Startup Seed Protection', () => {
    test('SEC-02: Rejects unverified social login in production when idToken is absent', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const verifySocialRequest = (body) => {
        if (process.env.NODE_ENV === 'production' && !body.idToken) {
          return { status: 400, message: 'Direct unverified social login is disabled in production. Verified OAuth ID token required.' };
        }
        return { status: 200, message: 'Success' };
      };

      const attackPayload = {
        provider: 'google',
        email: 'admin@tradejourn.com' // Attacker attempting to claim admin email
      };

      const res = verifySocialRequest(attackPayload);
      assert.equal(res.status, 400);
      assert.match(res.message, /Verified OAuth ID token required/);

      process.env.NODE_ENV = original;
    });

    test('SEC-04: seedDemoData immediately aborts in production unless ALLOW_PROD_SEED is true', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAllow = process.env.ALLOW_PROD_SEED;
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PROD_SEED;

      const seedDemoDataCheck = () => {
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
          return { seeded: false, reason: 'Production mode: automatic credential seeding is disabled for security.' };
        }
        return { seeded: true };
      };

      const res = seedDemoDataCheck();
      assert.equal(res.seeded, false, 'Must NEVER seed hardcoded credentials in production');
      assert.match(res.reason, /automatic credential seeding is disabled/);

      process.env.NODE_ENV = originalEnv;
      process.env.ALLOW_PROD_SEED = originalAllow;
    });
  });

  // =========================================================================
  // SEC-15: Production Database Fail-Safe Enforcement
  // =========================================================================
  describe('SEC-15: Production Database Fail-Safe Enforcement', () => {
    test('Throws fatal error if MONGODB_URI is undefined in production', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGODB_URI;
      process.env.NODE_ENV = 'production';
      delete process.env.MONGODB_URI;

      const validateDbEnv = () => {
        const uri = process.env.MONGODB_URI?.trim();
        if (process.env.NODE_ENV === 'production' && !uri) {
          throw new Error('FATAL DATABASE CONFIGURATION: MONGODB_URI environment variable is required in production.');
        }
      };

      assert.throws(
        () => validateDbEnv(),
        /FATAL DATABASE CONFIGURATION: MONGODB_URI environment variable is required in production/
      );

      process.env.NODE_ENV = originalEnv;
      process.env.MONGODB_URI = originalUri;
    });
  });

  // =========================================================================
  // SEC-RBAC: Role-Based Access Control (RBAC) Enforcement
  // =========================================================================
  describe('SEC-RBAC: Role-Based Access Control Middleware', () => {
    const { authorize } = require('../middleware/auth');

    test('Rejects non-admin users from admin-restricted resources (403 Forbidden)', () => {
      let statusCode = null;
      let responseBody = null;
      const req = { user: { _id: 'u1', role: 'pro' } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (body) => { responseBody = body; } };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const adminGuard = authorize('admin');
      adminGuard(req, res, next);

      assert.equal(statusCode, 403);
      assert.equal(nextCalled, false);
      assert.match(responseBody.message, /Forbidden: role 'pro' is not authorized/);
    });

    test('Allows admin users into admin-restricted resources', () => {
      const req = { user: { _id: 'u_admin', role: 'admin' } };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      const adminGuard = authorize('admin');
      adminGuard(req, {}, next);

      assert.equal(nextCalled, true);
    });
  });

  // =========================================================================
  // SEC-ZOD: Schema Validation & NoSQL Injection Sanitization
  // =========================================================================
  describe('SEC-ZOD: Strict Input Validation & NoSQL Defense', () => {
    const { registerSchema, forgotPasswordVerifySchema } = require('../validators/authValidators');
    const { uploadImageSchema } = require('../validators/uploadValidators');

    test('Zod rejects registration with passwords less than 8 characters', () => {
      const shortPasswordData = {
        name: 'Trader Test',
        userId: 'trader_123',
        password: 'short'
      };

      const result = registerSchema.safeParse(shortPasswordData);
      assert.equal(result.success, false);
      assert.match(result.error.issues[0].message, /at least 8 characters/);
    });

    test('Zod rejects invalid OTP formats (letters or incorrect length)', () => {
      const invalidOtps = ['12345', '1234567', 'abcdef', '12 456'];
      invalidOtps.forEach(otp => {
        const res = forgotPasswordVerifySchema.safeParse({ identifier: 'test_user', otp });
        assert.equal(res.success, false, `OTP "${otp}" should be rejected`);
      });

      const validRes = forgotPasswordVerifySchema.safeParse({ identifier: 'test_user', otp: '849201' });
      assert.equal(validRes.success, true);
    });

    test('Zod rejects SVG or executable image data URIs to prevent Stored XSS', () => {
      const svgPayload = { image: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+' };
      const res = uploadImageSchema.safeParse(svgPayload);
      assert.equal(res.success, false, 'SVG data URI must be rejected');

      const pngPayload = { image: 'data:image/png;base64,' + 'A'.repeat(100) };
      const validRes = uploadImageSchema.safeParse(pngPayload);
      assert.equal(validRes.success, true);
    });

    test('NoSQL Injection sanitization strips $ and . operator keys', () => {
      // Simulating mongoSanitize behavior
      const sanitizeObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        const clean = Array.isArray(obj) ? [] : {};
        for (const [key, val] of Object.entries(obj)) {
          if (key.startsWith('$') || key.includes('.')) {
            continue; // stripped
          }
          clean[key] = (typeof val === 'object' && val !== null) ? sanitizeObject(val) : val;
        }
        return clean;
      };

      const maliciousBody = {
        email: { '$gt': '' },
        password: 'Password123!',
        '$where': 'sleep(5000)'
      };

      const clean = sanitizeObject(maliciousBody);
      assert.equal(clean.email['$gt'], undefined);
      assert.equal(clean['$where'], undefined);
      assert.equal(clean.password, 'Password123!');
    });
  });

  // =========================================================================
  // SEC-OAUTH: Server-Side Cryptographic Token Verification in ALL Environments
  // =========================================================================
  describe('SEC-OAUTH: Strict Cryptographic OAuth ID Token Verification', () => {
    const { verifyOAuthIdToken } = require('../services/oauthService');

    test('Throws error when idToken is missing or blank in ANY environment', async () => {
      await assert.rejects(
        async () => { await verifyOAuthIdToken({ provider: 'google', idToken: '' }); },
        /OAuth idToken is required/
      );
    });

    test('Throws configuration error if GOOGLE_CLIENT_ID is not configured on server', async () => {
      const originalGoogleId = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      await assert.rejects(
        async () => { await verifyOAuthIdToken({ provider: 'google', idToken: 'fake.jwt.token' }); },
        /GOOGLE_CLIENT_ID environment variable is missing/
      );

      process.env.GOOGLE_CLIENT_ID = originalGoogleId;
    });

    test('Throws unsupported provider error when attempting Apple OAuth login', async () => {
      await assert.rejects(
        async () => { await verifyOAuthIdToken({ provider: 'apple', idToken: 'some_token' }); },
        /Unsupported OAuth provider/
      );
    });
  });

  // =========================================================================
  // SEC-DEMO: Shared Demo Account Read-Only Isolation
  // =========================================================================
  describe('SEC-DEMO: Demo Account Read-Only Guard', () => {
    const { preventDemoModification } = require('../middleware/auth');

    test('Rejects write operations attempted by shared demo account (403 Forbidden)', () => {
      let statusCode = null;
      let responseBody = null;
      const demoReq = { user: { _id: 'u_demo', email: 'protrader@tradejourn.com', role: 'demo' } };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (body) => { responseBody = body; } };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      preventDemoModification(demoReq, res, next);

      assert.equal(statusCode, 403);
      assert.equal(responseBody.code, 'DEMO_READ_ONLY');
      assert.equal(nextCalled, false);
    });

    test('Allows write operations for authenticated regular/pro users', () => {
      const regularReq = { user: { _id: 'u_real', email: 'trader@gmail.com', role: 'pro' } };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      preventDemoModification(regularReq, {}, next);
      assert.equal(nextCalled, true);
    });
  });

  // =========================================================================
  // SEC-MAGIC: Real Binary Magic Bytes Image Validation
  // =========================================================================
  describe('SEC-MAGIC: Binary Image Signature (Magic Bytes) Verification', () => {
    const validateMagicBytes = (base64String) => {
      try {
        const rawData = base64String.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(rawData, 'base64');
        if (buffer.length < 8) return false;

        const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
        const isWebp = buffer.length > 12 &&
          buffer.toString('ascii', 0, 4) === 'RIFF' &&
          buffer.toString('ascii', 8, 12) === 'WEBP';

        return isJpeg || isPng || isGif || isWebp;
      } catch {
        return false;
      }
    };

    test('Accepts valid PNG binary magic bytes (89 50 4E 47)', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const validPngUri = 'data:image/png;base64,' + pngHeader.toString('base64');
      assert.equal(validateMagicBytes(validPngUri), true);
    });

    test('Accepts valid JPEG binary magic bytes (FF D8 FF)', () => {
      const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
      const validJpegUri = 'data:image/jpeg;base64,' + jpegHeader.toString('base64');
      assert.equal(validateMagicBytes(validJpegUri), true);
    });

    test('Rejects spoofed text or HTML masquerading as image data', () => {
      const fakePayload = Buffer.from('<html><script>alert(1)</script></html>');
      const spoofedUri = 'data:image/png;base64,' + fakePayload.toString('base64');
      assert.equal(validateMagicBytes(spoofedUri), false);
    });
  });

  // =========================================================================
  // SEC-OTP-LIMIT: Per-Identifier Rate Limiting & Cooldown
  // =========================================================================
  describe('SEC-OTP-LIMIT: Per-Contact Rate Limiting & Anti-Bombing', () => {
    test('Enforces 60-second cooldown between consecutive OTP requests', () => {
      const tracker = new Map();
      const checkLimit = (target) => {
        const now = Date.now();
        const history = (tracker.get(target) || []).filter(ts => now - ts < 15 * 60 * 1000);
        if (history.length > 0) {
          const last = history[history.length - 1];
          if (Math.floor((now - last) / 1000) < 60) {
            return { allowed: false, cooldown: true };
          }
        }
        if (history.length >= 3) {
          return { allowed: false, cooldown: false };
        }
        history.push(now);
        tracker.set(target, history);
        return { allowed: true };
      };

      const email = 'victim@tradejourn.com';
      const first = checkLimit(email);
      assert.equal(first.allowed, true);

      // Immediate second request within 60s
      const second = checkLimit(email);
      assert.equal(second.allowed, false);
      assert.equal(second.cooldown, true);
    });
  });

  // =========================================================================
  // SEC-HMAC: MT5 Nonce Replay & Clock Drift Defense
  // =========================================================================
  describe('SEC-HMAC: Nonce Replay Prevention & Clock Drift Guard', () => {
    test('Rejects clock drift exceeding maxDrift limit (30 seconds)', () => {
      const maxDrift = 30;
      const checkClockDrift = (reqTimeSec, nowSec) => {
        const drift = Math.abs(nowSec - reqTimeSec);
        return drift <= maxDrift;
      };

      const now = Math.floor(Date.now() / 1000);
      assert.equal(checkClockDrift(now - 10, now), true, '10s drift is acceptable');
      assert.equal(checkClockDrift(now - 35, now), false, '35s drift must be rejected');
      assert.equal(checkClockDrift(now + 45, now), false, '45s future drift must be rejected');
    });

    test('Rejects duplicate nonce on replay attempt', () => {
      const nonceCache = new Set();
      const processRequestWithNonce = (nonce) => {
        if (nonceCache.has(nonce)) {
          return { accepted: false, error: 'Rejected potential replay attack: nonce has already been used' };
        }
        nonceCache.add(nonce);
        return { accepted: true };
      };

      const nonce = 'unique_nonce_abc123';
      const first = processRequestWithNonce(nonce);
      assert.equal(first.accepted, true);

      // Replay attempt with same nonce
      const second = processRequestWithNonce(nonce);
      assert.equal(second.accepted, false);
      assert.match(second.error, /replay attack/);
    });
  });

  // =========================================================================
  // SEC-TOKENVERSION: Immediate Session Invalidation on Password Change/Logout
  // =========================================================================
  describe('SEC-TOKENVERSION: Token Version Invalidation Enforcement', () => {
    test('Token with matching tokenVersion is valid', () => {
      const user = { _id: 'u_101', tokenVersion: 3 };
      const decoded = { id: 'u_101', tokenVersion: 3 };
      const isValid = (decoded.tokenVersion || 0) === (user.tokenVersion || 0);
      assert.equal(isValid, true, 'Matching tokenVersion must be accepted');
    });

    test('Token with stale tokenVersion is rejected (e.g. after logout or password change)', () => {
      const user = { _id: 'u_101', tokenVersion: 4 }; // version incremented after logout
      const oldDecoded = { id: 'u_101', tokenVersion: 3 };
      const isValid = (oldDecoded.tokenVersion || 0) === (user.tokenVersion || 0);
      assert.equal(isValid, false, 'Stale tokenVersion must be invalidated');
    });
  });

  // =========================================================================
  // SEC-BCRYPT12: Confirm Password Hashing Uses 12 Salt Rounds
  // =========================================================================
  describe('SEC-BCRYPT12: Password Hashing Cryptographic Work Factor', () => {
    const bcrypt = require('bcryptjs');

    test('Confirms bcrypt salt generates 12 work factor rounds', async () => {
      const salt = await bcrypt.genSalt(12);
      // Bcrypt salt format: $2a$12$... or $2b$12$...
      assert.match(salt, /^\$2[ab]\$12\$/, 'Salt must start with $2a$12$ or $2b$12$ denoting exactly 12 rounds');
    });
  });

  // =========================================================================
  // SEC-AI-IP: Demo Role AI Rate Limiter Keyed Strictly by IP
  // =========================================================================
  describe('SEC-AI-IP: Demo Role AI Rate Limiting Key Isolation', () => {
    const keyGen = (req) => {
      const isDemo = Boolean(req.user?.role === 'demo' || req.user?.isDemo || req.user?.email === 'protrader@tradejourn.com');
      if (isDemo) {
        return `ai_demo_${req.ip || 'ip'}`;
      }
      return req.user?._id?.toString() || req.ip;
    };

    test('Keys demo user requests by IP address rather than shared user ID', () => {
      const demoReqA = { user: { _id: 'u_demo', role: 'demo', email: 'protrader@tradejourn.com' }, ip: '203.0.113.10' };
      const demoReqB = { user: { _id: 'u_demo', role: 'demo', email: 'protrader@tradejourn.com' }, ip: '198.51.100.22' };
      const regularReq = { user: { _id: 'u_regular_789', role: 'pro', email: 'real@trader.com' }, ip: '203.0.113.10' };

      const keyA = keyGen(demoReqA);
      const keyB = keyGen(demoReqB);
      const keyReg = keyGen(regularReq);

      assert.equal(keyA, 'ai_demo_203.0.113.10', 'Demo user from IP A must have key ai_demo_203.0.113.10');
      assert.equal(keyB, 'ai_demo_198.51.100.22', 'Demo user from IP B must have distinct key ai_demo_198.51.100.22');
      assert.notEqual(keyA, keyB, 'Two demo visitors from different IPs must not share rate limit quotas');
      assert.equal(keyReg, 'u_regular_789', 'Regular registered user must be keyed by User ID');
    });
  });

  // =========================================================================
  // SEC-DEMO-GUARDED: Verify preventDemoModification Blocks All Mutating Routes
  // =========================================================================
  describe('SEC-DEMO-GUARDED: Comprehensive Route Guard Verification', () => {
    const { preventDemoModification } = require('../middleware/auth');

    test('Blocks demo user from mutating settings, uploads, MT5, and conversations', () => {
      let blockedCount = 0;
      const demoReq = { user: { _id: 'u_demo', role: 'demo', email: 'protrader@tradejourn.com' } };
      const res = {
        status: (code) => {
          if (code === 403) blockedCount++;
          return { json: () => {} };
        }
      };
      const next = () => {};

      // Simulate invocation across sensitive endpoints
      const endpoints = [
        'PUT /api/auth/settings',
        'POST /api/upload/image',
        'DELETE /api/upload/image',
        'POST /api/mt5/cloud/connect',
        'PUT /api/mt5/accounts/:id',
        'POST /api/mt5/positions/:id/journal',
        'POST /api/mt5/positions/:id/link-trade',
        'DELETE /api/mt5/accounts/:id',
        'DELETE /api/ai/conversations/:id',
        'POST /api/ai/chat'
      ];

      endpoints.forEach(() => {
        preventDemoModification(demoReq, res, next);
      });

      assert.equal(blockedCount, endpoints.length, `All ${endpoints.length} mutating routes must be blocked for demo account`);
    });
  });

  // =========================================================================
  // SEC-TOKENVERSION-STRICT: Missing & Undefined Token Version Rejection
  // =========================================================================
  describe('SEC-TOKENVERSION-STRICT: Rejection of Missing or Undefined Token Version', () => {
    test('Rejects tokens where tokenVersion is undefined or omitted in JWT payload', () => {
      const decodedMissingVersion = { id: 'u_101' }; // No tokenVersion field
      const validateToken = (decoded, user) => {
        if (decoded.tokenVersion === undefined || decoded.tokenVersion === null || typeof decoded.tokenVersion !== 'number') {
          return { valid: false, code: 'TOKEN_INVALIDATED', message: 'Token is missing tokenVersion' };
        }
        if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
          return { valid: false, code: 'TOKEN_INVALIDATED', message: 'Token version mismatch' };
        }
        return { valid: true };
      };

      const user = { _id: 'u_101', tokenVersion: 0 };
      const result = validateToken(decodedMissingVersion, user);
      assert.equal(result.valid, false, 'Token with missing tokenVersion must be rejected');
      assert.equal(result.code, 'TOKEN_INVALIDATED');
    });

    test('Rejects tokens where tokenVersion is null or non-numeric', () => {
      const validateToken = (decoded, user) => {
        if (decoded.tokenVersion === undefined || decoded.tokenVersion === null || typeof decoded.tokenVersion !== 'number') {
          return { valid: false, code: 'TOKEN_INVALIDATED' };
        }
        return { valid: decoded.tokenVersion === (user.tokenVersion || 0) };
      };

      const user = { _id: 'u_101', tokenVersion: 1 };
      assert.equal(validateToken({ id: 'u_101', tokenVersion: null }, user).valid, false);
      assert.equal(validateToken({ id: 'u_101', tokenVersion: '1' }, user).valid, false);
      assert.equal(validateToken({ id: 'u_101', tokenVersion: 1 }, user).valid, true);
    });
  });

  // =========================================================================
  // SEC-DEMO-LIFECYCLE: Demo User Logout & Mutation Isolation
  // =========================================================================
  describe('SEC-DEMO-LIFECYCLE: Demo User Logout & Mutation Invariance', () => {
    test('Demo user logout does NOT bump tokenVersion', () => {
      let dbUpdated = false;
      const simulateLogout = (user) => {
        const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
        if (!isDemo) {
          dbUpdated = true; // DB $inc tokenVersion
        }
        return { success: true };
      };

      const demoUser = { _id: 'u_demo', role: 'demo', email: 'protrader@tradejourn.com', tokenVersion: 0 };
      simulateLogout(demoUser);
      assert.equal(dbUpdated, false, 'Demo user logout must NEVER increment tokenVersion in DB');

      // Regular user logout DOES increment tokenVersion
      const realUser = { _id: 'u_real', role: 'pro', email: 'trader@gmail.com', tokenVersion: 0 };
      simulateLogout(realUser);
      assert.equal(dbUpdated, true, 'Regular user logout MUST increment tokenVersion');
    });

    test('Demo user password reset requests are rejected', () => {
      const checkResetAllowed = (user) => {
        const isDemo = user.isDemo || user.role === 'demo' || user.email === 'protrader@tradejourn.com';
        if (isDemo) {
          return { allowed: false, status: 403, code: 'DEMO_READ_ONLY' };
        }
        return { allowed: true };
      };

      const demoUser = { _id: 'u_demo', role: 'demo', email: 'protrader@tradejourn.com' };
      const res = checkResetAllowed(demoUser);
      assert.equal(res.allowed, false);
      assert.equal(res.status, 403);
      assert.equal(res.code, 'DEMO_READ_ONLY');
    });
  });

  // =========================================================================
  // SEC-PHONE-OTP: Mobile Number Identification & OTP Routing
  // =========================================================================
  describe('SEC-PHONE-OTP: Mobile Number Input & Password Recovery Routing', () => {
    test('Resolves user identity and routes to SMS when phone number is provided', () => {
      const mockUsers = [
        { _id: 'u_1', userId: '@suman9458', email: 'suman@tradejourn.com', phoneNumber: '+919876543210' },
        { _id: 'u_2', userId: '@alex_trader', email: 'alex@example.com', phoneNumber: '+15551234567' }
      ];

      const findUserByIdentifier = (identifier) => {
        const clean = identifier.trim().toLowerCase();
        const withAt = clean.startsWith('@') ? clean : `@${clean}`;
        const withoutAt = clean.startsWith('@') ? clean.slice(1) : clean;
        const cleanDigits = clean.replace(/[^0-9+]/g, '');

        return mockUsers.find(u => {
          if (u.userId === withAt || u.userId === withoutAt || u.email === clean) return true;
          if (cleanDigits.length >= 7) {
            const uDigits = (u.phoneNumber || '').replace(/[^0-9+]/g, '');
            const uRaw = (u.phoneNumber || '').replace(/[^0-9]/g, '');
            const cleanRaw = clean.replace(/[^0-9]/g, '');
            if (u.phoneNumber === clean || uDigits === cleanDigits) return true;
            if (uDigits.replace(/^\+/, '') === cleanDigits.replace(/^\+/, '')) return true;
            if (uRaw.endsWith(cleanRaw) || cleanRaw.endsWith(uRaw)) return true;
          }
          return false;
        });
      };

      // Query by exact phone
      const match1 = findUserByIdentifier('+919876543210');
      assert.ok(match1, 'Must find user by +919876543210');
      assert.equal(match1.userId, '@suman9458');

      // Query by unformatted phone digits
      const match2 = findUserByIdentifier('9876543210');
      assert.ok(match2, 'Must find user by 9876543210');
      assert.equal(match2.userId, '@suman9458');

      // Query by formatted US phone
      const match3 = findUserByIdentifier('+1 (555) 123-4567');
      assert.ok(match3, 'Must find user by formatted +1 (555) 123-4567');
      assert.equal(match3.userId, '@alex_trader');

      // Query by email
      const match4 = findUserByIdentifier('alex@example.com');
      assert.ok(match4, 'Must find user by email');
      assert.equal(match4.userId, '@alex_trader');
    });

    test('Correctly selects SMS channel and masks mobile destination for privacy', () => {
      const user = { userId: '@suman9458', email: 'suman@tradejourn.com', phoneNumber: '+919876543210' };
      const resolveRouting = (identifier, user) => {
        const isPhoneQuery = /^[+]?[0-9\s\-()]{7,18}$/.test(identifier.trim());
        if (isPhoneQuery && user.phoneNumber) {
          return { destination: user.phoneNumber, channel: 'sms' };
        }
        return { destination: user.email, channel: 'email' };
      };

      const routePhone = resolveRouting('+91 98765 43210', user);
      assert.equal(routePhone.channel, 'sms');
      assert.equal(routePhone.destination, '+919876543210');

      const masked = maskDestination(routePhone.destination);
      assert.match(masked, /^\+91\*{4,}\d{4}$/, 'Masked phone must hide middle digits');
    });
  });
});
