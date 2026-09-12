import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMatchCourse } from '../src/game/loadMatchCourse';
import { emptyHole, type Hole } from '../src/sim/types';

afterEach(() => vi.useRealTimers());
describe('match course recovery', () => {
  it('keeps six ready holes after a failure and retries only hole seven onward', async () => {
    const cache: Hole[] = [];
    const fetchHole = vi.fn(async (i: number) => {
      if (i === 6) throw new Error('Load failed');
      return { hole: emptyHole(String(i)) };
    });
    const options = { count: 9, cache, signal: new AbortController().signal, fetchHole, onProgress: vi.fn(), delayMs: 0 };
    await expect(loadMatchCourse(options)).rejects.toThrow('Load failed');
    expect(cache).toHaveLength(6);
    const retry = vi.fn(async (i: number) => ({ hole: emptyHole(String(i)) }));
    expect(await loadMatchCourse({ ...options, fetchHole: retry })).toHaveLength(9);
    expect(retry.mock.calls.map(args => args[0])).toEqual([6, 7, 8]);
  });
  it('recovers a transient failure and waits for server generation', async () => {
    const fetchHole = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ building: true }).mockResolvedValue({ hole: emptyHole('ready') });
    const progress = vi.fn();
    const holes = await loadMatchCourse({ count: 1, cache: [], signal: new AbortController().signal, fetchHole, onProgress: progress, delayMs: 0 });
    expect(holes).toHaveLength(1);
    expect(progress).toHaveBeenCalledWith(0, true);
    expect(progress).toHaveBeenLastCalledWith(1, false);
  });
  it('rejects stalled requests instead of leaving an endless loader', async () => {
    vi.useFakeTimers();
    const task = loadMatchCourse({ count: 1, cache: [], signal: new AbortController().signal, fetchHole: () => new Promise(() => {}), onProgress: vi.fn(), timeoutMs: 10, delayMs: 1 });
    const assertion = expect(task).rejects.toThrow('Connection timed out');
    await vi.runAllTimersAsync();
    await assertion;
  });
  it('ignores a late response after navigating away', async () => {
    const controller = new AbortController();
    const cache: Hole[] = [];
    let finish!: (value: { hole: Hole }) => void;
    const task = loadMatchCourse({ count: 1, cache, signal: controller.signal, fetchHole: () => new Promise(resolve => { finish = resolve; }), onProgress: vi.fn() });
    controller.abort();
    await expect(task).rejects.toMatchObject({ name: 'AbortError' });
    finish({ hole: emptyHole('late') });
    await Promise.resolve();
    expect(cache).toEqual([]);
  });
});
