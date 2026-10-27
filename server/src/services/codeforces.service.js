const axios = require('axios');

const CODEFORCES_API = 'https://codeforces.com/api';
const PROBLEMSET_CACHE_TTL_MS = 60 * 60 * 1000;
const USER_STATUS_RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 20000;

let problemsetCache = null;
let problemsetCacheExpiresAt = 0;
let problemsetRequest = null;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function describeApiFailure(error) {
  const status = error.response && error.response.status;
  if (status === 429) {
    return 'Codeforces rate limit reached (HTTP 429)';
  }
  if (status) {
    return `Codeforces returned HTTP ${status}`;
  }
  if (error.code === 'ECONNABORTED') {
    return 'Codeforces request timed out';
  }
  return `Codeforces request failed: ${error.message}`;
}

async function fetchProblemset() {
  if (problemsetCache && Date.now() < problemsetCacheExpiresAt) {
    return problemsetCache;
  }
  if (problemsetRequest) {
    return problemsetRequest;
  }

  problemsetRequest = axios.get(`${CODEFORCES_API}/problemset.problems`, {
    timeout: REQUEST_TIMEOUT_MS
  })
    .then((response) => {
      if (
        response.data.status !== 'OK' ||
        !response.data.result ||
        !Array.isArray(response.data.result.problems)
      ) {
        throw new Error('Codeforces problemset API returned an invalid response');
      }

      const problems = response.data.result.problems
        .filter((problem) => Number.isInteger(problem.contestId) &&
          typeof problem.index === 'string' &&
          typeof problem.name === 'string' &&
          Number.isFinite(problem.rating))
        .map((problem) => ({
          contestId: problem.contestId,
          index: problem.index,
          name: problem.name,
          rating: problem.rating,
          tags: Array.isArray(problem.tags) ? problem.tags : []
        }));

      problemsetCache = problems;
      problemsetCacheExpiresAt = Date.now() + PROBLEMSET_CACHE_TTL_MS;
      return problemsetCache;
    })
    .catch((error) => {
      throw new Error(`Unable to fetch Codeforces problemset: ${error.message}`, { cause: error });
    })
    .finally(() => {
      problemsetRequest = null;
    });

  return problemsetRequest;
}

async function fetchUserSolvedProblems(handle) {
  if (typeof handle !== 'string' || !handle.trim()) {
    throw new TypeError('A Codeforces handle is required to fetch solved problems');
  }

  const normalizedHandle = handle.trim();
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await axios.get(`${CODEFORCES_API}/user.status`, {
        params: { handle: normalizedHandle },
        timeout: REQUEST_TIMEOUT_MS
      });

      if (response.data.status !== 'OK' || !Array.isArray(response.data.result)) {
        const apiComment = response.data.comment ? `: ${response.data.comment}` : '';
        throw new Error(`Codeforces user.status API returned ${response.data.status || 'an invalid response'}${apiComment}`);
      }

      const solvedProblems = new Set();
      for (const submission of response.data.result) {
        const problem = submission.problem;
        if (
          submission.verdict === 'OK' &&
          problem &&
          Number.isInteger(problem.contestId) &&
          typeof problem.index === 'string'
        ) {
          solvedProblems.add(`${problem.contestId}-${problem.index}`);
        }
      }
      return solvedProblems;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await delay(USER_STATUS_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Unable to fetch solved problems for Codeforces handle "${normalizedHandle}" after 2 attempts: ${describeApiFailure(lastError)}`,
    { cause: lastError }
  );
}

module.exports = {
  fetchProblemset,
  fetchUserSolvedProblems
};
