export type SessionType = 'pre-market' | 'intraday' | 'swing' | 'earnings' | 'macro-fed';
export type RiskMode = 'lotto' | 'swing' | 'both';
export type Bias = 'bullish' | 'bearish' | 'neutral' | 'mixed';
export type ConfidenceLabel = 'high' | 'medium' | 'low';
export type SetupQuality = 'A' | 'B+' | 'B' | 'no_setup';
export type AgentName = 'BOB' | 'PAM' | 'CHRIS' | 'MICHAEL' | 'PEKO' | 'LIL_PRINT' | 'STUSSE' | 'DUST' | 'PAM_SYNTHESIS';
export type AgentStatus = 'pending' | 'running' | 'complete' | 'error';

export interface RunInput {
  scenarioQuestion: string;
  tickers: string[];
  marketContext: string;
  sessionType: SessionType;
  riskMode: RiskMode;
}

export interface AgentUpdate {
  agent: AgentName;
  status: AgentStatus;
  summary?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface KeyLevels {
  resistance: number[];
  support: number[];
  entry_zone: number | null;
  stop_loss: number | null;
  target_1: number | null;
  target_2: number | null;
}

export interface PamSynthesisOutput {
  agent: 'PAM_SYNTHESIS';
  ticker: string;
  session_date: string;
  market_question: string;
  final_bias: Bias;
  confidence_score: number;
  confidence_label: ConfidenceLabel;
  key_levels: KeyLevels;
  setup_quality: SetupQuality;
  invalidation_conditions: string[];
  lotto_available: boolean;
  swing_available: boolean;
  desk_narrative: string;
  stand_down: boolean;
  stand_down_reason: string;
  agents_disagreed: boolean;
  disagreement_notes: string;
}

export interface TradeRun {
  id: string;
  tickers: string[];
  scenarioQuestion: string;
  sessionType: SessionType;
  riskMode: RiskMode;
  marketContext: string;
  agentOutputs: Record<AgentName, Record<string, unknown>>;
  finalReport: PamSynthesisOutput | null;
  status: 'running' | 'complete' | 'error';
  createdAt: string;
}

export interface SSEEvent {
  type: 'scan_start' | 'scan_complete' | 'agent_start' | 'agent_complete' | 'agent_error' | 'run_complete' | 'error';
  data: AgentUpdate | { runId: string; report: PamSynthesisOutput } | { message: string };
}

export interface HistoryItem {
  id: string;
  tickers: string[];
  scenarioQuestion: string;
  sessionType: SessionType;
  finalBias: Bias | null;
  confidenceScore: number | null;
  setupQuality: SetupQuality | null;
  createdAt: string;
}
