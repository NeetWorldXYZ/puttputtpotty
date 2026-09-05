/**
 * Synthesised sound effects with the Web Audio API. No asset files. The
 * context is created on the first user gesture (browser autoplay rules).
 */

let ctx: BaseAudioContext | null = null;
let master: GainNode | null = null;

/** The live context and master bus, once unlocked (music hangs off the same bus). */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master && ctx instanceof AudioContext ? { ctx, master } : null;
}
let muted = false;

const MUTE_KEY = 'ppp.mute.v1';
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* ignore */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = m ? 0 : 0.8;
}

/**
 * iOS keeps Web Audio silent while the ring/silent switch is on silent unless
 * the page is treated as media. Two things flip that: the AudioSession API
 * (Safari 17+) and playing any media element once inside a user gesture.
 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
let mediaPrimed = false;
function primeMediaSession(): void {
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    /* ignore */
  }
  if (mediaPrimed) return;
  try {
    const el = new Audio(SILENT_WAV);
    el.setAttribute('playsinline', '');
    el.volume = 0.01;
    const p = el.play();
    if (p && typeof p.then === 'function') p.then(() => (mediaPrimed = true)).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Call from a pointer/touch handler so the context is allowed to start. */
export function unlockAudio(): void {
  primeMediaSession();
  if (ctx) {
    if (ctx instanceof AudioContext && ctx.state !== 'running') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    // iOS creates the context suspended even inside a gesture; resume it now, while the gesture is live.
    if (ctx instanceof AudioContext && ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

// Any first touch anywhere counts; iOS only honours resume() inside these.
if (typeof window !== 'undefined') {
  for (const ev of ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx instanceof AudioContext && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
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
  if (!ctx || !master || muted) return;
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
}

function noise(dur: number, opts: { gain?: number; filter?: number; to?: number; q?: number; delay?: number; attack?: number } = {}): void {
  if (!ctx || !master || muted) return;
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
   * Crowd cheer built from voices, not static: dozens of sawtooth "singers"
   * pushed through two vocal formant filters each (ah / oh / eh / ay), with
   * their own pitch, vibrato, onset and length, plus real-feeling claps
   * (three quick slaps per clap) and a couple of whistles. Bigger scores
   * get a bigger crowd.
   */
  cheer(level: 'huge' | 'big' | 'ok' | 'polite'): void {
    if (!ctx || !master || muted) return;
    const c = ctx;
    const bus = c.createGain();
    bus.gain.value = { huge: 0.9, big: 0.8, ok: 0.7, polite: 0.55 }[level];
    bus.connect(master);
    const t0 = now();
    const voices = { huge: 44, big: 30, ok: 18, polite: 8 }[level];
    const spread = { huge: 0.7, big: 0.55, ok: 0.45, polite: 0.35 }[level];
    const longest = { huge: 2.4, big: 2.0, ok: 1.6, polite: 1.2 }[level];
    const formants: [number, number][] = [
      [730, 1090], // ah
      [570, 840], // oh
      [530, 1840], // eh
      [660, 1720], // ay
    ];
    const r = Math.random;
    for (let i = 0; i < voices; i++) {
      const female = r() < 0.45;
      const f = female ? 200 + r() * 130 : 105 + r() * 80;
      const onset = t0 + r() * spread;
      const dur = 0.6 + r() * (longest - 0.6);
      const attack = 0.06 + r() * 0.25;
      const release = 0.25 + r() * 0.4;
      const [f1, f2] = formants[Math.floor(r() * formants.length)];
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, onset);
      // some voices whoop upward, the rest drift a little
      if (r() < 0.3) o.frequency.exponentialRampToValueAtTime(f * (1.25 + r() * 0.3), onset + 0.35 + r() * 0.3);
      else o.frequency.exponentialRampToValueAtTime(f * (0.97 + r() * 0.06), onset + dur);
      const vib = c.createOscillator();
      const vibG = c.createGain();
      vib.frequency.value = 4.5 + r() * 2.5;
      vibG.gain.value = f * (0.015 + r() * 0.02);
      vib.connect(vibG);
      vibG.connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, onset);
      g.gain.exponentialRampToValueAtTime(0.16 + r() * 0.08, onset + attack);
      g.gain.setValueAtTime(0.16, onset + Math.max(attack, dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, onset + dur);
      for (const [fc, q] of [
        [f1, 5],
        [f2, 7],
      ] as [number, number][]) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fc * (0.9 + r() * 0.2);
        bp.Q.value = q;
        o.connect(bp);
        bp.connect(g);
      }
      g.connect(bus);
      o.start(onset);
      vib.start(onset);
      o.stop(onset + dur + 0.05);
      vib.stop(onset + dur + 0.05);
    }
    // claps: each one is three quick slaps
    const claps = { huge: 34, big: 24, ok: 14, polite: 7 }[level];
    for (let i = 0; i < claps; i++) {
      const at = 0.08 + r() * (longest - 0.4);
      for (let k = 0; k < 3; k++) noise(0.014, { gain: 0.14 + r() * 0.1, filter: 1000 + r() * 700, q: 1.6, delay: at + k * (0.011 + r() * 0.006) });
    }
    // whistles
    const whistles = level === 'huge' ? 3 : level === 'big' ? 1 : 0;
    for (let i = 0; i < whistles; i++) {
      const w = c.createOscillator();
      const wg = c.createGain();
      const at = t0 + 0.2 + r() * 0.8;
      w.type = 'sine';
      w.frequency.setValueAtTime(1800 + r() * 300, at);
      w.frequency.exponentialRampToValueAtTime(2600, at + 0.18);
      w.frequency.exponentialRampToValueAtTime(2100, at + 0.5);
      wg.gain.setValueAtTime(0.0001, at);
      wg.gain.exponentialRampToValueAtTime(0.09, at + 0.04);
      wg.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      w.connect(wg);
      wg.connect(bus);
      w.start(at);
      w.stop(at + 0.6);
    }
    if (level === 'huge') {
      tone(311, 0.7, { type: 'sawtooth', gain: 0.05, delay: 0.4 });
      tone(466, 0.7, { type: 'sawtooth', gain: 0.035, delay: 0.4 });
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
  const saved = { ctx, master, muted };
  ctx = off;
  master = g;
  muted = false;
  try {
    (sfx[name] as (a?: unknown) => void)(arg);
  } finally {
    ctx = saved.ctx;
    master = saved.master;
    muted = saved.muted;
  }
  return await off.startRendering();
}
