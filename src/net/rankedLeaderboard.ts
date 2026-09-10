import { supabase } from './supabase';
import type { Avatar } from '../game/avatarParts';

export interface RankedWinner {
  user_id: string;
  display_name: string;
  avatar: Avatar | null;
  wins: number;
}

/** Both views use the same counts; filter before the server applies its limit. */
export async function loadRankedLeaderboard(playerIds: string[] | null = null): Promise<RankedWinner[]> {
  const { data, error } = await supabase.rpc('ranked_wins_leaderboard', {
    in_users: playerIds,
    lim: 50,
  });
  if (error) throw new Error('Ranked wins could not be loaded.');
  return data ?? [];
}
