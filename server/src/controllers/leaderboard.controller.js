const User = require('../models/User');

function parsePage(value, fallback, maximum) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return maximum ? Math.min(parsedValue, maximum) : parsedValue;
}

function getTier(rating) {
  if (rating >= 1600) {
    return 'GRANDMASTER';
  }
  if (rating >= 1400) {
    return 'WARLORD';
  }
  if (rating >= 1200) {
    return 'GLADIATOR';
  }
  return 'INITIATE';
}

async function getGlobalLeaderboard(req, res, next) {
  const page = parsePage(req.query.page, 1);
  const limit = parsePage(req.query.limit, 20, 50);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = { isVerified: true };

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { username: { $regex: escapedSearch, $options: 'i' } },
      { cfHandle: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  try {
    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select('_id username cfHandle isVerified platformRating peakRating stats createdAt')
        .sort({ platformRating: -1, 'stats.wins': -1, createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    const leaderboard = users.map((user, index) => {
      const stats = user.stats || {};
      return {
        ...user,
        rank: (page - 1) * limit + index + 1,
        winRate: stats.totalMatches > 0
          ? Number(((stats.wins / stats.totalMatches) * 100).toFixed(1))
          : 0,
        tier: getTier(user.platformRating)
      };
    });

    return res.status(200).json({
      success: true,
      page,
      limit,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      leaderboard
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getGlobalLeaderboard };
