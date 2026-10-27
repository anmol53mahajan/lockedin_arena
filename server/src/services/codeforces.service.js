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

async function fetchWithRetry(url, config, endpointLabel) {
  let lastError;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await axios.get(url, {
        ...config,
        timeout: REQUEST_TIMEOUT_MS
      });

      if (response.status === 429) {
        const rateLimitError = new Error('Codeforces rate limit reached (HTTP 429)');
        rateLimitError.response = response;
        throw rateLimitError;
      }

      if (response.data.status !== 'OK') {
        const apiComment = response.data.comment ? `: ${response.data.comment}` : '';
        throw new Error(`Codeforces ${endpointLabel} API returned ${response.data.status || 'an invalid response'}${apiComment}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await delay(USER_STATUS_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Unable to fetch Codeforces ${endpointLabel} after 2 attempts: ${describeApiFailure(lastError)}`,
    { cause: lastError }
  );
}

async function fetchProblemset() {
  if (problemsetCache && Date.now() < problemsetCacheExpiresAt) {
    return problemsetCache;
  }
  if (problemsetRequest) {
    return problemsetRequest;
  }

  problemsetRequest = fetchWithRetry(
    `${CODEFORCES_API}/problemset.problems`,
    {},
    'problemset'
  )
    .then((response) => {
      if (
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

  const submissions = await fetchUserSubmissions(handle);
  const solvedProblems = new Set();
  for (const submission of submissions) {
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
}

async function fetchUserSubmissions(handle, from = 1, count = 10) {
  if (typeof handle !== 'string' || !handle.trim()) {
    throw new TypeError('A Codeforces handle is required to fetch submissions');
  }
  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(count) || count < 1 || count > 1000) {
    throw new TypeError('Submission range must use a positive start index and a count between 1 and 1000');
  }

  const normalizedHandle = handle.trim();
  const response = await fetchWithRetry(
    `${CODEFORCES_API}/user.status`,
    { params: { handle: normalizedHandle, from, count } },
    `user.status for "${normalizedHandle}"`
  );
  if (!Array.isArray(response.data.result)) {
    throw new Error(`Codeforces user.status for "${normalizedHandle}" returned an invalid submissions list`);
  }
  return response.data.result;
}

module.exports = {
  fetchProblemset,
  fetchUserSolvedProblems,
  fetchUserSubmissions
};
