import { useEffect, useRef, useState } from 'react';
import { COURSE } from '../holes';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import type { Hole } from '../sim/types';
import { COURSE_LENGTHS, dailyEdition, dailySeed, getBest, getPreferredLength, goToCourse, secondsUntilNextDaily, setPreferredLength } from './courses';
import { getAudio, isMuted, setMuted, sfx, unlockAudio } from './sound';
import { startTheme, stopTheme } from './music';
import { navigate } from '../router';
import { api } from '../net/api';
import { ensureSession, getSavedName, loadProfile, getSavedAvatar } from '../net/supabase';
import { recallFix } from '../net/places';
import { AccountSheet } from './AccountSheet';
import { TabBar } from './TabBar';
import { Avatar } from './Avatar';
import { GameIcon } from './GameIcon';

const SHOW_THEMES = ['diveBar', 'spaceship', 'tropical', 'castle', 'stadium', 'grandma'];
const FLOATERS = ['🧻', '🪠', '🦆', '⛳', '🧼', '🚽', '🧻', '🪠', '⛳', '🦆'];


function untilTomorrowUtc(): string {
  const s = secondsUntilNextDaily();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TitleScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [name, setName] = useState(getSavedName());
  const [avatar] = useState(getSavedAvatar());
  const [askName, setAskName] = useState(false);
  const [help, setHelp] = useState(false);
  const [custom, setCustom] = useState(false);
  const [len, setLen] = useState(getPreferredLength());
  const [tick, setTick] = useState(0);
  const [thrones, setThrones] = useState<number | null>(null);
  const [nearby, setNearby] = useState<{
    total: number;
    claimed: number;
    mine: number;
  } | null>(null);
  const [dailyRank, setDailyRank] = useState<{
    rank: number;
    of: number;
  } | null>(null);
  const daily = dailySeed();
  const edition = dailyEdition(daily);
  const best = getBest(daily);
  const played = best !== null || dailyRank !== null;

  // Live stats: your thrones, the neighbourhood, your daily rank. All optional; the menu works without them.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Anonymous-first: the first open creates the account so the stats can be yours.
      const me = await ensureSession()
        .then((s) => s.user.id)
        .catch(() => null);
      if (!me || cancelled) return;
      // The name lives on the server now; the phone only caches it.
      const prof = await loadProfile();
      if (prof?.name && !cancelled) setName(prof.name);
      const fix = recallFix();
      const [kings, near, board] = await Promise.allSettled([
        api.kings({ limit: 200 }),
        fix ? api.nearby(fix.lat, fix.lng, 25000) : Promise.resolve([]),
        played ? api.leaderboard(daily) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      if (kings.status === 'fulfilled') setThrones(kings.value.find((k) => k.user_id === me)?.thrones ?? 0);
      if (near.status === 'fulfilled' && fix)
        setNearby({
          total: near.value.length,
          claimed: near.value.filter((l) => l.king_name).length,
          mine: near.value.filter((l) => l.king_user === me).length,
        });
      if (board.status === 'fulfilled') {
        const i = board.value.findIndex((r) => r.user_id === me);
        if (i >= 0) setDailyRank({ rank: i + 1, of: board.value.length });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [daily]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  void tick;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const start = performance.now();
    const base = COURSE[1];
    let themeIdx = Math.floor(Math.random() * SHOW_THEMES.length);
    let hole: Hole = {
      ...base,
      id: `title-${SHOW_THEMES[themeIdx]}`,
      theme: SHOW_THEMES[themeIdx],
    };
    let lastSwap = start;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      if (now - lastSwap > 7000) {
        lastSwap = now;
        themeIdx = (themeIdx + 1) % SHOW_THEMES.length;
        hole = {
          ...base,
          id: `title-${SHOW_THEMES[themeIdx]}`,
          theme: SHOW_THEMES[themeIdx],
        };
      }
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = fitCamera(hole.bounds, w * 1.25, h * 1.25, 0);
      cam.ox -= w * 0.125 + Math.sin(t * 0.25) * 12;
      cam.oy -= h * 0.125 + Math.cos(t * 0.2) * 12;
      drawHole(ctx, hole, cam, {
        ballRadius: DEFAULT_PARAMS.ballRadius,
        cupRadius: cupRadius(DEFAULT_PARAMS),
        ball: { x: hole.tee.x, y: hole.tee.y },
        dpr,
        time: t,
      });
      ctx.fillStyle = 'rgba(12,16,40,0.55)';
      ctx.fillRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const theme = () => {
    const a = getAudio();
    if (a && !isMuted()) startTheme(a.ctx, a.master, 0.45);
  };
  const wake = () => {
    unlockAudio();
    theme();
  };
  // Coming back from a game the context is already unlocked: music starts straight away. Leaving fades it out.
  useEffect(() => {
    theme();
    return () => stopTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (fn: () => void, sound: 'tap' | 'whoosh' = 'tap') => {
    wake();
    if (sound === 'whoosh') sfx.whoosh();
    else sfx.tap();
    fn();
  };
  const pickLen = (n: number) => {
    wake();
    sfx.select();
    setLen(n);
    setPreferredLength(n);
  };


  return (
    <div className="title" onPointerDown={wake} onPointerUp={wake} onClick={wake}>
      <canvas ref={canvasRef} className="title-bg" />
      <div className="floaters" aria-hidden="true">
        {FLOATERS.map((f, i) => (
          <span key={i} style={{ left: `${(i * 37 + 8) % 92}%`, animationDuration: `${14 + (i % 5) * 3}s`, animationDelay: `${-i * 2.3}s`, fontSize: `${22 + (i % 3) * 8}px` }}>
            {f}
          </span>
        ))}
      </div>
      <div className="arcade-backdrop" aria-hidden="true" />
      <div className="title-inner home2 compact-home open-home">
        <header className="home-top">
          <div className="home-icons">
            <button
              className="icon-btn"
              aria-label={muted ? 'Sound off' : 'Sound on'}
              onClick={() =>
                go(() => {
                  const m = !muted;
                  setMuted(m);
                  setMutedState(m);
                  if (m) stopTheme();
                  else theme();
                })
              }
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="icon-btn" aria-label="How to play" onClick={() => go(() => setHelp(true))}>
              ❓
            </button>
          </div>
          <button className="player-chip corner" onClick={() => go(() => setAskName(true))}>
            <Avatar av={avatar} size={26} className="chip-avatar" />
            <span className="player-name">{name ?? 'Set your name'}</span>
            <span className="player-thrones">👑 {thrones ?? '–'}</span>
          </button>
        </header>
        <div className="arcade-brand"><img src={`${import.meta.env.BASE_URL}art/arcade-logo.webp`} alt="Putt Putt Potty" draggable={false} /></div>
        <div className="arcade-green" aria-hidden="true">
          <svg viewBox="0 0 360 250" preserveAspectRatio="xMidYMid meet">
            <path className="putt-trail" d="M72 213C230 208 291 123 291 80" fill="none" stroke="#fff9df" strokeWidth="4" strokeDasharray="10 13" strokeLinecap="round" />
            <g stroke="#09233d" strokeWidth="4" strokeLinejoin="round">
              <g transform="translate(256 8)"><path d="M9 19h53v44H12Z" fill="#fffdf0"/><path d="M15 27h41v27H17Z" fill="#e9ecde" strokeWidth="2"/><path d="M19 84h30l4 22H16Z" fill="#fdfaf0"/><path d="M4 65Q35 52 67 65L60 83Q34 108 11 83Z" fill="#fffdf0"/><ellipse cx="35" cy="67" rx="29" ry="11" fill="#fff"/><ellipse cx="35" cy="67" rx="18" ry="6" fill="#70b7ca"/><path d="M14 15 9-1 25 6 35-9 44 6 60-1 54 15Z" fill="#ffd044"/></g>
              <circle cx="72" cy="213" r="22" fill="#f8fbff"/>
            </g>
            <g fill="#c7d9e2"><circle cx="65" cy="202" r="3"/><circle cx="76" cy="199" r="3"/><circle cx="83" cy="208" r="3"/><circle cx="69" cy="213" r="3"/><circle cx="60" cy="219" r="3"/><circle cx="78" cy="223" r="3"/></g>
            <g stroke="#ffda4d" strokeWidth="4" strokeLinecap="round"><path d="m39 210-15-3m20 19-13 8m210-201-9-12m91 20 12-11"/></g>
          </svg>
        </div>
        <section className="arcade-daily" aria-label={`Daily challenge · ${edition} · Next round in ${untilTomorrowUtc()}`}>
          <div className="challenge-label">{played ? 'ROUND COMPLETE' : "TODAY’S CHALLENGE"}</div>
          <button className="arcade-play" onClick={() => go(() => (played ? navigate('leaders') : goToCourse('daily')), played ? 'tap' : 'whoosh')}>
            <strong>{played ? 'DAILY RESULTS' : 'PLAY DAILY'}</strong>
            <small>{played ? (best !== null ? `You shot ${best}${dailyRank ? ` · #${dailyRank.rank}` : ''}` : 'See where you stand') : '9 holes. One shot at glory.'}</small>
          </button>
        </section>
        <section className="arcade-modes" aria-label="More ways to play">
          <button className="arcade-map" aria-label={nearby ? `Throne map, ${nearby.total} bathrooms nearby` : 'Throne map'} onClick={() => go(() => navigate('map'), 'whoosh')}><GameIcon kind="map" /><span>THRONE<br />MAP</span></button>
          <button className="arcade-match" onClick={() => go(() => navigate('match'), 'whoosh')}><svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#09233d" strokeWidth="5" strokeLinecap="round"><path d="m9 6 29 34q8 7 7-4M39 6 10 40q-8 7-7-4"/></g><path d="m9 6 13 15M39 6 26 21" stroke="#fff" strokeWidth="2"/></svg><span>QUICK<br />MATCH</span></button>
        </section>
        <button className="arcade-custom" onClick={() => go(() => setCustom(true))}>Custom round <span aria-hidden="true">→</span></button>
      </div>
      <TabBar active="play" />
      {custom && (
        <div className="overlay" onClick={() => setCustom(false)}>
          <div className="card pop custom-sheet" role="dialog" aria-modal="true" aria-label="Custom game" onClick={(e) => e.stopPropagation()}>
            <h2>Make it your round</h2>
            <p>How many holes?</p>
            <div className="custom-lengths">
              {COURSE_LENGTHS.map((l) => <button key={l.n} className={l.n === len ? 'active' : ''} onClick={() => pickLen(l.n)} aria-pressed={l.n === len}>{l.label}</button>)}
            </div>
            <button className="primary" onClick={() => go(() => goToCourse('random', len), 'whoosh')}>Tee off · {len} holes</button>
            <button onClick={() => setCustom(false)}>Back to home</button>
          </div>
        </div>
      )}

      {askName && (
        <AccountSheet
          onClose={(n) => {
            setName(n);
            setAskName(false);
          }}
        />
      )}

      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <div className="card pop help" onClick={(e) => e.stopPropagation()}>
            <h2>How to play</h2>
            <ul>
              <li>
                <strong>Putt.</strong> Drag anywhere to aim, pull back for power, release. Drag back to your finger to cancel.
              </li>
              <li>
                <strong>Thrones.</strong> Every real bathroom on the map is a three-hole course. Stand within 50 m, check in, and play for the record. Fewest strokes wins; ties go
                to the faster round.
              </li>
              <li>
                <strong>Kings.</strong> Hold the record and you're King of the Throne until someone beats it. Thrones reset every six weeks.
              </li>
              <li>
                <strong>Daily.</strong> One shared nine-hole course a day, one attempt, ranked against everyone.
              </li>
            </ul>
            <button className="primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
