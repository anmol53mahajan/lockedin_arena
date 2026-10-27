const Match = require('../models/Match');
const { fetchUserSubmissions } = require('./codeforces.service');

const POLL_INTERVAL_MS = 13000;
const MATCH_SELECT = 'roomCode host guest status problems scores startTime endTime config.durationMinutes';
let pollInterval = null;
let socketServer = null;
let pollInProgress = false;
const matchChecksInProgress = new Set();

function roomName(roomCode) {
  return `arena:${roomCode}`;
}

function getWinner(hostScore, guestScore) {
  if (hostScore === guestScore) return 'TIE';
  return hostScore > guestScore ? 'HOST' : 'GUEST';
}

function getAcceptedSubmission(submissions, problem, startSeconds) {
  const identifier = `${problem.contestId}-${problem.index}`;
  return submissions
    .filter((submission) =>
      submission.verdict === 'OK' &&
      submission.problem &&
      `${submission.problem.contestId}-${submission.problem.index}` === identifier &&
      Number.isFinite(submission.creationTimeSeconds) &&
      submission.creationTimeSeconds >= startSeconds
    )
    .sort((left, right) => left.creationTimeSeconds - right.creationTimeSeconds)[0] || null;
}

async function loadSubmissions(handle, cache) {
  if (!cache.has(handle)) {
    cache.set(handle, fetchUserSubmissions(handle, 1, 10));
  }
  return cache.get(handle);
}

async function expireMatch(match, io) {
  const finished = await Match.findOneAndUpdate(
    { _id: match._id, status: 'ACTIVE', endTime: { $lte: new Date() } },
    {
      $set: {
        status: 'FINISHED',
        winner: getWinner(match.scores.hostScore, match.scores.guestScore)
      }
    },
    { returnDocument: 'after' }
  ).select('roomCode winner scores');

  if (!finished) return false;
  io.to(roomName(finished.roomCode)).emit('match-ended', {
    reason: 'TIME_EXPIRED',
    winner: finished.winner,
    scores: finished.scores
  });
  return true;
}

async function processMatch(matchId, io, submissionCache = new Map()) {
  const matchKey = matchId.toString();
  if (matchChecksInProgress.has(matchKey)) return;
  matchChecksInProgress.add(matchKey);

  try {
    const match = await Match.findById(matchId)
      .select(MATCH_SELECT)
      .populate('host', 'cfHandle')
      .populate('guest', 'cfHandle');
    if (!match || match.status !== 'ACTIVE') return;

    if (match.endTime && match.endTime.getTime() <= Date.now()) {
      await expireMatch(match, io);
      return;
    }

    if (
      !match.host?.cfHandle ||
      !match.guest?.cfHandle ||
      !match.startTime ||
      !Array.isArray(match.problems)
    ) {
      io.to(roomName(match.roomCode)).emit('sync-error', {
        message: 'Match is missing player handles or start data; contact support.'
      });
      return;
    }

    let hostSubmissions;
    let guestSubmissions;
    try {
      [hostSubmissions, guestSubmissions] = await Promise.all([
        loadSubmissions(match.host.cfHandle, submissionCache),
        loadSubmissions(match.guest.cfHandle, submissionCache)
      ]);
    } catch (error) {
      io.to(roomName(match.roomCode)).emit('sync-error', {
        message: 'Codeforces submissions could not be refreshed. The arena will retry automatically.'
      });
      console.error(`[Poller] Submission refresh failed for room ${match.roomCode}:`, error.message);
      return;
    }

    const startSeconds = match.startTime.getTime() / 1000;
    for (const problem of match.problems) {
      if (problem.status !== 'UNSOLVED') continue;

      const hostAccepted = getAcceptedSubmission(hostSubmissions, problem, startSeconds);
      const guestAccepted = getAcceptedSubmission(guestSubmissions, problem, startSeconds);
      if (!hostAccepted && !guestAccepted) continue;

      let solvedBy = match.host._id;
      let solverHandle = match.host.cfHandle;
      if (
        guestAccepted &&
        (!hostAccepted || guestAccepted.creationTimeSeconds < hostAccepted.creationTimeSeconds)
      ) {
        solvedBy = match.guest._id;
        solverHandle = match.guest.cfHandle;
      }

      const isHostSolver = solvedBy.toString() === match.host._id.toString();
      const points = problem.points;
      const now = new Date();
      const updatedMatch = await Match.findOneAndUpdate(
        {
          _id: match._id,
          status: 'ACTIVE',
          problems: {
            $elemMatch: {
              contestId: problem.contestId,
              index: problem.index,
              status: 'UNSOLVED'
            }
          }
        },
        {
          $set: {
            'problems.$.status': 'LOCKED',
            'problems.$.solvedBy': solvedBy,
            'problems.$.solvedAt': now
          },
          $inc: {
            [isHostSolver ? 'scores.hostScore' : 'scores.guestScore']: points
          }
        },
        { returnDocument: 'after' }
      ).select('roomCode host guest problems scores');

      if (!updatedMatch) continue;

      const problemId = `${problem.contestId}-${problem.index}`;
      io.to(roomName(match.roomCode)).emit('problem-locked', {
        problemId,
        solvedBy: solvedBy.toString(),
        points,
        newScores: updatedMatch.scores,
        solverHandle
      });

      const totalPoints = updatedMatch.problems.reduce((total, item) => total + item.points, 0);
      const winnerScore = isHostSolver
        ? updatedMatch.scores.hostScore
        : updatedMatch.scores.guestScore;

      if (winnerScore > totalPoints / 2) {
        const winner = isHostSolver ? 'HOST' : 'GUEST';
        const finishedMatch = await Match.findOneAndUpdate(
          { _id: match._id, status: 'ACTIVE' },
          {
            $set: {
              status: 'FINISHED',
              winner,
              endTime: now
            }
          },
          { returnDocument: 'after' }
        ).select('roomCode winner scores');

        if (finishedMatch) {
          io.to(roomName(match.roomCode)).emit('match-ended', {
            reason: 'CLINCH_VICTORY',
            winner: finishedMatch.winner,
            scores: finishedMatch.scores
          });
        }
        return;
      }
    }
  } catch (error) {
    console.error(`[Poller] Match check failed for ${matchKey}:`, error);
    throw error;
  } finally {
    matchChecksInProgress.delete(matchKey);
  }
}

async function pollActiveMatches(io) {
  if (pollInProgress) return;
  pollInProgress = true;
  try {
    const activeMatches = await Match.find({ status: 'ACTIVE' }).select('_id').lean();
    const submissionCache = new Map();
    await Promise.all(activeMatches.map((match) => processMatch(match._id, io, submissionCache)));
  } catch (error) {
    console.error('[Poller] Active match scan failed:', error);
  } finally {
    pollInProgress = false;
  }
}

async function syncMatch(roomCode) {
  if (!socketServer) {
    throw new Error('Submission poller has not been started');
  }
  const match = await Match.findOne({ roomCode: roomCode.toUpperCase(), status: 'ACTIVE' }).select('_id');
  if (!match) {
    throw new Error('Active match was not found');
  }
  await processMatch(match._id, socketServer, new Map());
}

function startPoller(io) {
  if (pollInterval) return;
  socketServer = io;
  pollInterval = setInterval(() => {
    void pollActiveMatches(io);
  }, POLL_INTERVAL_MS);
  if (typeof pollInterval.unref === 'function') pollInterval.unref();
  void pollActiveMatches(io);
  console.log(`[Poller] Submission watcher started (${POLL_INTERVAL_MS / 1000}s interval)`);
}

function stopPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  socketServer = null;
  matchChecksInProgress.clear();
}

module.exports = {
  startPoller,
  stopPoller,
  syncMatch,
  expireMatch
};
