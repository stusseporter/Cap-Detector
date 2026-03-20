import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Download, Plus, History, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import BiasIndicator from '@/components/BiasIndicator';
import LevelTable from '@/components/LevelTable';
import DisagreementBar from '@/components/DisagreementBar';
import DeskChat from '@/components/DeskChat';
import AgentCard from '@/components/AgentCard';
import { getRun } from '@/lib/api';
import type { TradeRun, AgentName, PamSynthesisOutput } from '@shared/types';

const AGENT_ORDER: AgentName[] = [
  'BOB', 'PAM', 'CHRIS', 'MICHAEL', 'PEKO', 'LIL_PRINT', 'STUSSE', 'DUST', 'PAM_SYNTHESIS',
];

const SETUP_COLORS: Record<string, string> = {
  A: 'var(--green)',
  'B+': '#86efac',
  B: 'var(--amber)',
  no_setup: 'var(--red)',
};

export default function ReportView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [run, setRun] = useState<TradeRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentBreakdownOpen, setAgentBreakdownOpen] = useState(false);

  useEffect(() => {
    if (!params.id) { navigate('/'); return; }

    getRun(params.id)
      .then(setRun)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <span className="font-mono text-sm animate-pulse" style={{ color: 'var(--green)' }}>
            Loading report...
          </span>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="font-mono text-sm" style={{ color: 'var(--red)' }}>
            {error || 'Run not found'}
          </p>
        </div>
      </div>
    );
  }

  const report = run.finalReport as PamSynthesisOutput | null;
  const agentOutputs = (run.agentOutputs ?? {}) as Record<AgentName, Record<string, unknown>>;
  const setupQuality = report?.setup_quality ?? 'no_setup';
  const setupColor = SETUP_COLORS[setupQuality] ?? 'var(--muted)';

  const stusse = agentOutputs['STUSSE'];
  const dust = agentOutputs['DUST'];

  function exportJSON() {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pg-run-${params.id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header block */}
        <div
          className="rounded p-6 space-y-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div>
            <h1 className="font-mono font-bold text-xl tracking-widest mb-1" style={{ color: 'var(--green)' }}>
              PRINTER GANG TRADING DESK
            </h1>
            <p className="font-mono text-xs tracking-wider" style={{ color: 'var(--muted)' }}>
              {run.tickers.join(', ')} · {new Date(run.createdAt).toLocaleDateString()} · {run.sessionType.toUpperCase()} · {run.riskMode.toUpperCase()}
            </p>
          </div>

          <p className="text-sm" style={{ color: 'var(--text)' }}>
            {run.scenarioQuestion}
          </p>

          {/* Bias + confidence */}
          {report && (
            <BiasIndicator
              bias={report.final_bias}
              confidenceScore={report.confidence_score}
              confidenceLabel={report.confidence_label}
            />
          )}

          {/* Setup quality */}
          {report && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>SETUP QUALITY</span>
              <span
                className="font-mono font-bold text-lg px-3 py-1 rounded"
                style={{
                  color: setupColor,
                  background: `${setupColor}22`,
                  border: `1px solid ${setupColor}`,
                }}
              >
                {setupQuality.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* STAND DOWN banner */}
        {report?.stand_down && (
          <div
            className="w-full p-4 rounded flex items-center gap-3 animate-slide-up"
            style={{ background: '#ef444422', border: '1px solid var(--red)' }}
          >
            <AlertTriangle size={20} style={{ color: 'var(--red)' }} />
            <div>
              <p className="font-mono font-bold tracking-widest" style={{ color: 'var(--red)' }}>
                STAND DOWN
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
                {report.stand_down_reason}
              </p>
            </div>
          </div>
        )}

        {/* Disagreement bar */}
        {report && (
          <DisagreementBar
            agentOutputs={agentOutputs}
            agentsDisagreed={report.agents_disagreed}
            disagreementNotes={report.disagreement_notes}
          />
        )}

        {/* Key levels */}
        {report?.key_levels && <LevelTable levels={report.key_levels} />}

        {/* Options panel */}
        {(report?.lotto_available || report?.swing_available) && (
          <div className="space-y-3">
            <h2 className="font-mono text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
              OPTIONS PLAYS
            </h2>

            {report.lotto_available && stusse && !stusse.no_lotto && (
              <div
                className="rounded p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--amber)' }}
              >
                <p className="font-mono font-bold text-sm tracking-widest mb-2" style={{ color: 'var(--amber)' }}>
                  STUSSE — LOTTO PLAY
                </p>
                <div className="text-sm space-y-1" style={{ color: 'var(--text)' }}>
                  <p><span style={{ color: 'var(--muted)', fontFamily: 'mono' }}>Type:</span> {String(stusse.play_type ?? '—')} {String(stusse.direction ?? '')}</p>
                  <p><span style={{ color: 'var(--muted)' }}>Strike:</span> {stusse.strike ? `$${String(stusse.strike)}` : '—'} · <span style={{ color: 'var(--muted)' }}>Expiry:</span> {String(stusse.expiry ?? '—')}</p>
                  {Boolean(stusse.rationale) && <p style={{ color: 'var(--grey)' }}>{String(stusse.rationale)}</p>}
                  {Boolean(stusse.stusse_note) && <p style={{ color: 'var(--amber)', fontStyle: 'italic' }}>{String(stusse.stusse_note)}</p>}
                </div>
              </div>
            )}

            {report.swing_available && dust && !dust.no_swing && (
              <div
                className="rounded p-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--green)' }}
              >
                <p className="font-mono font-bold text-sm tracking-widest mb-2" style={{ color: 'var(--green)' }}>
                  DUST — SWING PLAY
                </p>
                <div className="text-sm space-y-1" style={{ color: 'var(--text)' }}>
                  <p><span style={{ color: 'var(--muted)' }}>Direction:</span> {String(dust.direction ?? '—')} · <span style={{ color: 'var(--muted)' }}>Strike Type:</span> {String(dust.strike_type ?? '—')}</p>
                  <p><span style={{ color: 'var(--muted)' }}>Strike:</span> {dust.strike ? `$${String(dust.strike)}` : '—'} · <span style={{ color: 'var(--muted)' }}>Window:</span> {String(dust.expiry_window ?? '—')}</p>
                  {Boolean(dust.entry_trigger) && <p><span style={{ color: 'var(--muted)' }}>Entry Trigger:</span> {String(dust.entry_trigger)}</p>}
                  {Boolean(dust.rationale) && <p style={{ color: 'var(--grey)' }}>{String(dust.rationale)}</p>}
                  {Boolean(dust.dust_note) && <p style={{ color: 'var(--green)', fontStyle: 'italic' }}>{String(dust.dust_note)}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Desk narrative */}
        {report?.desk_narrative && (
          <blockquote
            className="rounded p-5"
            style={{
              background: 'var(--surface)',
              borderLeft: '4px solid var(--green)',
              border: '1px solid var(--border)',
              borderLeftColor: 'var(--green)',
            }}
          >
            <p
              className="font-mono text-sm leading-relaxed"
              style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}
            >
              {report.desk_narrative}
            </p>
            <p className="font-mono text-xs mt-2" style={{ color: 'var(--green)' }}>— PAM</p>
          </blockquote>
        )}

        {/* Invalidation conditions */}
        {report?.invalidation_conditions && report.invalidation_conditions.length > 0 && (
          <div
            className="rounded p-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <p className="font-mono text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
              INVALIDATION CONDITIONS
            </p>
            <ul className="space-y-1">
              {report.invalidation_conditions.map((cond, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span style={{ color: 'var(--red)' }}>•</span>
                  <span style={{ color: 'var(--text)' }}>{cond}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agent breakdown accordion */}
        <div
          className="rounded overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setAgentBreakdownOpen(!agentBreakdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--surface)' }}
          >
            <span className="font-mono text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
              AGENT BREAKDOWN
            </span>
            {agentBreakdownOpen ? (
              <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
            )}
          </button>
          {agentBreakdownOpen && (
            <div className="p-4 space-y-2" style={{ background: 'var(--bg)' }}>
              {AGENT_ORDER.map((agent) => {
                const output = agentOutputs[agent];
                const hasError = output && 'error' in output;
                return (
                  <AgentCard
                    key={agent}
                    agent={agent}
                    status={output ? (hasError ? 'error' : 'complete') : 'pending'}
                    output={output}
                    error={hasError ? String(output.error) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Desk chat */}
        <DeskChat runId={params.id!} />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pb-8">
          <button
            onClick={exportJSON}
            className="flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold hover-glow"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <Download size={14} />
            EXPORT JSON
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold hover-glow"
            style={{ background: 'var(--green)', color: 'var(--bg)', border: '1px solid var(--green)' }}
          >
            <Plus size={14} />
            NEW SESSION
          </button>
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold hover-glow"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <History size={14} />
            HISTORY
          </button>
        </div>
      </div>
    </div>
  );
}
