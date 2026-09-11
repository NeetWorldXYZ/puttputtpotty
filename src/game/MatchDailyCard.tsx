import { useEffect, useState } from 'react';
import { api } from '../net/api';
import { dailySeed, getBest, goToCourse, secondsUntilNextDaily } from './courses';
import './MatchDailyCard.css';
import { MatchModeIcon } from './MatchModeIcon';

type Standing = Awaited<ReturnType<typeof api.dailyStanding>>;

function DailyEmblem() {
  return <div className="md-emblem"><MatchModeIcon kind="daily"/></div>;
}

export function MatchDailyCard({ disabled }: { disabled: boolean }) {
  const [seed, setSeed] = useState(dailySeed);
  const [seconds, setSeconds] = useState(secondsUntilNextDaily);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ seed: string; standing: Standing; error: boolean } | null>(null);
  useEffect(() => {
    const tick = () => { setSeconds(secondsUntilNextDaily()); setSeed(dailySeed()); };
    const refresh = () => { tick(); setRevision(n => n + 1); };
    const timer = window.setInterval(tick, 1000);
    window.addEventListener('focus', refresh);
    const visible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => {
    let active = true;
    void api.dailyStanding(seed).then(standing => { if (active) setResult({ seed, standing, error: false }); }).catch(() => { if (active) setResult({ seed, standing: null, error: true }); });
    return () => { active = false; };
  }, [seed, revision]);
  // Never carry yesterday's standing into a freshly opened daily course.
  const current = result?.seed === seed ? result : null;
  const standing = current?.standing ?? null;
  const best = getBest(seed);
  const played = standing !== null || best !== null;
  const delta = standing ? standing.total - standing.par : null;
  const score = delta === null ? best : delta === 0 ? 'E' : delta > 0 ? `+${delta}` : String(delta);
  const countdown = seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return <section className={`md-card${played ? ' md-played' : ''}`} aria-labelledby="md-title">
    <DailyEmblem/>
    <header><h2 id="md-title">DAILY <span>RANKED COURSE</span></h2><p>{played ? (standing ? 'Today’s round completed. Ranked against everybody.' : 'Round saved on device. Leaderboard sync incomplete.') : 'One round per day. Ranked against everybody.'}</p></header>
    {played ? <div className="md-result-row"><div className="md-score"><small>TODAY</small><strong>{score}</strong>{!standing && <small>strokes</small>}</div><div className="md-standing"><strong>{standing ? `#${standing.rank}` : '—'}</strong><small>{standing ? 'on the global leaderboard' : current?.error ? 'Rank unavailable' : 'Rank pending'}</small></div><div className="md-countdown"><span aria-hidden="true">◷</span><div><small>Next course in</small><strong>{countdown}</strong></div></div><button className="md-complete" disabled><span aria-hidden="true">✓</span> COURSE PLAYED</button></div> : <div className="md-ready-row"><div className="md-global"><span aria-hidden="true">◎</span><div><strong>GLOBAL LEADERBOARD</strong><small>Compete with golfers worldwide.</small></div></div><button className="md-play" disabled={disabled || !current} onClick={() => { if (current?.error) { setResult(null); setRevision(n => n + 1); } else goToCourse('daily'); }}>{!current ? 'CHECKING ROUND…' : current.error ? 'RETRY DAILY STATUS' : 'PLAY TODAY’S COURSE'} <span aria-hidden="true">→</span></button></div>}
  </section>;
}
