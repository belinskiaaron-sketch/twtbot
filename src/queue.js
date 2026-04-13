import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_DIR = path.resolve(__dirname, '..', 'content-queue');

const VALID_TYPES = new Set(['shortTweet', 'eduTweet', 'thread']);
const TYPE_ORDER  = ['shortTweet', 'eduTweet', 'thread'];

// ── Internal helpers ─────────────────────────────────────────────────────────

function weekFilePath(startDate) {
  return path.join(QUEUE_DIR, `week-${startDate}.json`);
}

/** Return today's date as a YYYY-MM-DD string in local time. */
function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * List all week-YYYY-MM-DD.json files in QUEUE_DIR, sorted newest first.
 * Creates the directory if it doesn't exist.
 */
async function listWeekFiles() {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  const entries = await fs.readdir(QUEUE_DIR);
  return entries
    .filter((f) => /^week-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse(); // newest week start date first
}

/**
 * Read and parse a single week file by filename (not full path).
 * Returns { filePath, week } or throws on parse error.
 */
async function readWeekFile(filename) {
  const filePath = path.join(QUEUE_DIR, filename);
  const raw = await fs.readFile(filePath, 'utf8');
  return { filePath, week: JSON.parse(raw) };
}

/**
 * Write a week object back to its file, preserving formatting.
 */
async function writeWeekFile(filePath, week) {
  await fs.writeFile(filePath, JSON.stringify(week, null, 2), 'utf8');
}

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Persist a 7-day content batch to content-queue/week-YYYY-MM-DD.json.
 *
 * Each day is stored with an added `posted` map (type → boolean) and
 * `postedAt` map (type → ISO timestamp | null) so downstream callers
 * can track delivery state without touching the content fields.
 *
 * If a file already exists for the same week start date it is overwritten,
 * which makes re-generation safe to call idempotently.
 *
 * @param {Array<{ date: string, shortTweet: string, eduTweet: string, thread: string[] }>} days
 * @returns {Promise<string>} Absolute path of the written file.
 */
export async function saveWeekContent(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new TypeError('saveWeekContent: days must be a non-empty array');
  }

  await fs.mkdir(QUEUE_DIR, { recursive: true });

  const weekStart = days[0].date;

  const enrichedDays = days.map((day) => ({
    date: day.date,
    shortTweet: day.shortTweet,
    eduTweet: day.eduTweet,
    thread: day.thread,
    posted:   { shortTweet: false, eduTweet: false, thread: false },
    postedAt: { shortTweet: null,  eduTweet: null,  thread: null  },
    skipped:  { shortTweet: false, eduTweet: false, thread: false },
  }));

  const payload = {
    weekStart,
    savedAt: new Date().toISOString(),
    days: enrichedDays,
  };

  const filePath = weekFilePath(weekStart);
  await writeWeekFile(filePath, payload);

  return filePath;
}

/**
 * Find today's content entry from the most recent week file that covers today.
 *
 * Scans week files newest-first and returns the first day object whose `date`
 * field matches today's local date.  Returns `null` when no match is found so
 * callers know generation is needed.
 *
 * @returns {Promise<object|null>} The day object (with `posted`/`postedAt`), or null.
 */
export async function getTodayContent() {
  const today = todayString();
  const files = await listWeekFiles();

  for (const file of files) {
    let parsed;
    try {
      ({ week: parsed } = await readWeekFile(file));
    } catch {
      // Skip unreadable / corrupt files rather than crashing the whole queue.
      console.warn(`[queue] Could not read ${file} — skipping.`);
      continue;
    }

    const day = parsed.days?.find((d) => d.date === today);
    if (day) return day;
  }

  return null;
}

/**
 * Mark one content type for a specific date as posted.
 *
 * Locates the week file that contains `date`, sets
 * `day.posted[type] = true` and `day.postedAt[type] = <ISO timestamp>`,
 * then writes the file back atomically (write-then-rename not needed for
 * single-process use).
 *
 * @param {string} date - YYYY-MM-DD string matching the day's `date` field.
 * @param {'shortTweet'|'eduTweet'|'thread'} type
 * @returns {Promise<object>} The updated day object.
 * @throws {Error} If `type` is invalid or no file contains `date`.
 */
export async function markPosted(date, type) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(
      `markPosted: invalid type "${type}". Must be one of: ${[...VALID_TYPES].join(', ')}`,
    );
  }

  const files = await listWeekFiles();

  for (const file of files) {
    let filePath, week;
    try {
      ({ filePath, week } = await readWeekFile(file));
    } catch {
      continue;
    }

    const dayIndex = week.days?.findIndex((d) => d.date === date);
    if (dayIndex == null || dayIndex === -1) continue;

    const day = week.days[dayIndex];

    // Ensure tracking fields exist in case file was written before this schema.
    if (!day.posted) day.posted = { shortTweet: false, eduTweet: false, thread: false };
    if (!day.postedAt) day.postedAt = { shortTweet: null, eduTweet: null, thread: null };

    day.posted[type] = true;
    day.postedAt[type] = new Date().toISOString();

    await writeWeekFile(filePath, week);
    return day;
  }

  throw new Error(`markPosted: no queue file contains an entry for date "${date}"`);
}

/**
 * Mark one content type for a specific date as skipped.
 * Skipped items are excluded from cron posting and review queues.
 *
 * @param {string} date - YYYY-MM-DD
 * @param {'shortTweet'|'eduTweet'|'thread'} type
 * @returns {Promise<object>} The updated day object.
 */
export async function markSkipped(date, type) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(
      `markSkipped: invalid type "${type}". Must be one of: ${[...VALID_TYPES].join(', ')}`,
    );
  }

  const files = await listWeekFiles();

  for (const file of files) {
    let filePath, week;
    try {
      ({ filePath, week } = await readWeekFile(file));
    } catch {
      continue;
    }

    const dayIndex = week.days?.findIndex((d) => d.date === date);
    if (dayIndex == null || dayIndex === -1) continue;

    const day = week.days[dayIndex];
    if (!day.skipped) day.skipped = { shortTweet: false, eduTweet: false, thread: false };
    day.skipped[type] = true;

    await writeWeekFile(filePath, week);
    return day;
  }

  throw new Error(`markSkipped: no queue file contains an entry for date "${date}"`);
}

/**
 * Overwrite the content text for one type on a given date.
 * Used by the review CLI to persist edits.
 *
 * @param {string} date - YYYY-MM-DD
 * @param {'shortTweet'|'eduTweet'|'thread'} type
 * @param {string|string[]} newContent - String for tweets, string[] for thread.
 * @returns {Promise<object>} The updated day object.
 */
export async function updateContent(date, type, newContent) {
  if (!VALID_TYPES.has(type)) {
    throw new Error(
      `updateContent: invalid type "${type}". Must be one of: ${[...VALID_TYPES].join(', ')}`,
    );
  }

  const files = await listWeekFiles();

  for (const file of files) {
    let filePath, week;
    try {
      ({ filePath, week } = await readWeekFile(file));
    } catch {
      continue;
    }

    const dayIndex = week.days?.findIndex((d) => d.date === date);
    if (dayIndex == null || dayIndex === -1) continue;

    week.days[dayIndex][type] = newContent;
    await writeWeekFile(filePath, week);
    return week.days[dayIndex];
  }

  throw new Error(`updateContent: no queue file contains an entry for date "${date}"`);
}

/**
 * Return all pending (not posted, not skipped) items for today and future dates,
 * sorted chronologically then by canonical type order (shortTweet → eduTweet → thread).
 * Used by the review CLI to present items for human inspection.
 *
 * @returns {Promise<Array<{ date: string, type: string, content: string|string[] }>>}
 */
export async function getUpcomingContent() {
  const today = todayString();
  // listWeekFiles() returns newest-first; reverse for chronological review order.
  const files = (await listWeekFiles()).reverse();
  const items = [];

  for (const file of files) {
    let week;
    try {
      ({ week } = await readWeekFile(file));
    } catch {
      continue;
    }

    for (const day of week.days ?? []) {
      if (day.date < today) continue; // skip past dates

      for (const type of TYPE_ORDER) {
        if (day.posted?.[type])  continue;
        if (day.skipped?.[type]) continue;

        items.push({
          date:    day.date,
          type,
          content: type === 'thread' ? day.thread : day[type],
        });
      }
    }
  }

  return items;
}
