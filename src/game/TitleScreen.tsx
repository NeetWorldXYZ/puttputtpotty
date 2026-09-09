import { MenuVolume } from './MenuControls';
import { useEffect, useRef, useState } from 'react';
import { COURSE } from '../holes';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import type { Hole } from '../sim/types';
import { COURSE_LENGTHS, dailyEdition, dailySeed, getBest, getPreferredLength, goToCourse, secondsUntilNextDaily, setPreferredLength } from './courses';
import { getAudio, isMuted, sfx, unlockAudio } from './sound';
import { startTheme } from './music';
import { navigate } from '../router';
import { api } from '../net/api';
import { ensureSession, getSavedName, loadProfile, getSavedAvatar } from '../net/supabase';
import { recallFix } from '../net/places';
import { AccountSheet } from './AccountSheet';
import { TabBar } from './TabBar';
import { Avatar } from './Avatar';
import { GameIcon } from './GameIcon';
import { MatchIcon } from './MatchIcon';
import { ClubhouseMap } from './ClubhouseMap';
import './Clubhouse.css';
import { ChallengesSheet, claimable } from './ChallengesSheet';
import type { ChallengeBoard } from '../net/api';

const SHOW_THEMES = ['diveBar', 'spaceship', 'tropical', 'castle', 'stadium', 'grandma'];
const FLOATERS = ['🧻', '🪠', '🦆', '⛳', '🧼', '🚽', '🧻', '🪠', '⛳', '🦆'];


function untilTomorrowUtc(): string {
  const s = secondsUntilNextDaily();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const relPar = (d: number) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);
const dailyStatLabel = (best: number | null, r: { rank: number; of: number; total: number; par: number } | null) =>
  r ? `You shot ${r.total}, ${relPar(r.total - r.par)}, rank ${r.rank} of ${r.of}` : best !== null ? `You shot ${best}` : 'See your results';

export function TitleScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    total: number;
    par: number;
  } | null>(null);
  const [record, setRecord] = useState<{ won: number; lost: number } | null>(null);
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [challenges, setChallenges] = useState(false);
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
      const [kings, near, board, ch] = await Promise.allSettled([
        api.profile(me),
        fix ? api.nearby(fix.lat, fix.lng, 25000) : Promise.resolve([]),
        api.dailyStanding(daily),
        api.challenges(),
      ]);
      if (cancelled) return;
      if (kings.status === 'fulfilled' && kings.value) {
        setThrones(kings.value.thrones);
        setRecord({ won: kings.value.matches_won ?? 0, lost: Math.max(0, (kings.value.matches ?? 0) - (kings.value.matches_won ?? 0)) });
      }
      if (ch.status === 'fulfilled' && ch.value) setBoard(ch.value);
      if (near.status === 'fulfilled' && fix)
        setNearby({
          total: near.value.length,
          claimed: near.value.filter((l) => l.king_name).length,
          mine: near.value.filter((l) => l.king_user === me).length,
        });
      if (board.status === 'fulfilled' && board.value) setDailyRank(board.value);
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
    // Music is shared across menus; App stops it when entering a course.
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
      <div className="title-inner home2 compact-home open-home clubhouse-home">
        <header className="home-top">
          <div className="home-icons">
            <MenuVolume />
            <button className="icon-btn" aria-label="How to play" onClick={() => go(() => setHelp(true))}>
              ❓
            </button>
            <button className="icon-btn ch-btn" aria-label={`Challenges${claimable(board) ? `, ${claimable(board)} ready to claim` : ''}`} onClick={() => go(() => setChallenges(true))}>
              🎯{claimable(board) > 0 && <span className="ch-badge">{claimable(board)}</span>}
            </button>
          </div>
          <button className="player-chip corner" onClick={() => go(() => setAskName(true))}>
            <Avatar av={avatar} size={26} className="chip-avatar" />
            <span className="player-name">{name ?? 'Set your name'}</span>
            <span className="player-thrones">👑 {thrones ?? '–'}</span>
          </button>
        </header>
        <div className="arcade-brand"><img src={`${import.meta.env.BASE_URL}art/arcade-logo.webp`} alt="Putt Putt Potty" draggable={false} /></div>
        <div className="clubhouse-heading">
          <h1>GO CLAIM YOUR CROWN</h1>
          <p>Every bathroom is a course.</p>
        </div>
        <button className="clubhouse-invitation" aria-label={nearby ? `Open throne map, ${nearby.total} bathrooms nearby` : 'Open throne map'} onClick={() => go(() => navigate('map'), 'whoosh')}>
          <ClubhouseMap />
          <span className="clubhouse-map-cta">OPEN THRONE MAP <span aria-hidden="true">→</span></span>
        </button>
        <p className="clubhouse-rule">Visit. Beat the record. Become king.</p>
        <button className="clubhouse-kingdom" onClick={() => go(() => navigate('profile'))}>
          <GameIcon kind="crown" /><strong>YOUR KINGDOM</strong>
          <span>{thrones === null ? 'Loading…' : `${thrones} ${thrones === 1 ? 'throne' : 'thrones'} held`}</span>
        </button>
        <section className="clubhouse-secondary" aria-label="More ways to play">
          <button aria-label={`Daily challenge · ${edition} · Next round in ${untilTomorrowUtc()}`} onClick={() => go(() => (played ? navigate('leaders') : goToCourse('daily')), played ? 'tap' : 'whoosh')}>
            <GameIcon kind="flag" />
            <span>
              <strong>{played ? 'DAILY RESULTS' : 'DAILY COURSE'}</strong>
              {played ? (
                <span className="sec-stat" aria-label={dailyStatLabel(best, dailyRank)}>
                  {(dailyRank?.total ?? best) !== null && <b className="sec-num">{dailyRank?.total ?? best}</b>}
                  {dailyRank && <i className={dailyRank.total - dailyRank.par < 0 ? 'under' : dailyRank.total - dailyRank.par > 0 ? 'over' : ''}>{relPar(dailyRank.total - dailyRank.par)}</i>}
                  {dailyRank ? <em className={dailyRank.rank === 1 ? 'top' : ''}>{dailyRank.rank === 1 ? '#1 today' : `#${dailyRank.rank} of ${dailyRank.of}`}</em> : <em>see results</em>}
                </span>
              ) : (
                <small>A new course every day</small>
              )}
            </span>
            <b aria-hidden="true">›</b>
          </button>
          <button onClick={() => go(() => navigate('match'), 'whoosh')}>
            <MatchIcon />
            <span>
              <strong>QUICK MATCH</strong>
              {record && record.won + record.lost > 0 ? (
                <span className="sec-stat" aria-label={`All time: ${record.won} won, ${record.lost} lost`}>
                  <b className="sec-num">{record.won}</b>
                  <i className="dash">–</i>
                  <b className="sec-num lost">{record.lost}</b>
                  <em>all time</em>
                </span>
              ) : (
                <small>Find a challenger</small>
              )}
            </span>
            <b aria-hidden="true">›</b>
          </button>
        </section>
        <button className="clubhouse-custom" onClick={() => go(() => setCustom(true))}>Custom round <span aria-hidden="true">→</span></button>
      </div>
      <TabBar active="play" />
      {challenges && (
        <ChallengesSheet
          initial={board}
          onClose={(b) => {
            setChallenges(false);
            if (b) setBoard(b);
          }}
        />
      )}
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
