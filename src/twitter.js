import { TwitterApi } from 'twitter-api-v2';

let twitterClient;

function getClient() {
  if (!twitterClient) {
    twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
  }
  return twitterClient.readWrite;
}

/**
 * Post a single tweet. Returns the created tweet object.
 */
export async function postTweet(text) {
  const client = getClient();
  const tweet = await client.v2.tweet(text);
  return tweet.data;
}

/**
 * Post a thread from an array of strings.
 * Each string becomes a reply to the previous tweet.
 */
export async function postThread(texts) {
  const client = getClient();
  const tweets = [];
  let lastId;

  for (const text of texts) {
    const payload = lastId ? { text, reply: { in_reply_to_tweet_id: lastId } } : { text };
    const tweet = await client.v2.tweet(payload);
    lastId = tweet.data.id;
    tweets.push(tweet.data);
  }

  return tweets;
}
