import Anthropic from '@anthropic-ai/sdk';
import { truncateToLimit } from './formatter.js';

const MAX_TWEET_LENGTH = 280;
const MODEL = 'claude-sonnet-4-20250514';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the content voice for traderdb.space — a platform that tracks and analyzes trading performance.

Your audience: serious traders who want data-driven insights, not motivation. They track P&L, review journals, and care about edge and expectancy. They will scroll past anything generic.

TONE RULES:
- Direct and specific. Cut filler openers like "Remember:", "Key insight:", "The truth is:".
- Slightly contrarian — challenge common trading myths with data or specific behavioral observations.
- Never generic motivational content. Nothing like "stay disciplined" or "believe in your system" without a specific, falsifiable claim attached.
- No decorative punctuation. No "→" bullet padding. No em-dash used as filler.
- No hashtags.

CONTENT PILLARS — rotate across all 7 days, no two consecutive days on the same pillar:
1. Trading psychology mistakes: name the specific cognitive error, cite what the data shows (win rate illusions, overtrading after drawdown, revenge trading frequency, etc.).
2. Risk management: position sizing math, max drawdown thresholds, expectancy formulas, correlation risk — never vague "manage your risk".
3. Journaling and self-review habits: what specific metrics to log, how to find blind spots in your own data, review cadence.
4. Pattern recognition: what distinguishes a statistical losing streak from a broken edge, how to read your own trade data for drift.

OUTPUT FORMAT — respond with valid JSON only. No markdown. No code fences. No commentary before or after the JSON object. The response must start with { and end with }.

JSON SCHEMA:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "shortTweet": "string — punchy, under 280 chars, contrarian hook or sharp observation",
      "eduTweet": "string — educational, specific stat or mechanic, under 280 chars",
      "thread": ["string", "string", "string", "string", "string"]
    }
  ]
}

HARD CONSTRAINTS:
- days array must have exactly 7 elements.
- shortTweet must be strictly under 280 characters.
- eduTweet must be strictly under 280 characters.
- thread must have between 5 and 7 strings. Each string must be strictly under 280 characters.
- The first thread tweet must hook without clickbait. The last must land a concrete takeaway.
- Vary the pillar and sub-topic across all 7 days.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate 7 consecutive YYYY-MM-DD date strings starting from `from`.
 */
function nextSevenDates(from) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Build the user-turn prompt, optionally restricted to a subset of dates.
 */
function buildPrompt(dates) {
  return `Generate Twitter/X content for traderdb.space for these exact dates: ${dates.join(', ')}.

Return a JSON object matching the schema in the system prompt. The days array must contain exactly ${dates.length} element(s), one per date listed above, in the same order.

Every shortTweet and eduTweet must be under 280 characters. Every tweet inside thread must be under 280 characters. thread must have 5–7 elements.

Respond with JSON only — no text before or after.`;
}

/**
 * Strip any markdown fences the model may have emitted, then parse JSON.
 * Throws a descriptive error if parsing fails.
 */
function parseJSON(raw) {
  // Strip common markdown code fences
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the outermost JSON object in case there is any stray prefix text
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new SyntaxError(`No JSON object found in response. Raw: ${cleaned.slice(0, 200)}`);
  }
  cleaned = cleaned.slice(start, end + 1);

  return JSON.parse(cleaned);
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a single day object.
 * Returns { ok: boolean, errors: string[] }.
 */
function validateDay(day, index) {
  const errors = [];
  const tag = `days[${index}]`;

  if (!day || typeof day !== 'object') {
    return { ok: false, errors: [`${tag} is not an object`] };
  }

  if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
    errors.push(`${tag}.date is not a YYYY-MM-DD string`);
  }

  for (const field of ['shortTweet', 'eduTweet']) {
    if (typeof day[field] !== 'string') {
      errors.push(`${tag}.${field} is not a string`);
    } else if (day[field].length > MAX_TWEET_LENGTH) {
      errors.push(`${tag}.${field} is ${day[field].length} chars (max ${MAX_TWEET_LENGTH})`);
    }
  }

  if (!Array.isArray(day.thread)) {
    errors.push(`${tag}.thread is not an array`);
  } else {
    if (day.thread.length < 5 || day.thread.length > 7) {
      errors.push(`${tag}.thread has ${day.thread.length} items (need 5–7)`);
    }
    day.thread.forEach((t, ti) => {
      if (typeof t !== 'string') {
        errors.push(`${tag}.thread[${ti}] is not a string`);
      } else if (t.length > MAX_TWEET_LENGTH) {
        errors.push(`${tag}.thread[${ti}] is ${t.length} chars (max ${MAX_TWEET_LENGTH})`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Returns only the length-violation errors for a day (structural errors excluded).
 * Used to decide whether truncation alone can fix a day.
 */
function hasOnlyLengthViolations(day, index) {
  const { errors } = validateDay(day, index);
  return errors.length > 0 && errors.every((e) => e.includes('chars (max'));
}

/**
 * Apply truncation to every tweet field in a day object.
 */
function truncateDay(day) {
  return {
    ...day,
    shortTweet: typeof day.shortTweet === 'string' ? truncateToLimit(day.shortTweet) : day.shortTweet,
    eduTweet: typeof day.eduTweet === 'string' ? truncateToLimit(day.eduTweet) : day.eduTweet,
    thread: Array.isArray(day.thread)
      ? day.thread.map((t) => (typeof t === 'string' ? truncateToLimit(t) : t))
      : day.thread,
  };
}

// ── API call ─────────────────────────────────────────────────────────────────

/**
 * Make one Claude API call and return the raw response text.
 * The system prompt is marked for prompt caching.
 */
async function callClaude(userPrompt) {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    },
    {
      headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
    },
  );

  if (!response.content?.[0]?.text) {
    throw new Error(`Unexpected API response shape: ${JSON.stringify(response).slice(0, 200)}`);
  }

  return response.content[0].text;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate 7 days of traderdb.space content using Claude.
 *
 * Strategy:
 *  1. Full generation attempt.
 *  2. If any days have length violations, attempt targeted regeneration for
 *     only the violating dates (one additional API call).
 *  3. Any violations that survive regeneration are truncated as a last resort.
 *
 * @param {Date} [startDate=new Date()] - First day of the 7-day window.
 * @returns {Promise<Array<{ date: string, shortTweet: string, eduTweet: string, thread: string[] }>>}
 */
export async function generateWeeklyContent(startDate = new Date()) {
  const dates = nextSevenDates(startDate);

  // ── Attempt 1: full generation ─────────────────────────────────────────────
  let raw;
  let parsed;

  const MAX_PARSE_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    raw = await callClaude(buildPrompt(dates));
    try {
      parsed = parseJSON(raw);
      break;
    } catch (err) {
      console.warn(`[ai] JSON parse failed (attempt ${attempt}/${MAX_PARSE_ATTEMPTS}): ${err.message}`);
      if (attempt === MAX_PARSE_ATTEMPTS) {
        throw new Error(`Claude did not return valid JSON after ${MAX_PARSE_ATTEMPTS} attempts. Last error: ${err.message}`);
      }
    }
  }

  if (!Array.isArray(parsed.days) || parsed.days.length !== 7) {
    throw new Error(
      `Expected 7 days in response, got ${Array.isArray(parsed.days) ? parsed.days.length : typeof parsed.days}`,
    );
  }

  // ── Attempt 2: targeted regeneration for length violations ────────────────
  const violatingDates = parsed.days
    .filter((day, i) => {
      const { ok } = validateDay(day, i);
      return !ok;
    })
    .map((day) => day.date)
    .filter(Boolean);

  if (violatingDates.length > 0) {
    console.warn(`[ai] ${violatingDates.length} day(s) have violations (${violatingDates.join(', ')}), regenerating…`);

    try {
      const regenRaw = await callClaude(buildPrompt(violatingDates));
      const regenParsed = parseJSON(regenRaw);

      if (Array.isArray(regenParsed.days)) {
        for (const regenDay of regenParsed.days) {
          const idx = parsed.days.findIndex((d) => d.date === regenDay.date);
          if (idx !== -1) {
            const { ok } = validateDay(regenDay, idx);
            if (ok) {
              parsed.days[idx] = regenDay;
              console.log(`[ai] Regenerated day ${regenDay.date} successfully.`);
            } else {
              console.warn(`[ai] Regenerated day ${regenDay.date} still has violations — will truncate.`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ai] Targeted regeneration failed: ${err.message} — falling back to truncation.`);
    }
  }

  // ── Final pass: truncate any remaining violations ─────────────────────────
  const result = parsed.days.map((day, i) => {
    const { ok, errors } = validateDay(day, i);
    if (ok) return day;

    console.warn(`[ai] Truncating day ${day.date ?? i} due to: ${errors.join('; ')}`);
    return truncateDay(day);
  });

  return result;
}
