const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const CF_HANDLE_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;
const VERIFICATION_TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const VERIFICATION_TOKEN_LIFETIME_MS = 5 * 60 * 1000;

function signToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function userResponse(user) {
  return {
    _id: user._id,
    username: user.username,
    platformRating: user.platformRating,
    isVerified: user.isVerified,
    cfHandle: user.cfHandle
  };
}

function createVerificationToken() {
  let token = '';

  for (let index = 0; index < 8; index += 1) {
    token += VERIFICATION_TOKEN_ALPHABET[crypto.randomInt(VERIFICATION_TOKEN_ALPHABET.length)];
  }

  return `LOCK_${token}`;
}

function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}

async function register(req, res, next) {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
    });
  }

  if (!PASSWORD_PATTERN.test(password)) {
    return res.status(400).json({
      success: false,
      message:
        'Password must be 8-128 characters and include an uppercase letter, a lowercase letter, a number, and a special character'
    });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error('JWT_SECRET is not configured'));
  }

  try {
    const existingUser = await User.findOne({ username: normalizedUsername }).select('_id');
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username is already taken' });
    }

    const user = await User.create({ username: normalizedUsername, password });
    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: userResponse(user)
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ success: false, message: 'Username is already taken' });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error('JWT_SECRET is not configured'));
  }

  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = signToken(user._id);
    return res.status(200).json({
      success: true,
      token,
      user: userResponse(user)
    });
  } catch (error) {
    return next(error);
  }
}

function getMe(req, res) {
  return res.status(200).json({ success: true, user: req.user });
}

async function initiateCfVerification(req, res, next) {
  const { cfHandle } = req.body || {};
  if (typeof cfHandle !== 'string' || !cfHandle.trim()) {
    return res.status(400).json({ success: false, message: 'Codeforces handle is required' });
  }

  const normalizedHandle = cfHandle.trim();
  if (!CF_HANDLE_PATTERN.test(normalizedHandle)) {
    return res.status(400).json({
      success: false,
      message: 'Codeforces handle must be 3-24 characters and contain only letters, numbers, underscores, or hyphens'
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+verificationTokenExpiresAt');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }
    if (user.isVerified) {
      return res.status(409).json({ success: false, message: 'Codeforces handle is already verified and locked' });
    }

    const handleInUse = await User.findOne({
      _id: { $ne: user._id },
      cfHandle: { $regex: `^${normalizedHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }).select('_id');
    if (handleInUse) {
      return res.status(409).json({ success: false, message: 'Codeforces handle is already linked to another account' });
    }

    const verificationToken = createVerificationToken();
    user.cfHandle = normalizedHandle;
    user.verificationToken = verificationToken;
    user.verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_LIFETIME_MS);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Submit code that produces a compilation error containing this token, then confirm within 5 minutes.',
      targetProblem: { contestId: 4, index: 'A' },
      token: verificationToken,
      expiresInSeconds: VERIFICATION_TOKEN_LIFETIME_MS / 1000
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmCfVerification(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('+verificationTokenExpiresAt');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }
    if (user.isVerified) {
      return res.status(409).json({ success: false, message: 'Codeforces handle is already verified' });
    }
    if (!user.cfHandle || !user.verificationToken || !user.verificationTokenExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Start Codeforces verification before confirming'
      });
    }
    if (user.verificationTokenExpiresAt.getTime() < Date.now()) {
      user.verificationToken = null;
      user.verificationTokenExpiresAt = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Verification token expired. Start verification again.'
      });
    }

    let response;
    try {
      response = await axios.get('https://codeforces.com/api/user.status', {
        params: { handle: user.cfHandle, from: 1, count: 5 },
        timeout: 10000
      });
    } catch (error) {
      const status = error.response ? 502 : 503;
      return res.status(status).json({
        success: false,
        message: 'Unable to reach the Codeforces API. Please try again later.'
      });
    }

    if (response.data.status !== 'OK' || !Array.isArray(response.data.result)) {
      return res.status(502).json({
        success: false,
        message: 'Codeforces API returned an invalid response'
      });
    }

    const nowSeconds = Date.now() / 1000;
    const challengeCreatedAt = user.verificationTokenExpiresAt.getTime() / 1000 -
      VERIFICATION_TOKEN_LIFETIME_MS / 1000;
    const matchingSubmission = response.data.result.some((submission) => {
      const createdAt = submission.creationTimeSeconds;
      return (
        submission.problem &&
        submission.problem.contestId === 4 &&
        submission.problem.index === 'A' &&
        submission.verdict === 'COMPILATION_ERROR' &&
        Number.isFinite(createdAt) &&
        createdAt >= challengeCreatedAt &&
        createdAt <= nowSeconds &&
        nowSeconds - createdAt <= 600
      );
    });

    if (!matchingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'No recent compilation error submission found for Problem 4A'
      });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiresAt = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Codeforces handle verified successfully',
      user: userResponse(user)
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  initiateCfVerification,
  confirmCfVerification
};
