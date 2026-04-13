const MAX_TWEET_LENGTH = 280;

/**
 * Ensure tweet text fits within Twitter's character limit.
 * Truncates with an ellipsis if necessary.
 */
export function truncateToLimit(text) {
  if (text.length <= MAX_TWEET_LENGTH) return text;
  return text.slice(0, MAX_TWEET_LENGTH - 1) + '…';
}

/**
 * Add a topic hashtag to a tweet if it fits within the limit.
 */
export function appendHashtag(text, topic) {
  if (!topic) return text;

  const tag = '#' + topic.replace(/\s+/g, '');
  const candidate = `${text} ${tag}`;
  return candidate.length <= MAX_TWEET_LENGTH ? candidate : text;
}

/**
 * Split a long piece of content into tweet-sized chunks for a thread.
 * Splits on sentence boundaries where possible.
 */
export function splitIntoThread(content, maxLength = MAX_TWEET_LENGTH) {
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const tweets = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if ((current + ' ' + trimmed).trim().length <= maxLength) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) tweets.push(current);
      current = trimmed.length <= maxLength ? trimmed : truncateToLimit(trimmed);
    }
  }

  if (current) tweets.push(current);
  return tweets;
}

/**
 * Format a raw AI-generated tweet object into a queue-ready item.
 */
export function formatQueueItem(raw, index = 0) {
  const text = truncateToLimit(appendHashtag(raw.text, raw.topic));
  return {
    id: `${Date.now()}-${index}`,
    text,
    topic: raw.topic || null,
    createdAt: new Date().toISOString(),
    postedAt: null,
    status: 'pending',
  };
}
