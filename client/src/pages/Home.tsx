import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Wifi, Upload, X, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { createAnalysisStream } from '@/lib/api';
import type { RunInput, SessionType, RiskMode, AgentName, PamSynthesisOutput } from '@shared/types';

interface AttachedFile {
  name: string;
  content: string;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [scenarioQuestion, setScenarioQuestion] = useState('');
  const [tickersInput, setTickersInput] = useState('');
  const [marketContext, setMarketContext] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('intraday');
  const [riskMode, setRiskMode] = useState<RiskMode>('both');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoScan = !marketContext.trim() && attachedFiles.length === 0;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} exceeds 10MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setAttachedFiles((prev) => [...prev, { name: file.name, content }]);
        setMarketContext((prev) => {
          const separator = prev ? '\n\n' : '';
          return `${prev}${separator}— UPLOADED: ${file.name} —\n${content}`;
        });
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(name: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== name));
    // Remove the uploaded block from context
    setMarketContext((prev) =>
      prev.replace(new RegExp(`— UPLOADED: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —\\n[\\s\\S]*?(?=(— UPLOADED:|$))`, 'g'), '').trim()
    );
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const input = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileUpload(input);
    // Trigger the actual synthetic event for the actual file list
    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setAttachedFiles((prev) => {
          if (prev.find((f) => f.name === file.name)) return prev;
          return [...prev, { name: file.name, content }];
        });
        setMarketContext((prev) => {
          if (prev.includes(`— UPLOADED: ${file.name} —`)) return prev;
          const separator = prev ? '\n\n' : '';
          return `${prev}${separator}— UPLOADED: ${file.name} —\n${content}`;
        });
      };
      reader.readAsText(file);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scenarioQuestion.trim()) { setError('Scenario question is required'); return; }
    if (!tickersInput.trim()) { setError('At least one ticker is required'); return; }

    setError('');
    setSubmitting(true);

    const tickers = tickersInput
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const input: RunInput = {
      scenarioQuestion: scenarioQuestion.trim(),
      tickers,
      marketContext: marketContext.trim(),
      sessionType,
      riskMode,
    };

    // Store input for RunView to use
    sessionStorage.setItem('pendingRun', JSON.stringify(input));

    // Navigate immediately to RunView which will start the stream
    navigate('/run');
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text)',
    padding: '10px 12px',
    width: '100%',
    fontSize: '14px',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--muted)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    letterSpacing: '0.1em',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="font-mono font-bold text-3xl tracking-widest mb-2"
            style={{ color: 'var(--green)' }}
          >
            PRINTER GANG TRADING DESK
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            Market Scenario Engine — ICT 2025 Methodology
          </p>
        </div>

        {/* Form with corner bracket accents */}
        <div className="relative">
          {/* Corner brackets */}
          <span className="absolute -top-2 -left-2 font-mono text-lg" style={{ color: 'var(--green)' }}>╭</span>
          <span className="absolute -top-2 -right-2 font-mono text-lg" style={{ color: 'var(--green)' }}>╮</span>
          <span className="absolute -bottom-2 -left-2 font-mono text-lg" style={{ color: 'var(--green)' }}>╰</span>
          <span className="absolute -bottom-2 -right-2 font-mono text-lg" style={{ color: 'var(--green)' }}>╯</span>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 p-6 rounded"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* Scenario Question */}
            <div>
              <label style={labelStyle}>Scenario Question *</label>
              <input
                type="text"
                value={scenarioQuestion}
                onChange={(e) => setScenarioQuestion(e.target.value)}
                placeholder="e.g. Is SPY setting up for a continuation run or rejection at ATH?"
                style={inputStyle}
                required
              />
            </div>

            {/* Tickers */}
            <div>
              <label style={labelStyle}>Target Tickers *</label>
              <input
                type="text"
                value={tickersInput}
                onChange={(e) => setTickersInput(e.target.value)}
                placeholder="SPY, NVDA, QQQ"
                style={inputStyle}
                required
              />
            </div>

            {/* File upload zone */}
            <div>
              <label style={labelStyle}>Upload Context Files (optional)</label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="rounded cursor-pointer flex flex-col items-center justify-center gap-2 py-4 transition-colors"
                style={{
                  border: '1px dashed var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--muted)',
                }}
              >
                <Upload size={20} />
                <span className="text-xs font-mono">Drop files here or click to browse</span>
                <span className="text-xs" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                  .txt .pdf .csv .json .md — max 5 files, 10MB each
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.pdf,.csv,.json,.md"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachedFiles.map((f) => (
                    <span
                      key={f.name}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
                      style={{ background: '#00ff8820', border: '1px solid var(--green)', color: 'var(--green)' }}
                    >
                      {f.name}
                      <button type="button" onClick={() => removeFile(f.name)}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Market Context */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label style={{ ...labelStyle, marginBottom: 0 }}>Market Context (optional)</label>
                {autoScan && (
                  <span
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono wifi-pulse"
                    style={{ background: '#f59e0b22', border: '1px solid var(--amber)', color: 'var(--amber)' }}
                  >
                    <Wifi size={10} />
                    AUTO-SCAN ACTIVE
                  </span>
                )}
              </div>
              <textarea
                value={marketContext}
                onChange={(e) => setMarketContext(e.target.value)}
                placeholder="Leave blank to auto-scan Yahoo Finance for live market data. Or paste your own context: news, levels, pre-market notes..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Session Type */}
            <div>
              <label style={labelStyle}>Session Type</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                style={inputStyle}
              >
                <option value="pre-market">Pre-Market</option>
                <option value="intraday">Intraday</option>
                <option value="swing">Swing</option>
                <option value="earnings">Earnings</option>
                <option value="macro-fed">Macro / Fed</option>
              </select>
            </div>

            {/* Risk Mode */}
            <div>
              <label style={labelStyle}>Risk Protocol</label>
              <div className="flex gap-2">
                {(['lotto', 'swing', 'both'] as RiskMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRiskMode(mode)}
                    className="flex-1 py-2 rounded font-mono font-bold text-sm tracking-widest transition-colors hover-glow"
                    style={{
                      background: riskMode === mode ? 'var(--green)' : 'var(--bg)',
                      color: riskMode === mode ? 'var(--bg)' : 'var(--muted)',
                      border: riskMode === mode ? '1px solid var(--green)' : '1px solid var(--border)',
                    }}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm font-mono" style={{ color: 'var(--red)' }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded font-mono font-bold text-base tracking-widest hover-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: 'var(--green)',
                color: 'var(--bg)',
                border: '1px solid var(--green)',
              }}
            >
              <Zap size={16} />
              {autoScan ? 'SCAN + RUN THE DESK' : 'RUN THE DESK'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
