import type { Bias, ConfidenceLabel } from '@shared/types';

interface BiasIndicatorProps {
  bias: Bias;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
}

const BIAS_COLORS: Record<Bias, string> = {
  bullish: '#00ff88',
  bearish: '#ef4444',
  neutral: '#6b7280',
  mixed: '#f59e0b',
};

const BIAS_LABELS: Record<Bias, string> = {
  bullish: 'BULLISH',
  bearish: 'BEARISH',
  neutral: 'NEUTRAL',
  mixed: 'MIXED',
};

export default function BiasIndicator({ bias, confidenceScore, confidenceLabel }: BiasIndicatorProps) {
  const color = BIAS_COLORS[bias] ?? '#6b7280';

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Bias badge */}
      <div
        className="px-6 py-3 rounded font-mono font-bold text-2xl tracking-widest"
        style={{
          background: `${color}22`,
          border: `2px solid ${color}`,
          color,
        }}
      >
        {BIAS_LABELS[bias] ?? bias.toUpperCase()}
      </div>

      {/* Confidence */}
      <div className="flex flex-col">
        <span className="font-mono font-bold text-3xl" style={{ color }}>
          {confidenceScore}
          <span className="text-base font-normal ml-1" style={{ color: 'var(--muted)' }}>/100</span>
        </span>
        <span
          className="font-mono text-xs tracking-widest mt-1"
          style={{
            color: confidenceLabel === 'high' ? '#00ff88' : confidenceLabel === 'medium' ? '#f59e0b' : '#ef4444',
          }}
        >
          {confidenceLabel.toUpperCase()} CONFIDENCE
        </span>
      </div>
    </div>
  );
}
