const crypto = require('crypto');
const MT5Account = require('../models/MT5Account');

// Replay attack prevention: in-memory cache with 60s TTL
const nonceCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiresAt] of nonceCache.entries()) {
    if (now > expiresAt) {
      nonceCache.delete(nonce);
    }
  }
}, 30000);

/**
 * Validates outbound HMAC-SHA256 signature from Python MT5 Connector
 * Expected Headers:
 *   x-connector-key: Public apiKeyId
 *   x-connector-timestamp: ISO string or Unix timestamp (seconds)
 *   x-connector-nonce: Unique cryptographic nonce
 *   x-connector-signature: Hex HMAC-SHA256 signature
 */
const verifyMT5Hmac = async (req, res, next) => {
  // 1. Feature Flag Check (Enabled by default unless explicitly disabled)
  if (process.env.MT5_INTEGRATION_ENABLED === 'false') {
    return res.status(403).json({
      success: false,
      message: 'MetaTrader 5 integration is currently disabled by system administrator'
    });
  }

  const apiKeyId = req.headers['x-connector-key'];
  const timestamp = req.headers['x-connector-timestamp'];
  const nonce = req.headers['x-connector-nonce'];
  const signature = req.headers['x-connector-signature'];

  if (!apiKeyId || !timestamp || !nonce || !signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing required HMAC security headers (x-connector-key, timestamp, nonce, signature)'
    });
  }

  // 2. Clock Drift Protection (Default max drift: 30 seconds)
  const maxDrift = Number(process.env.MT5_MAX_CLOCK_DRIFT_SEC) || 30;
  const requestTime = isNaN(Number(timestamp)) ? new Date(timestamp).getTime() : Number(timestamp) * 1000;
  const now = Date.now();
  const driftSec = Math.abs(now - requestTime) / 1000;

  if (isNaN(requestTime) || driftSec > maxDrift) {
    return res.status(401).json({
      success: false,
      message: `Request timestamp rejected: clock drift of ${driftSec.toFixed(1)}s exceeds allowed limit of ${maxDrift}s`
    });
  }

  // 3. Nonce Replay Prevention
  if (nonceCache.has(nonce)) {
    return res.status(401).json({
      success: false,
      message: 'Rejected potential replay attack: nonce has already been used'
    });
  }
  nonceCache.set(nonce, now + (maxDrift * 2 * 1000));

  try {
    // 4. Retrieve Account & Secret Hash
    const account = await MT5Account.findOne({ apiKeyId, isActive: true }).select('+apiKeyHash');
    if (!account || !account.apiKeyHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked MT5 connector key'
      });
    }

    // 5. Compute HMAC-SHA256 Signature
    // Format: METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH
    const bodyStr = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const payloadToSign = `${req.method.toUpperCase()}:${req.originalUrl || req.url}:${timestamp}:${nonce}:${bodyHash}`;

    const expectedSignature = crypto
      .createHmac('sha256', account.apiKeyHash)
      .update(payloadToSign)
      .digest('hex');

    // Constant-time comparison
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid HMAC signature'
      });
    }

    // Attach verified account & user context
    req.mt5Account = account;
    req.user = { _id: account.userId };
    next();
  } catch (err) {
    console.error('HMAC verification error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal error during connector signature verification'
    });
  }
};

module.exports = { verifyMT5Hmac };
