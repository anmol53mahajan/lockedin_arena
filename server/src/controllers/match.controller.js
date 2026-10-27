const crypto = require('crypto');
const Match = require('../models/Match');

const VALID_DURATIONS = [15, 30, 45, 60];
const VALID_PROBLEM_COUNTS = [3, 4, 5];
const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PARTICIPANT_FIELDS = 'username cfHandle platformRating isVerified';
const MAX_ROOM_CODE_ATTEMPTS = 5;

function generateRoomCode() {
  let roomCode = 'LK';
  for (let index = 0; index < 4; index += 1) {
    roomCode += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return roomCode;
}

function isDuplicateRoomCode(error) {
  return error && error.code === 11000 && error.keyPattern && error.keyPattern.roomCode;
}

function isSameUser(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftId = left._id || left;
  const rightId = right._id || right;
  return leftId.toString() === rightId.toString();
}

function isParticipant(match, userId) {
  return isSameUser(match.host, userId) || isSameUser(match.guest, userId);
}

function populateParticipants(query) {
  return query
    .populate('host', PARTICIPANT_FIELDS)
    .populate('guest', PARTICIPANT_FIELDS);
}

function validateCreateInput(body) {
  const { durationMinutes, problemCount, problemTiers } = body;

  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return 'Duration must be 15, 30, 45, or 60 minutes';
  }
  if (!VALID_PROBLEM_COUNTS.includes(problemCount)) {
    return 'Problem count must be 3, 4, or 5';
  }
  if (!Array.isArray(problemTiers) || problemTiers.length !== problemCount) {
    return 'Problem tier count must match the selected problem count';
  }

  for (let index = 0; index < problemTiers.length; index += 1) {
    const tier = problemTiers[index];
    if (!tier || typeof tier !== 'object' || Array.isArray(tier)) {
      return `Problem tier ${index + 1} is invalid`;
    }
    if (
      !Number.isInteger(tier.minRating) ||
      !Number.isInteger(tier.maxRating) ||
      tier.minRating < 0 ||
      tier.maxRating < tier.minRating
    ) {
      return `Problem tier ${index + 1} must have a valid minimum and maximum rating`;
    }
    if (!Number.isInteger(tier.points) || tier.points <= 0) {
      return `Problem tier ${index + 1} points must be a positive integer`;
    }
  }

  return null;
}

async function createMatch(req, res, next) {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Verify your Codeforces handle before creating a duel'
    });
  }

  const body = req.body || {};
  const validationMessage = validateCreateInput(body);
  if (validationMessage) {
    return res.status(400).json({ success: false, message: validationMessage });
  }

  const problemTiers = body.problemTiers.map((tier, index) => ({
    slot: index + 1,
    minRating: tier.minRating,
    maxRating: tier.maxRating,
    points: tier.points
  }));

  try {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      try {
        const match = await Match.create({
          roomCode: generateRoomCode(),
          host: req.user._id,
          status: 'LOBBY',
          config: {
            durationMinutes: body.durationMinutes,
            problemCount: body.problemCount,
            problemTiers
          }
        });

        const populatedMatch = await populateParticipants(Match.findById(match._id));
        return res.status(201).json({
          success: true,
          roomCode: match.roomCode,
          match: populatedMatch
        });
      } catch (error) {
        if (!isDuplicateRoomCode(error)) {
          throw error;
        }
      }
    }

    return res.status(503).json({
      success: false,
      message: 'Could not reserve a unique room code. Please try again.'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  }
}

async function getMatchByCode(req, res, next) {
  const roomCode = typeof req.params.roomCode === 'string'
    ? req.params.roomCode.trim().toUpperCase()
    : '';
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return res.status(400).json({ success: false, message: 'Room code must be 6 letters or numbers' });
  }

  try {
    const match = await populateParticipants(Match.findOne({ roomCode }));
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match room was not found' });
    }
    return res.status(200).json({ success: true, match });
  } catch (error) {
    return next(error);
  }
}

async function joinMatch(req, res, next) {
  const suppliedCode = req.body && req.body.roomCode;
  if (typeof suppliedCode !== 'string' || !/^[A-Z0-9]{6}$/i.test(suppliedCode.trim())) {
    return res.status(400).json({ success: false, message: 'Room code must be 6 letters or numbers' });
  }

  const roomCode = suppliedCode.trim().toUpperCase();
  try {
    const existingMatch = await Match.findOne({ roomCode });
    if (!existingMatch) {
      return res.status(404).json({ success: false, message: 'Match room was not found' });
    }
    if (isSameUser(existingMatch.host, req.user._id)) {
      const hostMatch = await populateParticipants(Match.findById(existingMatch._id));
      return res.status(200).json({ success: true, match: hostMatch });
    }
    if (isSameUser(existingMatch.guest, req.user._id)) {
      const guestMatch = await populateParticipants(Match.findById(existingMatch._id));
      return res.status(200).json({ success: true, match: guestMatch });
    }
    if (existingMatch.status !== 'LOBBY') {
      return res.status(409).json({ success: false, message: 'This match is no longer accepting players' });
    }
    if (existingMatch.guest) {
      return res.status(409).json({ success: false, message: 'Room is full' });
    }

    const joinedMatch = await Match.findOneAndUpdate(
      { _id: existingMatch._id, status: 'LOBBY', guest: null },
      { $set: { guest: req.user._id } },
      { new: true, runValidators: true }
    );

    if (joinedMatch) {
      const populatedMatch = await populateParticipants(Match.findById(joinedMatch._id));
      return res.status(200).json({ success: true, match: populatedMatch });
    }

    const latestMatch = await Match.findById(existingMatch._id);
    if (!latestMatch) {
      return res.status(404).json({ success: false, message: 'Match room was not found' });
    }
    if (latestMatch.status !== 'LOBBY') {
      return res.status(409).json({ success: false, message: 'This match is no longer accepting players' });
    }
    if (isSameUser(latestMatch.guest, req.user._id)) {
      const guestMatch = await populateParticipants(Match.findById(latestMatch._id));
      return res.status(200).json({ success: true, match: guestMatch });
    }

    return res.status(409).json({ success: false, message: 'Room is full' });
  } catch (error) {
    return next(error);
  }
}

async function getUserMatchHistory(req, res, next) {
  try {
    const matches = await populateParticipants(
      Match.find({
        status: 'FINISHED',
        $or: [{ host: req.user._id }, { guest: req.user._id }]
      }).sort({ createdAt: -1 })
    );

    return res.status(200).json({ success: true, matches });
  } catch (error) {
    return next(error);
  }
}

async function updateReadyState(req, res, next) {
  const roomCode = typeof req.params.roomCode === 'string'
    ? req.params.roomCode.trim().toUpperCase()
    : '';
  const { ready } = req.body || {};
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return res.status(400).json({ success: false, message: 'Room code must be 6 letters or numbers' });
  }
  if (typeof ready !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Ready state must be true or false' });
  }

  try {
    const match = await Match.findOne({ roomCode });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match room was not found' });
    }
    if (match.status !== 'LOBBY') {
      return res.status(409).json({ success: false, message: 'Readiness can only be changed in the lobby' });
    }
    if (!isParticipant(match, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only room participants can update readiness' });
    }

    const isHost = isSameUser(match.host, req.user._id);
    const field = isHost ? 'readyStates.hostReady' : 'readyStates.guestReady';
    const updatedMatch = await Match.findOneAndUpdate(
      { _id: match._id, status: 'LOBBY' },
      { $set: { [field]: ready } },
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return res.status(409).json({ success: false, message: 'Lobby state changed. Refresh and try again.' });
    }
    const populatedMatch = await populateParticipants(Match.findById(updatedMatch._id));
    return res.status(200).json({ success: true, match: populatedMatch });
  } catch (error) {
    return next(error);
  }
}

async function startMatch(req, res, next) {
  const roomCode = typeof req.params.roomCode === 'string'
    ? req.params.roomCode.trim().toUpperCase()
    : '';
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return res.status(400).json({ success: false, message: 'Room code must be 6 letters or numbers' });
  }

  try {
    const match = await Match.findOne({ roomCode });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match room was not found' });
    }
    if (!isSameUser(match.host, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the host can start the match' });
    }
    if (match.status !== 'LOBBY') {
      return res.status(409).json({ success: false, message: 'This match has already left the lobby' });
    }
    if (!match.guest || !match.readyStates.hostReady || !match.readyStates.guestReady) {
      return res.status(409).json({ success: false, message: 'Both players must join and be ready before starting' });
    }

    const startedMatch = await Match.findOneAndUpdate(
      {
        _id: match._id,
        status: 'LOBBY',
        guest: { $ne: null },
        'readyStates.hostReady': true,
        'readyStates.guestReady': true
      },
      { $set: { status: 'ACTIVE', startTime: new Date() } },
      { new: true, runValidators: true }
    );

    if (!startedMatch) {
      return res.status(409).json({ success: false, message: 'Lobby state changed. Refresh before starting.' });
    }
    const populatedMatch = await populateParticipants(Match.findById(startedMatch._id));
    return res.status(200).json({ success: true, match: populatedMatch });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createMatch,
  getMatchByCode,
  joinMatch,
  getUserMatchHistory,
  updateReadyState,
  startMatch
};
