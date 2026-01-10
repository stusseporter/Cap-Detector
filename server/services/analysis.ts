import OpenAI from 'openai';
import { TranscriptSegment, formatTimestamp } from './youtube';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
}

function buildTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
  return segments.map(seg => `[${formatTimestamp(seg.offset)}] ${seg.text}`).join('\n');
}

export async function analyzeTranscript(
  transcript: TranscriptSegment[] | string,
  onProgress?: (message: string) => void
): Promise<AnalysisResult> {
  const transcriptText = typeof transcript === 'string' 
    ? transcript 
    : buildTranscriptWithTimestamps(transcript);

  onProgress?.('Identifying claims and opinions...');

  const systemPrompt = `You are an expert fact-checker and media analyst. Your job is to analyze video transcripts for:
1. Factual claims vs opinions/emotional language
2. Rhetorical manipulation tactics
3. Overall credibility

You must respond with valid JSON matching the exact schema provided.`;

  const analysisPrompt = `Analyze this video transcript for factual accuracy and manipulation tactics.

TRANSCRIPT:
${transcriptText}

Provide a comprehensive analysis in the following JSON format:
{
  "capScore": <number 0-100, where 0=completely factual and 100=completely misleading>,
  "capScoreExplanation": "<brief explanation of what contributed to the score>",
  "summary": "<2-3 sentence summary of the content and its reliability>",
  "claims": [
    {
      "id": "<unique id>",
      "timestamp": "<timestamp from transcript if available, or 'N/A'>",
      "offsetMs": <milliseconds offset or 0>,
      "text": "<the exact claim made>",
      "type": "<'claim' for factual assertions, 'opinion' for subjective statements>",
      "rating": "<'supported' if verifiable/true, 'unsupported' if false/unverifiable, 'uncertain' if unclear>",
      "explanation": "<why this rating was given>"
    }
  ],
  "framingTactics": [
    {
      "name": "<tactic name like 'Appeal to Fear', 'Cherry-Picking', 'False Dichotomy', 'Emotional Language', 'Exaggeration'>",
      "count": <number of times used>,
      "severity": "<'low', 'medium', or 'high' based on manipulation impact>",
      "examples": ["<quote or paraphrase from transcript>"]
    }
  ]
}

Guidelines:
- Extract at least 3-5 significant claims if present
- Identify ALL manipulation tactics used, even subtle ones
- Be fair but critical - don't assume malice, but note misleading patterns
- Cap score should reflect overall reliability: 0-30=mostly factual, 31-60=mixed/biased, 61-100=highly misleading
- Include timestamps where they appear in brackets like [1:23]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: analysisPrompt }
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    const result = JSON.parse(content) as AnalysisResult;
    
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
        : 'uncertain'
    }));

    return result;
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse analysis results');
  }
}
