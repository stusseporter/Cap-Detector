import type { TradeRun, HistoryItem, RunInput } from '@shared/types';

const BASE = '';

export async function getHistory(): Promise<HistoryItem[]> {
  const res = await fetch(`${BASE}/api/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function getRun(id: string): Promise<TradeRun> {
  const res = await fetch(`${BASE}/api/runs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch run');
  return res.json();
}

export async function sendChat(runId: string, question: string): Promise<{ answer: string }> {
  const res = await fetch(`${BASE}/api/runs/${runId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}

export function createAnalysisStream(
  input: RunInput,
  onEvent: (event: string, data: unknown) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  let closed = false;

  fetch(`${BASE}/api/analyze/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(currentEvent, data);
            } catch {
              // skip malformed
            }
          }
        }
      }

      onDone();
    })
    .catch((err) => {
      if (!closed) onError(err instanceof Error ? err : new Error(String(err)));
    });

  return () => { closed = true; };
}
