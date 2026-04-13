import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate trading content using Claude.
 * Returns an array of tweet objects ready for the queue.
 */
export async function generateTradingContent(prompt) {
  const systemPrompt = `You are a knowledgeable trading analyst and content creator.
Generate insightful, engaging Twitter/X posts about trading, markets, and finance.
Each post should be concise (under 280 characters), informative, and avoid financial advice disclaimers.
Focus on education, market observations, technical analysis concepts, and trading psychology.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: prompt || 'Generate 5 unique trading/market insights as individual tweet-length posts. Return them as a JSON array of objects with "text" and "topic" fields.',
      },
    ],
  });

  const raw = response.content[0].text;

  // Extract JSON array from the response
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error('Claude did not return a valid JSON array of tweets');
  }

  return JSON.parse(match[0]);
}
