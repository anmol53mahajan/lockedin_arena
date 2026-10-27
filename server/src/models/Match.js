const mongoose = require('mongoose');

const problemTierSchema = new mongoose.Schema(
  {
    slot: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    minRating: {
      type: Number,
      required: true,
      min: 0
    },
    maxRating: {
      type: Number,
      required: true,
      min: 0
    },
    points: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    contestId: Number,
    index: String,
    name: String,
    rating: Number,
    points: Number,
    problemUrl: String,
    status: {
      type: String,
      enum: ['UNSOLVED', 'LOCKED'],
      default: 'UNSOLVED'
    },
    solvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    solvedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      match: /^[A-Z0-9]{6}$/,
      index: true
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['LOBBY', 'STARTING', 'ACTIVE', 'SETTLING', 'FINISHED', 'ABANDONED'],
      default: 'LOBBY'
    },
    config: {
      durationMinutes: {
        type: Number,
        enum: [15, 30, 45, 60],
        default: 30,
        required: true
      },
      problemCount: {
        type: Number,
        enum: [3, 4, 5],
        default: 4,
        required: true
      },
      problemTiers: {
        type: [problemTierSchema],
        required: true,
        validate: {
          validator(tiers) {
            return tiers.length >= 3 && tiers.length <= 5 &&
              tiers.every((tier, index) =>
                tier.slot === index + 1 &&
                tier.minRating <= tier.maxRating &&
                Number.isInteger(tier.points) &&
                tier.points > 0
              );
          },
          message: 'Problem tiers must have sequential slots, valid rating bands, and positive integer points'
        }
      }
    },
    problems: {
      type: [problemSchema],
      default: []
    },
    scores: {
      hostScore: { type: Number, default: 0, min: 0 },
      guestScore: { type: Number, default: 0, min: 0 }
    },
    readyStates: {
      hostReady: { type: Boolean, default: false },
      guestReady: { type: Boolean, default: false }
    },
    winner: {
      type: String,
      enum: ['HOST', 'GUEST', 'TIE', null],
      default: null
    },
    terminationReason: {
      type: String,
      enum: ['CLINCH_VICTORY', 'TIME_EXPIRED', null],
      default: null
    },
    hostRatingBefore: { type: Number, default: null },
    hostRatingAfter: { type: Number, default: null },
    hostDelta: { type: Number, default: null },
    guestRatingBefore: { type: Number, default: null },
    guestRatingAfter: { type: Number, default: null },
    guestDelta: { type: Number, default: null },
    startTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Match || mongoose.model('Match', matchSchema);
