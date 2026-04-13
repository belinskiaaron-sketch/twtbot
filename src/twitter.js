import { TwitterApi, ApiResponseError } from 'twitter-api-v2';

// ── Client singleton ─────────────────────────────────────────────────────────

let _client = null;

/**
 * Build (or return the cached) authenticated readWrite client.
 * Validates that all four credential env vars are present so the
 * error surfaces at call time, not at module load time.
 */
function getClient() {
  const { TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET } =
    process.env;

  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    throw new Error(
      '[twitter] Missing credentials — ensure TWITTER_API_KEY, TWITTER_API_SECRET, ' +
        'TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET are set in your .env file.',
    );
  }

  if (!_client) {
    _client = new TwitterApi({
      appKey: TWITTER_API_KEY,
      appSecret: TWITTER_API_SECRET,
      accessToken: TWITTER_ACCESS_TOKEN,
      accessSecret: TWITTER_ACCESS_SECRET,
    });
  }

  return _client.readWrite;
}

// ── Error handling ───────────────────────────────────────────────────────────

/**
 * Format a rate-limit reset timestamp (Unix seconds) as a human-readable string.
 */
function formatReset(resetUnix) {
  if (!resetUnix) return 'unknown';
  return new Date(resetUnix * 1000).toISOString();
}

/**
 * Wrap any twitter-api-v2 call with consistent error handling:
 *
 *  - Rate limit (429): logs limit / remaining / reset time, then throws an
 *    Error with code=429 and rateLimitReset attached so callers can schedule
 *    a retry without re-parsing the details.
 *
 *  - Other API errors: throws an Error whose message includes the HTTP status
 *    and the full API response body as a JSON string.
 *
 *  - Non-API errors (network, etc.): re-thrown unchanged.
 *
 * @template T
 * @param {() => Promise<T>} fn      The API call to execute.
 * @param {string}           context Short label used in log / error messages.
 * @returns {Promise<T>}
 */
async function withErrorHandling(fn, context) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiResponseError) {
      if (err.rateLimitError) {
        const resetUnix = err.rateLimit?.reset;
        console.warn(
          `[twitter] Rate limit hit during "${context}". ` +
            `Limit: ${err.rateLimit?.limit ?? '?'} | ` +
            `Remaining: ${err.rateLimit?.remaining ?? '?'} | ` +
            `Resets at: ${formatReset(resetUnix)}`,
        );
        const rl = new Error(
          `[twitter] Rate limited during "${context}". ` +
            `Try again after ${formatReset(resetUnix)}.`,
        );
        rl.code = 429;
        rl.rateLimitReset = resetUnix ?? null;
        throw rl;
      }

      // Any other API error — include the full response body.
      const body = JSON.stringify(err.data ?? {});
      throw new Error(
        `[twitter] "${context}" failed (HTTP ${err.code}): ${body}`,
      );
    }

    // Network-level or unexpected errors — re-throw as-is.
    throw err;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Post a single tweet.
 *
 * @param {string} text - Tweet text (must be ≤ 280 characters).
 * @returns {Promise<string>} The ID of the created tweet.
 * @throws {Error} On rate-limit (logged) or any other API failure.
 */
export async function postTweet(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new TypeError('[twitter] postTweet: text must be a non-empty string');
  }

  const client = getClient();
  const result = await withErrorHandling(() => client.v2.tweet(text), 'postTweet');
  return result.data.id;
}

/**
 * Post a thread by replying each tweet to the previous one in sequence.
 *
 * If a tweet in the middle of the thread fails, the error message includes
 * the index and the IDs of tweets that were already posted, so partial
 * threads can be identified and cleaned up if needed.
 *
 * @param {string[]} tweets - Ordered array of tweet texts.
 * @returns {Promise<string[]>} Ordered array of created tweet IDs.
 * @throws {TypeError} If `tweets` is not a non-empty array of strings.
 * @throws {Error}     On rate-limit (logged) or any other API failure.
 */
export async function postThread(tweets) {
  if (!Array.isArray(tweets) || tweets.length === 0) {
    throw new TypeError('[twitter] postThread: tweets must be a non-empty array');
  }

  const client = getClient();
  const ids = [];
  let replyToId;

  for (let i = 0; i < tweets.length; i++) {
    const text = tweets[i];

    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new TypeError(`[twitter] postThread: tweets[${i}] must be a non-empty string`);
    }

    const payload = replyToId
      ? { text, reply: { in_reply_to_tweet_id: replyToId } }
      : { text };

    let result;
    try {
      result = await withErrorHandling(
        () => client.v2.tweet(payload),
        `postThread[${i + 1}/${tweets.length}]`,
      );
    } catch (err) {
      // Annotate partial-thread context onto the error before re-throwing.
      const postedSummary =
        ids.length > 0 ? `Already posted tweet IDs: [${ids.join(', ')}].` : 'No tweets posted yet.';
      err.message = `${err.message} — Failed at tweet ${i + 1}/${tweets.length}. ${postedSummary}`;
      throw err;
    }

    replyToId = result.data.id;
    ids.push(replyToId);
  }

  return ids;
}

/**
 * Verify that the stored credentials are valid by calling GET /2/users/me.
 * Logs the authenticated account's username and ID on success.
 *
 * @returns {Promise<{ id: string, name: string, username: string }>} The authenticated user object.
 * @throws {Error} On rate-limit (logged) or credential / API failure.
 */
export async function testConnection() {
  const client = getClient();
  const result = await withErrorHandling(() => client.v2.me(), 'testConnection');
  const { id, name, username } = result.data;
  console.log(`[twitter] Connected as @${username} (name: "${name}", id: ${id})`);
  return result.data;
}
