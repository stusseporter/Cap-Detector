import { Link, useLocation } from 'wouter';

export default function Navbar() {
  const [location] = useLocation();

  return (
    <nav
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/">
          <span
            className="font-mono font-bold text-sm tracking-widest cursor-pointer hover-glow rounded px-2 py-1"
            style={{ color: 'var(--green)' }}
          >
            PRINTER GANG
          </span>
        </Link>

        <div className="flex items-center gap-6 text-xs font-mono" style={{ color: 'var(--muted)' }}>
          <Link href="/">
            <span className={`cursor-pointer hover:text-green transition-colors ${location === '/' ? 'text-green' : ''}`}
              style={location === '/' ? { color: 'var(--green)' } : {}}>
              NEW SESSION
            </span>
          </Link>
          <Link href="/history">
            <span className={`cursor-pointer hover:text-green transition-colors ${location === '/history' ? 'text-green' : ''}`}
              style={location === '/history' ? { color: 'var(--green)' } : {}}>
              HISTORY
            </span>
          </Link>
        </div>
      </div>

      <div
        className="text-center text-xs py-1 font-mono"
        style={{ background: '#1a0a0a', color: 'var(--red)', borderTop: '1px solid #2a1111' }}
      >
        Educational analysis only. Not financial advice.
      </div>
    </nav>
  );
}
