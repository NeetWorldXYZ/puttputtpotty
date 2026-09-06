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
import { MASCOT_BODY, MASCOT_VIEWBOX } from './mascot';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';

const SHOW_THEMES = ['diveBar', 'spaceship', 'tropical', 'castle', 'stadium', 'grandma'];
const FLOATERS = ['🧻', '🪠', '🦆', '⛳', '🧼', '🚽', '🧻', '🪠', '⛳', '🦆'];


function untilTomorrowUtc(): string {
  const s = secondsUntilNextDaily();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Mascot() {
  return <svg className="mascot" viewBox={MASCOT_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: MASCOT_BODY }} />;
}


/** Art files shipped in public/art; the SVG versions stay as the fallback while a file is missing. */
export const ART = {
  logo: `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/art/logo.webp`,
  daily: `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/art/daily-card.webp`,
};

/** Little map illustration for the home card: roads, pins, and a crowned pin when you hold a throne. */
function MapArt({ mine }: { mine: number }) {
  return (
    <svg className="map-art" viewBox="0 0 150 120" aria-hidden="true">
      <rect x="0" y="0" width="150" height="120" rx="16" fill="#dff8ec" />
      <path d="M-5 30 C 40 20, 60 60, 110 45 S 150 20, 160 35" stroke="#fff" strokeWidth="9" fill="none" />
      <path d="M20 130 C 30 80, 80 110, 95 70 S 130 50, 155 75" stroke="#fff" strokeWidth="9" fill="none" />
      <path d="M-5 30 C 40 20, 60 60, 110 45 S 150 20, 160 35" stroke="#a9e6c8" strokeWidth="2" strokeDasharray="6 5" fill="none" />
      <circle cx="95" cy="92" r="10" fill="#9ad1ff" opacity="0.6" />
      <circle cx="95" cy="92" r="4" fill="#3a8dff" stroke="#fff" strokeWidth="2" />
      <g transform="translate(38 44)">
        <path d="M0 -18 a12 12 0 1 1 0.01 0 L0 4 Z" fill="#1f2a44" />
        <circle cx="0" cy="-12" r="5" fill="#fff" />
      </g>
      <g transform="translate(118 62)">
        <path d="M0 -18 a12 12 0 1 1 0.01 0 L0 4 Z" fill="#1f2a44" />
        <circle cx="0" cy="-12" r="5" fill="#fff" />
      </g>
      <g transform="translate(72 30)">
        <path d="M0 -22 a15 15 0 1 1 0.01 0 L0 6 Z" fill={mine > 0 ? '#ffd447' : '#1f2a44'} stroke="#1f2a44" strokeWidth="2" />
        <text x="0" y="-9" textAnchor="middle" fontSize="15">
          👑
        </text>
      </g>
    </svg>
  );
}

/** Resolves to true once the image loads, false if it 404s, null while unknown. */
function useImage(src: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setOk(true);
    img.onerror = () => live && setOk(false);
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return ok;
}

/** The daily card's picture: a floating green, a flag, a crowned throne. */
function DailyArt({ played }: { played: boolean }) {
  return (
    <svg className="daily-art" viewBox="0 0 360 190" aria-hidden="true">
      <defs>
        <linearGradient id="da-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#233258" />
          <stop offset="1" stopColor="#1a2440" />
        </linearGradient>
        <linearGradient id="da-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fe36b" />
          <stop offset="1" stopColor="#4fb84a" />
        </linearGradient>
        <linearGradient id="da-dirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a3c" />
          <stop offset="1" stopColor="#5a3a26" />
        </linearGradient>
      </defs>
      <rect width="360" height="190" fill="url(#da-sky)" />
      {[
        [30, 24, 1.6],
        [70, 60, 1.1],
        [120, 18, 1.3],
        [300, 30, 1.8],
        [335, 80, 1.1],
        [250, 14, 1.2],
        [20, 120, 1.0],
        [345, 140, 1.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
      ))}
      <path d="M40 132 C60 108 300 104 320 132 C335 150 300 176 180 180 C60 176 25 150 40 132 Z" fill="url(#da-green)" stroke="#1f2a44" strokeWidth="4" />
      <path d="M46 140 C60 160 120 178 180 180 C240 178 300 160 314 140 L300 172 C260 190 100 190 60 172 Z" fill="url(#da-dirt)" stroke="#1f2a44" strokeWidth="3" />
      <ellipse cx="120" cy="148" rx="40" ry="14" fill="#3f9c3a" opacity="0.55" />
      <circle cx="248" cy="112" r="16" fill="#2f8f3e" stroke="#1f2a44" strokeWidth="3" />
      <circle cx="268" cy="124" r="12" fill="#3aa347" stroke="#1f2a44" strokeWidth="3" />
      <rect x="246" y="126" width="4" height="14" fill="#5a3a26" />
      <circle cx="128" cy="150" r="5" fill="#1f2a44" opacity="0.5" />
      <rect x="126" y="108" width="3" height="44" fill="#f4f6f7" stroke="#1f2a44" strokeWidth="1.5" />
      <path d="M129 108 L154 116 L129 124 Z" fill="#ff5f7e" stroke="#1f2a44" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="150" cy="156" r="6" fill="#fff" stroke="#1f2a44" strokeWidth="2.5" />
      <ellipse cx="205" cy="146" rx="18" ry="6" fill="rgba(0,0,0,0.25)" />
      <rect x="192" y="96" width="26" height="22" rx="5" fill="#ffffff" stroke="#1f2a44" strokeWidth="3" />
      <path d="M186 118 C186 114 194 112 205 112 C216 112 224 114 224 118 L221 132 C219 140 212 144 205 144 C198 144 191 140 189 132 Z" fill="#ffffff" stroke="#1f2a44" strokeWidth="3" />
      <ellipse cx="205" cy="118" rx="14" ry="5" fill="#4db8ff" stroke="#1f2a44" strokeWidth="2.5" />
      <path d="M193 96 L196 84 L201 90 L205 80 L209 90 L214 84 L217 96 Z" fill={played ? '#c9d8ff' : '#ffc63a'} stroke="#1f2a44" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export function TitleScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [name, setName] = useState(getSavedName());
  const [avatar] = useState(getSavedAvatar());
  const logoArt = useImage(ART.logo) === true;
  const dailyArt = useImage(ART.daily) === true;
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
      <div className="title-inner home2">
        <header className="home-top">
          <span className="home-icons">
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
          </span>
          <button className="player-chip corner" onClick={() => go(() => setAskName(true))}>
            <Avatar av={avatar} size={26} className="chip-avatar" />
            <span className="player-name">{name ?? 'Set your name'}</span>
            <span className="player-thrones">👑 {thrones ?? '–'}</span>
          </button>
        </header>
        <div className="brand hero">
          {logoArt ? (
            <img className="logo-img hero" src={ART.logo} alt="Putt Putt Potty" />
          ) : (
            <>
              <Mascot />
              <div className="logo big">
                <span className="logo-top">Putt Putt</span>
                <span className="logo-bottom">Potty</span>
              </div>
            </>
          )}
        </div>
        <div className="tagline">Every bathroom is a course.</div>

        <button className={`daily-card${played ? ' played' : ''}`} onClick={() => go(() => (played ? navigate('leaders') : goToCourse('daily')), played ? 'tap' : 'whoosh')}>
          {dailyArt ? <img className="daily-img" src={ART.daily} alt="" /> : <DailyArt played={played} />}
          {dailyArt && !played ? null : (
            <span className={`sign${dailyArt ? ' badge' : ''}`}>
              <span className="sign-top">{played ? 'Your round' : "Today's round"}</span>
              <span className="sign-main">{played ? (best !== null ? `You shot ${best}` : 'Played') : 'Nine holes.'}</span>
              <span className="sign-sub">{played ? (dailyRank ? `#${dailyRank.rank} of ${dailyRank.of}` : 'On the board.') : 'One throne.'}</span>
            </span>
          )}
          <span className="cta in-card">{played ? `🏆 Leaderboard · next in ${untilTomorrowUtc()}` : `${edition === 'morning' ? '🌅' : '🌇'}  Play the ${edition} course`}</span>
        </button>
        <button className="map-card" onClick={() => go(() => navigate('map'), 'whoosh')}>
          <span className="mc-text">
            <span className="mc-kicker">📍 Real bathrooms</span>
            <strong>Nearby thrones</strong>
            <small>{nearby ? `${nearby.total} bathrooms · ${nearby.claimed} claimed · you hold ${nearby.mine}` : 'Three holes each. One throne to win.'}</small>
            <span className="mc-go">Open the map ›</span>
          </span>
          <MapArt mine={nearby?.mine ?? 0} />
        </button>

        <div className="duo">
          <button className="tile pink" onClick={() => go(() => navigate('match'), 'whoosh')}>
            <span className="tile-icon">🪠</span>
            <span className="tile-title">Quick match</span>
            <span className="tile-sub">Same nine holes. Live.</span>
          </button>
          <div className="tile mint">
            <span className="tile-icon">🎲</span>
            <span className="tile-title">Custom game</span>
            <span className="tile-sub">Pick your holes.</span>
            <span className="len-chips">
              {COURSE_LENGTHS.map((l) => (
                <button key={l.n} className={l.n === len ? 'active' : ''} onClick={() => pickLen(l.n)} aria-label={`${l.n} holes`}>
                  {l.label}
                </button>
              ))}
            </span>
            <button className="tile-go" onClick={() => go(() => goToCourse('random', len), 'whoosh')}>
              Tee off · {len} holes
            </button>
          </div>
        </div>

      </div>
      <TabBar active="play" />

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
