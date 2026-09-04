import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hole, Stroke } from '../sim/types';
import { FIXED_DT, cupRadius } from '../sim/params';
import { compileHole, type World } from '../sim/world';
import { applyStroke, createSimState, holeScore, step, totalStrokes, type SimState, STROKE_CAP } from '../sim/sim';
import { seedFromString } from '../sim/rng';
import { drawHole, drawMinimap, type AimOverlay } from '../render/drawHole';
import { fitCamera, fitScale, followCamera, type Camera } from '../render/camera';
import { useTuning } from './paramsStore';
import { DevPanel } from './DevPanel';

interface Props {
  holes: Hole[];
  /** Shown as a corner button; used by the editor's test-play loop. */
  onExit?: () => void;
  exitLabel?: string;
  onOpenEditor?: () => void;
}

interface Drag {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  pointerId: number;
}

interface Toast {
  text: string;
  kind: 'danger' | 'accent';
  until: number;
}

const HUD_TOP = 70;
const HUD_BOTTOM = 48;
const SIDE_PAD = 8;
/** Below this many px per unit the whole-hole view is too small to read; switch to follow. */
const MIN_FIT_SCALE = 10;
const CANCEL_POWER = 0.08;

function scoreTerm(strokes: number, par: number, sunk: boolean): string {
  if (!sunk) return 'Stroke cap';
  if (strokes === 1) return 'Hole in one!';
  const d = strokes - par;
  if (d <= -3) return 'Albatross';
  if (d === -2) return 'Eagle';
  if (d === -1) return 'Birdie';
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

export function PlayView({ holes, onExit, exitLabel, onOpenEditor }: Props) {
  const tuning = useTuning();
  const { paramsRef, prefsRef } = tuning;

  const [holeIndex, setHoleIndex] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [devOpen, setDevOpen] = useState(false);
  const [courseDone, setCourseDone] = useState(false);
  const hole = holes[Math.min(holeIndex, holes.length - 1)];
  const seed = useMemo(() => seedFromString(hole.id), [hole.id]);

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
  const toastRef = useRef<Toast | null>(null);

  // --- HUD mirror of the bits of sim state React needs to render
  const [hud, setHud] = useState({ strokes: 0, done: false, sunk: false, strokeHistory: [] as Stroke[] });
  const syncHud = useCallback(() => {
    const s = stateRef.current;
    setHud({ strokes: totalStrokes(s), done: s.done, sunk: s.sunk, strokeHistory: s.strokeHistory.slice() });
  }, []);

  const resetHole = useCallback(
    (h: Hole) => {
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
      toastRef.current = null;
      setHud({ strokes: 0, done: false, sunk: false, strokeHistory: [] });
    },
    [],
  );

  // Rebuild when the hole changes (index change, or the editor handing in a new hole).
  useEffect(() => {
    resetHole(hole);
  }, [hole, resetHole]);

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

  /** Camera for the current frame; also reports whether we are in follow mode. */
  const computeCamera = useCallback(
    (bx: number, by: number): { cam: Camera; follow: boolean } => {
      const { w, h } = sizeRef.current;
      const b = worldRef.current.hole.bounds;
      const viewW = w - SIDE_PAD * 2;
      const viewH = h - HUD_TOP - HUD_BOTTOM;
      const fs = fitScale(b, viewW, viewH);
      if (fs >= MIN_FIT_SCALE) {
        const cam = fitCamera(b, viewW, viewH);
        return { cam: { scale: cam.scale, ox: cam.ox + SIDE_PAD, oy: cam.oy + HUD_TOP }, follow: false };
      }
      const scale = Math.max(viewW / b.w, 12);
      const cam = followCamera(b, viewW, viewH, scale, bx, by);
      return { cam: { scale, ox: cam.ox + SIDE_PAD, oy: cam.oy + HUD_TOP }, follow: true };
    },
    [],
  );

  const handleEvents = useCallback(
    (s: SimState, now: number) => {
      let settled = false;
      for (const e of s.events) {
        switch (e.type) {
          case 'lipOut':
            cupFlashRef.current = 1;
            toastRef.current = { text: 'LIP OUT', kind: 'accent', until: now + 900 };
            break;
          case 'hazard':
            toastRef.current = {
              text: `${e.hazardType.toUpperCase()}  +${e.penalty}`,
              kind: 'danger',
              until: now + 1400,
            };
            settled = true;
            break;
          case 'timeout':
            toastRef.current = { text: 'TIME CAP', kind: 'accent', until: now + 900 };
            settled = true;
            break;
          case 'sticky':
            toastRef.current = { text: 'STUCK', kind: 'danger', until: now + 900 };
            settled = true;
            break;
          case 'rest':
          case 'sunk':
            settled = true;
            break;
          default:
            break;
        }
      }
      if (settled) {
        lastTrailRef.current = trailRef.current;
        trailRef.current = [];
        syncHud();
      }
    },
    [syncHud],
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
      const params = paramsRef.current;
      const prefs = prefsRef.current;
      const world = worldRef.current;
      const s = stateRef.current;

      // --- fixed-step physics
      if (!s.resting && !s.done) {
        accRef.current += frame;
        while (accRef.current >= FIXED_DT) {
          prevBallRef.current = { x: s.ball.x, y: s.ball.y };
          step(s, world, params);
          if (prefs.showTrail && !s.resting) trailRef.current.push(s.ball.x, s.ball.y);
          if (s.events.length) handleEvents(s, now);
          accRef.current -= FIXED_DT;
          if (s.resting || s.done) {
            accRef.current = 0;
            break;
          }
        }
      } else {
        accRef.current = 0;
        prevBallRef.current = { x: s.ball.x, y: s.ball.y };
      }

      // --- interpolated ball for rendering
      const alpha = s.resting ? 1 : accRef.current / FIXED_DT;
      const pb = prevBallRef.current;
      const bx = pb.x + (s.ball.x - pb.x) * alpha;
      const by = pb.y + (s.ball.y - pb.y) * alpha;

      // --- camera (smoothed follow)
      const ct = camTargetRef.current;
      const k = Math.min(1, frame * 7);
      ct.x += (bx - ct.x) * k;
      ct.y += (by - ct.y) * k;
      const { cam, follow } = computeCamera(ct.x, ct.y);

      // --- timers
      if (cupFlashRef.current > 0) cupFlashRef.current = Math.max(0, cupFlashRef.current - frame * 2.5);

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
          aim = {
            x: s.ball.x,
            y: s.ball.y,
            dx,
            dy,
            power,
            lengthUnits: prefs.aimLineLength,
            cancelling: power < CANCEL_POWER,
          };
        }
      }

      // --- draw
      const { dpr, w, h } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHole(ctx, world.hole, cam, {
        ballRadius: params.ballRadius,
        cupRadius: cupRadius(params),
        ball: s.sunk ? null : { x: bx, y: by },
        trail: prefs.showTrail ? trailRef.current : undefined,
        trailOld: prefs.showTrail ? lastTrailRef.current : undefined,
        aim,
        cupFlash: cupFlashRef.current,
        zoneLabels: prefs.showZoneLabels,
      });

      if (follow) {
        const mmW = 64;
        const mmH = Math.min(180, (mmW * world.hole.bounds.h) / world.hole.bounds.w);
        drawMinimap(
          ctx,
          world.hole,
          w - mmW - 12,
          h - mmH - HUD_BOTTOM - 4,
          mmW,
          mmH,
          { x: -cam.ox / cam.scale, y: -cam.oy / cam.scale, w: w / cam.scale, h: h / cam.scale },
          s.sunk ? null : { x: bx, y: by },
        );
      }

      // --- drag origin marker (so a thumb knows where "zero" is)
      if (d && aim) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(d.startX, d.startY, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(d.startX, d.startY);
        ctx.lineTo(d.curX, d.curY);
        ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [computeCamera, handleEvents, paramsRef, prefsRef]);

  // --- toast / power meter need React re-renders at a low rate
  const [uiTick, setUiTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUiTick((t) => t + 1), 80);
    return () => clearInterval(id);
  }, []);
  void uiTick;

  // --- input
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.resting || s.done || dragRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    dragRef.current = { startX: x, startY: y, curX: x, curY: y, pointerId: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    d.curX = e.clientX - r.left;
    d.curY = e.clientY - r.top;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
      syncHud();
    }
  };
  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
  const toast = toastRef.current && toastRef.current.until > performance.now() ? toastRef.current : null;

  const nextHole = () => {
    const sc = holeScore(stateRef.current, par);
    const newResults = [...results, sc];
    setResults(newResults);
    if (holeIndex + 1 < holes.length) setHoleIndex(holeIndex + 1);
    else setCourseDone(true);
  };
  const retryHole = () => resetHole(hole);
  const restartCourse = () => {
    setResults([]);
    setCourseDone(false);
    setHoleIndex(0);
    resetHole(holes[0]);
  };
  const jumpToHole = (i: number) => {
    setCourseDone(false);
    setResults(results.slice(0, i));
    setHoleIndex(i);
    if (i === holeIndex) resetHole(hole);
  };

  const thisScore = hud.done ? holeScore(stateRef.current, par) : cur;
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const totalScore = results.reduce((a, b) => a + b, 0);

  return (
    <div className="play" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />

      <div className="hud">
        <div>
          <div className="name">
            HOLE {holeIndex + 1}/{holes.length} · {hole.name}
          </div>
          <div className="big">PAR {par}</div>
        </div>
        <div className="right">
          <div className="name">
            STROKES{hud.strokes >= STROKE_CAP ? ' · CAP' : ''} · COURSE{' '}
            <span className={finishedRel < 0 ? 'score-under' : finishedRel > 0 ? 'score-over' : ''}>
              {relPar(finishedRel)}
            </span>
          </div>
          <div className="big">
            {cur}
            {cur > par && (
              <span style={{ fontSize: 15, marginLeft: 8 }} className="score-over">
                {relPar(cur - par)}
              </span>
            )}
          </div>
        </div>
      </div>

      {onExit && (
        <button className="corner-btn tl" onClick={onExit} title={exitLabel ?? 'Back'}>
          ←
        </button>
      )}
      {!onExit && onOpenEditor && (
        <button className="corner-btn tl" onClick={onOpenEditor} title="Level editor" style={{ fontSize: 14 }}>
          ✎
        </button>
      )}
      <button className="corner-btn tr" onClick={() => setDevOpen((v) => !v)} title="Dev panel">
        ⚙
      </button>

      {dragging && (
        <div className={`power-meter${meterPower < CANCEL_POWER ? ' cancel' : ''}`}>
          <div className="fill" style={{ height: `${meterPower * 100}%` }} />
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      {!hud.done && !dragging && hud.strokes === 0 && (
        <div className="hint">Drag anywhere to aim · release to putt · drag back to cancel</div>
      )}

      {hud.done && !courseDone && (
        <div className="overlay">
          <div className="card">
            <h2>{hud.sunk ? 'Sunk!' : 'Stroke cap'}</h2>
            <div className="term">{scoreTerm(thisScore, par, hud.sunk)}</div>
            <div className="sub">
              {hud.sunk ? `${cur} stroke${cur === 1 ? '' : 's'}` : `${STROKE_CAP} strokes, scored ${thisScore}`} · par {par}
            </div>
            <button className="primary" onClick={nextHole}>
              {holeIndex + 1 < holes.length ? 'Next hole →' : 'Finish course'}
            </button>
            <button onClick={retryHole}>Retry hole</button>
            {onExit && <button onClick={onExit}>{exitLabel ?? 'Back'}</button>}
          </div>
        </div>
      )}

      {courseDone && (
        <div className="overlay">
          <div className="card">
            <h2>Course complete</h2>
            <div className="sub">
              {totalScore} strokes · par {totalPar} · <strong>{relPar(totalScore - totalPar)}</strong>
            </div>
            <table>
              <tbody>
                {holes.map((h, i) => (
                  <tr key={h.id}>
                    <td>
                      {i + 1}. {h.name}
                    </td>
                    <td>
                      {results[i]} / {h.par}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="primary" onClick={restartCourse}>
              Play again
            </button>
            {onExit && <button onClick={onExit}>{exitLabel ?? 'Back'}</button>}
          </div>
        </div>
      )}

      {devOpen && (
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
        />
      )}
    </div>
  );
}
