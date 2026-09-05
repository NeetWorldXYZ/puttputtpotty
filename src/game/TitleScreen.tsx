import { useEffect, useRef, useState } from 'react';
import { COURSE } from '../holes';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import type { Hole } from '../sim/types';
import { COURSE_LENGTHS, dailySeed, getBest, getPreferredLength, goToCourse, setPreferredLength } from './courses';
import { getAudio, isMuted, setMuted, sfx, unlockAudio } from './sound';
import { startTheme, stopTheme } from './music';
import { navigate } from '../router';
import { api } from '../net/api';
import { ensureSession, getSavedName } from '../net/supabase';
import { recallFix } from '../net/places';
import { NamePrompt } from './NamePrompt';

const SHOW_THEMES = ['diveBar', 'spaceship', 'tropical', 'castle', 'stadium', 'grandma'];
const FLOATERS = ['🧻', '🪠', '🦆', '⛳', '🧼', '🚽', '🧻', '🪠', '⛳', '🦆'];
const SEASON_EPOCH = Date.UTC(2026, 8, 1);
const SEASON_MS = 6 * 7 * 24 * 3600 * 1000;

function seasonInfo(): { n: number; daysLeft: number } {
  const t = Date.now() - SEASON_EPOCH;
  const n = Math.floor(t / SEASON_MS) + 1;
  const daysLeft = Math.max(0, Math.ceil((n * SEASON_MS - t) / 86400000));
  return { n, daysLeft };
}

/** The mascot: a crowned toilet with a golf ball, drawn inline so it scales crisp. */
function Mascot() {
  return (
    <svg className="mascot" viewBox="0 0 120 130" aria-hidden="true">
      <defs>
        <linearGradient id="porc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9e4ee" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="60" cy="122" rx="40" ry="6" fill="rgba(0,0,0,0.35)" />
      {/* tank */}
      <rect x="30" y="34" width="60" height="42" rx="8" fill="url(#porc)" stroke="#1f2a44" strokeWidth="4" />
      <rect x="38" y="30" width="44" height="9" rx="4" fill="#ffffff" stroke="#1f2a44" strokeWidth="4" />
      {/* flush handle */}
      <rect x="82" y="44" width="12" height="5" rx="2.5" fill="#c0c9d6" stroke="#1f2a44" strokeWidth="3" />
      {/* bowl */}
      <path d="M22 78 C22 70 32 66 60 66 C88 66 98 70 98 78 L94 96 C90 112 76 118 60 118 C44 118 30 112 26 96 Z" fill="url(#porc)" stroke="#1f2a44" strokeWidth="4" />
      {/* seat */}
      <ellipse cx="60" cy="78" rx="34" ry="12" fill="#ffffff" stroke="#1f2a44" strokeWidth="4" />
      <ellipse cx="60" cy="79" rx="22" ry="7" fill="#4db8ff" stroke="#1f2a44" strokeWidth="3" />
      {/* eyes on the tank */}
      <circle cx="49" cy="52" r="7" fill="#fff" stroke="#1f2a44" strokeWidth="3" />
      <circle cx="71" cy="52" r="7" fill="#fff" stroke="#1f2a44" strokeWidth="3" />
      <circle cx="51" cy="53" r="3" fill="#1f2a44" />
      <circle cx="73" cy="53" r="3" fill="#1f2a44" />
      {/* smile */}
      <path d="M50 64 Q60 70 70 64" fill="none" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
      {/* crown */}
      <path d="M36 30 L42 14 L52 24 L60 8 L68 24 L78 14 L84 30 Z" fill="#ffd166" stroke="#1f2a44" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="42" cy="14" r="3" fill="#ff6f3c" stroke="#1f2a44" strokeWidth="2" />
      <circle cx="60" cy="8" r="3.5" fill="#ff6f3c" stroke="#1f2a44" strokeWidth="2" />
      <circle cx="78" cy="14" r="3" fill="#ff6f3c" stroke="#1f2a44" strokeWidth="2" />
      {/* golf ball rolling in */}
      <circle cx="104" cy="110" r="9" fill="#fff" stroke="#1f2a44" strokeWidth="3.5" />
      <circle cx="101" cy="107" r="1.4" fill="#b7c3d0" />
      <circle cx="106" cy="108" r="1.4" fill="#b7c3d0" />
      <circle cx="103" cy="112" r="1.4" fill="#b7c3d0" />
    </svg>
  );
}

function untilTomorrowUtc(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TitleScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [name, setName] = useState(getSavedName());
  const [askName, setAskName] = useState(false);
  const [help, setHelp] = useState(false);
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
  const best = getBest(daily);
  const played = best !== null;

  // Live stats: your thrones, the neighbourhood, your daily rank. All optional; the menu works without them.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Anonymous-first: the first open creates the account so the stats can be yours.
      const me = await ensureSession()
        .then((s) => s.user.id)
        .catch(() => null);
      if (!me || cancelled) return;
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
      if (board.status === 'fulfilled' && played) {
        const i = board.value.findIndex((r) => r.user_id === me);
        if (i >= 0) setDailyRank({ rank: i + 1, of: board.value.length });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [daily, played]);

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
  const lenInfo = COURSE_LENGTHS.find((l) => l.n === len) ?? COURSE_LENGTHS[1];

  const season = seasonInfo();

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
      <div className="title-inner home">
        <div className="home-stack">
          <button className="player-chip corner" onClick={() => go(() => setAskName(true))}>
            <span className="player-name">{name ?? 'Set your name'}</span>
            <span className="player-thrones">👑 {thrones ?? '–'}</span>
          </button>

          <header className="hero-head">
            <Mascot />
            <div className="logo big">
              <span className="logo-top">Putt Putt</span>
              <span className="logo-bottom">Potty</span>
            </div>
            <div className="tagline">Every bathroom is a course. Every course has a king.</div>
            <div className="season-pill">
              Season {season.n} · {season.daysLeft} days left
            </div>
          </header>

          <button className="play-btn thrones" onClick={() => go(() => navigate('map'), 'whoosh')}>
            <span className="pb-icon">👑</span>
            <span className="pb-text">
              <span className="pb-title">Thrones</span>
              <span className="pb-sub">{nearby ? `${nearby.total} bathrooms near you · ${nearby.claimed} claimed · you hold ${nearby.mine}` : 'Real bathrooms near you. Take the throne.'}</span>
            </span>
            <span className="pb-go">Map</span>
          </button>

          <button className="play-btn daily" onClick={() => go(() => goToCourse('daily'), 'whoosh')}>
            <span className="pb-icon">📅</span>
            <span className="pb-text">
              <span className="pb-title">
                Daily course <span className={`pill${played ? ' done' : ''}`}>{played ? '1/1' : '0/1'}</span>
              </span>
              <span className="pb-sub">
                {played ? `You shot ${best}${dailyRank ? ` · #${dailyRank.rank} of ${dailyRank.of} today` : ''} · next in ${untilTomorrowUtc()}` : `Nine holes, one shot at it · resets in ${untilTomorrowUtc()}`}
              </span>
            </span>
            <span className="pb-go">{played ? 'Results' : 'Play'}</span>
          </button>

          <div className="play-btn custom">
            <span className="pb-icon">🎲</span>
            <span className="pb-text">
              <span className="pb-title">Custom game</span>
              <span className="pb-sub">
                {len} holes · {lenInfo.blurb}
              </span>
              <span className="len-chips">
                {COURSE_LENGTHS.map((l) => (
                  <button key={l.n} className={l.n === len ? 'active' : ''} onClick={() => pickLen(l.n)} aria-label={`${l.n} holes`}>
                    {l.label}
                  </button>
                ))}
                <span className="len-word">holes</span>
              </span>
            </span>
            <button className="pb-go" onClick={() => go(() => goToCourse('random', len), 'whoosh')}>
              Tee off
            </button>
          </div>

          <div className="home-row">
            <button className="menu-small" onClick={() => go(() => navigate('leaders'))}>
              🏆 Leaderboard
            </button>
            <button
              className="menu-small"
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
              {muted ? '🔇 Sound off' : '🔊 Sound on'}
            </button>
            <button className="menu-small" onClick={() => go(() => setHelp(true))}>
              ❓ How to play
            </button>
          </div>
        </div>
      </div>

      {askName && (
        <NamePrompt
          onDone={(n) => {
            setName(n);
            setAskName(false);
          }}
          onCancel={() => setAskName(false)}
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
