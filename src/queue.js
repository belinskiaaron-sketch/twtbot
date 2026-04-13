import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_DIR = path.resolve(__dirname, '..', 'content-queue');

/**
 * Return the file path for a queue item by its id.
 */
function itemPath(id) {
  return path.join(QUEUE_DIR, `${id}.json`);
}

/**
 * Save a queue item to disk.
 */
export async function saveItem(item) {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  await fs.writeFile(itemPath(item.id), JSON.stringify(item, null, 2), 'utf8');
  return item;
}

/**
 * Load all pending items from the queue directory, sorted oldest first.
 */
export async function loadPending() {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  const files = await fs.readdir(QUEUE_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const items = await Promise.all(
    jsonFiles.map(async (f) => {
      const raw = await fs.readFile(path.join(QUEUE_DIR, f), 'utf8');
      return JSON.parse(raw);
    })
  );

  return items
    .filter((item) => item.status === 'pending')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Mark an item as posted (updates status and postedAt timestamp on disk).
 */
export async function markPosted(id) {
  const filePath = itemPath(id);
  const raw = await fs.readFile(filePath, 'utf8');
  const item = JSON.parse(raw);
  item.status = 'posted';
  item.postedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(item, null, 2), 'utf8');
  return item;
}

/**
 * Mark an item as failed with an optional error message.
 */
export async function markFailed(id, error = '') {
  const filePath = itemPath(id);
  const raw = await fs.readFile(filePath, 'utf8');
  const item = JSON.parse(raw);
  item.status = 'failed';
  item.error = String(error);
  item.failedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(item, null, 2), 'utf8');
  return item;
}

/**
 * Return the count of pending items in the queue.
 */
export async function pendingCount() {
  const items = await loadPending();
  return items.length;
}
