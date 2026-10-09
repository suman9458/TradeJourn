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
      trim: true
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
      enum: ['user', 'admin', 'pro'],
      default: 'pro'
    },
    settings: {
      currency: { type: String, default: 'USD' },
      riskPerTrade: { type: Number, default: 1 },
      defaultInstrument: { type: String, default: 'EURUSD' },
      aiApiKey: { type: String, default: '' },
      aiModel: { type: String, default: 'gpt-4o-mini' }
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare input password to hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
