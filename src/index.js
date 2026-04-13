import 'dotenv/config';
import cron from 'node-cron';
import { generateWeeklyContent } from './ai.js';
import { postTweet, postThread } from './twitter.js';
import { saveWeekContent, getTodayContent, markPosted } from './queue.js';

// ── Logger ───────────────────────────────────────────────────────────────────

function log(label, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${label}] ${msg}`);
}

function logError(label, msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${label}] ERROR: ${msg}`);
}

// ── Job implementations ───────────────────────────────────────────────────────

/**
 * Generate a fresh week of content and persist it to the queue.
 */
async function jobGenerate() {
  log('generate', 'Requesting weekly content from Claude…');
  const days = await generateWeeklyContent();
  const filePath = await saveWeekContent(days);
  log('generate', `Saved ${days.length} days of content → ${filePath}`);
  return days;
}

/**
 * Post today's shortTweet unless it has already been posted.
 */
async function jobShortTweet() {
  log('shortTweet', 'Job triggered.');
  const today = await getTodayContent();

  if (!today) {
    log('shortTweet', 'No content queued for today — skipping.');
    return;
  }
  if (today.posted?.shortTweet) {
    log('shortTweet', `Already posted for ${today.date} — skipping.`);
    return;
  }
  if (today.skipped?.shortTweet) {
    log('shortTweet', `Marked skipped in review for ${today.date} — skipping.`);
    return;
  }

  log('shortTweet', `Posting for ${today.date}: "${today.shortTweet}"`);
  const id = await postTweet(today.shortTweet);
  await markPosted(today.date, 'shortTweet');
  log('shortTweet', `Done. Tweet id: ${id}`);
}

/**
 * Post today's eduTweet unless it has already been posted.
 */
async function jobEduTweet() {
  log('eduTweet', 'Job triggered.');
  const today = await getTodayContent();

  if (!today) {
    log('eduTweet', 'No content queued for today — skipping.');
    return;
  }
  if (today.posted?.eduTweet) {
    log('eduTweet', `Already posted for ${today.date} — skipping.`);
    return;
  }
  if (today.skipped?.eduTweet) {
    log('eduTweet', `Marked skipped in review for ${today.date} — skipping.`);
    return;
  }

  log('eduTweet', `Posting for ${today.date}: "${today.eduTweet}"`);
  const id = await postTweet(today.eduTweet);
  await markPosted(today.date, 'eduTweet');
  log('eduTweet', `Done. Tweet id: ${id}`);
}

/**
 * Post today's thread unless it has already been posted.
 */
async function jobThread() {
  log('thread', 'Job triggered.');
  const today = await getTodayContent();

  if (!today) {
    log('thread', 'No content queued for today — skipping.');
    return;
  }
  if (today.posted?.thread) {
    log('thread', `Already posted for ${today.date} — skipping.`);
    return;
  }
  if (today.skipped?.thread) {
    log('thread', `Marked skipped in review for ${today.date} — skipping.`);
    return;
  }

  log('thread', `Posting ${today.thread.length}-tweet thread for ${today.date}…`);
  const ids = await postThread(today.thread);
  await markPosted(today.date, 'thread');
  log('thread', `Done. Tweet ids: [${ids.join(', ')}]`);
}

// ── Safe wrapper ─────────────────────────────────────────────────────────────

/**
 * Wrap a job function so any thrown error is logged without crashing the
 * process.  Used as the cron callback so a single failed run never kills
 * the scheduler.
 */
function safeJob(label, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      logError(label, err.message);
    }
  };
}

// ── Cron scheduler ────────────────────────────────────────────────────────────

const TZ = 'America/New_York';

/**
 * Register all four cron tasks and return them so the shutdown handler can
 * stop them cleanly.
 *
 * Schedule (all times America/New_York):
 *   09:00 daily  — morning shortTweet
 *   13:00 daily  — afternoon eduTweet
 *   19:00 daily  — evening thread
 *   00:00 Sunday — weekly content generation
 */
function startCron() {
  const tasks = [
    cron.schedule('0 9 * * *',  safeJob('shortTweet', jobShortTweet), { timezone: TZ }),
    cron.schedule('0 13 * * *', safeJob('eduTweet',   jobEduTweet),   { timezone: TZ }),
    cron.schedule('0 19 * * *', safeJob('thread',     jobThread),     { timezone: TZ }),
    cron.schedule('0 0 * * 0',  safeJob('generate',   jobGenerate),   { timezone: TZ }),
  ];

  log('cron', `4 jobs scheduled (timezone: ${TZ})`);
  log('cron', '  09:00 ET daily   → shortTweet');
  log('cron', '  13:00 ET daily   → eduTweet');
  log('cron', '  19:00 ET daily   → thread');
  log('cron', '  00:00 ET Sunday  → weekly generation');

  return tasks;
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function registerShutdown(tasks) {
  function shutdown(signal) {
    log('shutdown', `${signal} received — stopping all cron tasks…`);
    for (const task of tasks) {
      task.stop();
      task.destroy();
    }
    log('shutdown', 'All tasks stopped. Exiting.');
    process.exit(0);
  }

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ── One-shot helpers (used by --generate and --post CLI flags) ─────────────────

/**
 * Post the first unposted content type for today in order:
 * shortTweet → eduTweet → thread.
 */
async function runPostNext() {
  const today = await getTodayContent();
  if (!today) {
    log('post', 'No content queued for today. Run: npm run generate');
    return;
  }

  for (const type of ['shortTweet', 'eduTweet', 'thread']) {
    if (today.posted?.[type]) {
      log('post', `${type} already posted for ${today.date} — skipping.`);
      continue;
    }
    if (today.skipped?.[type]) {
      log('post', `${type} marked skipped in review for ${today.date} — skipping.`);
      continue;
    }

    if (type === 'thread') {
      await jobThread();
    } else if (type === 'shortTweet') {
      await jobShortTweet();
    } else {
      await jobEduTweet();
    }
    return; // post one type per invocation
  }

  log('post', `All content for ${today.date} already posted.`);
}

// ── Startup content check ─────────────────────────────────────────────────────

/**
 * If there is no content for today, generate a fresh week immediately so the
 * day-one posting jobs have something to work with.
 */
async function seedIfEmpty() {
  log('startup', 'Checking for today\'s content…');
  const today = await getTodayContent();

  if (!today) {
    log('startup', 'No content for today — generating a fresh week now.');
    await jobGenerate();
  } else {
    const pending = Object.entries(today.posted ?? {})
      .filter(([, v]) => !v)
      .map(([k]) => k);
    const posted = Object.entries(today.posted ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    log('startup', `Content ready for ${today.date}. Pending: [${pending.join(', ')}] | Posted: [${posted.join(', ')}]`);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--generate')) {
  // One-shot: generate this week's content and exit.
  await jobGenerate();

} else if (args.includes('--post')) {
  // One-shot: post the next pending item for today and exit.
  await runPostNext();

} else {
  // Daemon mode (npm start or npm run dev).
  // 1. Seed content if today has none.
  // 2. Start all cron jobs.
  // 3. Register shutdown handlers and keep the process alive.
  await seedIfEmpty();
  const tasks = startCron();
  registerShutdown(tasks);
  log('startup', 'Daemon running. Press Ctrl+C to stop.');
}
