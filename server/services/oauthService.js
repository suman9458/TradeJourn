const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

let googleClient = null;

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google OAuth is not configured on this server (GOOGLE_CLIENT_ID environment variable is missing).');
  }
  if (!googleClient) {
    googleClient = new OAuth2Client(clientId);
  }
  return { client: googleClient, clientId };
};

/**
 * Cryptographically verifies an OAuth ID token server-side (signature, audience, issuer, expiration).
 * Enforces verification in ALL environments (development, staging, production).
 *
 * @param {Object} params
 * @param {string} params.provider - 'google'
 * @param {string} params.idToken - Raw ID Token JWT from Google OAuth provider
 * @returns {Promise<{ email: string, name: string, sub: string, provider: string }>}
 */
const verifyOAuthIdToken = async ({ provider = 'google', idToken }) => {
  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    throw new Error('OAuth idToken is required and cannot be empty.');
  }

  const cleanProvider = provider.toLowerCase();

  if (cleanProvider !== 'google') {
    throw new Error(`Unsupported OAuth provider: '${provider}'. Only verified Google Sign-In is supported.`);
  }

  const { client, clientId } = getGoogleClient();

  const ticket = await client.verifyIdToken({
    idToken: idToken.trim(),
    audience: clientId
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google OAuth token payload.');
  }

  // Verify issuer
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error(`Invalid Google OAuth token issuer: ${payload.iss}`);
  }

  // Verify expiration
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < nowSec) {
    throw new Error('Google OAuth ID token has expired.');
  }

  // Verify email presence and verification status
  if (!payload.email) {
    throw new Error('Google OAuth ID token does not contain an email address.');
  }

  if (payload.email_verified === false) {
    throw new Error('Google OAuth email address is not verified by Google.');
  }

  return {
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split('@')[0],
    sub: payload.sub,
    provider: 'google'
  };
};

module.exports = {
  verifyOAuthIdToken
};

