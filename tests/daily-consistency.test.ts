import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dailySeed, secondsUntilNextDaily } from '../src/generator/generator';
import { queueDaily, pendingDaily, acknowledgeDaily } from '../src/net/dailyOutbox';

describe('one daily course per Eastern day', () => {
  it('does not rotate at noon', () => {
    expect(dailySeed(new Date('2026-09-11T15:59:59Z'))).toBe(dailySeed(new Date('2026-09-11T16:00:00Z')));
    expect(secondsUntilNextDaily(new Date('2026-09-11T16:00:00Z'))).toBe(43200);
  });
  it('rotates at Eastern midnight in summer and winter', () => {
    expect(dailySeed(new Date('2026-09-12T03:59:59Z'))).not.toBe(dailySeed(new Date('2026-09-12T04:00:00Z')));
    expect(dailySeed(new Date('2026-12-12T04:59:59Z'))).not.toBe(dailySeed(new Date('2026-12-12T05:00:00Z')));
  });
});
describe('daily submission recovery', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
  });
  it('keeps the first attempt until acknowledged and separates accounts', () => {
    const hole = { user: 'a', seed: '2026-09-11-pm', index: 0, strokes: [] };
    queueDaily(hole);
    queueDaily({ ...hole, user: 'b' });
    expect(queueDaily({ ...hole, strokes: [{ angle: 1, power: 2 }] })).toEqual(hole);
    acknowledgeDaily(hole);
    expect(pendingDaily()).toEqual([{ ...hole, user: 'b' }]);
  });
});
