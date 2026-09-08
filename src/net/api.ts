import type { Hole, Stroke } from '../sim/types';
import { FUNCTION_URL, SUPABASE_KEY, SUPABASE_URL } from './config';
import { ensureSession, quickToken, supabase } from './supabase';
import type { Avatar } from '../game/avatarParts';

export interface NearbyLocation {
  id: string;
  name: string;
  poi_type: string;
  lat: number;
  lng: number;
  theme: string;
  difficulty: string;
  hole_par: number | null;
  /** Course par over the bathroom's three holes. */
  par: number | null;
  distance_m: number;
  king_name: string | null;
  king_score: number | null;
  king_user: string | null;
  king_since: string | null;
  king_holes: number[] | null;
  king_elapsed_ms: number | null;
  king_avatar: Avatar | null;
  run_count: number;
}

export interface King {
  avatar?: Avatar | null;
  user_id: string;
  display_name: string;
  score: number;
  par: number;
  hole_scores: number[] | null;
  elapsed_ms: number | null;
  created_at: string;
}

/** m:ss for round times. */
export function fmtElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const HOLES_PER_COURSE = 3;

export interface MatchRow {
  id: string;
  seed: string;
  code: string | null;
  status: 'waiting' | 'playing' | 'done' | 'cancelled';
  holes: number;
  p1: string;
  p2: string | null;
  p1_name?: string | null;
  p2_name?: string | null;
  p1_score: number | null;
  p1_holes: number[] | null;
  p1_elapsed_ms: number | null;
  p2_score: number | null;
  p2_holes: number[] | null;
  p2_elapsed_ms: number | null;
  winner: string | null;
  forfeit: boolean;
  started_at: string | null;
  finished_at: string | null;
  p1_avatar: Avatar | null;
  p2_avatar: Avatar | null;
}

export interface KingRow {
  user_id: string;
  display_name: string;
  avatar: Avatar | null;
  thrones: number;
  best_rel: number;
  aces: number;
  last_win: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  slogan: string | null;
  avatar: Avatar | null;
  since: string;
  thrones: number;
  aces: number;
  runs: number;
  best_rel: number | null;
  matches_won: number;
  matches: number;
  throne_list: { location_id: string; name: string; poi_type: string; score: number; par: number; elapsed_ms: number | null; since: string }[];
}

export interface DailyRow {
  user_id: string;
  display_name: string;
  avatar: Avatar | null;
  total: number;
  holes: number;
  /** Simulated rolling time over the round, the tiebreak. */
  elapsed_ms: number;
  finished_at: string;
}

export interface LocationRow {
  rank: number;
  user_id: string;
  display_name: string;
  avatar: Avatar | null;
  score: number;
  par: number;
  hole_scores: number[] | null;
  elapsed_ms: number | null;
  played_at: string;
}

export interface LocationSummary {
  id: string;
  name: string;
  poiType: string;
  lat: number;
  lng: number;
  theme: string;
  difficulty: string;
}

const CALL_TIMEOUT_MS = 30000;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const token = (await quickToken(2000)) ?? (await ensureSession()).access_token;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`);
    return data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('the server is slow to answer');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A read-only RPC over plain fetch: no auth-client lock to wait on, a hard
 * timeout per attempt, and retries with backoff. Used for the reads the map
 * cannot live without.
 */
async function readRpc<T>(fn: string, params: Record<string, unknown>, opts: { timeoutMs?: number; attempts?: number } = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 7000;
  const attempts = opts.attempts ?? 3;
  const delays = [1500, 4000];
  let lastErr: Error = new Error('unreachable');
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const token = i === 0 ? await quickToken(1000) : null;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${token ?? SUPABASE_KEY}` },
        body: JSON.stringify(params),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        const e = new Error(err.message ?? `request failed (${res.status})`);
        if (res.status < 500 && res.status !== 408 && res.status !== 429) throw e;
        lastErr = e;
      } else return (await res.json()) as T;
    } catch (e) {
      lastErr = (e as Error).name === 'AbortError' ? new Error('no answer from the server') : (e as Error);
    } finally {
      clearTimeout(timer);
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delays[Math.min(i, delays.length - 1)]));
  }
  throw lastErr;
}

export const api = {
  setProfile: (displayName?: string, slogan?: string, avatar?: Avatar) => call<{ ok: true }>({ action: 'profile', displayName, slogan, avatar }),
  /** Flag a name or slogan; three different reporters reset it. */
  report: (userId: string, reason: 'name' | 'slogan' | 'cheating' | 'other') => call<{ ok: true; reset: boolean }>({ action: 'report', userId, reason }),
  /** Founds the bathroom if needed and returns its (server-generated) three holes and current king. */
  hole: (location: { id: string; name: string; poiType: string; lat: number; lng: number }) =>
    call<{ location: LocationSummary; ready: boolean; holes: Hole[]; par: number | null; building?: number; king: King | null }>({ action: 'hole', location }),
  checkin: (locationId: string, lat: number, lng: number, accuracy: number) =>
    call<{ ok: true; distance: number }>({ action: 'checkin', locationId, lat, lng, accuracy }),
  /** Bathrooms near a point, fetched from OpenStreetMap by the server and cached there. */
  bathrooms: (lat: number, lng: number, radius: number) => call<{ places: { id: string; name: string; poiType: string; lat: number; lng: number }[]; cached: boolean }>({ action: 'bathrooms', lat, lng, radius }),
  courseHole: (seed: string, index: number) => call<{ hole: Hole }>({ action: 'course-hole', seed, index }),
  /** Starts the server-side round clock for a throne run (needs a check-in). */
  start: (locationId: string) => call<{ ok: true; startedAt: string }>({ action: 'start', locationId }),
  /** One stroke list per hole, in order. The server replays all three. */
  submitLocation: (locationId: string, strokes: Stroke[][], lat: number, lng: number, accuracy: number) =>
    call<{ score: number; par: number; sunk: boolean; holeScores: number[]; elapsedMs: number | null; king: King | null; isKing: boolean }>({ action: 'submit', locationId, strokes, lat, lng, accuracy }),
  submitDaily: (courseSeed: string, holeIndex: number, strokes: Stroke[]) =>
    call<{ score: number; par: number; sunk: boolean }>({ action: 'submit', courseSeed, holeIndex, strokes }),

  async nearby(lat: number, lng: number, radiusM = 2500): Promise<NearbyLocation[]> {
    const rows = await readRpc<NearbyLocation[] | null>('nearby_locations', { in_lat: lat, in_lng: lng, radius_m: radiusM });
    return rows ?? [];
  },
  submitMatch: (matchId: string, strokes: Stroke[][]) =>
    call<{ score: number; holeScores: number[]; elapsedMs: number; done: boolean; winner: string | null }>({ action: 'submit', matchId, strokes }),

  async findMatch(): Promise<MatchRow> {
    await ensureSession();
    const { data, error } = await supabase.rpc('find_match');
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as MatchRow;
  },
  async createInvite(holes = 9): Promise<MatchRow> {
    await ensureSession();
    const { data, error } = await supabase.rpc('create_invite', { in_holes: holes });
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as MatchRow;
  },
  async joinInvite(code: string): Promise<MatchRow> {
    await ensureSession();
    const { data, error } = await supabase.rpc('join_invite', { in_code: code });
    if (error) throw new Error(error.message.replace(/^.*?: /, ''));
    return (Array.isArray(data) ? data[0] : data) as MatchRow;
  },
  async cancelMatch(id: string): Promise<void> {
    await supabase.rpc('cancel_match', { in_id: id });
  },
  async matchState(id: string): Promise<MatchRow> {
    const { data, error } = await supabase.rpc('match_state', { in_id: id });
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as MatchRow;
  },
  async kings(opts: { lat?: number; lng?: number; radiusM?: number; limit?: number } = {}): Promise<KingRow[]> {
    const { data, error } = await supabase.rpc('kings_leaderboard', { in_lat: opts.lat ?? null, in_lng: opts.lng ?? null, radius_m: opts.radiusM ?? null, lim: opts.limit ?? 50 });
    if (error) throw new Error(error.message);
    return (data ?? []) as KingRow[];
  },
  async locationBoard(locationId: string, limit = 20): Promise<LocationRow[]> {
    const { data, error } = await supabase.rpc('location_leaderboard', { in_location: locationId, lim: limit });
    if (error) throw new Error(error.message);
    return (data ?? []) as LocationRow[];
  },
  /** A bathroom the map doesn't know about, at your feet. */
  found: (name: string, poiType: string, lat: number, lng: number, accuracy: number) =>
    call<{ location: { id: string; name: string; poiType: string; lat: number; lng: number } }>({ action: 'found', name, poiType, lat, lng, accuracy }),
  /** Six digits another phone can enter to take over this account. */
  linkCode: () => call<{ code: string; expiresAt: string }>({ action: 'link-code' }),
  linkClaim: (code: string) => call<{ ok: true; displayName: string }>({ action: 'link-claim', code }),
  /** A player's public page: identity, season stats and thrones held. */
  async profile(userId: string): Promise<PlayerProfile | null> {
    return await readRpc<PlayerProfile | null>('player_profile', { in_user: userId });
  },
  async leaderboard(seed: string): Promise<DailyRow[]> {
    const { data, error } = await supabase.rpc('course_leaderboard', { in_seed: seed, lim: 20 });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
