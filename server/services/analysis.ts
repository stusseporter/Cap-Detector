import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ─── Provider types ────────────────────────────────────────────────────────────
export type AIProvider = 'claude' | 'gemini' | 'deepseek';

export interface Claim {
  id: string;
  timestamp: string;
  offsetMs: number;
  text: string;
  type: 'claim' | 'opinion';
  rating: 'supported' | 'unsupported' | 'uncertain';
  explanation: string;
}

export interface FramingTactic {
  name: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  examples: string[];
}

export interface AnalysisResult {
  capScore: number;
  capScoreExplanation: string;
  summary: string;
  claims: Claim[];
  framingTactics: FramingTactic[];
  provider?: AIProvider;
}

// ─── Shared prompts ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Cap Detector — an expert media literacy AI that analyzes content for factual accuracy, rhetorical manipulation, and narrative framing. You think like a seasoned investigative journalist combined with a behavioral psychologist.

Your analysis must be:
- PRECISE: Distinguish clearly between verifiable facts, opinions, and misleading framings
- FAIR: Don't assume malice — distinguish between bias, ignorance, and deliberate manipulation
- CULTURALLY FLUENT: Understand slang, coded language, dog whistles, and platform-specific rhetoric
- SPECIFIC: Always cite exact quotes or paraphrases from the content as evidence

You respond ONLY with valid JSON. No preamble, no markdown, no explanation outside the JSON structure.`;

const contentTypeLabels: Record<string, string> = {
  youtube: 'video transcript',
  article: 'article',
  twitter: 'tweet thread',
  text: 'text',
};

function buildAnalysisPrompt(text: string, contentType: string): string {
  const label = contentTypeLabels[contentType] || 'content';
  return `Analyze this ${label} for factual accuracy, manipulation tactics, and rhetorical framing.

CONTENT TO ANALYZE:
---
${text}
---

Return ONLY a JSON object with this exact structure:
{
  "capScore": <integer 0-100, where 0=completely factual/honest and 100=completely misleading/manipulative>,
  "capScoreExplanation": "<2-3 sentences explaining the score>",
  "summary": "<3-4 sentence plain-English summary of reliability and what to watch out for>",
  "claims": [
    {
      "id": "claim-1",
      "timestamp": "<[1:23] if transcript, otherwise 'N/A'>",
      "offsetMs": <ms offset or 0>,
      "text": "<the specific claim — quote directly when possible>",
      "type": "<'claim' for facts | 'opinion' for subjective takes>",
      "rating": "<'supported' | 'unsupported' | 'uncertain'>",
      "explanation": "<1-2 sentences: why this rating?>"
    }
  ],
  "framingTactics": [
    {
      "name": "<tactic name e.g. 'Appeal to Fear', 'Cherry-Picking', 'False Dichotomy', 'Us vs Them', 'Emotional Language', 'Exaggeration', 'Misleading Statistics', 'Strawman', 'Ad Hominem', 'Bandwagon', 'False Authority'>",
      "count": <occurrences>,
      "severity": "<'low' | 'medium' | 'high'>",
      "examples": ["<direct quote or paraphrase showing this tactic>"]
    }
  ]
}

SCORING GUIDE:
- 0-20: Highly factual, minimal bias, transparent sourcing
- 21-40: Mostly accurate, some opinion framing, minor rhetorical devices
- 41-60: Mixed — some valid points but notable bias or emotional manipulation
- 61-80: Significantly misleading — heavy framing, unsupported claims
- 81-100: Highly deceptive — deliberate misinformation, bad-faith rhetoric

RULES: Extract 5-10 claims minimum. Every framing tactic must have at least one example quote. Be fair to all perspectives.`;
}

function parseAndValidate(rawText: string, provider: AIProvider): AnalysisResult {
  const jsonText = rawText
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  const result = JSON.parse(jsonText) as AnalysisResult;

  result.capScore = Math.max(0, Math.min(100, Math.round(result.capScore)));
  result.provider = provider;

  if (!result.claims) result.claims = [];
  if (!result.framingTactics) result.framingTactics = [];
  if (typeof result.capScore !== 'number') result.capScore = 50;
  if (!result.summary) result.summary = 'Analysis completed.';
  if (!result.capScoreExplanation) result.capScoreExplanation = 'Score based on claim accuracy and framing tactics.';

  result.claims = result.claims.map((claim, idx) => ({
    ...claim,
    id: claim.id || `claim-${idx + 1}`,
    timestamp: claim.timestamp || 'N/A',
    offsetMs: claim.offsetMs || 0,
    type: claim.type === 'opinion' ? 'opinion' : 'claim',
    rating: ['supported', 'unsupported', 'uncertain'].includes(claim.rating)
      ? claim.rating
      : 'uncertain',
  }));

  return result;
}

// ─── Claude (Anthropic) ────────────────────────────────────────────────────────
async function analyzeWithClaude(text: string, contentType: string): Promise<AnalysisResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildAnalysisPrompt(text, contentType) }],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') throw new Error('No response from Claude');

  return parseAndValidate(content.text, 'claude');
}

// ─── Gemini 3.1 (Google) ──────────────────────────────────────────────────────
async function analyzeWithGemini(text: string, contentType: string): Promise<AnalysisResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro-preview',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent(buildAnalysisPrompt(text, contentType));
  const rawText = result.response.text();

  return parseAndValidate(rawText, 'gemini');
}

// ─── DeepSeek V4 (OpenAI-compatible) ─────────────────────────────────────────
async function analyzeWithDeepSeek(text: string, contentType: string): Promise<AnalysisResult> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  });

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 4096,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildAnalysisPrompt(text, contentType) },
    ],
    response_format: { type: 'json_object' },
  });

  const rawText = response.choices[0]?.message?.content || '';
  return parseAndValidate(rawText, 'deepseek');
}

// ─── Auto-select provider based on available keys ────────────────────────────
function selectProvider(): AIProvider {
  const forced = process.env.AI_PROVIDER as AIProvider;
  if (forced && ['claude', 'gemini', 'deepseek'].includes(forced)) return forced;

  // Auto-detect from available keys
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';

  throw new Error('No AI provider API key found. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY');
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  claude: 'Claude Sonnet 4.6',
  gemini: 'Gemini 3.1 Pro',
  deepseek: 'DeepSeek V4',
};

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyzeContent(
  text: string,
  contentType: string,
  onProgress?: (message: string) => void,
  providerOverride?: AIProvider
): Promise<AnalysisResult> {
  const provider = providerOverride || selectProvider();
  const label = PROVIDER_LABELS[provider];

  onProgress?.(`Analyzing with ${label}...`);

  try {
    switch (provider) {
      case 'claude':
        return await analyzeWithClaude(text, contentType);
      case 'gemini':
        return await analyzeWithGemini(text, contentType);
      case 'deepseek':
        return await analyzeWithDeepSeek(text, contentType);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    // Fallback chain: if primary fails, try next available
    console.error(`${label} failed:`, error);

    if (provider !== 'claude' && process.env.ANTHROPIC_API_KEY) {
      console.log('Falling back to Claude...');
      onProgress?.('Switching to backup provider...');
      return await analyzeWithClaude(text, contentType);
    }
    if (provider !== 'gemini' && process.env.GEMINI_API_KEY) {
      console.log('Falling back to Gemini...');
      onProgress?.('Switching to backup provider...');
      return await analyzeWithGemini(text, contentType);
    }
    if (provider !== 'deepseek' && process.env.DEEPSEEK_API_KEY) {
      console.log('Falling back to DeepSeek...');
      onProgress?.('Switching to backup provider...');
      return await analyzeWithDeepSeek(text, contentType);
    }

    throw error;
  }
}
