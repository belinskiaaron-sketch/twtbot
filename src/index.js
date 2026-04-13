import 'dotenv/config';
import cron from 'node-cron';
import { generateTradingContent } from './ai.js';
import { postTweet } from './twitter.js';
import { formatQueueItem } from './formatter.js';
import { saveItem, loadPending, markPosted, markFailed, pendingCount } from './queue.js';

// ── Content generation ──────────────────────────────────────────────────────

async function generate() {
  console.log('[generate] Requesting content from Claude…');
  const raw = await generateTradingContent();
  const items = raw.map((tweet, i) => formatQueueItem(tweet, i));
  await Promise.all(items.map(saveItem));
  console.log(`[generate] Queued ${items.length} item(s).`);
  return items;
}

// ── Posting ─────────────────────────────────────────────────────────────────

async function postNext() {
  const pending = await loadPending();
  if (pending.length === 0) {
    console.log('[post] Queue is empty — nothing to post.');
    return null;
  }

  const item = pending[0];
  console.log(`[post] Posting item ${item.id}: "${item.text}"`);

  try {
    const tweet = await postTweet(item.text);
    await markPosted(item.id);
    console.log(`[post] Posted! Tweet id: ${tweet.id}`);
    return tweet;
  } catch (err) {
    await markFailed(item.id, err.message);
    console.error(`[post] Failed to post item ${item.id}:`, err.message);
    throw err;
  }
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
  // Seed queue on first run if empty, then start cron
  const count = await pendingCount();
  if (count === 0) {
    console.log('[dev] Queue empty — running initial generation.');
    await generate();
  }
  startCron();
} else {
  // Default: print queue status
  const pending = await loadPending();
  console.log(`Queue status: ${pending.length} item(s) pending.`);
  pending.forEach((item, i) => console.log(`  ${i + 1}. [${item.id}] ${item.text}`));
}
