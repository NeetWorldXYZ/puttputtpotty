/** Sound effects use a lazy Web Audio context; menu music is native media. */
import { stinger, type StingerLevel } from './music';
import { createThemePlayer } from './themePlayer';

let ctx: BaseAudioContext | null = null;
let master: GainNode | null = null;
let backgrounded = typeof document !== 'undefined' && document.hidden;
let audioTransition = false;
let interrupted = false;
let hasRun = false;
let unlocked = false;
let menuOwners = 0;
let effectsActive = false;
let effectsUntil = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const stopSources = new Set<() => void>();
let muted = false;
const MUTE_KEY = 'ppp.mute.v1';
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* unavailable storage */ }

const theme = createThemePlayer(yieldAudio);
type GameAudioSession = { type: string; state?: string; addEventListener?: (event: string, listener: () => void) => void };
let observedSession: GameAudioSession | undefined;

function audioSession(): GameAudioSession | undefined {
  try { return (navigator as unknown as { audioSession?: GameAudioSession }).audioSession; }
  catch { return undefined; }
}

function configureGameAudio(): void {
  const session = audioSession();
  if (!session) return;
  try {
    // Effects-only gameplay needs playback to work with iPhone Silent mode.
    // Native menu music already establishes its own media session via 'auto'.
    if (session.type !== 'playback') session.type = 'playback';
    if (observedSession !== session) {
      session.addEventListener?.('statechange', () => {
        if (session.state === 'interrupted') yieldAudio();
      });
      observedSession = session;
    }
  } catch { /* Optional Safari API. */ }
}

function releaseGameAudio(): void {
  try {
    if (observedSession?.type === 'playback') observedSession.type = 'auto';
  } catch { /* Optional Safari API. */ }
}

function isBackgrounded(): boolean {
  return backgrounded || (typeof document !== 'undefined' && document.hidden);
}
export function isMuted(): boolean { return muted || interrupted; }
function musicWanted(): boolean { return menuOwners > 0 && unlocked && !isMuted() && !isBackgrounded(); }
function effectsWanted(): boolean { return effectsActive && !isMuted() && !isBackgrounded(); }
function notifyMuteChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ppp:mutechange'));
}

function clearEffects(): void {
  clearTimeout(idleTimer);
  effectsUntil = 0;
  effectsActive = false;
  for (const stop of stopSources) stop();
  stopSources.clear();
}

/** Temporary system interruptions never overwrite the saved mute preference. */
function yieldAudio(): void {
  if (interrupted || muted) return;
  interrupted = true;
  clearEffects();
  syncAudio();
  notifyMuteChange();
}

function contextStateChanged(): void {
  if (!ctx) return;
  const state = String(ctx.state); // Safari also exposes "interrupted".
  if (state === 'running') {
    hasRun = true;
    if (!effectsWanted()) syncAudio();
  } else if (state === 'interrupted' ||
      (state === 'suspended' && hasRun && !audioTransition && effectsWanted())) {
    yieldAudio();
  }
}

function syncAudio(): void {
  theme.setPlaying(musicWanted());
  const quiet = !effectsWanted();
  if (master) {
    master.gain.cancelScheduledValues(ctx?.currentTime ?? 0);
    master.gain.value = quiet ? 0 : 0.8;
  }
  if (quiet || musicWanted()) releaseGameAudio();
  if (!ctx || audioTransition || ctx.state === 'closed') return;
  const live = ctx as AudioContext;
  if (!quiet && !musicWanted()) configureGameAudio();
  if (quiet ? live.state === 'suspended' : live.state === 'running') return;
  // Mark before calling: statechange can fire before the promise settles.
  audioTransition = true;
  const failed = () => {
    audioTransition = false;
    if (!quiet) yieldAudio();
  };
  try {
    const operation = quiet ? live.suspend() : live.resume();
    void operation.then(() => {
      audioTransition = false;
      if (live.state === 'running') hasRun = true;
      if (quiet !== !effectsWanted()) syncAudio();
    }).catch(failed);
  } catch { failed(); }
}

/** One music owner per mounted menu; sibling tab swaps don't restart the song. */
export function acquireMenuMusic(): () => void {
  menuOwners++;
  syncAudio();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    menuOwners--;
    // React unmounts one tab before mounting the next in the same effect flush.
    queueMicrotask(syncAudio);
  };
}

/** The effects bus, if an actual sound has needed it. Music never uses it. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master && ctx instanceof AudioContext ? { ctx, master } : null;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (!m) { interrupted = false; unlocked = true; }
  else clearEffects();
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* unavailable storage */ }
  syncAudio();
  notifyMuteChange();
}

/** A gesture permits audio, but does NOT allocate or resume an effects context. */
export function unlockAudio(): void {
  if (isBackgrounded() || isMuted() || unlocked) return;
  unlocked = true;
  syncAudio();
}

/** Wake only for a real effect, and sleep after its scheduled tail has ended. */
function ensureEffects(seconds: number): boolean {
  if (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) return true;
  if (!unlocked || isMuted() || isBackgrounded()) return false;
  if (String(ctx?.state) === 'interrupted' || audioSession()?.state === 'interrupted' ||
      (hasRun && effectsActive && ctx?.state === 'suspended' && !audioTransition)) {
    yieldAudio();
    return false;
  }
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      if (!musicWanted()) configureGameAudio();
      ctx = new AC();
      hasRun = ctx.state === 'running';
      ctx.addEventListener('statechange', contextStateChanged);
      master = ctx.createGain();
      master.gain.value = .8;
      master.connect(ctx.destination);
      loadCheerSamples();
    }
    effectsActive = true;
    effectsUntil = Math.max(effectsUntil, Date.now() + seconds * 1000 + 1500);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { clearEffects(); syncAudio(); }, effectsUntil - Date.now());
    syncAudio();
    return !isMuted();
  } catch {
    yieldAudio();
    return false;
  }
}

function trackSource(source: AudioScheduledSourceNode, output: AudioNode): void {
  const stop = () => {
    try { source.stop(); } catch { /* ended */ }
    source.disconnect();
    output.disconnect();
    stopSources.delete(stop);
  };
  stopSources.add(stop);
  source.addEventListener('ended', stop, { once: true });
}

if (typeof window !== 'undefined') {
  for (const event of ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'] as const) {
    window.addEventListener(event, unlockAudio, { passive: true, capture: true });
  }
  const visibility = () => { if (isBackgrounded()) clearEffects(); syncAudio(); };
  window.addEventListener('pagehide', () => { backgrounded = true; visibility(); });
  window.addEventListener('pageshow', () => { backgrounded = document.hidden; visibility(); });
  document.addEventListener('visibilitychange', () => { backgrounded = document.hidden; visibility(); });
}

/**
 * Optional recorded crowd cheers. Drop files at public/sfx/cheer-big.mp3
 * and public/sfx/cheer-small.mp3 (any format the browser decodes) and they
 * play under the ace / birdie stingers. Missing files are silently skipped.
 */
const samples: { big: AudioBuffer | null; small: AudioBuffer | null; tried: boolean } = { big: null, small: null, tried: false };
export function loadCheerSamples(): void {
  if (samples.tried || !ctx) return;
  samples.tried = true;
  const c = ctx;
  for (const [key, file] of [
    ['big', 'cheer-big.mp3'],
    ['small', 'cheer-small.mp3'],
  ] as const) {
    fetch(`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/sfx/${file}`)
      .then((r) => (r.ok && /audio|octet/.test(r.headers.get('content-type') ?? '') ? r.arrayBuffer() : null))
      .then((ab) => (ab ? c.decodeAudioData(ab) : null))
      .then((buf) => {
        if (buf) samples[key] = buf;
      })
      .catch(() => {});
  }
}

function now(): number {
  return ctx ? ctx.currentTime : 0;
}

function noiseBuffer(seconds: number): AudioBuffer | null {
  if (!ctx) return null;
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; attack?: number; delay?: number } = {}): void {
  if (!ensureEffects(dur + (opts.delay ?? 0) + .05) || !ctx || !master) return;
  const t0 = now() + (opts.delay ?? 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
  const a = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
  trackSource(o, g);
}

function noise(dur: number, opts: { gain?: number; filter?: number; to?: number; q?: number; delay?: number; attack?: number } = {}): void {
  if (!ensureEffects(dur + (opts.delay ?? 0) + .05) || !ctx || !master) return;
  const buf = noiseBuffer(dur + 0.05);
  if (!buf) return;
  const t0 = now() + (opts.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = opts.q ?? 0.8;
  f.frequency.setValueAtTime(opts.filter ?? 1200, t0);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
  trackSource(src, g);
}

export const sfx = {
  putt(power: number): void {
    noise(0.06 + power * 0.05, { gain: 0.25 + power * 0.3, filter: 900 + power * 1500, to: 300 });
    tone(180 + power * 120, 0.08, { type: 'triangle', gain: 0.18 });
  },
  wall(speed: number): void {
    const k = Math.min(1, speed / 60);
    tone(140 + k * 80, 0.09, { type: 'triangle', gain: 0.12 + k * 0.25, to: 70 });
    noise(0.05, { gain: 0.08 + k * 0.15, filter: 700, to: 250 });
  },
  bumper(): void {
    tone(320, 0.22, { type: 'square', gain: 0.18, to: 640 });
    tone(640, 0.16, { type: 'sine', gain: 0.12, to: 1100, delay: 0.03 });
  },
  post(): void {
    tone(900, 0.05, { type: 'square', gain: 0.12, to: 500 });
  },
  dead(): void {
    noise(0.12, { gain: 0.2, filter: 300, to: 120 });
  },
  splash(): void {
    noise(0.35, { gain: 0.35, filter: 2200, to: 400, q: 0.6 });
    tone(520, 0.25, { type: 'sine', gain: 0.1, to: 180 });
  },
  gurgle(): void {
    for (let i = 0; i < 5; i++) tone(260 - i * 30, 0.08, { type: 'sine', gain: 0.15, to: 120, delay: i * 0.07 });
    noise(0.45, { gain: 0.15, filter: 500, to: 150 });
  },
  fall(): void {
    tone(700, 0.5, { type: 'sine', gain: 0.18, to: 90 });
  },
  overflow(): void {
    noise(0.4, { gain: 0.25, filter: 1500, to: 600, q: 0.5 });
    for (let i = 0; i < 4; i++) tone(400 + i * 90, 0.06, { type: 'sine', gain: 0.1, delay: 0.05 + i * 0.08 });
  },
  flush(): void {
    noise(0.9, { gain: 0.35, filter: 1800, to: 200, q: 0.4 });
    tone(880, 0.18, { type: 'sine', gain: 0.22, delay: 0.05 });
    tone(1320, 0.28, { type: 'sine', gain: 0.22, delay: 0.16 });
  },
  clink(): void {
    tone(1600, 0.08, { type: 'triangle', gain: 0.18, to: 1200 });
  },
  /** UI tap. */
  tap(): void {
    tone(620, 0.04, { type: 'triangle', gain: 0.14, to: 480 });
    noise(0.03, { gain: 0.08, filter: 2400, to: 1200 });
  },
  /** Chip / option select. */
  select(): void {
    tone(740, 0.05, { type: 'triangle', gain: 0.14, to: 980 });
  },
  /** Startup jingle when audio wakes on the home screen. */
  jingle(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.16, delay: i * 0.09 }));
    tone(1319, 0.5, { type: 'sine', gain: 0.12, delay: 0.4 });
    noise(0.5, { gain: 0.12, filter: 1500, to: 300, q: 0.5, delay: 0.42 });
  },
  /**
   * Sink celebration: the theme's hook as a stinger, sized by the score.
   * If a recorded crowd file exists under /sfx it plays underneath on the
   * bigger ones (see loadCheerSamples).
   */
  stinger(level: StingerLevel): void {
    const sample = level === 'ace' ? samples.big : level === 'great' ? samples.small : null;
    if (!ensureEffects(Math.max(3.2, (sample?.duration ?? 0) + .15)) || !ctx || !master) return;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(master);
    stinger({ ctx, out: bus }, level, now());
    stopSources.add(() => bus.disconnect());
    if (sample && ctx instanceof AudioContext) {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = sample;
      g.gain.value = level === 'ace' ? 0.7 : 0.5;
      src.connect(g);
      g.connect(master);
      src.start(now() + 0.15);
      trackSource(src, g);
    }
  },
  whoosh(): void {
    noise(0.3, { gain: 0.3, filter: 400, to: 2600, q: 1.2 });
  },
  pop(): void {
    noise(0.08, { gain: 0.25, filter: 1200, to: 500 });
    tone(500, 0.06, { type: 'sine', gain: 0.15, to: 900 });
  },
  squelch(): void {
    tone(200, 0.2, { type: 'sawtooth', gain: 0.12, to: 60 });
    noise(0.18, { gain: 0.15, filter: 600, to: 200 });
  },
  fanfare(kind: 'ace' | 'great' | 'ok' | 'meh' | 'bad'): void {
    const seq: Record<typeof kind, number[]> = {
      ace: [523, 659, 784, 1047, 1319],
      great: [523, 659, 784, 1047],
      ok: [523, 659],
      meh: [440, 415],
      bad: [330, 262, 220],
    };
    seq[kind].forEach((f, i) => tone(f, kind === 'bad' || kind === 'meh' ? 0.25 : 0.18, { type: 'triangle', gain: 0.2, delay: i * (kind === 'bad' ? 0.18 : 0.1) }));
  },
  tick(): void {
    tone(1200, 0.03, { type: 'square', gain: 0.05 });
  },
};


/** Renders one effect offline (previews and tests); restores the live context afterwards. */
export async function renderSfx(name: keyof typeof sfx, seconds = 3, arg?: unknown, sampleRate = 44100): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const g = off.createGain();
  g.gain.value = 0.8;
  g.connect(off.destination);
  const saved = { ctx, master, muted, interrupted, stops: new Set(stopSources) };
  stopSources.clear();
  ctx = off;
  master = g;
  muted = false;
  interrupted = false;
  try {
    (sfx[name] as (a?: unknown) => void)(arg);
  } finally {
    ctx = saved.ctx;
    master = saved.master;
    muted = saved.muted;
    interrupted = saved.interrupted;
    stopSources.clear();
    for (const stop of saved.stops) stopSources.add(stop);
  }
  return await off.startRendering();
}
