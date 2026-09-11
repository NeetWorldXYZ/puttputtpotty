import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), rows: vi.fn() }));
vi.mock('../src/net/supabase', () => ({
  ensureSession: async () => ({ user: { id: 'me' } }),
  quickToken: async () => null,
  supabase: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ eq: mocks.rows }) }) }) },
}));
import { api } from '../src/net/api';
import { getBest, recordBest } from '../src/game/courses';
import { queueDaily } from '../src/net/dailyOutbox';
const seed = '2026-09-11-pm';
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  vi.spyOn(api, 'syncDaily').mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  recordBest(seed, 35);
  recordBest('other-course', 29);
});
describe('reset daily attempt', () => {
  it('clears only the local score of a confirmed deleted attempt', async () => {
    mocks.rows.mockResolvedValue({ count: 0, error: null });
    expect(await api.dailyStanding(seed)).toBeNull();
    expect(getBest(seed)).toBeNull();
    expect(getBest('other-course')).toBe(29);
  });
  it('keeps incomplete attempts and failed status checks', async () => {
    mocks.rows.mockResolvedValue({ count: 7, error: null });
    await api.dailyStanding(seed);
    expect(getBest(seed)).toBe(35);
    mocks.rows.mockResolvedValue({ count: null, error: { message: 'offline' } });
    await api.dailyStanding(seed);
    expect(getBest(seed)).toBe(35);
  });
  it('keeps an offline result with shots still waiting to sync', async () => {
    queueDaily({ user: 'me', seed, index: 0, strokes: [] });
    mocks.rows.mockResolvedValue({ count: 0, error: null });
    await api.dailyStanding(seed);
    expect(getBest(seed)).toBe(35);
  });
});
