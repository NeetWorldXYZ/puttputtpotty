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
  distance_m: number;
  king_name: string | null;
  king_score: number | null;
  king_user: string | null;
  king_since: string | null;
  run_count: number;
}

export interface King {
  user_id: string;
  display_name: string;
  score: number;
  par: number;
  created_at: string;
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
  /** Founds the bathroom if needed and returns its (server-generated) hole and current king. */
  hole: (location: { id: string; name: string; poiType: string; lat: number; lng: number }) =>
    call<{ location: LocationSummary; hole: Hole; king: King | null }>({ action: 'hole', location }),
  checkin: (locationId: string, lat: number, lng: number, accuracy: number) =>
    call<{ ok: true; distance: number }>({ action: 'checkin', locationId, lat, lng, accuracy }),
  /** Bathrooms near a point, fetched from OpenStreetMap by the server and cached there. */
  bathrooms: (lat: number, lng: number, radius: number) => call<{ places: { id: string; name: string; poiType: string; lat: number; lng: number }[]; cached: boolean }>({ action: 'bathrooms', lat, lng, radius }),
  courseHole: (seed: string, index: number) => call<{ hole: Hole }>({ action: 'course-hole', seed, index }),
  submitLocation: (locationId: string, strokes: Stroke[], lat: number, lng: number, accuracy: number) =>
    call<{ score: number; par: number; sunk: boolean; king: King | null; isKing: boolean }>({ action: 'submit', locationId, strokes, lat, lng, accuracy }),
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
