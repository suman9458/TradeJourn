const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  userId: z.string().trim().min(3, 'User ID must be at least 3 characters').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  dob: z.string().optional(),
  tradingExperience: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert', '']).optional(),
  email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
  phoneNumber: z.string().trim().max(25).optional().or(z.literal(''))
});

const loginSchema = z.object({
  userId: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required')
}).refine(data => data.userId || data.email, {
  message: 'Please provide either User ID or Email to sign in',
  path: ['identifier']
});

const socialSchema = z.object({
  provider: z.literal('google').default('google'),
  idToken: z.string().trim().min(10, 'Google OAuth idToken must be a valid JWT token string')
});

const forgotPasswordSendSchema = z.object({
  identifier: z.string().trim().min(2, 'User ID, Email, or Phone Number is required')
});

const forgotPasswordVerifySchema = z.object({
  identifier: z.string().trim().min(2, 'User ID, Email, or Phone Number is required'),
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly a 6-digit number')
});

const forgotPasswordResetSchema = z.object({
  resetToken: z.string().trim().min(16, 'Reset token must be a valid security token'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long')
});

const forgotPasswordFirebaseSchema = z.object({
  idToken: z.string().trim().min(20, 'Firebase ID token must be a valid JWT token string'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  identifier: z.string().trim().optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  socialSchema,
  forgotPasswordSendSchema,
  forgotPasswordVerifySchema,
  forgotPasswordResetSchema,
  forgotPasswordFirebaseSchema
};

