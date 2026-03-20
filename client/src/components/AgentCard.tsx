import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Loader, XCircle, Clock } from 'lucide-react';
import type { AgentName, AgentStatus } from '@shared/types';

const AGENT_ROLES: Record<AgentName, string> = {
  BOB: 'Research Engine',
  PAM: 'Lead Analyst / Desk Chief',
  CHRIS: 'ICT Execution Lead',
  MICHAEL: 'Hybrid Strategist',
  PEKO: 'Breakout Specialist',
  LIL_PRINT: 'Retail Radar',
  STUSSE: 'Lotto Options Specialist',
  DUST: 'Strategic Options Specialist',
  PAM_SYNTHESIS: 'Final Synthesis',
};

interface AgentCardProps {
  agent: AgentName;
  status: AgentStatus;
  summary?: string;
  output?: Record<string, unknown>;
  error?: string;
}

export default function AgentCard({ agent, status, summary, output, error }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isRunning = status === 'running';
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isPending = status === 'pending';

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '12px 16px',
    transition: 'border-color 0.2s',
    ...(isRunning ? { borderLeft: '3px solid var(--amber)' } : {}),
    ...(isComplete ? { borderLeft: '3px solid var(--green)' } : {}),
    ...(isError ? { borderLeft: '3px solid var(--red)' } : {}),
  };

  return (
    <div
      style={cardStyle}
      className={isRunning ? 'agent-running' : ''}
    >
      <div className="flex items-center gap-3">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isPending && <Clock size={16} style={{ color: 'var(--muted)' }} />}
          {isRunning && <Loader size={16} style={{ color: 'var(--amber)' }} className="animate-spin" />}
          {isComplete && <CheckCircle size={16} style={{ color: 'var(--green)' }} />}
          {isError && <XCircle size={16} style={{ color: 'var(--red)' }} />}
        </div>

        {/* Agent name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-mono font-bold text-sm tracking-wider"
              style={{
                color: isPending ? 'var(--muted)' : isRunning ? 'var(--amber)' : isComplete ? 'var(--green)' : 'var(--red)',
              }}
            >
              {agent === 'LIL_PRINT' ? 'LIL PRINT' : agent === 'PAM_SYNTHESIS' ? 'PAM SYNTHESIS' : agent}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {AGENT_ROLES[agent]}
            </span>
          </div>
          {summary && (
            <p className="text-xs mt-1" style={{ color: 'var(--grey)' }}>
              {summary}
            </p>
          )}
          {error && (
            <p className="text-xs mt-1" style={{ color: 'var(--red)' }}>
              Error: {error}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        {(isComplete || isError) && output && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1 rounded"
            style={{ color: 'var(--muted)' }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      {/* Expanded JSON */}
      {expanded && output && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <pre
            className="text-xs overflow-auto rounded p-3"
            style={{
              background: 'var(--bg)',
              color: 'var(--grey)',
              fontFamily: 'JetBrains Mono, monospace',
              maxHeight: '300px',
            }}
          >
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
