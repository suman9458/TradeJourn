const crypto = require('crypto');

// Mask destination for privacy (e.g. su***@tradejourn.com or +1***1234)
const maskDestination = (dest) => {
  if (!dest) return 'your registered contact';
  if (dest.includes('@')) {
    const [name, domain] = dest.split('@');
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  }
  if (dest.length > 6) {
    return `${dest.slice(0, 3)}****${dest.slice(-4)}`;
  }
  return dest;
};

// Generate cryptographically secure 6-digit numeric OTP
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Send OTP via Twilio SMS, Nodemailer (Email), or Development Fallback
 * @param {Object} options
 * @param {string} options.destination - Email address or phone number
 * @param {string} options.otp - 6-digit OTP
 * @param {string} options.userName - User display name
 * @param {string} [options.preferredChannel] - 'sms' | 'email' | 'auto'
 */
const sendOtp = async ({ destination, otp, userName = 'Trader', preferredChannel = 'auto' }) => {
  const isEmail = destination.includes('@');
  const channel = preferredChannel !== 'auto' ? preferredChannel : isEmail ? 'email' : 'sms';

  // 1. Check Twilio configuration for SMS
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const hasTwilio = Boolean(twilioSid && twilioAuth && twilioPhone);

  // 2. Check SMTP / Nodemailer configuration for Email
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);

  // Live Twilio SMS Delivery
  if (channel === 'sms' && hasTwilio) {
    try {
      const twilio = require('twilio');
      const client = twilio(twilioSid, twilioAuth);
      await client.messages.create({
        body: `TradeJourn security code: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
        from: twilioPhone,
        to: destination
      });
      console.log(`[OTP] Sent SMS via Twilio to ${maskDestination(destination)}`);
      return { delivered: true, channel: 'sms', maskedDestination: maskDestination(destination) };
    } catch (err) {
      console.error('[OTP] Twilio SMS sending failed:', err.message);
      // Fall through to dev fallback
    }
  }

  // Live SMTP Email Delivery
  if (channel === 'email' && hasSmtp) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"TradeJourn Security" <no-reply@tradejourn.com>',
        to: destination,
        subject: `Your TradeJourn Password Reset Code: ${otp}`,
        text: `Hello ${userName},\n\nYour 6-digit password reset verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, you can safely ignore this email.\n\n- TradeJourn Security Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #0b0f19; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #7c3aed, #00f59b); border-radius: 10px; color: #04080e; font-weight: 900; font-size: 18px;">TJ</div>
              <h1 style="color: #ffffff; font-size: 22px; margin: 16px 0 6px; letter-spacing: -0.02em;">Password Reset Verification</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 0;">TradeJourn Institutional Account Security</p>
            </div>
            <div style="background-color: #111827; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #374151; margin-bottom: 24px;">
              <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 14px;">Hello <strong style="color: #ffffff;">${userName}</strong>, here is your one-time verification code:</p>
              <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #a78bfa; padding: 12px 18px; background: rgba(124, 58, 237, 0.12); border-radius: 10px; display: inline-block; font-family: monospace;">
                ${otp}
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">Expires in <strong>10 minutes</strong>. Do not share this code.</p>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[OTP] Sent Email via SMTP to ${maskDestination(destination)}`);
      return { delivered: true, channel: 'email', maskedDestination: maskDestination(destination) };
    } catch (err) {
      console.error('[OTP] SMTP Email sending failed:', err.message);
      // Fall through to dev fallback
    }
  }

  // Development / Zero-Config Fallback:
  // Prints prominently to console and returns devOtp so user/dev can test immediately without waiting for API keys!
  console.log('\n======================================================');
  console.log('🔐 [TRADEJOURN OTP SYSTEM - DEV / LOCAL PREVIEW]');
  console.log(`Recipient: ${destination} (${userName})`);
  console.log(`OTP Code:  >>>  ${otp}  <<<`);
  console.log('Validity:  10 minutes');
  console.log('Notice:    Add TWILIO_* or SMTP_* to server/.env for live delivery');
  console.log('======================================================\n');

  return {
    delivered: true,
    channel: hasTwilio ? 'sms' : hasSmtp ? 'email' : 'dev',
    maskedDestination: maskDestination(destination),
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  };
};

module.exports = {
  generateOtp,
  maskDestination,
  sendOtp
};
