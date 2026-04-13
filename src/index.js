import 'dotenv/config';
import cron from 'node-cron';
import { generateWeeklyContent } from './ai.js';
import { postTweet } from './twitter.js';
import { postThread } from './twitter.js';
import { saveWeekContent, getTodayContent, markPosted } from './queue.js';

// ── Content generation ──────────────────────────────────────────────────────

async function generate() {
  console.log('[generate] Requesting content from Claude…');
  const days = await generateWeeklyContent();
  const filePath = await saveWeekContent(days);
  console.log(`[generate] Saved ${days.length} days of content → ${filePath}`);
  return days;
}

// ── Posting ─────────────────────────────────────────────────────────────────

async function postNext() {
  const today = await getTodayContent();
  if (!today) {
    console.log('[post] No content for today — run generate first.');
    return null;
  }

  // Post in order: shortTweet → eduTweet → thread (skip already-posted types)
  for (const type of ['shortTweet', 'eduTweet', 'thread']) {
    if (today.posted?.[type]) continue;

    if (type === 'thread') {
      console.log(`[post] Posting thread for ${today.date} (${today.thread.length} tweets)…`);
      const tweets = await postThread(today.thread);
      await markPosted(today.date, 'thread');
      console.log(`[post] Thread posted. First tweet id: ${tweets[0].id}`);
      return tweets;
    } else {
      const text = today[type];
      console.log(`[post] Posting ${type} for ${today.date}: "${text}"`);
      const tweet = await postTweet(text);
      await markPosted(today.date, type);
      console.log(`[post] Posted! Tweet id: ${tweet.id}`);
      return tweet;
    }
  }

  console.log(`[post] All content for ${today.date} already posted.`);
  return null;
}

// ── Cron loop (dev mode) ─────────────────────────────────────────────────────

function startCron() {
  console.log('[dev] Starting cron loop…');

  // Generate content every day at 06:00
  cron.schedule('0 6 * * *', async () => {
    try {
      await generate();
    } catch (err) {
      console.error('[cron/generate] Error:', err.message);
    }
  });

  // Post the next queued item every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try {
      await postNext();
    } catch (err) {
      console.error('[cron/post] Error:', err.message);
    }
  });

  console.log('[dev] Scheduled: generate @ 06:00 daily | post @ every 2 hours');
}

// ── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--generate')) {
  await generate();
} else if (args.includes('--post')) {
  await postNext();
} else if (args.includes('--dev')) {
  // Seed queue on first run if today has no content, then start cron
  const today = await getTodayContent();
  if (!today) {
    console.log('[dev] No content for today — running initial generation.');
    await generate();
  }
  startCron();
} else {
  // Default: print today's queue status
  const today = await getTodayContent();
  if (!today) {
    console.log('No content queued for today. Run: npm run generate');
  } else {
    console.log(`Today (${today.date}):`);
    for (const type of ['shortTweet', 'eduTweet', 'thread']) {
      const status = today.posted?.[type] ? `posted at ${today.postedAt[type]}` : 'pending';
      console.log(`  ${type}: ${status}`);
    }
  }
}
