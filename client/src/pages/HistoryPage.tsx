import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getHistory } from '@/lib/api';
import type { HistoryItem, Bias } from '@shared/types';

const BIAS_COLORS: Record<Bias, string> = {
  bullish: 'var(--green)',
  bearish: 'var(--red)',
  neutral: 'var(--grey)',
  mixed: 'var(--amber)',
};

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getHistory()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-mono font-bold text-xl tracking-widest mb-6" style={{ color: 'var(--green)' }}>
          SESSION HISTORY
        </h1>

        {loading && (
          <p className="font-mono text-sm animate-pulse" style={{ color: 'var(--muted)' }}>
            Loading...
          </p>
        )}

        {error && (
          <p className="font-mono text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <div
            className="rounded p-8 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <Clock size={32} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
            <p className="font-mono text-sm" style={{ color: 'var(--muted)' }}>
              No sessions yet. Run the desk to get started.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div
            className="rounded overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {items.map((item, i) => {
              const biasColor = item.finalBias ? (BIAS_COLORS[item.finalBias] ?? 'var(--grey)') : 'var(--grey)';
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/report/${item.id}`)}
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover-glow transition-colors"
                  style={{
                    background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                    borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {/* Tickers */}
                  <div className="flex-shrink-0 w-24">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text)' }}>
                      {item.tickers.slice(0, 2).join(', ')}
                      {item.tickers.length > 2 ? ' +' + (item.tickers.length - 2) : ''}
                    </span>
                  </div>

                  {/* Question */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {item.scenarioQuestion}
                    </p>
                    <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {item.sessionType.toUpperCase()} · {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Bias badge */}
                  {item.finalBias && (
                    <div className="flex-shrink-0">
                      <span
                        className="font-mono font-bold text-xs px-2 py-1 rounded"
                        style={{
                          color: biasColor,
                          background: `${biasColor}22`,
                          border: `1px solid ${biasColor}`,
                        }}
                      >
                        {item.finalBias.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Confidence */}
                  {item.confidenceScore !== null && (
                    <div className="flex-shrink-0 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {item.confidenceScore}/100
                    </div>
                  )}

                  {/* Setup quality */}
                  {item.setupQuality && (
                    <div className="flex-shrink-0">
                      <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
                        {item.setupQuality}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
