import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row { id: string; status: string; code: string | null; p1: string; p2: string | null; winner: string | null }
const db = vi.hoisted(() => ({ rows: [] as Row[], error: null as null | { message: string } }));
vi.mock('../src/net/supabase', () => ({ supabase: { from: () => {
  const filters: ((row: Row) => boolean)[] = [];
  const query = {
    select: () => query,
    eq: (key: keyof Row, value: string) => { filters.push(row => row[key] === value); return query; },
    is: (key: keyof Row, value: null) => { filters.push(row => row[key] === value); return query; },
    or: (expression: string) => {
      const pairs = expression.split(',').map(part => part.split('.eq.'));
      filters.push(row => pairs.some(([key, value]) => row[key as keyof Row] === value));
      return query;
    },
    then: (resolve: (value: { count: number | null; error: typeof db.error }) => unknown) => Promise.resolve(resolve({ count: db.error ? null : db.rows.filter(row => filters.every(filter => filter(row))).length, error: db.error })),
  };
  return query;
} } }));
import { loadRankedRecord } from '../src/net/rankedRecord';

const row = (id: string, changes: Partial<Row> = {}): Row => ({ id, status: 'done', code: null, p1: 'me', p2: 'opponent', winner: 'me', ...changes });
beforeEach(() => { db.rows = []; db.error = null; });
describe('ranked record', () => {
  it('counts both player seats, excluding invites, unfinished matches, and other players', async () => {
    db.rows = [row('win'), row('second-seat', { p1: 'opponent', p2: 'me' }), row('loss', { winner: 'opponent' }), row('draw', { winner: null }), row('friend', { code: 'ABCDEF' }), row('custom-friend', { code: 'CUSTOM', winner: 'opponent' }), row('waiting', { status: 'waiting', p2: null }), row('playing', { status: 'playing' }), row('cancelled', { status: 'cancelled' }), row('someone-else', { p1: 'a', p2: 'b', winner: 'a' })];
    expect(await loadRankedRecord('me')).toEqual({ played: 4, wins: 2, losses: 1, draws: 1, winRate: 50 });
  });
  it('treats an empty ranked history as a new player', async () => {
    db.rows = [row('friend-only', { code: 'FRIEND' })];
    expect(await loadRankedRecord('me')).toEqual({ played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 });
  });
  it('uses exact counts for histories larger than a returned-row page', async () => {
    db.rows = Array.from({ length: 1250 }, (_, i) => row(String(i)));
    expect((await loadRankedRecord('me')).played).toBe(1250);
  });
  it('reports failed reads instead of inventing a zero record', async () => {
    db.error = { message: 'offline' };
    await expect(loadRankedRecord('me')).rejects.toThrow('could not be loaded');
  });
});
