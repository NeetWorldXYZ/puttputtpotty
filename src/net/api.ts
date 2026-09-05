import type { Hole, Stroke } from '../sim/types';
import { FUNCTION_URL } from './config';
import { ensureSession, supabase } from './supabase';

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
  run_count: number;
}

export interface King {
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
}

export interface KingRow {
  user_id: string;
  display_name: string;
  thrones: number;
  best_rel: number;
  last_win: string;
}

export interface LocationRow {
  rank: number;
  user_id: string;
  display_name: string;
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

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const session = await ensureSession();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `request failed (${res.status})`);
  return data;
}

export const api = {
  setProfile: (displayName: string) => call<{ ok: true }>({ action: 'profile', displayName }),
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
    const { data, error } = await supabase.rpc('nearby_locations', { in_lat: lat, in_lng: lng, radius_m: radiusM });
    if (error) throw new Error(error.message);
    return (data ?? []) as NearbyLocation[];
  },
  submitMatch: (matchId: string, strokes: Stroke[][]) =>
    call<{ score: number; holeScores: number[]; elapsedMs: number; done: boolean; winner: string | null }>({ action: 'submit', matchId, strokes }),

  async findMatch(): Promise<MatchRow> {
    await ensureSession();
    const { data, error } = await supabase.rpc('find_match');
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as MatchRow;
  },
  async createInvite(): Promise<MatchRow> {
    await ensureSession();
    const { data, error } = await supabase.rpc('create_invite');
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
  async leaderboard(seed: string): Promise<{ user_id: string; display_name: string; total: number; holes: number; finished_at: string }[]> {
    const { data, error } = await supabase.rpc('course_leaderboard', { in_seed: seed, lim: 20 });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
