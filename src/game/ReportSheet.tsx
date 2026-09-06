import { useState } from 'react';
import { api } from '../net/api';

const REASONS: [Parameters<typeof api.report>[1], string][] = [
  ['name', 'Offensive name'],
  ['slogan', 'Offensive slogan'],
  ['cheating', 'Cheating'],
  ['other', 'Something else'],
];

/** Flag a player. Three different reporters reset their name and slogan; every report is kept for review. */
export function ReportSheet({ userId, name, onClose }: { userId: string; name: string; onClose: (msg?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (reason: Parameters<typeof api.report>[1]) => {
    setBusy(true);
    setError(null);
    try {
      await api.report(userId, reason);
      onClose('Thanks. We\u2019ll take a look.');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="overlay" onClick={() => onClose()}>
      <div className="card pop report" onClick={(e) => e.stopPropagation()}>
        <h2>Report {name}</h2>
        <div className="sub">What&apos;s wrong?</div>
        {REASONS.map(([id, label]) => (
          <button key={id} disabled={busy} onClick={() => void send(id)}>
            {label}
          </button>
        ))}
        {error && <div className="err">{error}</div>}
        <button className="quiet" onClick={() => onClose()}>
          Never mind
        </button>
      </div>
    </div>
  );
}
