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
      <div className="course-atmosphere" aria-hidden="true">
        <svg className="course-backdrop" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
          <g fill="#65c68e" stroke="#b8f1bd" strokeWidth="2">
            <path d="M-50 150C20 25 190 50 180 155S80 220 115 330S-65 380-50 150Z" />
            <path d="M415 70C535 5 665 100 580 195S505 390 405 330S525 195 415 70Z" />
            <path d="M55 565C-10 435 190 370 225 500S115 610 215 745S-40 785 55 565Z" />
            <path d="M480 540C620 425 705 670 555 695S545 940 385 830S395 665 480 540Z" />
          </g>
          <path d="M-30 450C215 295 275 115 355-30M140 960C360 710 210 525 400 435S620 450 670 340" fill="none" stroke="#fff1bc" strokeWidth="17" />
          <path d="M-30 450C215 295 275 115 355-30M140 960C360 710 210 525 400 435S620 450 670 340" fill="none" stroke="#408e77" strokeWidth="2" strokeDasharray="8 10" />
          <path d="M240 235C295 155 365 225 320 300S245 360 240 235Z" fill="#67daee" stroke="#c1f9ee" strokeWidth="3" />
          <g fill="none" stroke="#fff4bd" strokeWidth="3" strokeLinecap="round"><path d="M80 145v-45l28 10-28 10M475 235v-45l28 10-28 10M125 560v-45l28 10-28 10M490 760v-45l28 10-28 10" /></g>
        </svg>
      </div>
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
        <div className="club-brand"><span>PUTT PUTT <b>POTTY</b></span><GameIcon kind="crown" /></div>
        <section className="daily-feature" aria-label="Daily challenge">
          <div className="feature-eyebrow"><span>THE DAILY NINE</span><span>{played ? 'ROUND COMPLETE' : 'NEW EVERY DAY'}</span></div>
          <h1>{played ? <>That's a wrap.</> : <>Small putts.<br /><em>Big throne energy.</em></>}</h1>
          <p>{played ? 'Your round is in. See where you stand.' : 'Nine holes. One daily challenge. Make it count.'}</p>
          <div className="feature-score"><span>{best !== null ? <><b>{best}</b> YOUR STROKES</> : <><b>09</b> HOLES</>}</span><GameIcon kind={played ? 'trophy' : 'flag'} /></div>
          <button className="daily-play" onClick={() => go(() => (played ? navigate('leaders') : goToCourse('daily')), played ? 'tap' : 'whoosh')}><span>{played ? 'See daily results' : 'Play daily round'}</span><span aria-hidden="true">↗</span></button>
          <small className="feature-reset">{edition} course · Next round in {untilTomorrowUtc()}</small>
        </section>
        <section className="home-actions" aria-label="Choose how to play">
          <button className="action-tile map-action" onClick={() => go(() => navigate('map'), 'whoosh')}>
            <GameIcon kind="map" /><strong>Throne map</strong>
            <small>{nearby ? `${nearby.total} bathrooms nearby` : 'Find your next throne'}</small>
            <span className="tile-arrow" aria-hidden="true">↗</span>
          </button>
        </section>
        <div className="home-status" aria-label="Your progress">
          <span><b>{thrones ?? '—'}</b> thrones held</span>
          <span>{best !== null ? <><b>{best}</b> daily strokes</> : dailyRank ? <><b>#{dailyRank.rank}</b> daily rank</> : <>Next daily <b>{untilTomorrowUtc()}</b></>}</span>
        </div>
        <div className="home-secondary">
          <button onClick={() => go(() => setCustom(true))}><GameIcon kind="dice" /><span>Custom game<small>Your round, your length</small></span></button>
          <button onClick={() => go(() => navigate('match'), 'whoosh')}><GameIcon kind="flag" /><span>Quick match<small>Go head to head</small></span></button>
        </div>
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
