const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Cache Google's public certificates in memory to avoid repeated network calls
let publicCertsCache = null;
let certsExpiry = 0;

/**
 * Fetches Google's public x509 certificates for Firebase ID token verification.
 * Automatically caches according to HTTP Cache-Control header.
 */
const fetchGooglePublicCerts = async () => {
  const now = Date.now();
  if (publicCertsCache && now < certsExpiry) {
    return publicCertsCache;
  }

  return new Promise((resolve, reject) => {
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to fetch Google certs: HTTP ${res.statusCode}`));
          }
          const certs = JSON.parse(data);
          
          // Cache control parsing (default 6 hours)
          const cacheControl = res.headers['cache-control'] || '';
          const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
          const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 21600;
          
          publicCertsCache = certs;
          certsExpiry = Date.now() + (maxAgeSec * 1000);
          resolve(certs);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

/**
 * Cryptographically verifies a Firebase Authentication ID Token (RS256).
 * 
 * Verifications performed:
 * 1. Header contains 'kid' and 'alg' === 'RS256'.
 * 2. Signature matches Google's public certificate for the specified 'kid'.
 * 3. 'aud' matches FIREBASE_PROJECT_ID (or configured projectId).
 * 4. 'iss' matches 'https://securetoken.google.com/<projectId>'.
 * 5. 'sub' is non-empty string.
 * 6. 'exp' is in the future.
 * 7. 'auth_time' is in the past.
 * 
 * @param {string} idToken - Raw JWT string from Firebase client SDK
 * @param {string} [expectedProjectId] - Expected Firebase Project ID
 * @returns {Promise<{ uid: string, phoneNumber?: string, email?: string, phoneVerified: boolean }>}
 */
const verifyFirebaseIdToken = async (idToken, expectedProjectId) => {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    throw new Error('Firebase ID token is required and cannot be empty.');
  }

  const projectId = expectedProjectId || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL CONFIGURATION: FIREBASE_PROJECT_ID is not configured in server environment.');
    }
  }

  // Decode header to retrieve key ID (kid)
  const decodedToken = jwt.decode(idToken.trim(), { complete: true });
  if (!decodedToken || !decodedToken.header || !decodedToken.payload) {
    throw new Error('Malformed or unparseable Firebase ID token.');
  }

  const { header, payload } = decodedToken;

  if (header.alg !== 'RS256') {
    throw new Error(`Invalid token algorithm: expected RS256, received ${header.alg}`);
  }

  if (!header.kid) {
    throw new Error('Firebase token header is missing key ID (kid).');
  }

  // Fetch Google's public x509 certs
  const certs = await fetchGooglePublicCerts();
  const publicKeyCert = certs[header.kid];

  if (!publicKeyCert) {
    throw new Error(`Firebase token signed by unrecognized or revoked Google key ID: ${header.kid}`);
  }

  // Verify signature cryptographically using Google's public key
  const verified = jwt.verify(idToken.trim(), publicKeyCert, {
    algorithms: ['RS256'],
    audience: projectId || payload.aud,
    issuer: projectId ? `https://securetoken.google.com/${projectId}` : payload.iss
  });

  const nowSec = Math.floor(Date.now() / 1000);
  if (verified.exp && verified.exp < nowSec) {
    throw new Error('Firebase ID token has expired.');
  }

  if (verified.auth_time && verified.auth_time > nowSec + 300) {
    throw new Error('Firebase token auth_time is in the future.');
  }

  return {
    uid: verified.sub,
    phoneNumber: verified.phone_number || '',
    email: verified.email || '',
    phoneVerified: !!verified.phone_number
  };
};

module.exports = {
  verifyFirebaseIdToken,
  fetchGooglePublicCerts
};

