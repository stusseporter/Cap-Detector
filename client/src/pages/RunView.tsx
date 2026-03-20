import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, Wifi } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AgentCard from '@/components/AgentCard';
import { createAnalysisStream } from '@/lib/api';
import type { AgentName, AgentStatus, RunInput, PamSynthesisOutput } from '@shared/types';

const AGENT_ORDER: AgentName[] = [
  'BOB', 'PAM', 'CHRIS', 'MICHAEL', 'PEKO', 'LIL_PRINT', 'STUSSE', 'DUST', 'PAM_SYNTHESIS',
];

interface AgentState {
  status: AgentStatus;
  summary?: string;
  output?: Record<string, unknown>;
  error?: string;
}

interface ScanState {
  status: 'idle' | 'scanning' | 'done';
  message?: string;
}

export default function RunView() {
  const [, navigate] = useLocation();
  const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(() => {
    const init: Partial<Record<AgentName, AgentState>> = {};
    AGENT_ORDER.forEach((a) => { init[a] = { status: 'pending' }; });
    return init as Record<AgentName, AgentState>;
  });
  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const completedCount = AGENT_ORDER.filter((a) => agentStates[a].status === 'complete' || agentStates[a].status === 'error').length;
  const progress = Math.round((completedCount / AGENT_ORDER.length) * 100);

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingRun');
    if (!raw) {
      navigate('/');
      return;
    }

    let input: RunInput;
    try {
      input = JSON.parse(raw) as RunInput;
    } catch {
      navigate('/');
      return;
    }

    const autoScan = !input.marketContext?.trim();

    const stop = createAnalysisStream(
      input,
      (event, data) => {
        const d = data as Record<string, unknown>;

        switch (event) {
          case 'scan_start':
            setScan({ status: 'scanning', message: d.message as string });
            break;

          case 'scan_complete':
            setScan({ status: 'done', message: d.message as string });
            break;

          case 'agent_start': {
            const agent = d.agent as AgentName;
            setAgentStates((prev) => ({
              ...prev,
              [agent]: { status: 'running' },
            }));
            break;
          }

          case 'agent_complete': {
            const agent = d.agent as AgentName;
            setAgentStates((prev) => ({
              ...prev,
              [agent]: {
                status: 'complete',
                summary: d.summary as string | undefined,
                output: d.output as Record<string, unknown> | undefined,
              },
            }));
            break;
          }

          case 'agent_error': {
            const agent = d.agent as AgentName;
            setAgentStates((prev) => ({
              ...prev,
              [agent]: {
                status: 'error',
                error: d.error as string | undefined,
              },
            }));
            break;
          }

          case 'run_complete': {
            setRunId(d.runId as string);
            setDone(true);
            break;
          }

          case 'error':
            setError(d.message as string);
            break;
        }
      },
      () => {
        setDone(true);
      },
      (err) => {
        setError(err.message);
      }
    );

    stopRef.current = stop;
    return () => { stop(); };
  }, [navigate]);

  const needsScan = !agentStates['BOB'] || agentStates['BOB'].status === 'pending';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="font-mono font-bold text-2xl tracking-widest mb-1"
            style={{ color: done ? 'var(--green)' : 'var(--amber)' }}
          >
            {done ? 'DESK COMPLETE' : 'DESK IS LIVE'}
            {!done && <span className="inline-block animate-pulse ml-2">●</span>}
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
            {completedCount}/{AGENT_ORDER.length} agents complete
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full mb-6 overflow-hidden"
          style={{ background: 'var(--border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: done ? 'var(--green)' : 'var(--amber)' }}
          />
        </div>

        {/* Market scanner card */}
        {(scan.status !== 'idle') && (
          <div
            className="mb-4 rounded p-4 flex items-center gap-3 animate-slide-up"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${scan.status === 'done' ? 'var(--green)' : 'var(--amber)'}`,
              borderLeft: `3px solid ${scan.status === 'done' ? 'var(--green)' : 'var(--amber)'}`,
            }}
          >
            {scan.status === 'scanning' ? (
              <Wifi size={16} className="wifi-pulse" style={{ color: 'var(--amber)' }} />
            ) : (
              <CheckCircle size={16} style={{ color: 'var(--green)' }} />
            )}
            <div>
              <p
                className="font-mono font-bold text-sm tracking-widest"
                style={{ color: scan.status === 'done' ? 'var(--green)' : 'var(--amber)' }}
              >
                MARKET SCANNER
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {scan.message ?? (scan.status === 'scanning' ? 'Fetching live market data...' : 'Complete')}
              </p>
            </div>
          </div>
        )}

        {/* Agent cards */}
        <div className="space-y-2">
          {AGENT_ORDER.map((agent) => (
            <div key={agent} className="animate-slide-up">
              <AgentCard
                agent={agent}
                {...agentStates[agent]}
              />
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mt-4 p-4 rounded font-mono text-sm"
            style={{ background: '#ef444422', border: '1px solid var(--red)', color: 'var(--red)' }}
          >
            {error}
          </div>
        )}

        {/* View report button */}
        {done && runId && (
          <button
            onClick={() => {
              sessionStorage.removeItem('pendingRun');
              navigate(`/report/${runId}`);
            }}
            className="w-full mt-6 py-4 rounded font-mono font-bold text-base tracking-widest hover-glow transition-all animate-slide-up"
            style={{ background: 'var(--green)', color: 'var(--bg)', border: '1px solid var(--green)' }}
          >
            VIEW FINAL REPORT →
          </button>
        )}
      </div>
    </div>
  );
}
