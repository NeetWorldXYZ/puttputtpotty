/**
 * The Putt Putt Potty theme: a synthesised, looping 8-bar tune with a
 * four-note signature hook ("PUTT PUTT POT-TY"), a bouncy bass, off-beat
 * chord stabs, a drum kit built from noise and sines, a plunger "boing" and
 * a flush that carries the loop back around. No audio files.
 *
 * Everything is scheduled against a BaseAudioContext so the same code can
 * render a preview with an OfflineAudioContext.
 */

export const BPM = 118;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 8;
const SWING = 0.58; // off-beat eighths land here within the beat (0.5 = straight)

// Note helpers (MIDI-ish names -> Hz)
const N: Record<string, number> = {};
{
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let o = 1; o <= 7; o++) for (let i = 0; i < 12; i++) N[`${names[i]}${o}`] = 440 * Math.pow(2, (o * 12 + i - 57) / 12);
}

type Voice = { ctx: BaseAudioContext; out: AudioNode };

function env(g: GainNode, t: number, peak: number, a: number, d: number, s: number, r: number, hold: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * s), t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + hold + r);
}

/** Lead: two detuned squares through a low-pass, a little vibrato. The brand sound. */
function lead(v: Voice, f: number, t: number, dur: number, gain = 0.09): void {
  const { ctx, out } = v;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(1400, t + dur);
  lp.Q.value = 0.9;
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.detune.value = det;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoG.gain.value = f * 0.006;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.3);
  }
  lp.connect(g);
  g.connect(out);
  env(g, t, gain, 0.01, 0.08, 0.7, 0.12, dur);
}

/** Bass: triangle + a touch of saw, low-passed, short and bouncy. */
function bass(v: Voice, f: number, t: number, dur: number): void {
  const { ctx, out } = v;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + dur);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = f;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.35;
  o1.connect(lp);
  o2.connect(o2g);
  o2g.connect(lp);
  lp.connect(g);
  g.connect(out);
  o1.start(t);
  o2.start(t);
  o1.stop(t + dur + 0.1);
  o2.stop(t + dur + 0.1);
  env(g, t, 0.16, 0.005, 0.06, 0.6, 0.08, dur);
}

/** Chord stab: three short triangle notes, filtered. */
function stab(v: Voice, freqs: number[], t: number, dur: number): void {
  const { ctx, out } = v;
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  lp.connect(g);
  g.connect(out);
  env(g, t, 0.05, 0.005, 0.05, 0.4, 0.07, dur);
}

let noiseBuf: AudioBuffer | null = null;
let noiseBufCtx: BaseAudioContext | null = null;
function noiseSrc(ctx: BaseAudioContext): AudioBufferSourceNode {
  if (!noiseBuf || noiseBufCtx !== ctx) {
    const n = Math.floor(ctx.sampleRate * 1.5);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBufCtx = ctx;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function kick(v: Voice, t: number): void {
  const { ctx, out } = v;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.25);
}

function snare(v: Voice, t: number): void {
  const { ctx, out } = v;
  const s = noiseSrc(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1900;
  f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t);
  s.stop(t + 0.2);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  og.gain.setValueAtTime(0.18, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(og);
  og.connect(out);
  o.start(t);
  o.stop(t + 0.12);
}

function hat(v: Voice, t: number, open = false): void {
  const { ctx, out } = v;
  const s = noiseSrc(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  const d = open ? 0.18 : 0.045;
  g.gain.setValueAtTime(open ? 0.09 : 0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t);
  s.stop(t + d + 0.02);
}

/** The plunger: a wobbly sine dive. Comic accent, part of the signature. */
export function boing(v: Voice, t: number, gain = 0.14): void {
  const { ctx, out } = v;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(260, t + 0.28);
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.setValueAtTime(14, t);
  lfo.frequency.exponentialRampToValueAtTime(5, t + 0.4);
  lfoG.gain.value = 40;
  lfo.connect(lfoG);
  lfoG.connect(o.frequency);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g);
  g.connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.5);
  lfo.stop(t + 0.5);
}

/** A short flush swoosh used as the turnaround. */
function swoosh(v: Voice, t: number): void {
  const { ctx, out } = v;
  const s = noiseSrc(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.6;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(3200, t + 0.5);
  f.frequency.exponentialRampToValueAtTime(400, t + 0.9);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t);
  s.stop(t + 1);
}

// ---- The tune. Chords per bar (roots for the bass, triads for the stabs).
const CHORDS: { bass: string; stab: string[] }[] = [
  { bass: 'C2', stab: ['E4', 'G4', 'C5'] },
  { bass: 'C2', stab: ['E4', 'G4', 'C5'] },
  { bass: 'A1', stab: ['E4', 'A4', 'C5'] },
  { bass: 'A1', stab: ['E4', 'A4', 'C5'] },
  { bass: 'F2', stab: ['F4', 'A4', 'C5'] },
  { bass: 'G2', stab: ['F4', 'G4', 'B4'] },
  { bass: 'C2', stab: ['E4', 'G4', 'C5'] },
  { bass: 'G2', stab: ['F4', 'G4', 'B4'] },
];

/** Melody: [beat offset within the bar, note, length in beats]. The hook is bars 1, 3, 5 (up a fourth), 7. */
type Note = [number, string, number];
const HOOK = (a: string, b: string, c: string): Note[] => [
  [0, a, 0.5],
  [1, a, 0.5],
  [2, b, 0.45],
  [2.5, c, 0.9],
];
const MELODY: Note[][] = [
  HOOK('G4', 'E4', 'C4'), // PUTT PUTT POT-TY
  [
    [0.5, 'D4', 0.4],
    [1, 'E4', 0.4],
    [1.5, 'G4', 0.4],
    [2, 'E4', 0.9],
  ],
  HOOK('A4', 'E4', 'C4'),
  [
    [0, 'B4', 0.4],
    [0.5, 'C5', 0.4],
    [1, 'B4', 0.4],
    [1.5, 'A4', 0.4],
    [2, 'G4', 1.2],
  ],
  HOOK('C5', 'A4', 'F4'), // hook up a fourth
  [
    [0, 'B4', 0.4],
    [1, 'D5', 0.4],
    [2, 'B4', 0.4],
    [3, 'G4', 0.4],
  ],
  HOOK('G4', 'E4', 'C4'),
  [
    [0, 'D5', 0.3],
    [0.5, 'B4', 0.3],
    [1, 'G4', 0.3],
  ], // then the boing + swoosh turnaround
];

/** Bass pattern per bar: root on 1 and 3, octave/fifth bounce on the "and"s. */
function bassBar(v: Voice, root: number, t0: number): void {
  const fifth = root * 1.5;
  const oct = root * 2;
  const hits: [number, number, number][] = [
    [0, root, 0.45],
    [0.5 + (SWING - 0.5), oct, 0.2],
    [1, root, 0.3],
    [1.5 + (SWING - 0.5), fifth, 0.2],
    [2, root, 0.45],
    [2.5 + (SWING - 0.5), oct, 0.2],
    [3, fifth, 0.3],
    [3.5 + (SWING - 0.5), root, 0.2],
  ];
  for (const [b, f, len] of hits) bass(v, f, t0 + b * BEAT, len * BEAT);
}

function drumsBar(v: Voice, bar: number, t0: number): void {
  for (let beat = 0; beat < 4; beat++) {
    const t = t0 + beat * BEAT;
    if (beat === 0 || beat === 2) kick(v, t);
    if (beat === 1 || beat === 3) snare(v, t);
    hat(v, t);
    hat(v, t + SWING * BEAT, beat === 3 && bar % 2 === 1);
  }
  if (bar === 7) kick(v, t0 + 3.5 * BEAT);
}

/** Schedules one bar of everything at time t0. */
export function scheduleBar(v: Voice, bar: number, t0: number): void {
  const ch = CHORDS[bar % BARS];
  bassBar(v, N[ch.bass], t0);
  drumsBar(v, bar % BARS, t0);
  const stabs = ch.stab.map((n) => N[n]);
  for (const b of [0.5 + (SWING - 0.5), 1.5 + (SWING - 0.5), 2.5 + (SWING - 0.5), 3.5 + (SWING - 0.5)]) stab(v, stabs, t0 + b * BEAT, 0.22 * BEAT);
  for (const [b, note, len] of MELODY[bar % BARS]) lead(v, N[note], t0 + b * BEAT, len * BEAT);
  if (bar % BARS === 3) boing(v, t0 + 3 * BEAT, 0.1);
  if (bar % BARS === 7) {
    boing(v, t0 + 1.5 * BEAT, 0.12);
    swoosh(v, t0 + 2.5 * BEAT);
  }
}

// ---- Sink stingers: the hook as a celebration, sized by the score.
export type StingerLevel = 'ace' | 'great' | 'par' | 'bogey';

/** A stinger at time t on the given voice bus. Returns its length in seconds. */
export function stinger(v: Voice, level: StingerLevel, t: number): number {
  const e = BEAT * 0.85; // a touch quicker than the theme
  if (level === 'ace') {
    // snare pickup, the hook up an octave, a held top note with kick + open hat, boing, flush
    for (let i = 0; i < 3; i++) snare(v, t + i * e * 0.25);
    const t1 = t + e * 0.8;
    kick(v, t1);
    for (const [b, n, len] of [
      [0, 'C5', 0.45],
      [0.5, 'C5', 0.45],
      [1, 'A4', 0.4],
      [1.25, 'F4', 0.4],
      [1.75, 'G5', 1.6],
    ] as [number, string, number][]) lead(v, N[n], t1 + b * e, len * e, 0.12);
    kick(v, t1 + 1.75 * e);
    hat(v, t1 + 1.75 * e, true);
    stab(v, [N['E4'], N['G4'], N['C5']], t1 + 1.75 * e, 1.4 * e);
    stab(v, [N['G4'], N['C5'], N['E5']], t1 + 2.25 * e, 0.9 * e);
    boing(v, t1 + 3.2 * e, 0.14);
    swoosh(v, t1 + 3.4 * e);
    return e * 5.2;
  }
  if (level === 'great') {
    kick(v, t);
    for (const [b, n, len] of [
      [0, 'G4', 0.45],
      [0.5, 'G4', 0.45],
      [1, 'E4', 0.4],
      [1.25, 'C4', 0.4],
      [1.75, 'G4', 1.1],
    ] as [number, string, number][]) lead(v, N[n], t + b * e, len * e, 0.11);
    snare(v, t + 1.75 * e);
    stab(v, [N['E4'], N['G4'], N['C5']], t + 1.75 * e, 1 * e);
    boing(v, t + 2.6 * e, 0.1);
    return e * 3.6;
  }
  if (level === 'par') {
    lead(v, N['E4'], t, 0.35 * e, 0.1);
    lead(v, N['G4'], t + 0.4 * e, 0.7 * e, 0.1);
    kick(v, t + 0.4 * e);
    hat(v, t + 0.4 * e);
    return e * 1.3;
  }
  // bogey: a sad plunger, twice
  boing(v, t, 0.1);
  boing(v, t + 0.35, 0.07);
  return 0.9;
}

// ---- Live player: look-ahead scheduler on the page's audio context.
let timer = 0;
let playing = false;
let nextBar = 0;
let nextTime = 0;
let musicGain: GainNode | null = null;
let liveCtx: AudioContext | null = null;

export function isThemePlaying(): boolean {
  return playing;
}

/**
 * Starts the loop on the given context. Idempotent. The scheduler only lays
 * down bars while the context is actually running: on iOS the first tap
 * creates a suspended context that wakes a moment later, and backgrounding
 * the tab interrupts it. In both cases the tune resumes in time, from the
 * next bar, instead of never starting or dumping a burst of missed bars.
 */
export function startTheme(ctx: AudioContext, master: AudioNode, volume = 0.5): void {
  if (playing && liveCtx === ctx) return;
  stopTheme();
  liveCtx = ctx;
  musicGain = ctx.createGain();
  musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicGain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.8);
  musicGain.connect(master);
  const v: Voice = { ctx, out: musicGain };
  playing = true;
  nextBar = 0;
  nextTime = -1; // unset: (re)synced to the clock when the context is running
  const tick = () => {
    if (!playing) return;
    if (ctx.state !== 'running') {
      nextTime = -1;
      timer = window.setTimeout(tick, 100);
      return;
    }
    if (nextTime < 0 || nextTime < ctx.currentTime - 0.05) nextTime = ctx.currentTime + 0.08;
    while (nextTime < ctx.currentTime + 0.6) {
      scheduleBar(v, nextBar, nextTime);
      nextBar++;
      nextTime += BAR;
    }
    timer = window.setTimeout(tick, 120);
  };
  tick();
}

export function setThemeVolume(volume: number): void {
  if (musicGain && liveCtx) {
    musicGain.gain.cancelScheduledValues(liveCtx.currentTime);
    musicGain.gain.setTargetAtTime(Math.max(0.0001, volume), liveCtx.currentTime, 0.05);
  }
}

export function stopTheme(fadeSeconds = 0.35): void {
  if (!playing) return;
  playing = false;
  window.clearTimeout(timer);
  const g = musicGain;
  const c = liveCtx;
  if (g && c) {
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.setTargetAtTime(0.0001, c.currentTime, fadeSeconds / 3);
    setTimeout(() => g.disconnect(), fadeSeconds * 1000 + 100);
  }
  musicGain = null;
}

/** Renders a stinger offline (previews and tests). */
export async function renderStinger(level: StingerLevel, sampleRate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(3.2 * sampleRate), sampleRate);
  const g = ctx.createGain();
  g.gain.value = 0.6;
  g.connect(ctx.destination);
  stinger({ ctx, out: g }, level, 0.05);
  return await ctx.startRendering();
}

/** Renders `bars` bars offline (used for previews and tests). */
export async function renderTheme(bars = BARS, sampleRate = 44100): Promise<AudioBuffer> {
  const length = Math.ceil((bars * BAR + 1.5) * sampleRate);
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  g.connect(ctx.destination);
  const v: Voice = { ctx, out: g };
  for (let b = 0; b < bars; b++) scheduleBar(v, b, 0.05 + b * BAR);
  return await ctx.startRendering();
}
