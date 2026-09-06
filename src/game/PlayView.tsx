import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Hole, Stroke } from '../sim/types';
import { FIXED_DT, cupRadius, type PhysicsParams } from '../sim/params';
import { compileHole, type World } from '../sim/world';
import { applyStroke, createSimState, holeScore, step, totalStrokes, type SimEvent, type SimState, STROKE_CAP } from '../sim/sim';
import { seedFromString } from '../sim/rng';
import { drawHole, drawMinimap, type AimOverlay } from '../render/drawHole';
import { fitCamera, fitScale, followCamera, type Camera } from '../render/camera';
import { drawBall } from '../render/objects';
import { ballLook } from './avatarParts';
import { getSavedAvatar } from '../net/supabase';
import { themeById } from '../render/themes';
import { useTuning } from './paramsStore';
import { DevPanel } from './DevPanel';
import { goToCourse, dailySeed, recordBest, getBest } from './courses';
import { Fx } from './fx';
import { sfx, unlockAudio, isMuted, setMuted } from './sound';
import { buzz } from './haptics';

interface Props {
  holes: Hole[];
  /** Shown as a corner button; used by the editor's test-play loop. */
  onExit?: () => void;
  exitLabel?: string;
  onOpenEditor?: () => void;
  /** Seed of a generated course (null = handmade). undefined = editor test play. */
  courseSeed?: string | null;
  /**
   * Ranked play: the sim runs with these params regardless of the dev panel,
   * so the server's replay matches. Hides the dev panel.
   */
  lockedParams?: PhysicsParams;
  /** Fires once when a hole ends (sunk or stroke cap), before the player taps onward. */
  onHoleDone?: (info: HoleDoneInfo) => void;
  /** Replaces the default hole-finished card body (buttons included). */
  renderDoneCard?: (info: HoleDoneInfo, actions: { next: () => void; retry: () => void }) => ReactNode;
  /** Extra content under the scorecard chips (leaderboards etc). */
  scorecardExtra?: ReactNode;
  /** Hides the retry button on ranked holes. */
  noRetry?: boolean;
  /** Epoch ms the round clock started; shows a live timer in the HUD. */
  timerFrom?: number | null;
  /** The time to beat (the king's round), shown against the running clock. */
  raceMs?: number | null;
  raceLabel?: string | null;
  /** Rendered just under the HUD (quick-match opponent strip). */
  topExtra?: ReactNode;
}

export interface HoleDoneInfo {
  holeIndex: number;
  hole: Hole;
  strokes: Stroke[];
  score: number;
  sunk: boolean;
}

interface Drag {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  pointerId: number;
}

const HUD_TOP = 92;
const HUD_BOTTOM = 48;
const SIDE_PAD = 8;
const MIN_FIT_SCALE = 10;
const CANCEL_POWER = 0.08;
/** Holding the screen while the ball rolls runs the sim this many times faster. */
const FAST_FORWARD = 3;
const MAX_FRAME = 0.1;
const INTRO_SECONDS = 1.4;

function scoreTerm(strokes: number, par: number, sunk: boolean): string {
  if (!sunk) return 'Stroke cap';
  if (strokes === 1) return 'Hole in one!';
  const d = strokes - par;
  if (d <= -3) return 'Albatross!';
  if (d === -2) return 'Eagle!';
  if (d === -1) return 'Birdie!';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double bogey';
  if (d === 3) return 'Triple bogey';
  return `+${d}`;
}

function relPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PlayView({ holes, onExit, exitLabel, courseSeed, lockedParams, onHoleDone, renderDoneCard, scorecardExtra, noRetry, timerFrom, raceMs, raceLabel, topExtra }: Props) {
  const tuning = useTuning();
  const { prefsRef } = tuning;
  const lockedRef = useRef<PhysicsParams | undefined>(lockedParams);
  lockedRef.current = lockedParams;
  const paramsRef = useMemo(() => ({ get current() { return lockedRef.current ?? tuning.paramsRef.current; } }), [tuning.paramsRef]);
  const onHoleDoneRef = useRef(onHoleDone);
  onHoleDoneRef.current = onHoleDone;
  const doneFiredRef = useRef(false);

  const [holeIndex, setHoleIndex] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [devOpen, setDevOpen] = useState(false);
  const [courseDone, setCourseDone] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [banner, setBanner] = useState<{ key: number; title: string; sub: string } | null>(null);
  const [shared, setShared] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const hole = holes[Math.min(holeIndex, holes.length - 1)];
  const seed = useMemo(() => seedFromString(hole.id), [hole.id]);
  const theme = themeById(hole.theme);

  // --- simulation refs (never React state: the loop mutates them at 120Hz)
  const worldRef = useRef<World>(compileHole(hole));
  const stateRef = useRef<SimState>(createSimState(hole, seed));
  const prevBallRef = useRef({ x: hole.tee.x, y: hole.tee.y });
  const accRef = useRef(0);
  const trailRef = useRef<number[]>([]);
  const lastTrailRef = useRef<number[]>([]);
  const cupFlashRef = useRef(0);
  const camTargetRef = useRef({ x: hole.tee.x, y: hole.tee.y });
  const dragRef = useRef<Drag | null>(null);
  const fastRef = useRef(false);
  const [fast, setFast] = useState(false);
  const fxRef = useRef(new Fx());
  const squashRef = useRef({ amt: 0, ang: 0 });
  const introRef = useRef({ t: INTRO_SECONDS + 1 });
  /** The player's chosen ball, from the avatar this phone saved. */
  const ballStyleRef = useRef(ballLook(getSavedAvatar()));
  /** Bottom aim bar: filled to the drag power each frame without re-rendering. */
  const aimBarRef = useRef<HTMLDivElement>(null);
  const aimFillRef = useRef<HTMLDivElement>(null);
  const sinkRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const timeRef = useRef(0);
  const holeParRef = useRef(hole.par);
  holeParRef.current = hole.par;

  // --- round timer (ranked location play)
  const [clockMs, setClockMs] = useState(0);
  useEffect(() => {
    if (!timerFrom) return;
    const id = setInterval(() => setClockMs(Date.now() - timerFrom), 250);
    return () => clearInterval(id);
  }, [timerFrom]);

  // --- HUD mirror of the bits of sim state React needs to render
  const [hud, setHud] = useState({ strokes: 0, done: false, sunk: false, strokeHistory: [] as Stroke[] });
  const syncHud = useCallback(() => {
    const s = stateRef.current;
    setHud({ strokes: totalStrokes(s), done: s.done, sunk: s.sunk, strokeHistory: s.strokeHistory.slice() });
  }, []);

  const resetHole = useCallback(
    (h: Hole, idx: number) => {
      const sd = seedFromString(h.id);
      worldRef.current = compileHole(h);
      stateRef.current = createSimState(h, sd);
      prevBallRef.current = { x: h.tee.x, y: h.tee.y };
      camTargetRef.current = { x: h.tee.x, y: h.tee.y };
      accRef.current = 0;
      trailRef.current = [];
      lastTrailRef.current = [];
      cupFlashRef.current = 0;
      dragRef.current = null;
      fastRef.current = false;
      fxRef.current = new Fx();
      squashRef.current = { amt: 0, ang: 0 };
      sinkRef.current = null;
      introRef.current = { t: 0 };
      doneFiredRef.current = false;
      setHud({ strokes: 0, done: false, sunk: false, strokeHistory: [] });
      setBanner({ key: Date.now(), title: `Hole ${idx + 1} · ${h.name}`, sub: `${themeById(h.theme).name} · Par ${h.par}` });
    },
    [],
  );

  useEffect(() => {
    resetHole(hole, holeIndex);
  }, [hole, holeIndex, resetHole]);

  useEffect(() => {
    // hud.done can be stale for one render after a hole change (the sim is
    // reset before the HUD mirror is), so trust the sim state, not the mirror.
    const st = stateRef.current;
    if (!hud.done || doneFiredRef.current || !st.done || st.strokeHistory.length === 0) return;
    doneFiredRef.current = true;
    onHoleDoneRef.current?.({ holeIndex, hole, strokes: st.strokeHistory.slice(), score: holeScore(st, hole.par), sunk: st.sunk });
  }, [hud.done, holeIndex, hole]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(id);
  }, [banner]);

  // --- canvas + loop
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 390, h: 844, dpr: 1 });
  const [, setSizeTick] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      setSizeTick((t) => t + 1);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const computeCamera = useCallback((bx: number, by: number, scaleMul = 1): { cam: Camera; follow: boolean } => {
    const { w, h } = sizeRef.current;
    const b = worldRef.current.hole.bounds;
    const viewW = w - SIDE_PAD * 2;
    const viewH = h - HUD_TOP - HUD_BOTTOM;
    const fs = fitScale(b, viewW, viewH);
    if (fs >= MIN_FIT_SCALE && scaleMul === 1) {
      const cam = fitCamera(b, viewW, viewH);
      return { cam: { scale: cam.scale, ox: cam.ox + SIDE_PAD, oy: cam.oy + HUD_TOP }, follow: false };
    }
    const scale = (fs >= MIN_FIT_SCALE ? fs : Math.max(viewW / b.w, 12)) * scaleMul;
    const cam = followCamera(b, viewW, viewH, scale, bx, by);
    return { cam: { scale, ox: cam.ox + SIDE_PAD, oy: cam.oy + HUD_TOP }, follow: fs < MIN_FIT_SCALE };
  }, []);

  const handleEvent = useCallback(
    (s: SimState, e: SimEvent): boolean => {
      const fx = fxRef.current;
      switch (e.type) {
        case 'bounce': {
          const strong = e.speed > 18;
          squashRef.current = { amt: Math.min(1, e.speed / 40) + 0.25, ang: Math.atan2(e.ny, e.nx) };
          if (e.kind === 'bumper') {
            fx.burst(e.x, e.y, { count: 10, kind: 'star', color: ['#ffd166', '#ff6f3c', '#ffffff'], speed: 12, size: 0.35, life: 0.5 });
            fx.ring(e.x, e.y, '#ff6f3c', 1.2);
            fx.shake(6);
            sfx.bumper();
            buzz(20);
          } else if (e.kind === 'post') {
            fx.burst(e.x, e.y, { count: 5, color: '#ffffff', speed: 6, size: 0.14, life: 0.3 });
            sfx.post();
            if (strong) buzz(10);
          } else if (e.kind === 'deadWall') {
            fx.burst(e.x, e.y, { count: 6, color: '#9aa3ad', speed: 3, size: 0.2, life: 0.4 });
            sfx.dead();
          } else if (e.kind === 'mover') {
            fx.burst(e.x, e.y, { count: 9, kind: 'spark', color: ['#ffd166', '#ffffff'], speed: 10, size: 0.22, life: 0.3 });
            fx.ring(e.x, e.y, '#ffd166', 0.8, 0.3);
            fx.shake(4);
            sfx.bumper();
            buzz(20);
          } else if (strong) {
            fx.burst(e.x, e.y, { count: 6, kind: 'spark', color: '#ffffff', speed: 9, size: 0.2, life: 0.25, dir: Math.atan2(e.ny, e.nx), spread: 1.1 });
            fx.shake(Math.min(4, e.speed / 15));
            sfx.wall(e.speed);
            if (e.speed > 30) buzz(12);
          } else {
            sfx.wall(e.speed);
          }
          return false;
        }
        case 'lipOut':
          cupFlashRef.current = 1;
          fx.ring(e.x, e.y, '#ffd166', 0.8, 0.4);
          fx.text(e.x, e.y - 2, 'LIP OUT', '#ffd166');
          sfx.clink();
          return false;
        case 'hazard': {
          const t = e.hazardType;
          if (t === 'water' || t === 'overflow') {
            fx.burst(e.x, e.y, { count: 18, color: ['#3a86ff', '#9be1ff', '#ffffff'], speed: 9, size: 0.22, life: 0.6, gravity: 25, dir: -Math.PI / 2, spread: 1.2 });
            fx.burst(e.x, e.y, { count: 6, kind: 'bubble', color: '#ffffff', speed: 2, size: 0.3, life: 0.7 });
            if (t === 'water') sfx.splash();
            else sfx.overflow();
          } else if (t === 'drain') {
            fx.burst(e.x, e.y, { count: 10, color: ['#6c757d', '#adb5bd'], speed: 4, size: 0.18, life: 0.5 });
            fx.ring(e.x, e.y, '#adb5bd', 0.6, 0.5);
            sfx.gurgle();
          } else if (t === 'pit') {
            fx.burst(e.x, e.y, { count: 8, color: ['#4a4d6a', '#12131f'], speed: 3, size: 0.25, life: 0.6 });
            sfx.fall();
          } else {
            fx.burst(e.x, e.y, { count: 10, color: '#e63946', speed: 6, size: 0.2, life: 0.5 });
            sfx.dead();
          }
          fx.text(e.x, e.y - 2.2, `${t.toUpperCase()} +${e.penalty}`, '#ff5f7e', 1.1);
          // poof where the ball reappears
          fx.burst(s.ball.x, s.ball.y, { count: 8, color: '#ffffff', speed: 3, size: 0.2, life: 0.35 });
          fx.shake(3);
          buzz(30);
          return true;
        }
        case 'sunk': {
          sinkRef.current = { t: 0, x: e.x, y: e.y };
          const strokes = totalStrokes(s);
          const par = holeParRef.current;
          const d = strokes - par;
          sfx.flush();
          if (strokes === 1) {
            fx.burst(e.x, e.y, { count: 60, kind: 'confetti', color: ['#ffd166', '#ff3fa4', '#3a86ff', '#5be3a3', '#ff6f3c'], speed: 16, size: 0.3, life: 1.6, gravity: 14, drag: 1.5 });
            fx.burst(e.x, e.y, { count: 16, kind: 'star', color: '#ffd166', speed: 12, size: 0.4, life: 0.8 });
            fx.text(e.x, e.y - 3, 'HOLE IN ONE!', '#ffd166', 1.4);
            fx.shake(6);
            setTimeout(() => sfx.stinger('ace'), 250);
            buzz(60);
          } else if (d < 0) {
            fx.burst(e.x, e.y, { count: 34, kind: 'confetti', color: ['#ffd166', '#5be3a3', '#3a86ff', '#ffffff'], speed: 13, size: 0.28, life: 1.3, gravity: 14, drag: 1.5 });
            fx.text(e.x, e.y - 3, scoreTerm(strokes, par, true).toUpperCase(), '#5be3a3', 1.3);
            setTimeout(() => sfx.stinger('great'), 250);
            buzz(40);
          } else if (d === 0) {
            fx.burst(e.x, e.y, { count: 12, kind: 'star', color: '#ffffff', speed: 8, size: 0.3, life: 0.6 });
            fx.text(e.x, e.y - 3, 'PAR', '#ffffff', 1.2);
            setTimeout(() => sfx.stinger('par'), 250);
            buzz(25);
          } else {
            fx.text(e.x, e.y - 3, scoreTerm(strokes, par, true).toUpperCase(), '#c9d8ff', 1.1);
            if (d >= 3) setTimeout(() => sfx.fanfare('bad'), 350);
            else setTimeout(() => sfx.stinger('bogey'), 250);
          }
          return true;
        }
        case 'pipe':
          fx.burst(e.x, e.y, { count: 10, color: ['#2ec4b6', '#ffffff'], speed: 5, size: 0.2, life: 0.4 });
          fx.ring(e.x, e.y, '#2ec4b6', 0.9, 0.35);
          fx.burst(e.exitX, e.exitY, { count: 10, color: ['#2ec4b6', '#ffffff'], speed: 6, size: 0.2, life: 0.4 });
          sfx.whoosh();
          lastTrailRef.current = [...lastTrailRef.current];
          trailRef.current = [e.exitX, e.exitY];
          buzz(15);
          return false;
        case 'sticky':
          fx.burst(e.x, e.y, { count: 10, color: ['#ff69b4', '#ffb3d9'], speed: 4, size: 0.22, life: 0.5 });
          fx.text(e.x, e.y - 2, 'STUCK', '#ff69b4');
          sfx.squelch();
          return true;
        case 'timeout':
          fx.text(e.x, e.y - 2, 'TIME', '#c9d8ff');
          return true;
        case 'rest':
          if (totalStrokes(s) >= STROKE_CAP && !s.sunk) {
            fx.text(s.ball.x, s.ball.y - 2, 'STROKE CAP', '#ff5f7e', 1.1);
            sfx.fanfare('bad');
          }
          return true;
        default:
          return false;
      }
    },
    [paramsRef],
  );

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frame = Math.min(0.1, (now - last) / 1000);
      last = now;
      timeRef.current += frame;
      const params = paramsRef.current;
      const prefs = prefsRef.current;
      const world = worldRef.current;
      const s = stateRef.current;
      const fx = fxRef.current;

      // --- fixed-step physics
      if (!s.resting && !s.done) {
        accRef.current += Math.min(frame, MAX_FRAME) * (fastRef.current ? FAST_FORWARD : 1);
        let settled = false;
        while (accRef.current >= FIXED_DT) {
          prevBallRef.current = { x: s.ball.x, y: s.ball.y };
          step(s, world, params);
          if (prefs.showTrail && !s.resting) trailRef.current.push(s.ball.x, s.ball.y);
          for (const e of s.events) if (handleEvent(s, e)) settled = true;
          accRef.current -= FIXED_DT;
          if (s.resting || s.done) {
            accRef.current = 0;
            break;
          }
        }
        if (settled) {
          lastTrailRef.current = trailRef.current;
          trailRef.current = [];
          if (fastRef.current) {
            fastRef.current = false;
            setFast(false);
          }
          syncHud();
        }
      } else {
        accRef.current = 0;
        prevBallRef.current = { x: s.ball.x, y: s.ball.y };
        // Movers keep moving while you aim; the stroke records the clock at launch.
        if (world.moving.length) s.clock += frame;
      }

      // --- effects timers
      fx.update(frame);
      squashRef.current.amt *= Math.exp(-frame * 10);
      if (cupFlashRef.current > 0) cupFlashRef.current = Math.max(0, cupFlashRef.current - frame * 2.5);
      if (introRef.current.t < INTRO_SECONDS) introRef.current.t += frame;
      if (sinkRef.current) sinkRef.current.t += frame;

      // --- interpolated ball
      const alpha = s.resting ? 1 : accRef.current / FIXED_DT;
      const pb = prevBallRef.current;
      const bx = pb.x + (s.ball.x - pb.x) * alpha;
      const by = pb.y + (s.ball.y - pb.y) * alpha;

      // --- camera: smoothed follow + intro swoop
      const ct = camTargetRef.current;
      const k = Math.min(1, frame * 7);
      ct.x += (bx - ct.x) * k;
      ct.y += (by - ct.y) * k;
      const base = computeCamera(ct.x, ct.y);
      let cam = base.cam;
      const it = introRef.current.t;
      if (it < INTRO_SECONDS) {
        const u = easeInOut(Math.min(1, it / INTRO_SECONDS));
        const zoom = computeCamera(world.hole.cup.x, world.hole.cup.y, 1.7).cam;
        cam = { scale: zoom.scale + (base.cam.scale - zoom.scale) * u, ox: zoom.ox + (base.cam.ox - zoom.ox) * u, oy: zoom.oy + (base.cam.oy - zoom.oy) * u };
      }

      // --- aim overlay
      let aim: AimOverlay | null = null;
      const d = dragRef.current;
      if (d && s.resting && !s.done) {
        let dx = d.curX - d.startX;
        let dy = d.curY - d.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) {
          const power = Math.min(1, dist / prefs.maxDragPx);
          const sign = prefs.invertDrag ? 1 : -1;
          dx = (dx / dist) * sign;
          dy = (dy / dist) * sign;
          aim = { x: s.ball.x, y: s.ball.y, dx, dy, power, lengthUnits: prefs.aimLineLength, cancelling: power < CANCEL_POWER };
        }
      }

      if (aimFillRef.current) aimFillRef.current.style.width = `${aim ? Math.round(aim.power * 100) : 0}%`;
      if (aimBarRef.current) aimBarRef.current.dataset.state = s.done ? 'done' : aim ? (aim.cancelling ? 'cancel' : 'aiming') : 'idle';

      // --- draw
      const { dpr, w, h } = sizeRef.current;
      const sh = fx.shakeOffset();
      ctx.setTransform(dpr, 0, 0, dpr, sh.x * dpr, sh.y * dpr);
      const sink = sinkRef.current;
      const showBall = !s.sunk || (sink !== null && sink.t < 0.75);
      drawHole(ctx, world.hole, cam, {
        ballRadius: params.ballRadius,
        cupRadius: cupRadius(params),
        ball: null,
        trail: prefs.showTrail ? trailRef.current : undefined,
        trailOld: prefs.showTrail ? lastTrailRef.current : undefined,
        aim,
        cupFlash: cupFlashRef.current,
        zoneLabels: prefs.showZoneLabels,
        dpr,
        time: timeRef.current,
        clock: s.clock,
        extra: (c) => {
          if (showBall) {
            if (sink && s.sunk) {
              // flush spiral into the cup
              const u = Math.min(1, sink.t / 0.75);
              const r = (1 - u) * 1.1;
              const a = u * Math.PI * 5;
              const scale = 1 - u * 0.85;
              c.save();
              c.translate(sink.x + Math.cos(a) * r, sink.y + Math.sin(a) * r * 0.7);
              c.scale(scale, scale);
              drawBall(c, 0, 0, params.ballRadius, ballStyleRef.current);
              c.restore();
            } else {
              const sq = squashRef.current;
              if (sq.amt > 0.02) {
                const sx = 1 - 0.32 * sq.amt;
                const sy = 1 + 0.32 * sq.amt;
                c.save();
                c.translate(bx, by);
                c.rotate(sq.ang);
                c.scale(sx, sy);
                drawBall(c, 0, 0, params.ballRadius, ballStyleRef.current);
                c.restore();
              } else drawBall(c, bx, by, params.ballRadius, ballStyleRef.current);
            }
          }
          fx.draw(c);
        },
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (base.follow) {
        const mmW = 64;
        const mmH = Math.min(180, (mmW * world.hole.bounds.h) / world.hole.bounds.w);
        drawMinimap(ctx, world.hole, w - mmW - 12, h - mmH - HUD_BOTTOM - 4, mmW, mmH, { x: -cam.ox / cam.scale, y: -cam.oy / cam.scale, w: w / cam.scale, h: h / cam.scale }, s.sunk ? null : { x: bx, y: by });
      }

      // drag origin joystick
      if (d && aim) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(d.startX, d.startY, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#1f2a44';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(d.startX, d.startY);
        ctx.lineTo(d.curX, d.curY);
        ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [computeCamera, handleEvent, paramsRef, prefsRef, syncHud]);

  // --- low-rate React re-render for power meter/toasts
  const [uiTick, setUiTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUiTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, []);
  void uiTick;

  // --- input
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    unlockAudio();
    const s = stateRef.current;
    if (!s.resting && !s.done && !dragRef.current) {
      // Ball in motion: hold to fast-forward.
      e.currentTarget.setPointerCapture(e.pointerId);
      fastRef.current = true;
      setFast(true);
      return;
    }
    if (!s.resting || s.done || dragRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    dragRef.current = { startX: x, startY: y, curX: x, curY: y, pointerId: e.pointerId };
    introRef.current.t = INTRO_SECONDS; // skip the swoop if the player is ready
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    d.curX = e.clientX - r.left;
    d.curY = e.clientY - r.top;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fastRef.current) {
      fastRef.current = false;
      setFast(false);
    }
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const s = stateRef.current;
    if (!s.resting || s.done) return;
    const prefs = prefsRef.current;
    let dx = d.curX - d.startX;
    let dy = d.curY - d.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const power = Math.min(1, dist / prefs.maxDragPx);
    if (power < CANCEL_POWER) return;
    const sign = prefs.invertDrag ? 1 : -1;
    dx *= sign;
    dy *= sign;
    const angle = Math.atan2(dy, dx);
    if (applyStroke(s, paramsRef.current, { angle, power })) {
      trailRef.current = [s.ball.x, s.ball.y];
      accRef.current = 0;
      const fx = fxRef.current;
      fx.ring(s.ball.x, s.ball.y, '#ffffff', 0.7, 0.3);
      fx.burst(s.ball.x, s.ball.y, { count: 5 + Math.round(power * 6), kind: 'spark', color: '#ffffff', speed: 6 + power * 8, size: 0.18, life: 0.25, dir: angle + Math.PI, spread: 0.6 });
      sfx.putt(power);
      buzz(8);
      syncHud();
    }
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    fastRef.current = false;
    setFast(false);
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  // --- derived UI
  const par = hole.par;
  const finishedRel = results.reduce((acc, sc, i) => acc + sc - holes[i].par, 0);
  const cur = hud.strokes;
  const dragging = dragRef.current;
  let meterPower = 0;
  if (dragging) {
    const dx = dragging.curX - dragging.startX;
    const dy = dragging.curY - dragging.startY;
    meterPower = Math.min(1, Math.sqrt(dx * dx + dy * dy) / prefsRef.current.maxDragPx);
  }
  const meterColor = meterPower < 0.4 ? '#5be3a3' : meterPower < 0.75 ? '#ffd166' : '#ff6f3c';

  const thisScore = hud.done ? holeScore(stateRef.current, par) : cur;
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const totalScore = results.reduce((a, b) => a + b, 0);

  const nextHole = () => {
    const sc = holeScore(stateRef.current, par);
    const newResults = [...results, sc];
    setResults(newResults);
    if (holeIndex + 1 < holes.length) setHoleIndex(holeIndex + 1);
    else {
      setCourseDone(true);
      const total = newResults.reduce((a, b) => a + b, 0);
      if (courseSeed) setNewBest(recordBest(courseSeed, total));
    }
  };
  const retryHole = () => resetHole(hole, holeIndex);
  const restartCourse = () => {
    setResults([]);
    setCourseDone(false);
    setNewBest(false);
    setShared(false);
    setHoleIndex(0);
    resetHole(holes[0], 0);
  };
  const jumpToHole = (i: number) => {
    setCourseDone(false);
    setResults(results.slice(0, i));
    setHoleIndex(i);
    if (i === holeIndex) resetHole(hole, i);
  };
  const share = async () => {
    const text = `Putt Putt Potty${courseSeed ? ` · ${courseSeed}` : ''}: ${totalScore} (${relPar(totalScore - totalPar)}) — ${results.join(' ')}`;
    const url = courseSeed ? `${location.origin}/?seed=${encodeURIComponent(courseSeed)}${holes.length !== 9 ? `&n=${holes.length}` : ''}` : location.origin;
    try {
      if (navigator.share) await navigator.share({ title: 'Putt Putt Potty', text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
      setShared(true);
    } catch {
      /* cancelled */
    }
  };
  const toggleMute = () => {
    unlockAudio();
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <div className="play" ref={wrapRef} style={{ background: theme.page }}>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />

      <div className="aim-bar" ref={aimBarRef} data-state="idle" aria-hidden="true">
        <span className="aim-hint">
          <span className="h-idle">Drag to aim. Release to putt.</span>
          <span className="h-aiming">Release to putt.</span>
          <span className="h-cancel">Let go here to cancel.</span>
        </span>
        <span className="aim-meter">
          <span className="aim-fill" ref={aimFillRef}>
            <span className="aim-ball" />
          </span>
        </span>
      </div>

      {timerFrom ? (
        <div className={`race-clock${raceMs !== null && raceMs !== undefined ? (clockMs <= raceMs ? ' ahead' : ' behind') : ''}`}>
          <div className="race-time">⏱ {fmtClock(clockMs)}</div>
          <div className="race-target">{raceMs !== null && raceMs !== undefined ? `${raceLabel ?? 'the king'} did it in ${fmtClock(raceMs)}` : 'your time'}</div>
        </div>
      ) : null}
      <div className="hud">
        <div>
          <div className="name">
            HOLE {holeIndex + 1}/{holes.length} · PAR {par}
          </div>
          <div className="hole-name">{hole.name}</div>
          <div className="env">{theme.name}</div>
        </div>
        <div className="right">
          <div className="name">STROKES</div>
          <div className="big" key={cur}>
            <span className="bump">{cur}</span>
            {cur > par && <span className="over">{relPar(cur - par)}</span>}
          </div>
          <div className="name">
            COURSE <span className={finishedRel < 0 ? 'score-under' : finishedRel > 0 ? 'score-over' : ''}>{relPar(finishedRel)}</span>
          </div>
        </div>
      </div>

      {topExtra}

      {onExit ? (
        <button className="corner-btn tl" onClick={onExit} title={exitLabel ?? 'Back'}>
          ←
        </button>
      ) : (
        <button className="corner-btn tl" onClick={() => goToCourse('title')} title="Title screen">
          ⌂
        </button>
      )}
      {!lockedParams && (
        <button className="corner-btn tr" onClick={() => setDevOpen((v) => !v)} title="Dev panel">
          ⚙
        </button>
      )}
      <button className="corner-btn tr2" onClick={toggleMute} title={muted ? 'Sound off' : 'Sound on'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {dragging && (
        <div className={`power-meter${meterPower < CANCEL_POWER ? ' cancel' : ''}`}>
          <div className="fill" style={{ height: `${meterPower * 100}%`, background: meterColor }} />
        </div>
      )}

      {banner && (
        <div className="banner" key={banner.key}>
          <div className="banner-title">{banner.title}</div>
          <div className="banner-sub">{banner.sub}</div>
        </div>
      )}

      {!hud.done && !dragging && hud.strokes === 0 && !banner && <div className="hint">Drag anywhere to aim · release to putt · hold while it rolls to fast-forward</div>}
      {fast && <div className="ff-badge">⏩ ×{FAST_FORWARD}</div>}

      {hud.done && !courseDone && (
        <div className="overlay">
          <div className="card pop">
            <h2>{hud.sunk ? scoreTerm(thisScore, par, true) : 'Stroke cap'}</h2>
            <div className="sub">
              {hud.sunk ? `${cur} stroke${cur === 1 ? '' : 's'}` : `${STROKE_CAP} strokes, scored ${thisScore}`} · par {par}
            </div>
            {renderDoneCard ? (
              renderDoneCard({ holeIndex, hole, strokes: hud.strokeHistory, score: thisScore, sunk: hud.sunk }, { next: nextHole, retry: retryHole })
            ) : (
              <>
                <button className="primary" onClick={nextHole}>
                  {holeIndex + 1 < holes.length ? 'Next hole →' : 'See scorecard'}
                </button>
                {!noRetry && courseSeed === undefined && <button onClick={retryHole}>Retry hole</button>}
                {!noRetry && courseSeed === null && <button onClick={retryHole}>Retry hole</button>}
                {onExit && <button onClick={onExit}>{exitLabel ?? 'Back'}</button>}
              </>
            )}
          </div>
        </div>
      )}

      {courseDone && (
        <div className="overlay">
          <div className="card pop scorecard">
            <h2>{totalScore - totalPar < 0 ? 'Under par!' : totalScore - totalPar === 0 ? 'Even par' : 'Course complete'}</h2>
            <div className="total">
              <span className="total-num">{totalScore}</span>
              <span className={`total-rel ${totalScore - totalPar < 0 ? 'score-under' : totalScore - totalPar > 0 ? 'score-over' : ''}`}>{relPar(totalScore - totalPar)}</span>
            </div>
            <div className="sub">
              par {totalPar}
              {courseSeed && ` · ${courseSeed}`}
              {newBest && <span className="best"> · NEW BEST</span>}
              {!newBest && courseSeed && getBest(courseSeed) !== null && ` · best ${getBest(courseSeed)}`}
            </div>
            <div className="chips">
              {holes.map((h, i) => {
                const dlt = results[i] - h.par;
                const cls = results[i] === 1 ? 'ace' : dlt < 0 ? 'under' : dlt === 0 ? 'par' : dlt >= 3 ? 'bad' : 'over';
                return (
                  <div key={h.id} className={`chip ${cls}`} title={`${h.name} · par ${h.par}`}>
                    <span className="chip-n">{i + 1}</span>
                    <span className="chip-s">{results[i]}</span>
                  </div>
                );
              })}
            </div>
            {scorecardExtra}
            <button className="primary" onClick={share}>
              {shared ? 'Shared!' : 'Share score'}
            </button>
            {!onExit && <button onClick={() => goToCourse('random', holes.length)}>New course, same length</button>}
            {!onExit && courseSeed !== dailySeed() && getBest(dailySeed()) === null && <button onClick={() => goToCourse('daily')}>Daily course</button>}
            {!noRetry && <button onClick={restartCourse}>Play again</button>}
            {onExit ? <button onClick={onExit}>{exitLabel ?? 'Back'}</button> : <button onClick={() => goToCourse('title')}>Title screen</button>}
          </div>
        </div>
      )}

      {devOpen && !lockedParams && (
        <DevPanel
          params={tuning.params}
          prefs={tuning.prefs}
          setParam={tuning.setParam}
          setPref={tuning.setPref}
          reset={tuning.reset}
          onClose={() => setDevOpen(false)}
          holeNames={holes.map((h) => h.name)}
          holeIndex={holeIndex}
          onJumpToHole={jumpToHole}
          strokeHistory={hud.strokeHistory}
          seed={seed}
          courseSeed={onExit ? undefined : (courseSeed ?? null)}
        />
      )}
    </div>
  );
}
