import { expect, it, vi } from 'vitest';
import { ThroneAttempt } from '../src/net/throneAttempt';

it('concedes the correct clock even when leaving before start answers', async () => {
  let resolve!: (value: { startedAt: string }) => void;
  const begin = vi.fn(() => new Promise<{ startedAt: string }>(r => { resolve = r; }));
  const cancel = vi.fn(async () => {});
  const attempt = new ThroneAttempt(begin, cancel);
  attempt.mount();
  const first = attempt.start();
  expect(attempt.start()).toBe(first);
  const exit = attempt.concede();
  expect(cancel).not.toHaveBeenCalled();
  resolve({ startedAt: 'clock-1' });
  await exit;
  expect(begin).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledWith('clock-1');
  await attempt.concede();
  expect(cancel).toHaveBeenCalledOnce();
});

it('ignores StrictMode cleanup but concedes an actual navigation away', async () => {
  const cancel = vi.fn(async () => {});
  const attempt = new ThroneAttempt(async () => ({ startedAt: 'clock-2' }), cancel);
  attempt.mount(); await attempt.start();
  attempt.dispose(); attempt.mount();
  await Promise.resolve();
  expect(cancel).not.toHaveBeenCalled();
  attempt.dispose();
  await Promise.resolve(); await Promise.resolve();
  expect(cancel).toHaveBeenCalledWith('clock-2');
});

it('preserves a completed result and allows failed cancellation to retry', async () => {
  const cancel = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const attempt = new ThroneAttempt(async () => ({ startedAt: 'clock-3' }), cancel);
  await attempt.start();
  await expect(attempt.concede()).rejects.toThrow('offline');
  await attempt.concede();
  expect(cancel).toHaveBeenCalledTimes(2);
  const saved = new ThroneAttempt(async () => ({ startedAt: 'clock-4' }), cancel);
  await saved.start(); saved.finish(); saved.dispose();
  await saved.concede(); await Promise.resolve();
  expect(cancel).toHaveBeenCalledTimes(2);
});
