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
    call<{ location: LocationSummary; holes: Hole[]; par: number; king: King | null }>({ action: 'hole', location }),
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
  async leaderboard(seed: string): Promise<{ user_id: string; display_name: string; total: number; holes: number; finished_at: string }[]> {
    const { data, error } = await supabase.rpc('course_leaderboard', { in_seed: seed, lim: 20 });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
