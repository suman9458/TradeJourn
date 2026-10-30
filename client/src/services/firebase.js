import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

// Firebase configuration read strictly from Vite environment variables (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

let cachedAuth = null;
let recaptchaVerifierInstance = null;

/**
 * Checks whether Firebase Phone Auth credentials have been configured.
 */
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.length > 5 &&
    !firebaseConfig.apiKey.includes('YOUR_')
  );
};

/**
 * Initializes and returns Firebase Auth instance.
 */
export const getFirebaseAuth = () => {
  if (cachedAuth) return cachedAuth;
  
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  cachedAuth = getAuth(app);
  // Default language to English
  cachedAuth.useDeviceLanguage();
  return cachedAuth;
};

/**
 * Normalizes phone numbers to standard E.164 international format (+<country><number>)
 */
export const formatPhoneNumberE164 = (rawPhone) => {
  if (!rawPhone) return '';
  const trimmed = rawPhone.toString().trim();
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');

  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  // If 10 digits provided without country code, default to India (+91)
  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  return `+${digitsOnly}`;
};

/**
 * Sets up or clears invisible reCAPTCHA verifier.
 */
export const initRecaptchaVerifier = (containerId = 'firebase-recaptcha-container') => {
  const auth = getFirebaseAuth();

  if (recaptchaVerifierInstance) {
    try {
      recaptchaVerifierInstance.clear();
    } catch {
      // Ignored if already cleared
    }
    recaptchaVerifierInstance = null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`reCAPTCHA container #${containerId} not found in DOM.`);
  }

  recaptchaVerifierInstance = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - allow signInWithPhoneNumber
    },
    'expired-callback': () => {
      // Response expired. Ask user to solve reCAPTCHA again.
      if (recaptchaVerifierInstance) {
        recaptchaVerifierInstance.clear();
        recaptchaVerifierInstance = null;
      }
    }
  });

  return recaptchaVerifierInstance;
};

/**
 * Triggers Google Firebase SMS OTP delivery to trader's mobile phone (10,000 free per month).
 * 
 * @param {string} phoneNumber - Trader's phone number
 * @param {string} containerId - Element ID for reCAPTCHA widget
 * @returns {Promise<{ confirmationResult: any, formattedPhone: string }>}
 */
export const sendFirebasePhoneOtp = async (phoneNumber, containerId = 'firebase-recaptcha-container') => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not yet configured. Please supply VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID.');
  }

  const formattedPhone = formatPhoneNumberE164(phoneNumber);
  if (formattedPhone.length < 10) {
    throw new Error('Please enter a valid mobile number with country code (e.g. +91 98765 43210).');
  }

  const auth = getFirebaseAuth();
  const verifier = initRecaptchaVerifier(containerId);

  const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
  return { confirmationResult, formattedPhone };
};

/**
 * Confirms 6-digit OTP code with Google Firebase and returns signed Google ID Token.
 * 
 * @param {any} confirmationResult - Result returned by signInWithPhoneNumber
 * @param {string} otpCode - 6-digit verification code entered by user
 * @returns {Promise<{ idToken: string, phoneNumber: string }>}
 */
export const confirmFirebaseOtp = async (confirmationResult, otpCode) => {
  if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
    throw new Error('Invalid OTP session. Please request a new OTP code.');
  }

  const cleanOtp = (otpCode || '').toString().trim();
  if (cleanOtp.length !== 6) {
    throw new Error('Please enter the complete 6-digit verification code.');
  }

  const userCredential = await confirmationResult.confirm(cleanOtp);
  const idToken = await userCredential.user.getIdToken(true);

  return {
    idToken,
    phoneNumber: userCredential.user.phoneNumber || ''
  };
};

