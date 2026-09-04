import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMPASS_DIRECTIONS,
  HAZARD_RESETS,
  HAZARD_TYPES,
  SURFACE_TYPES,
  emptyHole,
  type CompassDirection,
  type HazardReset,
  type HazardType,
  type Hole,
  type Obstacle,
  type Point,
  type Polygon,
  type SurfaceType,
} from '../sim/types';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import { distSqPointSegment, pointInPolygon } from '../sim/geometry';
import { validateHole } from '../sim/validate';
import { drawHole } from '../render/drawHole';
import { fitCamera, screenToWorld, type Camera } from '../render/camera';
import { PALETTE } from '../render/palette';
import { PlayView } from '../game/PlayView';
import { useTuning } from '../game/paramsStore';
import type { SolveReport } from '../solver/solver';
import { ARCHETYPES, type Archetype } from '../generator/archetypes';
import type { Difficulty } from '../generator/decorate';
import type { GeneratedHole } from '../generator/generator';
import { randomSeed } from '../game/courses';
import { THEMES } from '../render/themes';
import { COURSE } from '../holes';
import { downloadJson, loadAutosave, saveAutosave } from './storage';

type Tool =
  | 'select'
  | 'wall'
  | 'tee'
  | 'cup'
  | 'surface'
  | 'slope'
  | 'hazard'
  | 'blockerRect'
  | 'blockerCircle'
  | 'blockerPoly'
  | 'bumper'
  | 'pipe'
  | 'windmill'
  | 'gate'
  | 'pendulum';

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select / move', key: 'V' },
  { id: 'wall', label: 'Wall', key: 'W' },
  { id: 'tee', label: 'Tee', key: 'T' },
  { id: 'cup', label: 'Cup', key: 'C' },
  { id: 'surface', label: 'Surface zone', key: 'S' },
  { id: 'slope', label: 'Slope zone', key: 'L' },
  { id: 'hazard', label: 'Hazard zone', key: 'H' },
  { id: 'blockerRect', label: 'Blocker (rect)', key: 'B' },
  { id: 'blockerCircle', label: 'Blocker (circle)', key: 'O' },
  { id: 'blockerPoly', label: 'Blocker (polygon)', key: 'K' },
  { id: 'bumper', label: 'Bumper', key: 'U' },
  { id: 'pipe', label: 'Pipe (entry → exit)', key: 'I' },
  { id: 'windmill', label: 'Windmill', key: 'M' },
  { id: 'gate', label: 'Sliding block', key: 'D' },
  { id: 'pendulum', label: 'Pendulum', key: 'N' },
];

/** Obstacle types the editor can assign to a placed shape. */
const SOLID_TYPES = ['blocker', 'deadWall', 'curb'] as const;
const CIRCLE_TYPES = ['blocker', 'bumper', 'post', 'deadWall', 'curb'] as const;

function shapeAnchor(s: Obstacle['shape']): Point {
  if (s.kind === 'polygon') return s.points[0];
  return { x: s.x, y: s.y };
}

type Selection =
  | { kind: 'wall'; index: number }
  | { kind: 'surface'; index: number }
  | { kind: 'slope'; index: number }
  | { kind: 'hazard'; index: number }
  | { kind: 'obstacle'; index: number }
  | { kind: 'tee' }
  | { kind: 'cup' };

/** Something a vertex-drag moves. */
type Handle =
  | { kind: 'wallEnd'; index: number; end: 'a' | 'b' }
  | { kind: 'zoneVertex'; zone: 'surface' | 'slope' | 'hazard'; index: number; vi: number }
  | { kind: 'tee' }
  | { kind: 'cup' }
  | { kind: 'obstacle'; index: number }
  | { kind: 'pipeExit'; index: number };

type DragOp =
  | { kind: 'handles'; handles: Handle[]; startHole: Hole }
  | { kind: 'rect'; ax: number; ay: number; cx: number; cy: number }
  | { kind: 'circle'; ax: number; ay: number; r: number; bumper: boolean }
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number };

interface ZoneDefaults {
  surfaceType: SurfaceType;
  direction: CompassDirection;
  grade: 1 | 2 | 3;
  hazardType: HazardType;
  penalty: number;
  resetTo: HazardReset;
}

const HANDLE_PX = 8;
const WALL_PICK_PX = 7;

function handlePoint(h: Hole, hd: Handle): Point {
  switch (hd.kind) {
    case 'wallEnd':
      return h.walls[hd.index][hd.end];
    case 'zoneVertex':
      return zonePolys(h, hd.zone)[hd.index][hd.vi];
    case 'tee':
      return h.tee;
    case 'cup':
      return h.cup;
    case 'obstacle':
      return shapeAnchor(h.obstacles[hd.index].shape);
    case 'pipeExit': {
      const o = h.obstacles[hd.index];
      return o.type === 'pipe' ? o.exit : { x: 0, y: 0 };
    }
  }
}

function zonePolys(h: Hole, zone: 'surface' | 'slope' | 'hazard'): Polygon[] {
  if (zone === 'surface') return h.surfaceZones.map((z) => z.polygon);
  if (zone === 'slope') return h.slopeZones.map((z) => z.polygon);
  return h.hazards.map((z) => z.polygon);
}

function allHandles(h: Hole): Handle[] {
  const out: Handle[] = [{ kind: 'tee' }, { kind: 'cup' }];
  h.walls.forEach((_, i) => {
    out.push({ kind: 'wallEnd', index: i, end: 'a' });
    out.push({ kind: 'wallEnd', index: i, end: 'b' });
  });
  (['surface', 'slope', 'hazard'] as const).forEach((zone) => {
    zonePolys(h, zone).forEach((poly, i) => poly.forEach((_, vi) => out.push({ kind: 'zoneVertex', zone, index: i, vi })));
  });
  h.obstacles.forEach((o, i) => {
    out.push({ kind: 'obstacle', index: i });
    if (o.type === 'pipe') out.push({ kind: 'pipeExit', index: i });
  });
  return out;
}

function moveHandle(h: Hole, hd: Handle, to: Point): void {
  switch (hd.kind) {
    case 'wallEnd':
      h.walls[hd.index][hd.end] = { x: to.x, y: to.y };
      break;
    case 'zoneVertex':
      zonePolys(h, hd.zone)[hd.index][hd.vi] = { x: to.x, y: to.y };
      break;
    case 'tee':
      h.tee = { x: to.x, y: to.y };
      break;
    case 'cup':
      h.cup = { x: to.x, y: to.y };
      break;
    case 'pipeExit': {
      const o = h.obstacles[hd.index];
      if (o.type === 'pipe') o.exit = { x: to.x, y: to.y };
      break;
    }
    case 'obstacle': {
      const s = h.obstacles[hd.index].shape;
      if (s.kind === 'polygon') {
        const dx = to.x - s.points[0].x;
        const dy = to.y - s.points[0].y;
        s.points = s.points.map((q) => ({ x: q.x + dx, y: q.y + dy }));
      } else {
        s.x = to.x;
        s.y = to.y;
      }
      break;
    }
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function selectionLabel(sel: Selection, h: Hole): string {
  switch (sel.kind) {
    case 'wall':
      return `Wall #${sel.index}`;
    case 'surface':
      return `Surface zone #${sel.index} (${h.surfaceZones[sel.index]?.surfaceType})`;
    case 'slope':
      return `Slope zone #${sel.index}`;
    case 'hazard':
      return `Hazard #${sel.index} (${h.hazards[sel.index]?.type})`;
    case 'obstacle':
      return `${h.obstacles[sel.index]?.type} #${sel.index}`;
    case 'tee':
      return 'Tee';
    case 'cup':
      return 'Cup';
  }
}

export function EditorView({ onExit }: { onExit: () => void }) {
  const [hole, setHoleState] = useState<Hole>(() => loadAutosave() ?? clone(COURSE[1]));
  const [tool, setTool] = useState<Tool>('select');
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(1);
  const [draft, setDraft] = useState<Point[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [testing, setTesting] = useState(false);
  const [zoneDefaults, setZoneDefaults] = useState<ZoneDefaults>({
    surfaceType: 'tile',
    direction: 'N',
    grade: 1,
    hazardType: 'drain',
    penalty: 1,
    resetTo: 'lastSafe',
  });
  const [jsonText, setJsonText] = useState('');
  const [jsonMsg, setJsonMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [status, setStatus] = useState('');
  const tuning = useTuning();

  // --- solver (runs in a worker so the UI stays responsive)
  const [solving, setSolving] = useState(false);
  const [report, setReport] = useState<SolveReport | null>(null);
  const [reportHoleJson, setReportHoleJson] = useState('');
  const workerRef = useRef<Worker | null>(null);
  const solveIdRef = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; report?: SolveReport; error?: string }>) => {
      if (e.data.id !== solveIdRef.current) return;
      setSolving(false);
      if (e.data.report) setReport(e.data.report);
      else setStatus(`solver error: ${e.data.error}`);
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);
  const runSolver = useCallback(() => {
    const w = workerRef.current;
    if (!w) return;
    const id = ++solveIdRef.current;
    setSolving(true);
    setReportHoleJson(JSON.stringify(holeRef.current));
    w.postMessage({ kind: 'solve', id, hole: holeRef.current, params: tuning.paramsRef.current });
  }, [tuning.paramsRef]);
  const reportStale = report !== null && reportHoleJson !== JSON.stringify(hole);

  // --- canvas + camera
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 800, h: 600, dpr: 1 });
  const [cam, setCam] = useState<Camera>({ scale: 10, ox: 40, oy: 40 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const dragRef = useRef<DragOp | null>(null);
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  // Movers animate in the editor so their timing can be judged.
  const [editorClock, setEditorClock] = useState(0);
  useEffect(() => {
    if (testing) return;
    if (!hole.obstacles.some((o) => o.type === 'windmill' || o.type === 'slidingGate' || o.type === 'pendulum')) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setEditorClock((performance.now() - t0) / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [testing, hole]);

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current;
    setCam(fitCamera(holeRef.current.bounds, w, h, 40));
  }, []);

  // --- undo/redo
  const undoRef = useRef<Hole[]>([]);
  const redoRef = useRef<Hole[]>([]);
  const holeRef = useRef(hole);
  holeRef.current = hole;

  const commit = useCallback((next: Hole) => {
    undoRef.current.push(clone(holeRef.current));
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    setHoleState(next);
  }, []);
  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(clone(holeRef.current));
    setHoleState(prev);
    setSelection(null);
  }, []);
  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(clone(holeRef.current));
    setHoleState(next);
    setSelection(null);
  }, []);

  // --- autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      saveAutosave(hole);
      setStatus(`autosaved ${new Date().toLocaleTimeString()}`);
    }, 300);
    return () => clearTimeout(id);
  }, [hole]);

  // --- JSON panel mirrors the hole unless the user is editing it
  const jsonDirtyRef = useRef(false);
  useEffect(() => {
    if (!jsonDirtyRef.current) setJsonText(JSON.stringify(hole, null, 2));
  }, [hole]);

  // --- generator
  const [genSeed, setGenSeed] = useState(() => randomSeed());
  const [genArche, setGenArche] = useState<Archetype | 'any'>('any');
  const [genDiff, setGenDiff] = useState<Difficulty | 'any'>('any');
  const [generating, setGenerating] = useState(false);
  const [genInfo, setGenInfo] = useState<string | null>(null);
  const genIdRef = useRef(0);
  const runGenerator = useCallback(() => {
    const w = workerRef.current;
    if (!w) return;
    const id = 1_000_000 + ++genIdRef.current;
    setGenerating(true);
    const handler = (e: MessageEvent<{ id: number; generated?: GeneratedHole; error?: string }>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', handler);
      setGenerating(false);
      if (e.data.generated) {
        const g = e.data.generated;
        commit(g.hole);
        setSelection(null);
        setDraft([]);
        setReport(g.report);
        setReportHoleJson(JSON.stringify(g.hole));
        setGenInfo(`${g.archetype} · ${g.difficulty} · par ${g.hole.par} · ${g.attempts} attempt${g.attempts === 1 ? '' : 's'}${g.fallback ? ' · FALLBACK (undecorated)' : ''}`);
        setTimeout(fit, 0);
      } else setGenInfo(`error: ${e.data.error}`);
    };
    w.addEventListener('message', handler);
    w.postMessage({
      kind: 'generate',
      id,
      options: {
        seed: genSeed,
        archetype: genArche === 'any' ? undefined : genArche,
        difficulty: genDiff === 'any' ? undefined : genDiff,
        params: tuning.paramsRef.current,
      },
    });
  }, [genSeed, genArche, genDiff, commit, fit, tuning.paramsRef]);



  useEffect(() => {
    if (testing) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      if (first) {
        first = false;
        fit();
      }
      redraw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [testing, fit, redraw]);

  const snapPt = useCallback(
    (p: Point): Point => {
      if (!snap) return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
      return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
    },
    [snap, grid],
  );

  const toWorld = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return screenToWorld(camRef.current, e.clientX - r.left, e.clientY - r.top);
  }, []);

  const pxToUnits = (px: number) => px / camRef.current.scale;

  // --- hit testing
  const pickHandle = useCallback((p: Point): Handle | null => {
    const h = holeRef.current;
    const tol = pxToUnits(HANDLE_PX);
    let best: Handle | null = null;
    let bestD = tol * tol;
    for (const hd of allHandles(h)) {
      if (hd.kind === 'obstacle') continue; // obstacles move by body, not handle
      const q = handlePoint(h, hd);
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = hd;
      }
    }
    return best;
  }, []);

  const pickSelection = useCallback((p: Point): Selection | null => {
    const h = holeRef.current;
    const tol = pxToUnits(WALL_PICK_PX);
    const r = DEFAULT_PARAMS.ballRadius;
    if ((p.x - h.tee.x) ** 2 + (p.y - h.tee.y) ** 2 <= (r * 1.6) ** 2) return { kind: 'tee' };
    if ((p.x - h.cup.x) ** 2 + (p.y - h.cup.y) ** 2 <= cupRadius(DEFAULT_PARAMS) ** 2) return { kind: 'cup' };
    for (let i = h.walls.length - 1; i >= 0; i--) {
      const w = h.walls[i];
      if (distSqPointSegment(p.x, p.y, w.a.x, w.a.y, w.b.x, w.b.y) <= tol * tol) return { kind: 'wall', index: i };
    }
    for (let i = h.obstacles.length - 1; i >= 0; i--) {
      const s = h.obstacles[i].shape;
      const hit =
        s.kind === 'rect'
          ? p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h
          : s.kind === 'circle'
            ? (p.x - s.x) ** 2 + (p.y - s.y) ** 2 <= s.r * s.r
            : pointInPolygon(p.x, p.y, s.points);
      if (hit) return { kind: 'obstacle', index: i };
    }
    for (let i = h.hazards.length - 1; i >= 0; i--) if (pointInPolygon(p.x, p.y, h.hazards[i].polygon)) return { kind: 'hazard', index: i };
    for (let i = h.slopeZones.length - 1; i >= 0; i--)
      if (pointInPolygon(p.x, p.y, h.slopeZones[i].polygon)) return { kind: 'slope', index: i };
    for (let i = h.surfaceZones.length - 1; i >= 0; i--)
      if (pointInPolygon(p.x, p.y, h.surfaceZones[i].polygon)) return { kind: 'surface', index: i };
    return null;
  }, []);

  // --- draft finishing
  const finishDraft = useCallback(
    (close: boolean) => {
      const pts = draft;
      const h = clone(holeRef.current);
      if (tool === 'wall') {
        if (pts.length < 2) {
          setDraft([]);
          return;
        }
        for (let i = 0; i + 1 < pts.length; i++) h.walls.push({ a: pts[i], b: pts[i + 1] });
        if (close && pts.length >= 3) h.walls.push({ a: pts[pts.length - 1], b: pts[0] });
        commit(h);
      } else if (tool === 'blockerPoly') {
        if (pts.length < 3) {
          setDraft([]);
          return;
        }
        h.obstacles.push({ type: 'blocker', shape: { kind: 'polygon', points: pts } });
        commit(h);
        setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
      } else if (tool === 'surface' || tool === 'slope' || tool === 'hazard') {
        if (pts.length < 3) {
          setDraft([]);
          return;
        }
        if (tool === 'surface') h.surfaceZones.push({ polygon: pts, surfaceType: zoneDefaults.surfaceType });
        else if (tool === 'slope')
          h.slopeZones.push({ polygon: pts, direction: zoneDefaults.direction, grade: zoneDefaults.grade });
        else
          h.hazards.push({
            polygon: pts,
            type: zoneDefaults.hazardType,
            penalty: zoneDefaults.penalty,
            resetTo: zoneDefaults.resetTo,
          });
        commit(h);
      }
      setDraft([]);
    },
    [draft, tool, zoneDefaults, commit],
  );

  const deleteSelection = useCallback(() => {
    const sel = selection;
    if (!sel) return;
    const h = clone(holeRef.current);
    switch (sel.kind) {
      case 'wall':
        h.walls.splice(sel.index, 1);
        break;
      case 'surface':
        h.surfaceZones.splice(sel.index, 1);
        break;
      case 'slope':
        h.slopeZones.splice(sel.index, 1);
        break;
      case 'hazard':
        h.hazards.splice(sel.index, 1);
        break;
      case 'obstacle':
        h.obstacles.splice(sel.index, 1);
        break;
      default:
        return; // tee/cup can't be deleted
    }
    commit(h);
    setSelection(null);
  }, [selection, commit]);

  // --- keyboard
  useEffect(() => {
    if (testing) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Escape') {
        setDraft([]);
        setSelection(null);
        dragRef.current = null;
        return;
      }
      if (e.key === 'Enter') {
        if (draft.length) finishDraft(tool !== 'wall');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (draft.length) setDraft((d) => d.slice(0, -1));
        else deleteSelection();
        return;
      }
      if (k === 'g') setSnap((s) => !s);
      else if (k === 'p') setTesting(true);
      else if (k === 'f') fit();
      else {
        const t = TOOLS.find((tt) => tt.key.toLowerCase() === k);
        if (t) {
          setTool(t.id);
          setDraft([]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [testing, draft, tool, finishDraft, deleteSelection, undo, redo, fit]);

  // --- pointer handling
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const raw = toWorld(e);
    const p = snapPt(raw);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: camRef.current.ox, oy: camRef.current.oy };
      return;
    }
    if (e.button === 2) {
      if (draft.length) finishDraft(tool !== 'wall');
      return;
    }
    if (e.button !== 0) return;

    switch (tool) {
      case 'select': {
        const hd = pickHandle(raw);
        if (hd) {
          // Drag every handle sitting on the same coordinate (shared vertices move together).
          const h = holeRef.current;
          const q = handlePoint(h, hd);
          const group = allHandles(h).filter((o) => {
            if (o.kind === 'obstacle') return false;
            const r = handlePoint(h, o);
            return Math.abs(r.x - q.x) < 1e-6 && Math.abs(r.y - q.y) < 1e-6;
          });
          dragRef.current = { kind: 'handles', handles: group, startHole: clone(h) };
          if (hd.kind === 'tee') setSelection({ kind: 'tee' });
          else if (hd.kind === 'cup') setSelection({ kind: 'cup' });
          else if (hd.kind === 'wallEnd') setSelection({ kind: 'wall', index: hd.index });
          else if (hd.kind === 'zoneVertex') setSelection({ kind: hd.zone, index: hd.index });
          else if (hd.kind === 'pipeExit') setSelection({ kind: 'obstacle', index: hd.index });
          return;
        }
        const sel = pickSelection(raw);
        setSelection(sel);
        if (sel && sel.kind === 'obstacle') {
          dragRef.current = {
            kind: 'handles',
            handles: [{ kind: 'obstacle', index: sel.index }],
            startHole: clone(holeRef.current),
          };
          // store the grab offset in the draft-free way: remember the raw grab point via closure below
          grabOffsetRef.current = (() => {
            const a = shapeAnchor(holeRef.current.obstacles[sel.index].shape);
            return { x: raw.x - a.x, y: raw.y - a.y };
          })();
        } else grabOffsetRef.current = null;
        return;
      }
      case 'wall':
      case 'surface':
      case 'slope':
      case 'hazard':
      case 'blockerPoly': {
        if (draft.length >= 2) {
          const f = draft[0];
          const tol = pxToUnits(HANDLE_PX);
          if ((f.x - raw.x) ** 2 + (f.y - raw.y) ** 2 <= tol * tol) {
            finishDraft(true);
            return;
          }
        }
        const last = draft[draft.length - 1];
        if (last && last.x === p.x && last.y === p.y) return;
        setDraft((d) => [...d, p]);
        return;
      }
      case 'tee': {
        const h = clone(holeRef.current);
        h.tee = p;
        commit(h);
        return;
      }
      case 'cup': {
        const h = clone(holeRef.current);
        h.cup = p;
        commit(h);
        return;
      }
      case 'blockerRect':
        dragRef.current = { kind: 'rect', ax: p.x, ay: p.y, cx: p.x, cy: p.y };
        return;
      case 'blockerCircle':
      case 'bumper':
        dragRef.current = { kind: 'circle', ax: p.x, ay: p.y, r: 0, bumper: tool === 'bumper' };
        return;
      case 'windmill': {
        const h = clone(holeRef.current);
        h.obstacles.push({ type: 'windmill', shape: { kind: 'circle', x: p.x, y: p.y, r: 3 }, blades: 3, period: 4, phase: 0, direction: 1 });
        commit(h);
        setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
        return;
      }
      case 'pendulum': {
        const h = clone(holeRef.current);
        h.obstacles.push({ type: 'pendulum', shape: { kind: 'circle', x: p.x, y: p.y, r: 4 }, arc: 0.9, period: 3, phase: 0 });
        commit(h);
        setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
        return;
      }
      case 'gate':
        dragRef.current = { kind: 'rect', ax: p.x, ay: p.y, cx: p.x, cy: p.y };
        return;
      case 'pipe': {
        if (draft.length === 0) {
          setDraft([p]);
          return;
        }
        const entry = draft[0];
        const h = clone(holeRef.current);
        h.obstacles.push({
          type: 'pipe',
          shape: { kind: 'circle', x: entry.x, y: entry.y, r: 1.1 },
          exit: p,
          mode: 'redirect',
          exitAngle: Math.round(Math.atan2(h.cup.y - p.y, h.cup.x - p.x) * 100) / 100,
        });
        commit(h);
        setDraft([]);
        setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
        return;
      }
    }
  };
  const grabOffsetRef = useRef<Point | null>(null);

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const raw = toWorld(e);
    const p = snapPt(raw);
    setCursor(p);
    const d = dragRef.current;
    if (!d) {
      redraw();
      return;
    }
    switch (d.kind) {
      case 'pan':
        setCam({ ...camRef.current, ox: d.ox + (e.clientX - d.sx), oy: d.oy + (e.clientY - d.sy) });
        break;
      case 'handles': {
        const h = clone(d.startHole);
        const off = grabOffsetRef.current;
        const to = off ? snapPt({ x: raw.x - off.x, y: raw.y - off.y }) : p;
        for (const hd of d.handles) moveHandle(h, hd, to);
        setHoleState(h); // live preview; committed on pointer up
        break;
      }
      case 'rect':
        d.cx = p.x;
        d.cy = p.y;
        redraw();
        break;
      case 'circle':
        d.r = Math.sqrt((p.x - d.ax) ** 2 + (p.y - d.ay) ** 2);
        redraw();
        break;
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    switch (d.kind) {
      case 'handles': {
        // The live preview already put the moved hole in state; register the undo entry against the start.
        const moved = holeRef.current;
        if (JSON.stringify(moved) !== JSON.stringify(d.startHole)) {
          undoRef.current.push(clone(d.startHole));
          redoRef.current = [];
        }
        break;
      }
      case 'rect': {
        const x = Math.min(d.ax, d.cx);
        const y = Math.min(d.ay, d.cy);
        const w = Math.abs(d.cx - d.ax);
        const hh = Math.abs(d.cy - d.ay);
        if (w > 0 && hh > 0) {
          const h = clone(holeRef.current);
          if (tool === 'gate')
            h.obstacles.push({ type: 'slidingGate', shape: { kind: 'rect', x, y, w, h: hh }, axis: w >= hh ? 'x' : 'y', amplitude: 3, period: 3, phase: 0, look: 'gate' });
          else h.obstacles.push({ type: 'blocker', shape: { kind: 'rect', x, y, w, h: hh } });
          commit(h);
          setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
        }
        break;
      }
      case 'circle': {
        const r = Math.max(d.r, d.bumper ? 0.8 : 0.5);
        const h = clone(holeRef.current);
        const ob: Obstacle = d.bumper
          ? { type: 'bumper', shape: { kind: 'circle', x: d.ax, y: d.ay, r } }
          : { type: 'blocker', shape: { kind: 'circle', x: d.ax, y: d.ay, r } };
        h.obstacles.push(ob);
        commit(h);
        setSelection({ kind: 'obstacle', index: h.obstacles.length - 1 });
        break;
      }
      default:
        break;
    }
    redraw();
  };

  const onDoubleClick = () => {
    if (draft.length) finishDraft(tool !== 'wall');
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const c = camRef.current;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const scale = Math.min(80, Math.max(2, c.scale * factor));
    const wx = (sx - c.ox) / c.scale;
    const wy = (sy - c.oy) / c.scale;
    setCam({ scale, ox: sx - wx * scale, oy: sy - wy * scale });
  };

  // --- drawing
  useEffect(() => {
    if (testing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { dpr, w, h } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = cam.scale;
    const d = dragRef.current;

    drawHole(ctx, hole, cam, {
      ballRadius: DEFAULT_PARAMS.ballRadius,
      cupRadius: cupRadius(DEFAULT_PARAMS),
      ball: { x: hole.tee.x, y: hole.tee.y },
      zoneLabels: true,
      dpr,
      clock: editorClock,
      overlay: (c) => {
        // grid
        const b = hole.bounds;
        const x0 = b.x;
        const y0 = b.y;
        const x1 = b.x + b.w;
        const y1 = b.y + b.h;
        c.lineWidth = 1;
        if (S * grid >= 4) {
          for (let x = x0; x <= x1 + 1e-9; x += grid) {
            const major = Math.abs(x / (grid * 5) - Math.round(x / (grid * 5))) < 1e-9;
            c.strokeStyle = major ? PALETTE.gridMajor : PALETTE.grid;
            c.beginPath();
            c.moveTo(x * S + cam.ox, y0 * S + cam.oy);
            c.lineTo(x * S + cam.ox, y1 * S + cam.oy);
            c.stroke();
          }
          for (let y = y0; y <= y1 + 1e-9; y += grid) {
            const major = Math.abs(y / (grid * 5) - Math.round(y / (grid * 5))) < 1e-9;
            c.strokeStyle = major ? PALETTE.gridMajor : PALETTE.grid;
            c.beginPath();
            c.moveTo(x0 * S + cam.ox, y * S + cam.oy);
            c.lineTo(x1 * S + cam.ox, y * S + cam.oy);
            c.stroke();
          }
        }
        // bounds outline
        c.strokeStyle = PALETTE.textDim;
        c.setLineDash([6, 4]);
        c.strokeRect(x0 * S + cam.ox, y0 * S + cam.oy, b.w * S, b.h * S);
        c.setLineDash([]);

        // selection highlight
        if (selection) {
          c.strokeStyle = PALETTE.select;
          c.lineWidth = 3;
          if (selection.kind === 'wall' && hole.walls[selection.index]) {
            const wl = hole.walls[selection.index];
            c.beginPath();
            c.moveTo(wl.a.x * S + cam.ox, wl.a.y * S + cam.oy);
            c.lineTo(wl.b.x * S + cam.ox, wl.b.y * S + cam.oy);
            c.stroke();
          } else if (selection.kind === 'obstacle' && hole.obstacles[selection.index]) {
            const s = hole.obstacles[selection.index].shape;
            if (s.kind === 'rect') c.strokeRect(s.x * S + cam.ox - 2, s.y * S + cam.oy - 2, s.w * S + 4, s.h * S + 4);
            else if (s.kind === 'circle') {
              c.beginPath();
              c.arc(s.x * S + cam.ox, s.y * S + cam.oy, s.r * S + 2, 0, Math.PI * 2);
              c.stroke();
            } else {
              c.beginPath();
              s.points.forEach((q, i) => (i ? c.lineTo(q.x * S + cam.ox, q.y * S + cam.oy) : c.moveTo(q.x * S + cam.ox, q.y * S + cam.oy)));
              c.closePath();
              c.stroke();
            }
          } else if (selection.kind === 'tee' || selection.kind === 'cup') {
            const q = selection.kind === 'tee' ? hole.tee : hole.cup;
            c.beginPath();
            c.arc(q.x * S + cam.ox, q.y * S + cam.oy, S * 1.2, 0, Math.PI * 2);
            c.stroke();
          } else if (selection.kind === 'surface' || selection.kind === 'slope' || selection.kind === 'hazard') {
            const poly = zonePolys(hole, selection.kind)[selection.index];
            if (poly) {
              c.beginPath();
              poly.forEach((q, i) => (i ? c.lineTo(q.x * S + cam.ox, q.y * S + cam.oy) : c.moveTo(q.x * S + cam.ox, q.y * S + cam.oy)));
              c.closePath();
              c.stroke();
            }
          }
        }

        // solver's best run (numbered rest positions)
        if (report && report.bestRun && !reportStale) {
          const pts = [{ x: hole.tee.x, y: hole.tee.y }, ...report.bestRun.positions];
          c.save();
          c.strokeStyle = PALETTE.good;
          c.lineWidth = 2;
          c.setLineDash([6, 4]);
          c.beginPath();
          pts.forEach((q, i) => (i ? c.lineTo(q.x * S + cam.ox, q.y * S + cam.oy) : c.moveTo(q.x * S + cam.ox, q.y * S + cam.oy)));
          c.stroke();
          c.setLineDash([]);
          c.font = '11px system-ui, sans-serif';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          report.bestRun.positions.forEach((q, i) => {
            c.fillStyle = PALETTE.good;
            c.beginPath();
            c.arc(q.x * S + cam.ox, q.y * S + cam.oy, 8, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#111';
            c.fillText(String(i + 1), q.x * S + cam.ox, q.y * S + cam.oy);
          });
          c.restore();
        }

        // vertex handles (select tool)
        if (tool === 'select') {
          c.fillStyle = 'rgba(255,255,255,0.85)';
          for (const hd of allHandles(hole)) {
            if (hd.kind === 'obstacle' || hd.kind === 'tee' || hd.kind === 'cup') continue;
            const q = handlePoint(hole, hd);
            c.fillRect(q.x * S + cam.ox - 3, q.y * S + cam.oy - 3, 6, 6);
          }
        }

        // draft polyline
        if (draft.length) {
          c.strokeStyle = PALETTE.draft;
          c.fillStyle = PALETTE.draft;
          c.lineWidth = 2;
          c.beginPath();
          draft.forEach((q, i) => (i ? c.lineTo(q.x * S + cam.ox, q.y * S + cam.oy) : c.moveTo(q.x * S + cam.ox, q.y * S + cam.oy)));
          if (cursor) c.lineTo(cursor.x * S + cam.ox, cursor.y * S + cam.oy);
          c.stroke();
          for (const q of draft) {
            c.beginPath();
            c.arc(q.x * S + cam.ox, q.y * S + cam.oy, 4, 0, Math.PI * 2);
            c.fill();
          }
          // first point ring = click to close
          const f = draft[0];
          c.beginPath();
          c.arc(f.x * S + cam.ox, f.y * S + cam.oy, HANDLE_PX, 0, Math.PI * 2);
          c.stroke();
        }

        // rect / circle previews
        if (d && d.kind === 'rect') {
          c.strokeStyle = PALETTE.draft;
          c.lineWidth = 2;
          c.strokeRect(
            Math.min(d.ax, d.cx) * S + cam.ox,
            Math.min(d.ay, d.cy) * S + cam.oy,
            Math.abs(d.cx - d.ax) * S,
            Math.abs(d.cy - d.ay) * S,
          );
        }
        if (d && d.kind === 'circle') {
          c.strokeStyle = d.bumper ? PALETTE.bumper : PALETTE.draft;
          c.lineWidth = 2;
          c.beginPath();
          c.arc(d.ax * S + cam.ox, d.ay * S + cam.oy, Math.max(d.r, 0.5) * S, 0, Math.PI * 2);
          c.stroke();
        }

        // cursor snap marker
        if (cursor && tool !== 'select') {
          c.strokeStyle = 'rgba(255,255,255,0.6)';
          c.lineWidth = 1;
          const cx = cursor.x * S + cam.ox;
          const cy = cursor.y * S + cam.oy;
          c.beginPath();
          c.moveTo(cx - 6, cy);
          c.lineTo(cx + 6, cy);
          c.moveTo(cx, cy - 6);
          c.lineTo(cx, cy + 6);
          c.stroke();
        }
        void w;
        void h;
      },
    });
  });

  // --- JSON panel actions
  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const v = validateHole(parsed);
      if (!v.ok || !v.hole) {
        setJsonMsg({ ok: false, text: v.errors.join('\n') });
        return;
      }
      jsonDirtyRef.current = false;
      commit(v.hole);
      setSelection(null);
      setJsonMsg({ ok: true, text: 'Imported.' });
    } catch (err) {
      setJsonMsg({ ok: false, text: `Invalid JSON: ${(err as Error).message}` });
    }
  };
  const importFile = (file: File) => {
    file.text().then((t) => {
      jsonDirtyRef.current = true;
      setJsonText(t);
      try {
        const v = validateHole(JSON.parse(t));
        if (v.ok && v.hole) {
          jsonDirtyRef.current = false;
          commit(v.hole);
          setSelection(null);
          setJsonMsg({ ok: true, text: `Imported ${file.name}.` });
        } else setJsonMsg({ ok: false, text: v.errors.join('\n') });
      } catch (err) {
        setJsonMsg({ ok: false, text: `Invalid JSON: ${(err as Error).message}` });
      }
    });
  };
  const loadBuiltin = (h: Hole) => {
    if (!window.confirm(`Replace the current hole with "${h.name}"?`)) return;
    commit(clone(h));
    setSelection(null);
    setDraft([]);
    setTimeout(fit, 0);
  };
  const newHole = () => {
    if (!window.confirm('Start a new empty hole? The current one is in the undo stack until you refresh.')) return;
    commit(emptyHole(`hole-${Date.now().toString(36)}`));
    setSelection(null);
    setDraft([]);
    setTimeout(fit, 0);
  };

  const validation = useMemo(() => validateHole(hole), [hole]);

  const updateHole = (fn: (h: Hole) => void) => {
    const h = clone(holeRef.current);
    fn(h);
    commit(h);
  };

  if (testing) {
    return (
      <PlayView
        holes={[hole]}
        onExit={() => setTesting(false)}
        exitLabel="Back to editor"
      />
    );
  }

  const draftHelp =
    draft.length > 0
      ? tool === 'pipe'
        ? 'Pipe: click where the ball comes out · Esc cancels'
        : tool === 'wall'
        ? `Wall: ${draft.length} pt · click first point or Enter/dbl-click to finish · Backspace removes last · Esc cancels`
        : `${tool === 'blockerPoly' ? 'Blocker' : 'Zone'}: ${draft.length} pt · click first point or Enter/dbl-click to close · Esc cancels`
      : null;

  return (
    <div className="editor">
      <div className="topbar">
        <span className="title">Putt Putt Potty — editor</span>
        <button className="primary" onClick={() => setTesting(true)} disabled={!validation.ok}>
          ▶ Test play <kbd style={{ marginLeft: 6, opacity: 0.7 }}>P</kbd>
        </button>
        <button onClick={runSolver} disabled={!validation.ok || solving} title="Estimate par and check the hole is playable">
          {solving ? 'Solving…' : '⌕ Solve'}
        </button>
        <button onClick={undo} title="Ctrl+Z">
          ↶ Undo
        </button>
        <button onClick={redo} title="Ctrl+Shift+Z">
          ↷ Redo
        </button>
        <button onClick={fit} title="F">
          Fit
        </button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap <kbd style={{ opacity: 0.6 }}>G</kbd>
        </label>
        <select value={grid} onChange={(e) => setGrid(parseFloat(e.target.value))} style={{ padding: '4px 6px' }}>
          <option value={0.25}>grid 0.25</option>
          <option value={0.5}>grid 0.5</option>
          <option value={1}>grid 1</option>
          <option value={2}>grid 2</option>
        </select>
        <span className="spacer" />
        <span className="status">{status}</span>
        <button onClick={onExit}>Play the course →</button>
      </div>

      <div className="tools">
        <h4>Tools</h4>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'active' : ''}
            onClick={() => {
              setTool(t.id);
              setDraft([]);
            }}
          >
            {t.label}
            <kbd>{t.key}</kbd>
          </button>
        ))}
        <h4>Built-in holes</h4>
        {COURSE.map((h) => (
          <button key={h.id} onClick={() => loadBuiltin(h)}>
            {h.name}
          </button>
        ))}
        <button onClick={newHole}>New empty hole</button>
        <h4>Help</h4>
        <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
          Wheel = zoom · Alt-drag / middle-drag = pan · Select tool drags vertices, tee, cup and obstacles · Delete removes
          the selection.
        </div>
      </div>

      <div className="canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={tool === 'select' ? 'select' : ''}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setCursor(null)}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
        {draftHelp && <div className="draft-help">{draftHelp}</div>}
        <div className="coords">{cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)}` : ''}</div>
      </div>

      <div className="props">
        <h4>Hole</h4>
        <div className="field">
          <label>id</label>
          <input value={hole.id} onChange={(e) => updateHole((h) => (h.id = e.target.value))} />
        </div>
        <div className="field">
          <label>name</label>
          <input value={hole.name} onChange={(e) => updateHole((h) => (h.name = e.target.value))} />
        </div>
        <div className="field">
          <label>environment</label>
          <select value={hole.theme ?? ''} onChange={(e) => updateHole((h) => (e.target.value ? (h.theme = e.target.value) : delete h.theme))}>
            <option value="">(default)</option>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>par</label>
          <input
            type="number"
            min={1}
            max={9}
            value={hole.par}
            onChange={(e) => updateHole((h) => (h.par = parseInt(e.target.value, 10) || 1))}
          />
        </div>
        <div className="field">
          <label>bounds w × h</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              min={5}
              value={hole.bounds.w}
              onChange={(e) => updateHole((h) => (h.bounds.w = parseFloat(e.target.value) || 5))}
            />
            <input
              type="number"
              min={5}
              value={hole.bounds.h}
              onChange={(e) => updateHole((h) => (h.bounds.h = parseFloat(e.target.value) || 5))}
            />
          </div>
        </div>

        {tool === 'pipe' && (
          <>
            <h4>Pipe</h4>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>Click the entry, then click where the ball comes out. Exit angle defaults to "toward the cup".</div>
          </>
        )}
        {(tool === 'surface' || tool === 'slope' || tool === 'hazard' || tool === 'bumper' || tool === 'blockerRect' || tool === 'blockerCircle' || tool === 'blockerPoly' || tool === 'windmill' || tool === 'gate' || tool === 'pendulum') && (
          <>
            <h4>New {tool === 'blockerRect' || tool === 'blockerCircle' || tool === 'blockerPoly' ? 'blocker' : tool === 'gate' ? 'sliding block' : tool} defaults</h4>
            {tool === 'surface' && (
              <div className="field">
                <label>surface</label>
                <select
                  value={zoneDefaults.surfaceType}
                  onChange={(e) => setZoneDefaults({ ...zoneDefaults, surfaceType: e.target.value as SurfaceType })}
                >
                  {SURFACE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {tool === 'slope' && (
              <>
                <div className="field">
                  <label>direction</label>
                  <select
                    value={zoneDefaults.direction}
                    onChange={(e) => setZoneDefaults({ ...zoneDefaults, direction: e.target.value as CompassDirection })}
                  >
                    {COMPASS_DIRECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>grade</label>
                  <select
                    value={zoneDefaults.grade}
                    onChange={(e) => setZoneDefaults({ ...zoneDefaults, grade: parseInt(e.target.value, 10) as 1 | 2 | 3 })}
                  >
                    <option value={1}>1 subtle</option>
                    <option value={2}>2 noticeable</option>
                    <option value={3}>3 severe</option>
                  </select>
                </div>
              </>
            )}
            {tool === 'hazard' && (
              <>
                <div className="field">
                  <label>type</label>
                  <select
                    value={zoneDefaults.hazardType}
                    onChange={(e) => setZoneDefaults({ ...zoneDefaults, hazardType: e.target.value as HazardType })}
                  >
                    {HAZARD_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>penalty</label>
                  <input
                    type="number"
                    min={0}
                    value={zoneDefaults.penalty}
                    onChange={(e) => setZoneDefaults({ ...zoneDefaults, penalty: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
                <div className="field">
                  <label>reset to</label>
                  <select
                    value={zoneDefaults.resetTo}
                    onChange={(e) => setZoneDefaults({ ...zoneDefaults, resetTo: e.target.value as HazardReset })}
                  >
                    {HAZARD_RESETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {(tool === 'windmill' || tool === 'gate' || tool === 'pendulum') && (
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                {tool === 'gate' ? 'Drag the block at its centre position; set axis and amplitude after.' : 'Click to place; period, phase and size are editable after.'}
              </div>
            )}
            {(tool === 'blockerRect' || tool === 'blockerCircle' || tool === 'bumper' || tool === 'blockerPoly') && (
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                {tool === 'blockerPoly' ? 'Click points to outline it.' : 'Drag on the canvas to size it.'} Type (blocker / dead
                wall / curb / post) and restitution are editable after placing (select it).
              </div>
            )}
          </>
        )}

        <h4>Generate</h4>
        <div className="field">
          <label>seed</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={genSeed} onChange={(e) => setGenSeed(e.target.value)} />
            <button style={{ padding: '4px 8px' }} onClick={() => setGenSeed(randomSeed())} title="new seed">
              ⟳
            </button>
          </div>
        </div>
        <div className="field">
          <label>archetype</label>
          <select value={genArche} onChange={(e) => setGenArche(e.target.value as Archetype | 'any')}>
            <option value="any">any</option>
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>difficulty</label>
          <select value={genDiff} onChange={(e) => setGenDiff(e.target.value as Difficulty | 'any')}>
            <option value="any">any</option>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </div>
        <div className="btnrow">
          <button className="primary" onClick={runGenerator} disabled={generating || !genSeed.trim()}>
            {generating ? 'Generating…' : '✦ Generate hole'}
          </button>
        </div>
        {genInfo && <div className="ok" style={{ color: genInfo.startsWith('error') ? 'var(--danger)' : 'var(--good)' }}>{genInfo}</div>}
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
          Replaces the current hole (undo to get it back). Same seed + settings = same hole.
        </div>

        <h4>Selection</h4>
        {!selection && <div style={{ color: 'var(--dim)', fontSize: 12 }}>Nothing selected. Use the Select tool.</div>}
        {selection && (
          <div className="sel">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectionLabel(selection, hole)}</div>
            {selection.kind === 'wall' && hole.walls[selection.index] && (
              <div className="field">
                <label>restitution</label>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  placeholder="global"
                  value={hole.walls[selection.index].restitution ?? ''}
                  onChange={(e) =>
                    updateHole((h) => {
                      const v = e.target.value;
                      if (v === '') delete h.walls[selection.index].restitution;
                      else h.walls[selection.index].restitution = parseFloat(v);
                    })
                  }
                />
              </div>
            )}
            {selection.kind === 'surface' && hole.surfaceZones[selection.index] && (
              <div className="field">
                <label>surface</label>
                <select
                  value={hole.surfaceZones[selection.index].surfaceType}
                  onChange={(e) => updateHole((h) => (h.surfaceZones[selection.index].surfaceType = e.target.value as SurfaceType))}
                >
                  {SURFACE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selection.kind === 'slope' && hole.slopeZones[selection.index] && (
              <>
                <div className="field">
                  <label>direction</label>
                  <select
                    value={hole.slopeZones[selection.index].direction}
                    onChange={(e) =>
                      updateHole((h) => (h.slopeZones[selection.index].direction = e.target.value as CompassDirection))
                    }
                  >
                    {COMPASS_DIRECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>grade</label>
                  <select
                    value={hole.slopeZones[selection.index].grade}
                    onChange={(e) =>
                      updateHole((h) => (h.slopeZones[selection.index].grade = parseInt(e.target.value, 10) as 1 | 2 | 3))
                    }
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </>
            )}
            {selection.kind === 'hazard' && hole.hazards[selection.index] && (
              <>
                <div className="field">
                  <label>type</label>
                  <select
                    value={hole.hazards[selection.index].type}
                    onChange={(e) => updateHole((h) => (h.hazards[selection.index].type = e.target.value as HazardType))}
                  >
                    {HAZARD_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>penalty</label>
                  <input
                    type="number"
                    min={0}
                    value={hole.hazards[selection.index].penalty}
                    onChange={(e) => updateHole((h) => (h.hazards[selection.index].penalty = parseInt(e.target.value, 10) || 0))}
                  />
                </div>
                <div className="field">
                  <label>reset to</label>
                  <select
                    value={hole.hazards[selection.index].resetTo}
                    onChange={(e) => updateHole((h) => (h.hazards[selection.index].resetTo = e.target.value as HazardReset))}
                  >
                    {HAZARD_RESETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {selection.kind === 'obstacle' && hole.obstacles[selection.index] && (
              <>
                {!['pipe', 'windmill', 'slidingGate', 'pendulum'].includes(hole.obstacles[selection.index].type) && (
                <div className="field">
                  <label>type</label>
                  <select
                    value={hole.obstacles[selection.index].type}
                    onChange={(e) =>
                      updateHole((h) => {
                        const o = h.obstacles[selection.index] as { type: string };
                        o.type = e.target.value;
                      })
                    }
                  >
                    {(hole.obstacles[selection.index].shape.kind === 'circle' ? CIRCLE_TYPES : SOLID_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                )}
                {hole.obstacles[selection.index].shape.kind === 'circle' && (
                  <div className="field">
                    <label>radius</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.2}
                      value={(hole.obstacles[selection.index].shape as { r: number }).r}
                      onChange={(e) =>
                        updateHole((h) => {
                          const s = h.obstacles[selection.index].shape;
                          if (s.kind === 'circle') s.r = parseFloat(e.target.value) || 0.5;
                        })
                      }
                    />
                  </div>
                )}
                {hole.obstacles[selection.index].shape.kind === 'rect' && (
                  <div className="field">
                    <label>w × h</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="number"
                        step={0.5}
                        value={(hole.obstacles[selection.index].shape as { w: number }).w}
                        onChange={(e) =>
                          updateHole((h) => {
                            const s = h.obstacles[selection.index].shape;
                            if (s.kind === 'rect') s.w = parseFloat(e.target.value) || 1;
                          })
                        }
                      />
                      <input
                        type="number"
                        step={0.5}
                        value={(hole.obstacles[selection.index].shape as { h: number }).h}
                        onChange={(e) =>
                          updateHole((h) => {
                            const s = h.obstacles[selection.index].shape;
                            if (s.kind === 'rect') s.h = parseFloat(e.target.value) || 1;
                          })
                        }
                      />
                    </div>
                  </div>
                )}
                {(hole.obstacles[selection.index].type === 'windmill' || hole.obstacles[selection.index].type === 'slidingGate' || hole.obstacles[selection.index].type === 'pendulum') && (
                  <>
                    {(['period', 'phase'] as const).map((k) => (
                      <div className="field" key={k}>
                        <label>{k}{k === 'phase' ? ' (rad)' : ' (s)'}</label>
                        <input
                          type="number"
                          step={k === 'phase' ? 0.1 : 0.25}
                          min={k === 'period' ? 0.25 : undefined}
                          value={(hole.obstacles[selection.index] as unknown as Record<string, number>)[k]}
                          onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as unknown as Record<string, number>)[k] = parseFloat(e.target.value) || 0))}
                        />
                      </div>
                    ))}
                    {hole.obstacles[selection.index].type === 'windmill' && (
                      <>
                        <div className="field">
                          <label>blades</label>
                          <input type="number" min={1} max={8} value={(hole.obstacles[selection.index] as { blades: number }).blades} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { blades: number }).blades = Math.max(1, parseInt(e.target.value, 10) || 1)))} />
                        </div>
                        <div className="field">
                          <label>direction</label>
                          <select value={(hole.obstacles[selection.index] as { direction: number }).direction} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { direction: 1 | -1 }).direction = (parseInt(e.target.value, 10) as 1 | -1)))}>
                            <option value={1}>clockwise</option>
                            <option value={-1}>counter-clockwise</option>
                          </select>
                        </div>
                      </>
                    )}
                    {hole.obstacles[selection.index].type === 'slidingGate' && (
                      <>
                        <div className="field">
                          <label>axis</label>
                          <select value={(hole.obstacles[selection.index] as { axis: string }).axis} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { axis: 'x' | 'y' }).axis = e.target.value as 'x' | 'y'))}>
                            <option value="x">x (left–right)</option>
                            <option value="y">y (up–down)</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>amplitude</label>
                          <input type="number" step={0.5} min={0} value={(hole.obstacles[selection.index] as { amplitude: number }).amplitude} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { amplitude: number }).amplitude = parseFloat(e.target.value) || 0))} />
                        </div>
                        <div className="field">
                          <label>look</label>
                          <select value={(hole.obstacles[selection.index] as { look?: string }).look ?? 'gate'} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { look?: string }).look = e.target.value))}>
                            <option value="gate">gate</option>
                            <option value="piston">piston</option>
                            <option value="luggage">luggage (steady)</option>
                          </select>
                        </div>
                      </>
                    )}
                    {hole.obstacles[selection.index].type === 'pendulum' && (
                      <div className="field">
                        <label>arc (rad)</label>
                        <input type="number" step={0.1} min={0} value={(hole.obstacles[selection.index] as { arc: number }).arc} onChange={(e) => updateHole((h) => ((h.obstacles[selection.index] as { arc: number }).arc = parseFloat(e.target.value) || 0))} />
                      </div>
                    )}
                  </>
                )}
                {hole.obstacles[selection.index].type === 'pipe' && (
                  <>
                    <div className="field">
                      <label>mode</label>
                      <select
                        value={(hole.obstacles[selection.index] as { mode: string }).mode}
                        onChange={(e) =>
                          updateHole((h) => {
                            const o = h.obstacles[selection.index];
                            if (o.type === 'pipe') o.mode = e.target.value as 'keep' | 'redirect';
                          })
                        }
                      >
                        <option value="redirect">redirect (aim along exit angle)</option>
                        <option value="keep">keep velocity</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>exit angle (°)</label>
                      <input
                        type="number"
                        step={5}
                        value={Math.round((((hole.obstacles[selection.index] as { exitAngle?: number }).exitAngle ?? 0) * 180) / Math.PI)}
                        onChange={(e) =>
                          updateHole((h) => {
                            const o = h.obstacles[selection.index];
                            if (o.type === 'pipe') o.exitAngle = ((parseFloat(e.target.value) || 0) * Math.PI) / 180;
                          })
                        }
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dim)' }}>Drag the exit ring with the Select tool to move it.</div>
                  </>
                )}
                {hole.obstacles[selection.index].type === 'curb' && (
                  <div className="field">
                    <label>jump speed</label>
                    <input
                      type="number"
                      step={1}
                      min={1}
                      placeholder="global"
                      value={(hole.obstacles[selection.index] as { jumpSpeed?: number }).jumpSpeed ?? ''}
                      onChange={(e) =>
                        updateHole((h) => {
                          const o = h.obstacles[selection.index] as { jumpSpeed?: number };
                          if (e.target.value === '') delete o.jumpSpeed;
                          else o.jumpSpeed = parseFloat(e.target.value);
                        })
                      }
                    />
                  </div>
                )}
                {!['curb', 'pipe', 'windmill', 'slidingGate', 'pendulum'].includes(hole.obstacles[selection.index].type) && (
                  <div className="field">
                    <label>restitution</label>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      placeholder="global"
                      value={(hole.obstacles[selection.index] as { restitution?: number }).restitution ?? ''}
                      onChange={(e) =>
                        updateHole((h) => {
                          const o = h.obstacles[selection.index] as { restitution?: number };
                          if (e.target.value === '') delete o.restitution;
                          else o.restitution = parseFloat(e.target.value);
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}
            {(selection.kind === 'tee' || selection.kind === 'cup') && (
              <div className="field">
                <label>x, y</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    step={0.5}
                    value={(selection.kind === 'tee' ? hole.tee : hole.cup).x}
                    onChange={(e) =>
                      updateHole((h) => ((selection.kind === 'tee' ? h.tee : h.cup).x = parseFloat(e.target.value) || 0))
                    }
                  />
                  <input
                    type="number"
                    step={0.5}
                    value={(selection.kind === 'tee' ? hole.tee : hole.cup).y}
                    onChange={(e) =>
                      updateHole((h) => ((selection.kind === 'tee' ? h.tee : h.cup).y = parseFloat(e.target.value) || 0))
                    }
                  />
                </div>
              </div>
            )}
            {selection.kind !== 'tee' && selection.kind !== 'cup' && (
              <div className="btnrow">
                <button className="danger" onClick={deleteSelection}>
                  Delete <kbd style={{ opacity: 0.6 }}>Del</kbd>
                </button>
              </div>
            )}
          </div>
        )}

        <h4>Solver</h4>
        {!report && (
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            Press <strong>Solve</strong> to estimate par, measure difficulty and check the section-9 rules. Uses the
            physics values from the dev panel.
          </div>
        )}
        {report && (
          <div className="sel" style={{ opacity: reportStale ? 0.5 : 1 }}>
            {reportStale && <div style={{ color: 'var(--accent)', fontSize: 11, marginBottom: 4 }}>hole changed — re-solve</div>}
            <div style={{ fontWeight: 700, color: report.accepted ? 'var(--good)' : 'var(--danger)' }}>
              {report.accepted ? 'ACCEPTED' : 'REJECTED'} · solver par {report.par ?? '–'}
              {report.par !== null && report.par !== hole.par && (
                <button
                  style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                  onClick={() => updateHole((h) => (h.par = report.par as number))}
                >
                  set par {report.par}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
              best {report.bestStrokes ?? '–'} · success {Math.round(report.successRate * 100)}% · ace{' '}
              {(report.aceRate * 100).toFixed(1)}% · random plays find cup {Math.round(report.cupFindRate * 100)}% · hazard{' '}
              {(report.hazardRate * 100).toFixed(0)}%
              <br />
              tee→cup {report.teeToCupDirect.toFixed(0)}u direct, {report.teeToCupPath < 0 ? 'no path' : report.teeToCupPath.toFixed(0) + 'u path'} ·
              cup↔corner {report.cupNearestCorner.toFixed(1)}u · traps {report.trapsFound} · {report.timeMs.toFixed(0)}ms
            </div>
            {report.rejectReasons.length > 0 && <div className="errors">{report.rejectReasons.join('\n')}</div>}
          </div>
        )}

        <h4>Stats</h4>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>
          {hole.walls.length} walls · {hole.surfaceZones.length} surfaces · {hole.slopeZones.length} slopes ·{' '}
          {hole.hazards.length} hazards · {hole.obstacles.length} obstacles
        </div>
        {!validation.ok && <div className="errors">{validation.errors.join('\n')}</div>}

        <h4>JSON</h4>
        <textarea
          value={jsonText}
          onChange={(e) => {
            jsonDirtyRef.current = true;
            setJsonText(e.target.value);
            setJsonMsg(null);
          }}
          spellCheck={false}
        />
        <div className="btnrow">
          <button onClick={applyJson}>Apply JSON</button>
          <button
            onClick={() => {
              jsonDirtyRef.current = false;
              setJsonText(JSON.stringify(hole, null, 2));
              setJsonMsg(null);
            }}
          >
            Revert
          </button>
        </div>
        <div className="btnrow">
          <button onClick={() => downloadJson(`${hole.id || 'hole'}.json`, hole)}>⤓ Export .json</button>
          <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(hole, null, 2))}>Copy</button>
          <label style={{ flex: 1 }}>
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = '';
              }}
            />
            <span
              className="editor-import-btn"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '6px 8px',
                fontSize: 12,
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--panel-2)',
                cursor: 'pointer',
              }}
            >
              ⤒ Import .json
            </span>
          </label>
        </div>
        {jsonMsg && <div className={jsonMsg.ok ? 'ok' : 'errors'}>{jsonMsg.text}</div>}
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 10, lineHeight: 1.5 }}>
          To ship a hole, save the JSON into <code>src/holes/</code> and add it to <code>src/holes/index.ts</code>.
        </div>
      </div>
    </div>
  );
}
