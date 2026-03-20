import type { AgentName } from '@shared/types';

interface DisagreementBarProps {
  agentOutputs: Record<AgentName, Record<string, unknown>>;
  agentsDisagreed: boolean;
  disagreementNotes: string;
}

export default function DisagreementBar({ agentOutputs, agentsDisagreed, disagreementNotes }: DisagreementBarProps) {
  // Compare key direction signals across agents
  const pamBias = agentOutputs['PAM']?.htf_bias as string | undefined;
  const chrisDir = agentOutputs['CHRIS']?.direction as string | undefined;
  const michaelConfirmed = agentOutputs['MICHAEL']?.thesis_confirmed as boolean | undefined;
  const pekoDir = agentOutputs['PEKO']?.breakout_direction as string | undefined;

  // Count aligned agents (agents whose direction aligns with PAM's bias)
  let aligned = 0;
  let total = 0;

  if (pamBias) {
    total = 3;

    const isBullish = pamBias === 'bullish';
    const isBearish = pamBias === 'bearish';

    if (chrisDir) {
      if ((isBullish && chrisDir === 'long') || (isBearish && chrisDir === 'short')) aligned++;
    }

    if (typeof michaelConfirmed === 'boolean') {
      if (michaelConfirmed) aligned++;
    }

    if (pekoDir && pekoDir !== 'none') {
      if ((isBullish && pekoDir === 'up') || (isBearish && pekoDir === 'down')) aligned++;
    }
  }

  const ratio = total > 0 ? aligned / total : 0.5;
  let consensusLabel: string;
  let consensusColor: string;

  if (ratio >= 0.8 || !agentsDisagreed) {
    consensusLabel = 'HIGH CONSENSUS';
    consensusColor = 'var(--green)';
  } else if (ratio >= 0.5) {
    consensusLabel = 'MIXED SIGNALS';
    consensusColor = 'var(--amber)';
  } else {
    consensusLabel = 'DESK DIVIDED';
    consensusColor = 'var(--red)';
  }

  return (
    <div
      className="rounded p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
          AGENT CONSENSUS
        </span>
        <span
          className="font-mono font-bold text-sm tracking-widest"
          style={{ color: consensusColor }}
        >
          {consensusLabel}
        </span>
      </div>

      {/* Bar */}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            background: consensusColor,
          }}
        />
      </div>

      {total > 0 && (
        <p className="text-xs mt-2 font-mono" style={{ color: 'var(--muted)' }}>
          {aligned}/{total} agents aligned
        </p>
      )}

      {agentsDisagreed && disagreementNotes && (
        <p className="text-xs mt-2" style={{ color: 'var(--amber)' }}>
          {disagreementNotes}
        </p>
      )}
    </div>
  );
}
