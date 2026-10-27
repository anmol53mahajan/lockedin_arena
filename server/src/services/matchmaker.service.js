const crypto = require('crypto');
const {
  fetchProblemset,
  fetchUserSolvedProblems
} = require('./codeforces.service');

function problemIdentifier(problem) {
  return `${problem.contestId}-${problem.index}`;
}

function isEligibleProblem(problem) {
  if (!Number.isInteger(problem.contestId) || problem.contestId > 100000) {
    return false;
  }
  return !problem.tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === 'interactive');
}

function validateTier(tier, index) {
  if (
    !tier ||
    !Number.isFinite(tier.minRating) ||
    !Number.isFinite(tier.maxRating) ||
    tier.minRating < 0 ||
    tier.maxRating < tier.minRating ||
    !Number.isInteger(tier.points) ||
    tier.points <= 0
  ) {
    throw new TypeError(`Problem tier ${index + 1} has invalid rating bounds or points`);
  }
}

function selectRandom(items) {
  return items[crypto.randomInt(items.length)];
}

async function selectMatchProblems(hostHandle, guestHandle, problemTiers) {
  if (!Array.isArray(problemTiers) || problemTiers.length === 0) {
    throw new TypeError('At least one problem tier is required to generate a match problem set');
  }
  problemTiers.forEach(validateTier);

  const [hostSolved, guestSolved] = await Promise.all([
    fetchUserSolvedProblems(hostHandle),
    fetchUserSolvedProblems(guestHandle)
  ]);
  const solvedUnion = new Set([...hostSolved, ...guestSolved]);
  const problemset = await fetchProblemset();
  const availableProblems = problemset.filter((problem) =>
    isEligibleProblem(problem) && !solvedUnion.has(problemIdentifier(problem))
  );
  const remainingProblems = new Map(
    availableProblems.map((problem) => [problemIdentifier(problem), problem])
  );
  const selectedProblems = [];

  for (let index = 0; index < problemTiers.length; index += 1) {
    const tier = problemTiers[index];
    let candidates = Array.from(remainingProblems.values()).filter((problem) =>
      problem.rating >= tier.minRating && problem.rating <= tier.maxRating
    );

    if (candidates.length === 0) {
      const expandedMinimum = Math.max(0, tier.minRating - 100);
      const expandedMaximum = tier.maxRating + 100;
      candidates = Array.from(remainingProblems.values()).filter((problem) =>
        problem.rating >= expandedMinimum && problem.rating <= expandedMaximum
      );
    }

    if (candidates.length === 0) {
      throw new Error(
        `No unsolved Codeforces problems available for slot ${tier.slot || index + 1} in rating band ${tier.minRating}-${tier.maxRating}, including the 100-point tolerance`
      );
    }

    const candidate = selectRandom(candidates);
    remainingProblems.delete(problemIdentifier(candidate));
    selectedProblems.push({
      contestId: candidate.contestId,
      index: candidate.index,
      name: candidate.name,
      rating: candidate.rating,
      points: tier.points,
      problemUrl: `https://codeforces.com/problemset/problem/${candidate.contestId}/${candidate.index}`,
      status: 'UNSOLVED',
      solvedBy: null,
      solvedAt: null
    });
  }

  return selectedProblems;
}

module.exports = { selectMatchProblems };
