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
      <div className="title-inner home2 compact-home open-home home-remix">
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
        <div className="arcade-green bathroom-green" aria-hidden="true">
          <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="home-tiles" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#e2ece1"/><path d="M0 32V0H32" fill="none" stroke="#a4bdb9" strokeWidth="2"/><path d="m1 1 30 30" stroke="#fff" opacity=".25"/></pattern>
              <linearGradient id="home-turf" x2="0" y2="1"><stop stopColor="#a3dc58"/><stop offset="1" stopColor="#46aa55"/></linearGradient>
            </defs>
            <path d="M28 25Q28 8 46 8H354Q372 8 372 26V204Q372 225 350 225H50Q28 225 28 204Z" fill="#082c3b" transform="translate(0 8)"/>
            <rect x="28" y="8" width="344" height="216" rx="22" fill="url(#home-tiles)" stroke="#092a3e" strokeWidth="5"/>
            <path d="M47 43V28H354V204H47" fill="none" stroke="#648d91" strokeWidth="10" strokeLinejoin="round"/>
            <path d="M50 36V27H354V203" fill="none" stroke="#fff8d9" strokeWidth="3"/>
            <path d="M88 186C69 130 145 143 164 106S245 43 286 66S317 134 264 153S208 211 144 210Q98 211 88 186Z" fill="#225e49" stroke="#0e3942" strokeWidth="4"/>
            <path d="M89 178C78 138 150 146 171 109S245 53 281 71S302 125 259 145S205 200 145 200Q103 201 89 178Z" fill="url(#home-turf)" stroke="#c7e87e" strokeWidth="3"/>
            <path d="M119 174Q222 177 256 102" fill="none" stroke="#faffd5" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round"/>
            <image href={`${import.meta.env.BASE_URL}art/gameplay/toilet.webp`} x="225" y="39" width="84" height="94"/>
            <path d="m246 44-5-15 11 6 8-12 8 12 11-6-5 15Z" fill="#ffd43e" stroke="#092a3e" strokeWidth="3"/>
            <image href={`${import.meta.env.BASE_URL}art/gameplay/paper-roll.webp`} x="41" y="37" width="57" height="57"/>
            <image href={`${import.meta.env.BASE_URL}art/gameplay/plant.webp`} x="299" y="151" width="69" height="69"/>
            <image href={`${import.meta.env.BASE_URL}art/gameplay/plunger.webp`} x="29" y="124" width="76" height="76"/>
            <circle cx="119" cy="174" r="12" fill="#fffdf0" stroke="#0e3444" strokeWidth="3"/><g fill="#bfd6d8"><circle cx="115" cy="170" r="2"/><circle cx="124" cy="172" r="2"/><circle cx="119" cy="180" r="2"/></g>
            <g transform="translate(316 92) rotate(10)"><rect x="-19" y="-12" width="42" height="28" rx="5" fill="#ffcf45" stroke="#0e3444" strokeWidth="3"/><path d="M-5 5V-5H8L-5 0" fill="#f8725a" stroke="#0e3444" strokeWidth="2"/></g>
          </svg>
        </div>
        <section className="arcade-daily" aria-label={`Daily challenge · ${edition} · Next round in ${untilTomorrowUtc()}`}>
          <div className="challenge-label">{played ? 'ROUND COMPLETE' : "TODAY’S CHALLENGE"}</div>
          <button className="arcade-play" onClick={() => go(() => (played ? navigate('leaders') : goToCourse('daily')), played ? 'tap' : 'whoosh')}>
            <span className="daily-ticket-icon" aria-hidden="true"><GameIcon kind={played ? 'trophy' : 'flag'} /></span><strong>{played ? 'DAILY RESULTS' : 'PLAY DAILY'}</strong><span className="daily-ticket-arrow" aria-hidden="true">›</span>
            <small>{played ? (best !== null ? `You shot ${best}${dailyRank ? ` · #${dailyRank.rank}` : ''}` : 'See where you stand') : '9 holes. One shot at glory.'}</small>
          </button>
        </section>
        <section className="arcade-modes" aria-label="More ways to play">
          <button className="arcade-map" aria-label={nearby ? `Throne map, ${nearby.total} bathrooms nearby` : 'Throne map'} onClick={() => go(() => navigate('map'), 'whoosh')}><span className="mode-illustration"><GameIcon kind="map" /></span><span>THRONE MAP</span><small>Find your next crown</small></button>
          <button className="arcade-match" onClick={() => go(() => navigate('match'), 'whoosh')}><span className="mode-illustration duel-plungers" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}art/gameplay/plunger.webp`} alt=""/><img src={`${import.meta.env.BASE_URL}art/gameplay/plunger.webp`} alt=""/></span><span>QUICK MATCH</span><small>Settle it on the green</small></button>
        </section>
        <button className="arcade-custom" onClick={() => go(() => setCustom(true))}><GameIcon kind="dice" /> Custom round <span aria-hidden="true">→</span></button>
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
