const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    userId: {
      type: String,
      required: [true, 'Please provide a unique User ID'],
      unique: true,
      trim: true,
      lowercase: true
    },
    dob: {
      type: String,
      default: ''
    },
    tradingExperience: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Expert'],
      default: 'Intermediate'
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      index: true
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
      default: ''
    },
    securityPin: {
      type: String,
      select: false,
      default: ''
    },
    pinAttempts: {
      type: Number,
      default: 0
    },
    pinLockedUntil: {
      type: Date,
      default: null
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    avatar: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'pro', 'demo'],
      default: 'pro'
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true
    },
    settings: {
      currency: { type: String, default: 'USD' },
      riskPerTrade: { type: Number, default: 1 },
      defaultInstrument: { type: String, default: 'EURUSD' },
      aiProvider: { type: String, default: 'gemini' },
      geminiApiKey: { type: String, default: '' },
      aiApiKey: { type: String, default: '' },
      aiModel: { type: String, default: 'gemini-2.0-flash' }
    }
  },
  {
    timestamps: true
  }
);

// Hash password and security PIN before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.isModified('securityPin') && this.securityPin) {
    const salt = await bcrypt.genSalt(10);
    this.securityPin = await bcrypt.hash(this.securityPin.toString().trim(), salt);
  }
  next();
});

// Compare input password to hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Compare input security PIN to hashed PIN
userSchema.methods.comparePin = async function (enteredPin) {
  if (!this.securityPin) return false;
  return await bcrypt.compare(enteredPin.toString().trim(), this.securityPin);
};

module.exports = mongoose.model('User', userSchema);
