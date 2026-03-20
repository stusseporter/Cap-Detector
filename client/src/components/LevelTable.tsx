import type { KeyLevels } from '@shared/types';

interface LevelTableProps {
  levels: KeyLevels;
}

function fmtPrice(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `$${Number(val).toFixed(2)}`;
}

export default function LevelTable({ levels }: LevelTableProps) {
  const rows = [
    { label: 'Entry Zone', value: fmtPrice(levels.entry_zone), highlight: true },
    { label: 'Stop Loss', value: fmtPrice(levels.stop_loss), color: 'var(--red)' },
    { label: 'Target 1', value: fmtPrice(levels.target_1), color: 'var(--green)' },
    { label: 'Target 2', value: fmtPrice(levels.target_2), color: 'var(--green)' },
    {
      label: 'Resistance',
      value: levels.resistance?.length
        ? levels.resistance.map((r) => `$${Number(r).toFixed(2)}`).join(', ')
        : '—',
      color: 'var(--red)',
    },
    {
      label: 'Support',
      value: levels.support?.length
        ? levels.support.map((s) => `$${Number(s).toFixed(2)}`).join(', ')
        : '—',
      color: 'var(--green)',
    },
  ];

  return (
    <div
      className="rounded overflow-hidden font-mono text-sm"
      style={{ border: '1px solid var(--border)' }}
    >
      <div
        className="px-4 py-2 text-xs tracking-widest font-bold"
        style={{ background: 'var(--surface)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
      >
        KEY LEVELS
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className="flex justify-between items-center px-4 py-2"
          style={{
            background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>{row.label}</span>
          <span
            style={{
              color: row.color ?? (row.highlight ? 'var(--text)' : 'var(--text)'),
              fontWeight: row.highlight ? 600 : 400,
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
