const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ratingHistorySchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    oldRating: Number,
    newRating: Number,
    delta: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username may contain only letters, numbers, and underscores']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long']
    },
    cfHandle: {
      type: String,
      default: null,
      trim: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    platformRating: {
      type: Number,
      default: 1200
    },
    peakRating: {
      type: Number,
      default: 1200
    },
    verificationToken: {
      type: String,
      default: null
    },
    verificationTokenExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    stats: {
      totalMatches: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      ties: { type: Number, default: 0 }
    },
    ratingHistory: {
      type: [ratingHistorySchema],
      default: []
    },
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match'
      }
    ]
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
