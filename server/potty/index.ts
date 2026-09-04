// Putt Putt Potty API: founds bathrooms (server-generated holes), caches
// daily-course holes, and verifies submitted runs by re-simulating them.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateHole, generateSlot, courseSlots, replay, holeScore, DEFAULT_PARAMS } from './engine.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CLAIM_RADIUS_M = 50;
const MAX_ACCURACY_M = 150;
const DWELL_SECONDS = 60;
const CHECKIN_MAX_AGE_S = 45 * 60;
const COOLDOWN_HOURS = 4;
const MAX_SPEED_MPS = 70;
const STROKE_CAP = 8;
const EPOCH = Date.UTC(2026, 8, 1); // 2026-09-01

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function currentSeason(): number {
  return Math.floor((Date.now() - EPOCH) / (6 * 7 * 24 * 3600 * 1000)) + 1;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** POI type -> environment + difficulty band (design doc section 11). */
function bandFor(poiType: string, id: string): { theme: string; difficulty: 'easy' | 'medium' | 'hard' } {
  switch (poiType) {
    case 'fuel':
      return { theme: 'gasStation', difficulty: 'easy' };
    case 'fast_food':
      return { theme: 'portaPotty', difficulty: 'easy' };
    case 'bar':
    case 'pub':
    case 'nightclub':
      return { theme: 'diveBar', difficulty: 'medium' };
    case 'restaurant':
    case 'cafe':
      return { theme: 'office', difficulty: 'medium' };
    case 'retail':
      return { theme: 'office', difficulty: 'hard' };
    case 'hotel':
      return { theme: 'luxuryHotel', difficulty: 'medium' };
    case 'airport':
      return { theme: 'airport', difficulty: 'hard' };
    case 'park':
      return { theme: 'tropical', difficulty: 'hard' };
    case 'stadium':
      return { theme: 'stadium', difficulty: 'hard' };
    default: {
      // Standalone public toilets get one of the absurd bathrooms, chosen by id.
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      const absurd = ['haunted', 'castle', 'spaceship', 'grandma'];
      return { theme: absurd[h % absurd.length], difficulty: 'medium' };
    }
  }
}

type Stroke = { angle: number; power: number; t?: number };

function validStrokes(v: unknown): v is Stroke[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > STROKE_CAP + 2) return false;
  return v.every((s) => s && typeof s.angle === 'number' && Number.isFinite(s.angle) && typeof s.power === 'number' && s.power >= 0 && s.power <= 1 && (s.t === undefined || (typeof s.t === 'number' && Number.isFinite(s.t))));
}

async function userFrom(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function ensureProfile(userId: string, displayName?: string): Promise<void> {
  const { data } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!data) await admin.from('profiles').insert({ id: userId, display_name: displayName?.slice(0, 24) || 'Anonymous Potty' });
  else if (displayName) await admin.from('profiles').update({ display_name: displayName.slice(0, 24) }).eq('id', userId);
}

async function ensureLocation(loc: { id: string; name: string; poiType: string; lat: number; lng: number }, userId: string) {
  const { data: existing } = await admin.from('locations').select('*').eq('id', loc.id).maybeSingle();
  if (existing && existing.hole) return existing;
  const band = bandFor(loc.poiType, loc.id);
  const g = generateHole({ seed: loc.id, difficulty: band.difficulty });
  g.hole.theme = band.theme;
  g.hole.id = loc.id;
  g.hole.name = loc.name;
  const row = {
    id: loc.id,
    name: loc.name.slice(0, 80),
    poi_type: loc.poiType,
    lat: loc.lat,
    lng: loc.lng,
    theme: band.theme,
    difficulty: band.difficulty,
    hole: g.hole,
    hole_par: g.hole.par,
    founded_by: userId,
  };
  const { data, error } = await admin.from('locations').upsert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

async function courseHole(seed: string, index: number) {
  const { data: cached } = await admin.from('course_holes').select('hole, par').eq('seed', seed).eq('hole_index', index).maybeSingle();
  if (cached) return cached.hole;
  const slot = courseSlots(seed, 9)[index];
  if (!slot) throw new Error('bad hole index');
  const g = generateSlot(seed, slot);
  await admin.from('course_holes').upsert({ seed, hole_index: index, hole: g.hole, par: g.hole.par });
  return g.hole;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await userFrom(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await req.json();
    const action = body.action as string;

    if (action === 'profile') {
      await ensureProfile(user.id, typeof body.displayName === 'string' ? body.displayName : undefined);
      return json({ ok: true });
    }

    if (action === 'hole') {
      const loc = body.location;
      if (!loc || typeof loc.id !== 'string' || !/^osm:(node|way|relation):\d+$/.test(loc.id) || typeof loc.lat !== 'number' || typeof loc.lng !== 'number')
        return json({ error: 'bad location' }, 400);
      await ensureProfile(user.id);
      const row = await ensureLocation({ id: loc.id, name: String(loc.name ?? 'Bathroom'), poiType: String(loc.poiType ?? 'toilets'), lat: loc.lat, lng: loc.lng }, user.id);
      const { data: throne } = await admin.from('thrones').select('*').eq('location_id', row.id).eq('season', currentSeason()).maybeSingle();
      return json({ location: { id: row.id, name: row.name, poiType: row.poi_type, lat: row.lat, lng: row.lng, theme: row.theme, difficulty: row.difficulty }, hole: row.hole, king: throne });
    }

    if (action === 'checkin') {
      const { locationId, lat, lng, accuracy } = body;
      if (typeof locationId !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'bad checkin' }, 400);
      const { data: loc } = await admin.from('locations').select('lat,lng').eq('id', locationId).maybeSingle();
      if (!loc) return json({ error: 'unknown location' }, 404);
      const dist = haversine(lat, lng, loc.lat, loc.lng);
      const acc = typeof accuracy === 'number' ? accuracy : 999;
      if (acc > MAX_ACCURACY_M) return json({ error: `GPS accuracy too low (${Math.round(acc)} m)` }, 400);
      if (dist > CLAIM_RADIUS_M + Math.min(acc, CLAIM_RADIUS_M)) return json({ error: `too far away (${Math.round(dist)} m)`, distance: dist }, 400);
      await ensureProfile(user.id);
      await admin.from('checkins').upsert({ user_id: user.id, location_id: locationId, lat, lng, accuracy: acc, at: new Date().toISOString() });
      return json({ ok: true, distance: dist });
    }

    if (action === 'course-hole') {
      const { seed, index } = body;
      if (typeof seed !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(seed) || typeof index !== 'number') return json({ error: 'bad course' }, 400);
      return json({ hole: await courseHole(seed, index) });
    }

    if (action === 'submit') {
      const { locationId, courseSeed, holeIndex, strokes, lat, lng, accuracy } = body;
      if (!validStrokes(strokes)) return json({ error: 'bad strokes' }, 400);
      await ensureProfile(user.id);
      let hole;
      let par: number;
      if (typeof locationId === 'string') {
        const { data: loc } = await admin.from('locations').select('*').eq('id', locationId).maybeSingle();
        if (!loc || !loc.hole) return json({ error: 'unknown location' }, 404);
        hole = loc.hole;
        par = loc.hole_par;
        if (typeof lat !== 'number' || typeof lng !== 'number') return json({ error: 'no position' }, 400);
        const acc = typeof accuracy === 'number' ? accuracy : 999;
        if (acc > MAX_ACCURACY_M) return json({ error: 'GPS accuracy too low' }, 400);
        const dist = haversine(lat, lng, loc.lat, loc.lng);
        if (dist > CLAIM_RADIUS_M + Math.min(acc, CLAIM_RADIUS_M)) return json({ error: `too far away (${Math.round(dist)} m)` }, 400);
        // Dwell: a check-in at this location at least DWELL_SECONDS ago and not stale.
        const { data: ci } = await admin.from('checkins').select('at').eq('user_id', user.id).eq('location_id', locationId).maybeSingle();
        if (!ci) return json({ error: 'check in first' }, 400);
        const age = (Date.now() - new Date(ci.at).getTime()) / 1000;
        if (age < DWELL_SECONDS) return json({ error: `stay a little longer (${Math.ceil(DWELL_SECONDS - age)} s)` }, 400);
        if (age > CHECKIN_MAX_AGE_S) return json({ error: 'check-in expired, check in again' }, 400);
        // Cooldown per location.
        const { data: last } = await admin.from('runs').select('created_at').eq('user_id', user.id).eq('location_id', locationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (last) {
          const hrs = (Date.now() - new Date(last.created_at).getTime()) / 3600000;
          if (hrs < COOLDOWN_HOURS) return json({ error: `come back in ${Math.ceil((COOLDOWN_HOURS - hrs) * 60)} min` }, 429);
        }
        // Impossible travel vs the user's previous located run.
        const { data: prev } = await admin.from('runs').select('lat,lng,created_at').eq('user_id', user.id).not('lat', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (prev && prev.lat !== null) {
          const d = haversine(lat, lng, prev.lat, prev.lng);
          const dt = (Date.now() - new Date(prev.created_at).getTime()) / 1000;
          if (dt > 0 && d / dt > MAX_SPEED_MPS) return json({ error: 'moved too fast between bathrooms' }, 400);
        }
      } else if (typeof courseSeed === 'string' && typeof holeIndex === 'number') {
        hole = await courseHole(courseSeed, holeIndex);
        par = hole.par;
        const { data: dup } = await admin.from('runs').select('id').eq('user_id', user.id).eq('course_seed', courseSeed).eq('hole_index', holeIndex).maybeSingle();
        if (dup) return json({ error: 'already played this hole today' }, 409);
      } else return json({ error: 'nothing to submit to' }, 400);

      // Re-simulate. The client's claimed score is ignored; the server's replay is the record.
      const seed = 0;
      const r = replay(hole, seed, strokes, DEFAULT_PARAMS);
      const st = r.state;
      if (!st.done) return json({ error: 'run not finished' }, 400);
      const score = holeScore(st, par);
      const { error } = await admin.from('runs').insert({
        user_id: user.id,
        location_id: typeof locationId === 'string' ? locationId : null,
        course_seed: typeof courseSeed === 'string' ? courseSeed : null,
        hole_index: typeof holeIndex === 'number' ? holeIndex : 0,
        strokes,
        score,
        par,
        season: currentSeason(),
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      });
      if (error) return json({ error: error.message }, 500);
      let king = null;
      if (typeof locationId === 'string') {
        const { data } = await admin.from('thrones').select('*').eq('location_id', locationId).eq('season', currentSeason()).maybeSingle();
        king = data;
      }
      return json({ score, par, sunk: st.sunk, king, isKing: king ? king.user_id === user.id : false });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
