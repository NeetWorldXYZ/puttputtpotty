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
      ctx.fillStyle = 'rgba(7,9,10,0.62)';
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

  return (
    <div className="title" onPointerDown={wake} onPointerUp={wake} onClick={wake}>
      <canvas ref={canvasRef} className="title-bg" />
      <div className="title-inner home">
        <div className="home-stack">
          <header className="home-head">
            <div className="logo small">
              <span className="logo-top">Putt Putt</span>
              <span className="logo-bottom">Potty</span>
            </div>
            <button className="player-chip" onClick={() => go(() => setAskName(true))}>
              <span className="player-name">{name ?? 'Set your name'}</span>
              <span className="player-thrones">👑 {thrones ?? '–'}</span>
            </button>
          </header>
          <div className="tagline">Every bathroom is a course. Every course has a king.</div>

          <section className="home-card hero" onClick={() => go(() => navigate('map'))}>
            <div className="card-icon">👑</div>
            <div className="card-body">
              <div className="card-title">Thrones</div>
              <div className="card-sub">
                {nearby ? `${nearby.total} bathrooms near you · ${nearby.claimed} claimed · you hold ${nearby.mine}` : 'Real bathrooms near you. Beat the record, take the throne.'}
              </div>
            </div>
            <button className="card-cta">Open map</button>
          </section>

          <section className="home-card" onClick={() => go(() => goToCourse('daily'))}>
            <div className="card-icon">📅</div>
            <div className="card-body">
              <div className="card-title">
                Daily course <span className={`pill${played ? ' done' : ''}`}>{played ? '1/1' : '0/1'}</span>
              </div>
              <div className="card-sub">
                {played
                  ? `You shot ${best}${dailyRank ? ` · #${dailyRank.rank} of ${dailyRank.of} today` : ''} · next course in ${untilTomorrowUtc()}`
                  : `Nine holes, one attempt, everyone plays the same course · resets in ${untilTomorrowUtc()}`}
              </div>
            </div>
            <button className="card-cta">{played ? 'Results' : 'Play'}</button>
          </section>

          <section className="home-card">
            <div className="card-icon">🎲</div>
            <div className="card-body">
              <div className="card-title">Custom game</div>
              <div className="card-sub">Fresh holes every time · {lenInfo.blurb}</div>
              <div className="len-chips">
                {COURSE_LENGTHS.map((l) => (
                  <button key={l.n} className={l.n === len ? 'active' : ''} onClick={() => pickLen(l.n)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="card-cta" onClick={() => go(() => goToCourse('random', len))}>
              Tee off
            </button>
          </section>

          <div className="home-row">
            <button className="menu-small" onClick={() => go(() => navigate('leaders'))}>
              🏆 Leaderboard
            </button>
            <button
              className="menu-small"
              onClick={() =>
                go(() => {
                  setMuted(!muted);
                  setMutedState(!muted);
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
