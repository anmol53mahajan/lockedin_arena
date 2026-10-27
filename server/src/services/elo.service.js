const Match = require('../models/Match');
const User = require('../models/User');

const K_FACTOR = 32;
const MINIMUM_RATING = 100;

function calculateEloDelta(playerRating, opponentRating, actualScore, K = K_FACTOR) {
  if (
    !Number.isFinite(playerRating) ||
    !Number.isFinite(opponentRating) ||
    ![0, 0.5, 1].includes(actualScore) ||
    !Number.isFinite(K) ||
    K <= 0
  ) {
    throw new TypeError('Elo calculation requires valid ratings, an actual score of 0, 0.5, or 1, and a positive K factor');
  }

  const expectedScore = 1 / (1 + (10 ** ((opponentRating - playerRating) / 400)));
  return Math.round(K * (actualScore - expectedScore));
}

function getOutcome(hostScore, guestScore) {
  if (hostScore > guestScore) {
    return { winner: 'HOST', hostActual: 1, guestActual: 0 };
  }
  if (guestScore > hostScore) {
    return { winner: 'GUEST', hostActual: 0, guestActual: 1 };
  }
  return { winner: 'TIE', hostActual: 0.5, guestActual: 0.5 };
}

function getSettlementSummary(match) {
  return {
    matchId: match._id.toString(),
    roomCode: match.roomCode,
    winner: match.winner,
    terminationReason: match.terminationReason,
    scores: match.scores,
    deltas: {
      host: match.hostDelta,
      guest: match.guestDelta
    },
    ratings: {
      hostBefore: match.hostRatingBefore,
      hostAfter: match.hostRatingAfter,
      guestBefore: match.guestRatingBefore,
      guestAfter: match.guestRatingAfter
    }
  };
}

async function applyPlayerSettlement({ player, match, ratingBefore, ratingAfter, delta, result }) {
  const statsField = result === 'TIE' ? 'ties' : result === 'WIN' ? 'wins' : 'losses';
  await User.updateOne(
    { _id: player._id, matches: { $ne: match._id } },
    {
      $set: {
        platformRating: ratingAfter,
        peakRating: Math.max(player.peakRating || 1200, ratingAfter)
      },
      $inc: {
        'stats.totalMatches': 1,
        [`stats.${statsField}`]: 1
      },
      $push: {
        ratingHistory: {
          matchId: match._id,
          oldRating: ratingBefore,
          newRating: ratingAfter,
          delta,
          timestamp: match.endTime
        }
      },
      $addToSet: { matches: match._id }
    }
  );
}

async function finalizeMatch(matchId, terminationReason) {
  if (!['CLINCH_VICTORY', 'TIME_EXPIRED'].includes(terminationReason)) {
    throw new TypeError('Match termination reason must be CLINCH_VICTORY or TIME_EXPIRED');
  }

  let match = await Match.findById(matchId)
    .populate('host', 'platformRating peakRating')
    .populate('guest', 'platformRating peakRating');
  if (!match) {
    throw new Error('Match was not found for finalization');
  }
  if (match.status === 'FINISHED') {
    return { ...getSettlementSummary(match), newlyFinalized: false };
  }
  if (!match.host || !match.guest) {
    throw new Error('Both match participants must exist before settlement');
  }

  if (match.status === 'ACTIVE') {
    const outcome = getOutcome(match.scores.hostScore, match.scores.guestScore);
    const hostRatingBefore = Number(match.host.platformRating || 1200);
    const guestRatingBefore = Number(match.guest.platformRating || 1200);
    const hostDelta = calculateEloDelta(hostRatingBefore, guestRatingBefore, outcome.hostActual);
    const guestDelta = calculateEloDelta(guestRatingBefore, hostRatingBefore, outcome.guestActual);
    const endTime = new Date();
    const claimed = await Match.findOneAndUpdate(
      { _id: match._id, status: 'ACTIVE' },
      {
        $set: {
          status: 'SETTLING',
          winner: outcome.winner,
          terminationReason,
          endTime,
          hostRatingBefore,
          hostRatingAfter: Math.max(MINIMUM_RATING, hostRatingBefore + hostDelta),
          hostDelta,
          guestRatingBefore,
          guestRatingAfter: Math.max(MINIMUM_RATING, guestRatingBefore + guestDelta),
          guestDelta
        }
      },
      { returnDocument: 'after' }
    );

    if (!claimed) {
      match = await Match.findById(matchId)
        .populate('host', 'platformRating peakRating')
        .populate('guest', 'platformRating peakRating');
      if (!match || match.status === 'FINISHED') {
        return match ? { ...getSettlementSummary(match), newlyFinalized: false } : null;
      }
      if (match.status !== 'SETTLING') {
        throw new Error(`Match cannot be finalized from ${match.status} status`);
      }
    } else {
      match = await Match.findById(claimed._id)
        .populate('host', 'platformRating peakRating')
        .populate('guest', 'platformRating peakRating');
      if (!match?.host || !match?.guest) {
        throw new Error('Both match participants must exist before settlement');
      }
    }
  } else if (match.status !== 'SETTLING') {
    throw new Error(`Match cannot be finalized from ${match.status} status`);
  }

  const isHostWinner = match.winner === 'HOST';
  const isGuestWinner = match.winner === 'GUEST';
  await Promise.all([
    applyPlayerSettlement({
      player: match.host,
      match,
      ratingBefore: match.hostRatingBefore,
      ratingAfter: match.hostRatingAfter,
      delta: match.hostDelta,
      result: match.winner === 'TIE' ? 'TIE' : isHostWinner ? 'WIN' : 'LOSS'
    }),
    applyPlayerSettlement({
      player: match.guest,
      match,
      ratingBefore: match.guestRatingBefore,
      ratingAfter: match.guestRatingAfter,
      delta: match.guestDelta,
      result: match.winner === 'TIE' ? 'TIE' : isGuestWinner ? 'WIN' : 'LOSS'
    })
  ]);

  const settledMatch = await Match.findOneAndUpdate(
    { _id: match._id, status: 'SETTLING' },
    { $set: { status: 'FINISHED' } },
    { returnDocument: 'after' }
  )
    .populate('host', 'username cfHandle platformRating peakRating')
    .populate('guest', 'username cfHandle platformRating peakRating');

  if (!settledMatch) {
    const currentMatch = await Match.findById(match._id)
      .populate('host', 'platformRating peakRating')
      .populate('guest', 'platformRating peakRating');
    if (currentMatch?.status === 'FINISHED') {
      return { ...getSettlementSummary(currentMatch), newlyFinalized: false };
    }
    throw new Error('Match settlement could not be completed');
  }

  return { ...getSettlementSummary(settledMatch), newlyFinalized: true };
}

module.exports = { calculateEloDelta, finalizeMatch };
