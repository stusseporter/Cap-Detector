import { useLocation } from 'wouter';
import Navbar from '@/components/Navbar';

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="font-mono font-bold text-6xl mb-4" style={{ color: 'var(--green)' }}>404</p>
        <p className="font-mono text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Page not found. The desk doesn't know where this is.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded font-mono font-bold text-sm tracking-widest hover-glow"
          style={{ background: 'var(--green)', color: 'var(--bg)', border: '1px solid var(--green)' }}
        >
          BACK TO DESK
        </button>
      </div>
    </div>
  );
}
