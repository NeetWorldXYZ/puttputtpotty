import { useEffect, useId, useState } from 'react';
import { api } from '../net/api';
import { dailySeed, getBest, goToCourse, secondsUntilNextDaily } from './courses';
import { ProfileStatIcon } from './ProfileStatIcon';
import './MatchDailyCard.css';

type Standing = Awaited<ReturnType<typeof api.dailyStanding>>;

function DailyEmblem() {
  const id = useId();
  return <div className="md-emblem" aria-hidden="true"><svg viewBox="0 0 180 155"><defs><radialGradient id={id}><stop stopColor="#53d6f6"/><stop offset="1" stopColor="#166adb"/></radialGradient></defs><circle cx="85" cy="84" r="70" fill={`url(#${id})`} stroke="#57d3ff" strokeWidth="5"/><g fill="#69d559"><path d="m49 24 22-8 24 7-3 15-17 4-5 16-20-1-10 14-21-5 9-25Z"/><path d="m82 77 24 2 14 18-7 19-15 22-15-3-4-23-13-16Z"/><path d="m128 40 19 13 9 24-16 7-18-12-8-19Z"/></g><path d="M24 131q12-30 28-13 13-35 29-4 15-7 24 22Z" fill="#05475b"/><g transform="translate(120 95) rotate(10)"><rect width="47" height="52" rx="6" fill="#fff2cb" stroke="#06243c" strokeWidth="4"/><path d="M2 13h43" stroke="#fb5777" strokeWidth="14"/><path d="M12-4v12M34-4v12" stroke="#06243c" strokeWidth="5" strokeLinecap="round"/><path d="M18 39V20l19 7-19 7" fill="#fb5777" stroke="#06243c" strokeWidth="3" strokeLinejoin="round"/></g></svg><ProfileStatIcon kind="win"/></div>;
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
    <header><h2 id="md-title">DAILY <span>RANKED COURSE</span></h2><p>{played ? 'Today’s round completed. Ranked against everybody.' : 'One round per course. Ranked against everybody.'}</p></header>
    {played ? <div className="md-result-row"><div className="md-score"><small>TODAY</small><strong>{score}</strong>{!standing && <small>strokes</small>}</div><div className="md-standing"><strong>{standing ? `#${standing.rank}` : '—'}</strong><small>{standing ? 'on the global leaderboard' : current?.error ? 'Rank unavailable' : 'Rank pending'}</small></div><div className="md-countdown"><span aria-hidden="true">◷</span><div><small>Next course in</small><strong>{countdown}</strong></div></div><button className="md-complete" disabled><span aria-hidden="true">✓</span> COURSE PLAYED</button></div> : <div className="md-ready-row"><div className="md-global"><span aria-hidden="true">◎</span><div><strong>GLOBAL LEADERBOARD</strong><small>Compete with golfers worldwide.</small></div></div><button className="md-play" disabled={disabled || !current} onClick={() => { if (current?.error) { setResult(null); setRevision(n => n + 1); } else goToCourse('daily'); }}>{!current ? 'CHECKING ROUND…' : current.error ? 'RETRY DAILY STATUS' : 'PLAY TODAY’S COURSE'} <span aria-hidden="true">→</span></button></div>}
  </section>;
}
