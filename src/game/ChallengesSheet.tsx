import { ChallengeIcon, ChallengeFlame, ChallengeCrown } from './ChallengeIcon';
import { ProfileStatIcon } from './ProfileStatIcon';
import { useEffect, useRef, useState } from 'react';
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
        <ChallengeIcon challenge={item.key}/>
      </span>
      <span className="ch-text">
        <strong>{item.title}</strong>
        <span className="ch-bar" role="progressbar" aria-valuemin={0} aria-valuemax={item.goal} aria-valuenow={Math.min(item.goal,item.progress)} aria-label={item.title}>
          <span style={{ width: `${Math.min(100, (item.progress / item.goal) * 100)}%` }} />
        </span>
        <small>
          {item.claimed ? 'Claimed' : `${item.progress} / ${item.goal}`}
          {err ? ` · ${err}` : ''}
        </small>
      </span>
      {item.claimed ? (
        <span className="ch-pts got" aria-label={`${item.points} points claimed`}>
          ✓ <ChallengeCrown/>{item.points}
        </span>
      ) : done ? (
        <button className="ch-claim" disabled={busy} onClick={() => void claim()}>
          {busy ? '…' : `Claim +${item.points}`}
        </button>
      ) : (
        <span className="ch-pts"><ChallengeCrown/>+{item.points}</span>
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
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(() => onClose(board));
  closeRef.current = () => onClose(board);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('.ch-close-icon')?.focus();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void api.challenges().then(b => b && setBoard(b)).catch(() => {});
    }, 60000);
    return () => { clearInterval(timer); if(previous?.isConnected) previous.focus(); };
  }, []);
  const onClaimed = (scope: 'daily' | 'weekly') => (key: string, pts: number) => {
    setBoard(b => b ? { ...b, points: b.points + pts,
      [scope]: { ...b[scope], items: b[scope].items.map(i => i.key === key ? { ...i, claimed: true } : i) },
    } : b);
    // Claiming a reward cannot add another activity day. Read the actual streak.
    void api.challenges().then(b => b && setBoard(b)).catch((e: Error) => setError(e.message));
  };
  return (
    <div className="overlay ch-overlay" onClick={() => onClose(board)}>
      <div ref={dialog} className="card pop ch-sheet" role="dialog" aria-modal="true" aria-label="Challenges" onClick={(e) => e.stopPropagation()} onKeyDown={event => {
        if(event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
        if(event.key !== 'Tab') return;
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
      }}>
        <header className="ch-hero">
          <ProfileStatIcon kind="win"/>
          <div><span className="ch-eyebrow">CHASE THE NEXT CROWN</span><h2>Challenges</h2><p>Play. Complete. Collect Throne Points.</p></div>
          <button className="ch-close-icon" aria-label="Close challenges" onClick={() => onClose(board)}>×</button>
        </header>
        <div className="ch-top">
          <span>
            <b><ChallengeCrown/>{board?.points ?? '–'}</b> Challenge TP
          </span>
          <span>
            <b><ChallengeFlame/>{board?.streak ?? '–'}</b> day streak
          </span>
        </div>
        <p className="ch-streak-note">Open the game daily to keep your streak. Each new day starts at midnight Eastern.</p>
        <div className="ch-scroll">
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
        </div>
        <footer className="ch-footer"><button onClick={() => onClose(board)}>Back to the game <span aria-hidden="true">›</span></button></footer>
      </div>
    </div>
  );
}
