import { supabase } from './supabase';

export interface RankedRecord {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

/** Only the random-opponent queue creates matches without an invite code. */
export async function loadRankedRecord(playerId: string): Promise<RankedRecord> {
  const completed = () => supabase.from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'done')
    .is('code', null)
    .or(`p1.eq.${playerId},p2.eq.${playerId}`);
  // Exact counts avoid the API row limit; RLS also restricts these to the player.
  const results = await Promise.all([
    completed(),
    completed().eq('winner', playerId),
    completed().is('winner', null),
  ]);
  for (const result of results) {
    if (result.error || result.count === null) throw new Error('Your ranked record could not be loaded.');
  }
  const wins = results[1].count!;
  const draws = results[2].count!;
  // A match may finish between the three reads. Never show a negative loss.
  const played = Math.max(results[0].count!, wins + draws);
  return { played, wins, draws, losses: played - wins - draws, winRate: played ? Math.round(wins / played * 100) : 0 };
}
