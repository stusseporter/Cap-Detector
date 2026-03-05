import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

const contentTypeLabels: Record<string, string> = {
  youtube: 'video transcript',
  article: 'article',
  twitter: 'tweet thread',
  text: 'text',
};

export async function analyzeContent(
  text: string,
  contentType: string,
  onProgress?: (message: string) => void
): Promise<AnalysisResult> {
  onProgress?.('Identifying claims and opinions...');

  const label = contentTypeLabels[contentType] || 'content';

  const systemPrompt = `You are Cap Detector — an expert media literacy AI that analyzes content for factual accuracy, rhetorical manipulation, and narrative framing. You think like a seasoned investigative journalist combined with a behavioral psychologist.

Your analysis must be:
- PRECISE: Distinguish clearly between verifiable facts, opinions, and misleading framings
- FAIR: Don't assume malice — distinguish between bias, ignorance, and deliberate manipulation
- CULTURALLY FLUENT: Understand slang, coded language, dog whistles, and platform-specific rhetoric
- SPECIFIC: Always cite exact quotes or paraphrases from the content as evidence

You respond ONLY with valid JSON. No preamble, no markdown, no explanation outside the JSON structure.`;

  const analysisPrompt = `Analyze this ${label} for factual accuracy, manipulation tactics, and rhetorical framing.

CONTENT TO ANALYZE:
---
${text}
---

Return ONLY a JSON object with this exact structure:
{
  "capScore": <integer 0-100, where 0=completely factual/honest and 100=completely misleading/manipulative>,
  "capScoreExplanation": "<2-3 sentences explaining the score — what drove it up or kept it low, referencing specific patterns found>",
  "summary": "<3-4 sentence plain-English summary: what is this content claiming, how reliable is it, and what should the reader watch out for>",
  "claims": [
    {
      "id": "claim-1",
      "timestamp": "<timestamp like [1:23] if present in transcript, otherwise 'N/A'>",
      "offsetMs": <millisecond offset if timestamp present, otherwise 0>,
      "text": "<the specific claim or statement being made — quote directly when possible>",
      "type": "<'claim' for assertions presented as fact, 'opinion' for clearly subjective takes>",
      "rating": "<'supported' = verifiable and accurate | 'unsupported' = false or unverifiable | 'uncertain' = unclear or lacks context>",
      "explanation": "<1-2 sentences: why this rating? What's the evidence or lack thereof? Be specific.>"
    }
  ],
  "framingTactics": [
    {
      "name": "<tactic name — e.g. 'Appeal to Fear', 'Cherry-Picking', 'False Dichotomy', 'Us vs Them', 'Emotional Language', 'Exaggeration', 'Misleading Statistics', 'Strawman', 'Ad Hominem', 'Bandwagon', 'Scarcity/Urgency', 'False Authority'>",
      "count": <number of times this tactic appears>,
      "severity": "<'low' = minor/common rhetoric | 'medium' = meaningful bias | 'high' = deliberate manipulation>",
      "examples": ["<direct quote or paraphrase from content showing this tactic in action>"]
    }
  ]
}

SCORING GUIDE:
- 0-20: Highly factual, minimal bias, transparent sourcing
- 21-40: Mostly accurate, some opinion framing, minor rhetorical devices
- 41-60: Mixed — some valid points but notable bias, cherry-picking, or emotional manipulation
- 61-80: Significantly misleading — heavy framing, unsupported claims, manipulation tactics
- 81-100: Highly deceptive — deliberate misinformation, coordinated manipulation, bad-faith rhetoric

ANALYSIS RULES:
- Extract 5-10 significant claims minimum if content allows
- Every framing tactic MUST have at least one example quote
- Timestamps only matter for YouTube transcripts — skip for articles/text
- Be fair to all political/ideological perspectives — apply the same rigor regardless of source
- If content is genuinely factual and balanced, give it a low cap score — don't manufacture issues`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: analysisPrompt }
    ],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('No response from Claude');
  }

  const rawText = content.text.trim();
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const result = JSON.parse(jsonText) as AnalysisResult;

    // Clamp score to 0-100
    result.capScore = Math.max(0, Math.min(100, Math.round(result.capScore)));

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
