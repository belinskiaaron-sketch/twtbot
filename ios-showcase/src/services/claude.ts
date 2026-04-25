const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeOptions {
  system?: string;
  maxTokens?: number;
  stream?: boolean;
}

async function callClaude(
  messages: Message[],
  apiKey: string,
  options: ClaudeOptions = {},
): Promise<string> {
  const { system, maxTokens = 1024 } = options;

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ── Capability: Chat ──────────────────────────────────────────────────────────

export async function chat(messages: Message[], apiKey: string): Promise<string> {
  return callClaude(messages, apiKey, {
    system: 'You are Claude, a helpful, harmless, and honest AI assistant. Be concise and clear.',
    maxTokens: 1024,
  });
}

// ── Capability: Analyze ───────────────────────────────────────────────────────

export interface AnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number;
  keyThemes: string[];
  summary: string;
  tone: string;
  readability: string;
}

export async function analyzeText(text: string, apiKey: string): Promise<AnalysisResult> {
  const system = `You are a text analysis expert. Always respond with valid JSON only — no markdown, no code fences.`;

  const prompt = `Analyze this text and return a JSON object with this exact structure:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number 0-100 representing positivity>,
  "keyThemes": [<up to 5 short theme strings>],
  "summary": "<2-sentence summary>",
  "tone": "<one word describing the tone, e.g. Professional, Casual, Urgent>",
  "readability": "<one of: Easy, Moderate, Advanced>"
}

Text to analyze:
${text}`;

  const raw = await callClaude([{ role: 'user', content: prompt }], apiKey, {
    system,
    maxTokens: 512,
  });

  // Strip possible fences
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as AnalysisResult;
}

// ── Capability: Generate ──────────────────────────────────────────────────────

export type GenerateMode = 'tweet' | 'headline' | 'story' | 'email' | 'bio';

export async function generateContent(
  topic: string,
  mode: GenerateMode,
  apiKey: string,
): Promise<string> {
  const instructions: Record<GenerateMode, string> = {
    tweet: 'Write a single engaging tweet (under 280 chars) about the topic. No hashtags.',
    headline: 'Write 3 compelling news headlines about the topic. Number them 1-3.',
    story: 'Write a short story (3-4 paragraphs) inspired by the topic.',
    email: 'Write a professional email subject line and body about the topic.',
    bio: 'Write a compelling 2-sentence professional bio for someone who works on this topic.',
  };

  const prompt = `${instructions[mode]}\n\nTopic: ${topic}`;
  return callClaude([{ role: 'user', content: prompt }], apiKey, { maxTokens: 512 });
}

// ── Capability: Code ──────────────────────────────────────────────────────────

export type CodeMode = 'explain' | 'review' | 'convert' | 'document';

export async function processCode(
  code: string,
  mode: CodeMode,
  apiKey: string,
  targetLanguage?: string,
): Promise<string> {
  const instructions: Record<CodeMode, string> = {
    explain: 'Explain what this code does in plain English. Be clear and concise.',
    review: 'Review this code for bugs, performance issues, and improvements. Be specific.',
    convert: `Convert this code to ${targetLanguage ?? 'Python'}. Preserve all logic.`,
    document: 'Add clear inline comments and a docstring/JSDoc to this code.',
  };

  return callClaude(
    [{ role: 'user', content: `${instructions[mode]}\n\n\`\`\`\n${code}\n\`\`\`` }],
    apiKey,
    { maxTokens: 1024 },
  );
}
