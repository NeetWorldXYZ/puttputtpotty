import { rngNext, seedFromString } from '../sim/rng';

/** Small stateful wrapper around mulberry32 for the generator. */
export class Rng {
  state: number;
  constructor(seed: number | string) {
    this.state = (typeof seed === 'string' ? seedFromString(seed) : seed) >>> 0;
  }
  next(): number {
    const [s, v] = rngNext(this.state);
    this.state = s;
    return v;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  fork(label: string): Rng {
    return new Rng(seedFromString(`${this.state}:${label}`));
  }
}
