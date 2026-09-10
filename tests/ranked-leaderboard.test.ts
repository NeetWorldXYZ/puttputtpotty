import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../src/net/supabase', () => ({ supabase: { rpc } }));
import { loadRankedLeaderboard } from '../src/net/rankedLeaderboard';

beforeEach(() => rpc.mockReset());

describe('ranked leaderboard', () => {
  it('includes a winner without throne data in the everybody result', async () => {
    const winner = { user_id: 'friend', display_name: 'Buddy', avatar: null, wins: 1 };
    rpc.mockResolvedValue({ data: [winner], error: null });
    expect(await loadRankedLeaderboard()).toEqual([winner]);
    expect(rpc).toHaveBeenCalledWith('ranked_wins_leaderboard', { in_users: null, lim: 50 });
  });

  it('filters friends on the same query before the server limits results', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await loadRankedLeaderboard(['me', 'friend']);
    expect(rpc).toHaveBeenCalledWith('ranked_wins_leaderboard', { in_users: ['me', 'friend'], lim: 50 });
  });

  it('does not turn an empty friend filter into everybody', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await loadRankedLeaderboard([]);
    expect(rpc).toHaveBeenCalledWith('ranked_wins_leaderboard', { in_users: [], lim: 50 });
  });

  it('reports a missing query instead of showing a misleading empty board', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'function unavailable' } });
    await expect(loadRankedLeaderboard()).rejects.toThrow('Ranked wins could not be loaded.');
  });
});
