/**
 * Synthesised sound effects with the Web Audio API. No asset files. The
 * context is created on the first user gesture (browser autoplay rules).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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

/** Call from a pointer/touch handler so the context is allowed to start. */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
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

function noise(dur: number, opts: { gain?: number; filter?: number; to?: number; q?: number; delay?: number } = {}): void {
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
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + 0.01);
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
