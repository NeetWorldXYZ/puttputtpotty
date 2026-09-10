import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getSavedAvatar, getSavedName, loadProfile } from '../net/supabase';
import type { RankedRecord } from '../net/rankedRecord';
import { Avatar } from './Avatar';
import './MatchClean.css';
import { MatchDailyCard } from './MatchDailyCard';
import { MatchModeIcon } from './MatchModeIcon';
import { goToCourse, setPreferredLength } from './courses';

const LENGTHS = [3, 9, 18] as const;
type Sheet = 'friend' | 'join' | 'custom' | 'record' | null;

interface Props {
  busy: boolean;
  error: string | null;
  record: RankedRecord | null;
  recordError: boolean;
  onRetryRecord: () => void;
  onFind: () => void;
  onInvite: (holes: number) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  searching: boolean;
  waitSeconds: number;
  searchLine: string;
  onCancel: () => void;
}

function CourseBackdrop() {
  return <img className="mc-landscape" src="/art/match-greens-v2.webp" width="1200" height="800" alt="" aria-hidden="true" decoding="async"/>;
}

function MysteryOpponent() {
  return <svg viewBox="0 0 160 170" aria-hidden="true" className="ma-mystery"><path d="m39 55-7-30 26 17 22-34 22 34 26-17-7 30Z" fill="#031c2e"/><g fill="#031c2e"><circle cx="32" cy="24" r="7"/><circle cx="80" cy="9" r="7"/><circle cx="128" cy="24" r="7"/><circle cx="80" cy="81" r="46"/><path d="M12 169q2-58 68-58t68 58Z"/></g><text x="80" y="105" textAnchor="middle" fill="#fffdf2" fontFamily="Arial,sans-serif" fontSize="68" fontWeight="900">?</text></svg>;
}


/** Keyboard focus stays in the sheet, then returns to the card that opened it. */
function MatchSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.querySelector<HTMLElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', key);
    return () => { dialog.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="ma-overlay" onClick={onClose}><div ref={ref} className="ma-sheet" role="dialog" aria-modal="true" aria-labelledby="ma-sheet-title" onClick={e => e.stopPropagation()}><button className="ma-close" aria-label="Close" onClick={onClose}>×</button><h2 id="ma-sheet-title">{title}</h2>{children}</div></div>;
}

export function MatchLobby({ busy, error, record, recordError, onRetryRecord, onFind, onInvite, onJoin, searching, waitSeconds, searchLine, onCancel }: Props) {
  const [name, setName] = useState(() => getSavedName() || 'Your golfer');
  const [avatar, setAvatar] = useState(getSavedAvatar);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [holes, setHoles] = useState(9);
  const [code, setCode] = useState('');
  const [customMode, setCustomMode] = useState<'friend' | 'solo'>('friend');
  useEffect(() => {
    let alive = true;
    const sync = () => { setName(getSavedName() || 'Your golfer'); setAvatar(getSavedAvatar()); };
    void loadProfile().then(p => { if (alive && p) sync(); }).catch(() => {});
    window.addEventListener('focus', sync);
    return () => { alive = false; window.removeEventListener('focus', sync); };
  }, []);
  useEffect(() => { if (searching) setSheet(null); }, [searching]);
  const chooseLength = <fieldset className="ma-lengths"><legend>How many holes?</legend>{LENGTHS.map(n => <button key={n} type="button" aria-pressed={holes === n} onClick={() => setHoles(n)} disabled={busy}>{n}<small>holes</small></button>)}</fieldset>;
  const open = (next: Sheet) => { if (!busy && !searching) setSheet(next); };
  return <main className={`ma-scroll mc-clean${searching ? ' ma-searching' : ''}`}>
    {error && !sheet && <div className="ma-error" role="alert">{error}</div>}
    <section className="ma-arena" aria-labelledby="ma-title">
      <header className="ma-heading"><h1 id="ma-title">RANKED <span>MATCH</span></h1><p>Same 9 holes. Head to head.<br/>Fewest strokes wins.</p></header>
      <div className="mc-match-scene">
        <CourseBackdrop/>
        <div className="ma-duel">
          <div className="ma-player ma-player-you"><div className="ma-portrait"><Avatar av={avatar} size={160}/></div><div className="ma-player-name" title={name}>{name}</div></div>
          <strong className="ma-versus" aria-label="versus">VS</strong>
          <div className="ma-player ma-player-opponent"><div className="ma-portrait"><MysteryOpponent/></div><div className="ma-player-name">{searching ? 'Finding opponent…' : 'Find Opponent'}</div></div>
        </div>
      <div className="ma-ranked-record" role="group" aria-label="Your ranked record">
        <div className="ma-record-content">
          {recordError ? <button className="ma-record-retry" onClick={onRetryRecord}>Record unavailable · Retry</button> : !record ? <p className="ma-record-loading" role="status">Loading your record…</p> : <div className="ma-record-numbers"><span className="ma-wins"><b>{record.wins}W</b><small>wins</small></span><span className="ma-losses"><b>{record.losses}L</b><small>losses</small></span><span className="ma-rate"><b>{record.played ? `${record.winRate}%` : '—'}</b><small>win rate</small></span>{record.draws > 0 && <small className="ma-draws">{record.draws} {record.draws === 1 ? 'draw' : 'draws'}</small>}</div>}
        </div>
      </div>
      </div>
      {searching ? <div className="ma-search-status"><p role="status">{searchLine}</p><button className="ma-primary ma-cancel" onClick={onCancel}>Cancel search <span>{Math.floor(waitSeconds / 60)}:{String(waitSeconds % 60).padStart(2, '0')}</span></button></div> : <button className="ma-primary" disabled={busy} onClick={onFind}>{busy ? 'CONNECTING…' : 'FIND RANKED OPPONENT'}<span aria-hidden="true">→</span></button>}
    </section>
    <MatchDailyCard disabled={busy || searching}/>
    <h2 className="mc-social-divider" id="mc-social-title"><span>Social Play <small>· Unranked</small></span></h2>
    <div className="ma-other-modes" role="group" aria-labelledby="mc-social-title">
      <button className="ma-mode-card ma-friend" disabled={busy || searching} onClick={() => open('friend')}><MatchModeIcon kind="friend"/><h2>PLAY A FRIEND</h2><span className="mc-arrow" aria-hidden="true">→</span></button>
      <button className="ma-mode-card ma-custom" disabled={busy || searching} onClick={() => open('custom')}><MatchModeIcon kind="custom"/><h2>CUSTOM MATCH</h2><span className="mc-arrow" aria-hidden="true">→</span></button>
    </div>
    {sheet && <MatchSheet title={sheet === 'record' ? 'YOUR RANKED RECORD' : sheet === 'friend' ? 'PLAY A FRIEND' : sheet === 'join' ? 'YOU’RE INVITED' : 'MAKE IT YOUR MATCH'} onClose={() => { if (!busy) setSheet(null); }}>
      {error && <div className="ma-error" role="alert">{error}</div>}
      {sheet === 'record' ? <><p>Only completed matches from <strong>Find ranked opponent</strong> count here. Friend invites and custom rounds never affect this record.</p><p>Fewest strokes wins. If scores tie, the faster round wins. An exact tie is a draw, not a loss.</p><button className="ma-primary" onClick={() => setSheet(null)}>GOT IT</button></> : sheet === 'join' ? <form onSubmit={e => { e.preventDefault(); if (code.length === 6 && !busy) void onJoin(code); }}><p>Enter your friend’s six-character invite code.</p><label className="ma-code-label" htmlFor="ma-invite-code">Invite code</label><input id="ma-invite-code" className="ma-code" maxLength={6} minLength={6} required autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="ABCDEF" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}/><button className="ma-primary" type="submit" disabled={code.length !== 6 || busy}>{busy ? 'JOINING…' : 'JOIN MATCH →'}</button></form> : <>
        <p>{sheet === 'friend' ? 'Same course. Your crew. Pick a round, then share your invite.' : 'Set your round length, then play a friend or practice solo.'}</p>
        {sheet === 'custom' && <fieldset className="ma-mode-options"><legend>Who’s playing?</legend><button aria-pressed={customMode === 'friend'} disabled={busy} onClick={() => setCustomMode('friend')}>With a friend</button><button aria-pressed={customMode === 'solo'} disabled={busy} onClick={() => setCustomMode('solo')}>Solo practice</button></fieldset>}
        {chooseLength}<p className="ma-sheet-note">{sheet === 'custom' && customMode === 'solo' ? 'A fresh generated course. Play at your own pace.' : 'Both players get the same generated course.'}<br/>Unranked · no impact on your record.</p>
        <button className="ma-primary" disabled={busy} onClick={() => { if (sheet === 'custom' && customMode === 'solo') { setPreferredLength(holes); goToCourse('random', holes); } else void onInvite(holes); }}>{busy ? 'CREATING…' : sheet === 'custom' && customMode === 'solo' ? 'TEE OFF →' : 'CREATE INVITE →'}</button>
        {sheet === 'friend' && <button className="ma-text-button" onClick={() => setSheet('join')} disabled={busy}>Already have a code? Join a friend</button>}
      </>}
    </MatchSheet>}
  </main>;
}
