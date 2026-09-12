import type { Hole } from '../sim/types';

/** Bound even a stalled session lookup, and ignore results from abandoned loads. */
export function bounded<T>(task: Promise<T>, signal: AbortSignal, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Connection timed out')); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    task.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort();
  });
}

export async function loadMatchCourse(options: {
  count: number; cache: Hole[]; signal: AbortSignal;
  fetchHole: (index: number) => Promise<{ hole?: Hole; building?: boolean }>;
  onProgress: (ready: number, reconnecting: boolean) => void;
  timeoutMs?: number; delayMs?: number;
}): Promise<Hole[]> {
  const { count, cache, signal, fetchHole, onProgress, timeoutMs = 35000, delayMs = 600 } = options;
  for (let index = 0; index < count; index++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (cache[index]) continue;
    const deadline = Date.now() + 90000;
    let failures = 0;
    onProgress(index, false);
    for (let attempt = 0; attempt < 30 && !cache[index]; attempt++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Course preparation timed out');
      try {
        const result = await bounded(fetchHole(index), signal, Math.min(timeoutMs, remaining));
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        failures = 0;
        if (result.hole) { cache[index] = result.hole; onProgress(index + 1, false); }
        else if (!result.building) throw new Error('Course response was incomplete');
      } catch (error) {
        if (signal.aborted) throw error;
        if (++failures >= 3) throw error;
        onProgress(index, true);
      }
      if (!cache[index]) await bounded(new Promise(resolve => setTimeout(resolve, delayMs * Math.max(1, failures))), signal, Math.max(1, deadline - Date.now()));
    }
    if (!cache[index]) throw new Error('Course preparation timed out');
  }
  return cache.slice(0, count);
}
