import { useEffect, useState } from 'react';
import { api, type ChallengeBoard, type ChallengeItem } from '../net/api';
import { sfx } from './sound';
import './Challenges.css';

function untilText(iso: string): string {
  const s = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** How many finished challenges are waiting to be claimed. */
export function claimable(b: ChallengeBoard | null): number {
  if (!b) return 0;
  return [...b.daily.items, ...b.weekly.items].filter((i) => i.progress >= i.goal && !i.claimed).length;
}

function Row({ item, period, onClaimed }: { item: ChallengeItem; period: string; onClaimed: (key: string, points: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const done = item.progress >= item.goal;
  const claim = async () => {
    setBusy(true);
    setErr(null);
    try {
      const pts = await api.claimChallenge(period, item.key);
      sfx.jingle();
      onClaimed(item.key, pts);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`ch-row${item.claimed ? ' claimed' : done ? ' done' : ''}`}>
      <span className="ch-emoji" aria-hidden="true">
        {item.emoji}
      </span>
      <span className="ch-text">
        <strong>{item.title}</strong>
        <span className="ch-bar" role="progressbar" aria-valuemin={0} aria-valuemax={item.goal} aria-valuenow={item.progress}>
          <span style={{ width: `${Math.min(100, (item.progress / item.goal) * 100)}%` }} />
        </span>
        <small>
          {item.claimed ? 'Claimed' : `${item.progress} / ${item.goal}`}
          {err ? ` · ${err}` : ''}
        </small>
      </span>
      {item.claimed ? (
        <span className="ch-pts got" aria-label={`${item.points} points claimed`}>
          ✓ {item.points}
        </span>
      ) : done ? (
        <button className="ch-claim" disabled={busy} onClick={() => void claim()}>
          {busy ? '…' : `Claim +${item.points}`}
        </button>
      ) : (
        <span className="ch-pts">+{item.points}</span>
      )}
    </li>
  );
}

/** Today's three and this week's three, with royal points and the daily streak on top. */
export function ChallengesSheet({ onClose, initial }: { onClose: (board: ChallengeBoard | null) => void; initial?: ChallengeBoard | null }) {
  const [board, setBoard] = useState<ChallengeBoard | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .challenges()
      .then((b) => b && setBoard(b))
      .catch((e: Error) => setError(e.message));
  }, []);
  const onClaimed = (scope: 'daily' | 'weekly') => (key: string, pts: number) =>
    setBoard((b) =>
      b
        ? {
            ...b,
            points: b.points + pts,
            streak: scope === 'daily' && b.daily.items.every((i) => !i.claimed) ? b.streak + 1 : b.streak,
            [scope]: { ...b[scope], items: b[scope].items.map((i) => (i.key === key ? { ...i, claimed: true } : i)) },
          }
        : b,
    );
  return (
    <div className="overlay" onClick={() => onClose(board)}>
      <div className="card pop ch-sheet" role="dialog" aria-modal="true" aria-label="Challenges" onClick={(e) => e.stopPropagation()}>
        <h2>Challenges</h2>
        <div className="ch-top">
          <span>
            <b>{board?.points ?? '–'}</b> royal points
          </span>
          <span>
            <b>🔥 {board?.streak ?? '–'}</b> day streak
          </span>
        </div>
        {error && <div className="err">{error}</div>}
        {!board && !error && <div className="sub">Loading…</div>}
        {board && (
          <>
            <div className="ch-section">
              <span>Today</span>
              <small>resets in {untilText(board.daily.resets_at)}</small>
            </div>
            <ul className="ch-list">
              {board.daily.items.map((i) => (
                <Row key={i.key} item={i} period={board.daily.period} onClaimed={onClaimed('daily')} />
              ))}
            </ul>
            <div className="ch-section">
              <span>This week</span>
              <small>resets in {untilText(board.weekly.resets_at)}</small>
            </div>
            <ul className="ch-list">
              {board.weekly.items.map((i) => (
                <Row key={i.key} item={i} period={board.weekly.period} onClaimed={onClaimed('weekly')} />
              ))}
            </ul>
          </>
        )}
        <button onClick={() => onClose(board)}>Close</button>
      </div>
    </div>
  );
}
