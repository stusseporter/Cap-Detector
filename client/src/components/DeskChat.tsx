import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { sendChat } from '@/lib/api';

interface Message {
  role: 'pam' | 'user';
  text: string;
}

interface DeskChatProps {
  runId: string;
}

export default function DeskChat({ runId }: DeskChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'pam', text: "Desk is live. What do you want to know about this setup?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const { answer } = await sendChat(runId, q);
      setMessages((prev) => [...prev, { role: 'pam', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'pam', text: 'Connection error. Try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Header toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover-glow transition-colors"
        style={{ background: 'var(--surface)' }}
      >
        <span className="font-mono font-bold text-sm tracking-widest" style={{ color: 'var(--green)' }}>
          ASK THE DESK
        </span>
        {open ? (
          <ChevronUp size={16} style={{ color: 'var(--muted)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--muted)' }} />
        )}
      </button>

      {open && (
        <div style={{ background: 'var(--bg)' }}>
          {/* Messages */}
          <div
            className="p-4 space-y-3 overflow-y-auto"
            style={{ maxHeight: '320px', borderTop: '1px solid var(--border)' }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-xs sm:max-w-sm rounded px-3 py-2 text-sm"
                  style={{
                    background: msg.role === 'pam' ? 'var(--surface)' : `${`var(--green)`}22`,
                    border: msg.role === 'pam' ? '1px solid var(--border)' : '1px solid var(--green)',
                    color: msg.role === 'pam' ? 'var(--text)' : 'var(--green)',
                    borderLeft: msg.role === 'pam' ? '3px solid var(--green)' : undefined,
                  }}
                >
                  {msg.role === 'pam' && (
                    <span className="block font-mono font-bold text-xs mb-1" style={{ color: 'var(--green)' }}>
                      PAM
                    </span>
                  )}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded px-3 py-2 text-sm font-mono"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  PAM is thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="flex gap-2 p-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask PAM about this setup..."
              className="flex-1 rounded px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'DM Sans, sans-serif',
              }}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded px-3 py-2 font-mono text-sm font-bold hover-glow transition-colors disabled:opacity-40"
              style={{
                background: 'var(--green)',
                color: 'var(--bg)',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
