/** Build-time only. Requires ffmpeg; the app never synthesizes its music. */
import engine from 'web-audio-engine';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BPM, renderTheme } from '../src/game/music';

Object.assign(globalThis, { OfflineAudioContext: engine.OfflineAudioContext });
// Deterministic percussion noise so rebuilding doesn't change the asset.
let seed = 0x505050;
Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
const rate = 44100;
const loopSeconds = 8 * 4 * 60 / BPM;
const rendered = await renderTheme(16, rate);
// The second pass includes the first pass's reverb/flush tails at the seam.
const samples = rendered.getChannelData(0).subarray(
  Math.round((.05 + loopSeconds) * rate), Math.round((.05 + 2 * loopSeconds) * rate),
);
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
let peak = 0;
for (let i = 0; i < samples.length; i++) {
  // Bake the existing music (.45) and master (.8) levels into the asset:
  // iOS doesn't consistently support setting media element volume.
  const value = samples[i] * .45 * .8;
  if (!Number.isFinite(value)) throw new Error('Invalid rendered sample');
  peak = Math.max(peak, Math.abs(value));
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
}
if (peak === 0 || peak >= 1) throw new Error(`Unexpected theme peak: ${peak}`);
const temp = mkdtempSync(join(tmpdir(), 'potty-theme-'));
try {
  const input = join(temp, 'theme.wav');
  writeFileSync(input, wav);
  mkdirSync('public/audio', { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'public/audio/potty-theme-v1.m4a']);
  console.log(`Rendered ${samples.length / rate}s theme, peak ${peak.toFixed(3)}`);
} finally { rmSync(temp, { recursive: true, force: true }); }
