const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const User = require('../models/User');
const { expireMatch, syncMatch } = require('../services/poller.service');

const ARENA_ROOM_PREFIX = 'arena:';
const MANUAL_SYNC_COOLDOWN_MS = 10000;
const roomTimers = new Map();
const roomTicksInProgress = new Set();

function getToken(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const authorization = socket.handshake.headers.authorization;
  const bearerMatch = authorization && authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch ? bearerMatch[1].trim() : null;
}

function sameUser(left, right) {
  if (!left || !right) return false;
  return left.toString() === right.toString();
}

function stopRoomTimer(roomCode) {
  const timer = roomTimers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(roomCode);
  }
  roomTicksInProgress.delete(roomCode);
}

async function tickRoom(io, roomCode) {
  if (roomTicksInProgress.has(roomCode)) return;
  roomTicksInProgress.add(roomCode);

  try {
    const match = await Match.findOne({ roomCode, status: 'ACTIVE' })
      .select('roomCode status endTime scores');
    if (!match) {
      stopRoomTimer(roomCode);
      return;
    }

    const remainingMs = Math.max(0, new Date(match.endTime).getTime() - Date.now());
    io.to(`${ARENA_ROOM_PREFIX}${roomCode}`).emit('timer-tick', { remainingMs });

    if (remainingMs <= 0) {
      await expireMatch(match, io);
      stopRoomTimer(roomCode);
    }
  } catch (error) {
    console.error(`[Socket] Timer tick failed for room ${roomCode}:`, error);
  } finally {
    roomTicksInProgress.delete(roomCode);
  }
}

function startRoomTimer(io, roomCode) {
  if (roomTimers.has(roomCode)) return;
  void tickRoom(io, roomCode);
  const timer = setInterval(() => {
    void tickRoom(io, roomCode);
  }, 1000);
  if (typeof timer.unref === 'function') timer.unref();
  roomTimers.set(roomCode, timer);
}

function configureDuelSockets(io, options = {}) {
  const manualSync = options.manualSync || syncMatch;

  io.use(async (socket, next) => {
    const token = getToken(socket);
    if (!token || !process.env.JWT_SECRET) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (typeof payload.id !== 'string' || !mongoose.isValidObjectId(payload.id)) {
        return next(new Error('Invalid authentication token'));
      }

      const user = await User.findById(payload.id).select('_id username');
      if (!user) {
        return next(new Error('Authenticated user was not found'));
      }
      socket.data.user = user;
      return next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return next(new Error('Invalid or expired authentication token'));
      }
      return next(error);
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-arena', async (payload = {}, acknowledge) => {
      const roomCode = typeof payload.roomCode === 'string'
        ? payload.roomCode.trim().toUpperCase()
        : '';
      const requestedUserId = typeof payload.userId === 'string' ? payload.userId : '';
      const respond = typeof acknowledge === 'function' ? acknowledge : () => {};

      if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        return respond({ success: false, message: 'Room code must be six letters or numbers' });
      }
      if (!sameUser(requestedUserId, socket.data.user._id)) {
        return respond({ success: false, message: 'Socket identity does not match the authenticated user' });
      }

      try {
        const match = await Match.findOne({ roomCode }).select('roomCode status host guest endTime');
        if (!match) {
          return respond({ success: false, message: 'Match room was not found' });
        }
        if (!sameUser(match.host, socket.data.user._id) && !sameUser(match.guest, socket.data.user._id)) {
          return respond({ success: false, message: 'Only match participants can join its socket room' });
        }

        const room = `${ARENA_ROOM_PREFIX}${roomCode}`;
        if (socket.data.arenaRoom && socket.data.arenaRoom !== room) {
          await socket.leave(socket.data.arenaRoom);
        }
        const alreadyJoined = socket.rooms.has(room);
        await socket.join(room);
        socket.data.arenaRoom = room;

        if (!alreadyJoined) {
          io.to(room).emit('player-connected', {
            userId: socket.data.user._id.toString(),
            username: socket.data.user.username
          });
        }

        if (match.status === 'ACTIVE') {
          startRoomTimer(io, roomCode);
          const remainingMs = Math.max(0, new Date(match.endTime).getTime() - Date.now());
          socket.emit('timer-tick', { remainingMs });
        } else if (match.status === 'FINISHED') {
          socket.emit('match-ended', {
            reason: match.winner === 'TIE' ? 'TIME_EXPIRED' : 'MATCH_FINISHED',
            winner: match.winner
          });
        }

        return respond({ success: true, room });
      } catch (error) {
        console.error(`[Socket] Unable to join arena ${roomCode}:`, error);
        return respond({ success: false, message: 'Unable to join arena room' });
      }
    });

    socket.on('manual-sync', async (acknowledge) => {
      const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
      const room = socket.data.arenaRoom;
      if (!room) {
        return respond({ success: false, message: 'Join an arena before requesting a sync' });
      }

      const now = Date.now();
      const cooldownUntil = socket.data.manualSyncCooldownUntil || 0;
      if (now < cooldownUntil) {
        return respond({
          success: false,
          message: 'Submission sync is cooling down',
          retryAfterMs: cooldownUntil - now
        });
      }

      socket.data.manualSyncCooldownUntil = now + MANUAL_SYNC_COOLDOWN_MS;
      const roomCode = room.slice(ARENA_ROOM_PREFIX.length);
      socket.emit('sync-started');
      try {
        await manualSync(roomCode);
        socket.emit('sync-complete');
        return respond({ success: true });
      } catch (error) {
        socket.emit('sync-error', { message: error.message || 'Submission sync failed' });
        return respond({ success: false, message: error.message || 'Submission sync failed' });
      }
    });

    socket.on('disconnecting', async () => {
      const user = socket.data.user;
      for (const room of socket.rooms) {
        if (!room.startsWith(ARENA_ROOM_PREFIX)) continue;
        try {
          const sockets = await io.in(room).fetchSockets();
          const hasOtherConnectionForUser = sockets.some((candidate) =>
            candidate.id !== socket.id &&
            candidate.data.user &&
            sameUser(candidate.data.user._id, user._id)
          );
          if (!hasOtherConnectionForUser) {
            io.to(room).emit('player-disconnected', {
              userId: user._id.toString(),
              username: user.username
            });
          }
        } catch (error) {
          console.error(`[Socket] Presence cleanup failed for ${room}:`, error);
        }
      }
    });
  });

  io.on('close', () => {
    for (const roomCode of roomTimers.keys()) {
      stopRoomTimer(roomCode);
    }
  });
}

module.exports = configureDuelSockets;
