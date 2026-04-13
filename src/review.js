import 'dotenv/config';
import readline from 'readline';
import { getUpcomingContent, markSkipped, updateContent } from './queue.js';

// ── TTY guard ─────────────────────────────────────────────────────────────────

if (!process.stdin.isTTY) {
  console.error('[review] This command requires an interactive terminal (TTY).');
  console.error('         Run it directly: npm run review');
  process.exit(1);
}

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const ESC   = '\x1b[';
const RESET = '\x1b[0m';

const bold   = (s) => `\x1b[1m${s}${RESET}`;
const dim    = (s) => `\x1b[2m${s}${RESET}`;
const cyan   = (s) => `\x1b[36m${s}${RESET}`;
const green  = (s) => `\x1b[32m${s}${RESET}`;
const yellow = (s) => `\x1b[33m${s}${RESET}`;
const red    = (s) => `\x1b[31m${s}${RESET}`;

const COLS = 62;
const rule = () => process.stdout.write(dim('─'.repeat(COLS)) + '\n');

// ── Input: single keypress (raw mode) ────────────────────────────────────────

/**
 * Block until the user presses one key.
 * Ctrl+C exits the process cleanly from anywhere.
 */
function readKey() {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      if (chunk === '\x03') {
        // Ctrl+C — exit gracefully
        process.stdout.write('\n');
        process.exit(0);
      }
      resolve(chunk.toLowerCase());
    });
  });
}

// ── Input: full line with optional pre-population ────────────────────────────

/**
 * Prompt for a line of text.  If `prefill` is provided it is written into
 * the readline buffer so the user can edit it in place.
 * Returns the trimmed answer, or `prefill` if the user submits a blank line.
 */
function readLine(promptText, prefill = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input:    process.stdin,
      output:   process.stdout,
      terminal: true,
    });

    rl.on('SIGINT', () => {
      rl.close();
      process.stdout.write('\n');
      process.exit(0);
    });

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || prefill);
    });

    // Pre-populate the input buffer so the user can edit in place.
    if (prefill) rl.write(prefill);
  });
}

// ── Display helpers ───────────────────────────────────────────────────────────

const TYPE_LABELS = {
  shortTweet: 'Short Tweet',
  eduTweet:   'Edu Tweet',
  thread:     'Thread',
};

/** "2026-04-14" → "Tue Apr 14" */
function fmtDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`); // noon avoids DST edge cases
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Wrap `text` to `width` columns, indented by `indent`. */
function wrap(text, width = COLS - 4, indent = '  ') {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > width) {
      if (line) lines.push(indent + line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(indent + line);
  return lines.join('\n');
}

function displayHeader(total, dayCount) {
  console.clear();
  const title = 'traderdb.space  ·  Content Review';
  const pad   = Math.floor((COLS - title.length) / 2);
  console.log(bold('╔' + '═'.repeat(COLS) + '╗'));
  console.log(bold('║') + ' '.repeat(pad) + bold(title) + ' '.repeat(COLS - pad - title.length) + bold('║'));
  console.log(bold('╚' + '═'.repeat(COLS) + '╝'));
  console.log();
  console.log(`  ${bold(String(total))} pending item${total !== 1 ? 's' : ''} across ${bold(String(dayCount))} day${dayCount !== 1 ? 's' : ''}`);
  console.log(dim('  Keys:  (a) approve   (e) edit   (s) skip   (q) quit'));
  console.log();
}

function displayItem(item, index, total) {
  const label   = TYPE_LABELS[item.type] ?? item.type;
  const dateStr = fmtDate(item.date);

  console.log();
  rule();

  if (item.type === 'thread') {
    const n = Array.isArray(item.content) ? item.content.length : 0;
    console.log(
      `  ${cyan(`[${index + 1} / ${total}]`)}  ${bold(dateStr)}  ${dim('·')}  ` +
      `${bold(label)}  ${dim(`·  ${n} tweet${n !== 1 ? 's' : ''}`)}`,
    );
    rule();
    console.log();
    item.content.forEach((tweet, i) => {
      const lenColor = tweet.length > 260 ? red : dim;
      const prefix   = dim(`  [${i + 1}/${item.content.length}] `);
      // Wrap with continuation indent aligned to content start (8 chars)
      const contIndent = '          ';
      const words  = tweet.split(' ');
      const firstLineWidth = COLS - 10;
      const restWidth      = COLS - contIndent.length;
      const lines  = [];
      let cur = '';
      for (const w of words) {
        const maxW = lines.length === 0 ? firstLineWidth : restWidth;
        const cand = cur ? `${cur} ${w}` : w;
        if (cand.length > maxW) { lines.push(cur); cur = w; }
        else cur = cand;
      }
      if (cur) lines.push(cur);
      const formatted = lines
        .map((l, li) => (li === 0 ? prefix + l : contIndent + l))
        .join('\n');
      console.log(formatted + '  ' + lenColor(`(${tweet.length})`));
    });
  } else {
    const len      = typeof item.content === 'string' ? item.content.length : 0;
    const lenColor = len > 260 ? red : dim;
    console.log(
      `  ${cyan(`[${index + 1} / ${total}]`)}  ${bold(dateStr)}  ${dim('·')}  ` +
      `${bold(label)}  ${lenColor(`${len} / 280`)}`,
    );
    rule();
    console.log();
    console.log(wrap(item.content));
  }

  console.log();
  rule();
  console.log(
    `  ${green('(a)')} approve   ${yellow('(e)')} edit   ${red('(s)')} skip   ${dim('(q)')} quit`,
  );
  rule();
}

function displaySummary(counts) {
  console.log();
  rule();
  console.log(`  ${bold('Review complete')}`);
  console.log(
    `  ${green(`✓ ${counts.approved} approved`)}   ` +
    `${cyan(`✎ ${counts.edited} edited`)}   ` +
    `${yellow(`↷ ${counts.skipped} skipped`)}   ` +
    `${dim(`→ ${counts.remaining} not reached`)}`,
  );
  rule();
  console.log();
}

// ── Edit flows ────────────────────────────────────────────────────────────────

async function editSingleTweet(item) {
  const current = item.content;
  console.log();
  rule();
  console.log(`  ${bold(`Editing ${TYPE_LABELS[item.type]}`)}  ${dim(`for ${fmtDate(item.date)}`)}`);
  rule();
  console.log();
  console.log(dim(`  Current (${current.length} / 280 chars):`));
  console.log(wrap(current));
  console.log();
  rule();

  const newText = await readLine('  New text: ', current);
  const capped  = newText.slice(0, 280);

  if (capped !== current) {
    await updateContent(item.date, item.type, capped);
    item.content = capped; // keep local copy in sync
    console.log(green(`  ✓ Saved  ${dim(`(${capped.length} chars)`)}`));
    return true; // was changed
  }
  console.log(dim('  Unchanged.'));
  return false;
}

async function editThread(item) {
  const tweets = item.content;
  console.log();
  rule();
  console.log(
    `  ${bold('Editing Thread')}  ${dim(`for ${fmtDate(item.date)}  ·  ${tweets.length} tweets`)}`,
  );
  rule();
  console.log(dim('  Blank line = keep current text.  Ctrl+C = exit.'));
  console.log();

  const edited = [];
  let changed  = false;

  for (let i = 0; i < tweets.length; i++) {
    const current = tweets[i];
    console.log(`  ${bold(`Tweet ${i + 1} / ${tweets.length}`)}  ${dim(`(${current.length} / 280)`)}`);
    console.log(wrap(current));
    console.log();

    const newText = await readLine('  New text: ', current);
    const capped  = newText.slice(0, 280);

    edited.push(capped);
    if (capped !== current) changed = true;

    if (i < tweets.length - 1) {
      rule();
      console.log();
    }
  }

  if (changed) {
    await updateContent(item.date, item.type, edited);
    item.content = edited;
    console.log();
    console.log(green('  ✓ Thread saved.'));
  } else {
    console.log();
    console.log(dim('  Unchanged.'));
  }

  return changed;
}

// ── Main review loop ──────────────────────────────────────────────────────────

async function main() {
  const items = await getUpcomingContent();

  if (items.length === 0) {
    console.log();
    console.log(bold('  No pending content to review.'));
    console.log(dim('  Run  npm run generate  to create new content.'));
    console.log();
    return;
  }

  const dayCount = new Set(items.map((it) => it.date)).size;
  displayHeader(items.length, dayCount);

  const counts = { approved: 0, edited: 0, skipped: 0, remaining: 0 };
  let quit = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    displayItem(item, i, items.length);
    process.stdout.write('  > ');

    // Loop on invalid keypresses so the user doesn't have to re-read the item.
    while (true) {
      const key = await readKey();

      if (key === 'q') {
        process.stdout.write(`${key}\n`);
        counts.remaining = items.length - i - 1;
        quit = true;
        break;
      }

      if (key === 'a' || key === '\r' || key === '\n') {
        process.stdout.write(`${key === 'a' ? 'a' : '↵'}\n`);
        console.log(green('  ✓ Approved — cron will post this.'));
        counts.approved++;
        break;
      }

      if (key === 'e') {
        process.stdout.write('e\n');
        const changed =
          item.type === 'thread'
            ? await editThread(item)
            : await editSingleTweet(item);
        if (changed) counts.edited++;
        else counts.approved++; // unchanged edit counts as approve
        break;
      }

      if (key === 's') {
        process.stdout.write('s\n');
        await markSkipped(item.date, item.type);
        console.log(yellow('  ↷ Skipped — cron will not post this.'));
        counts.skipped++;
        break;
      }

      // Unknown key — nudge without re-displaying the whole item.
      process.stdout.write('\n');
      console.log(dim(`  Press  a  e  s  or  q`));
      process.stdout.write('  > ');
    }

    if (quit) break;
    console.log();
  }

  displaySummary(counts);
}

main().catch((err) => {
  console.error(`\n[review] Fatal: ${err.message}`);
  process.exit(1);
});
