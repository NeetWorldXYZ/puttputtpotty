// Putt Putt Potty API: founds bathrooms (server-generated holes), caches
// daily-course holes, and verifies submitted runs by re-simulating them.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
// The engine (sim + solver + generator) is imported from a pinned commit of the public repo;
// bump the commit when server/potty/engine.js changes (npm run build:engine).
import { generateHole, generateSlot, courseSlots, replay, holeScore, DEFAULT_PARAMS } from 'https://raw.githubusercontent.com/NeetWorldXYZ/puttputtpotty/f3921839b455e445b9a2e693b40e17a44ec20002/server/potty/engine.js';

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

const HOLES_PER_COURSE = 3;
/** Difficulty ramp of a bathroom's three holes, by band. */
const COURSE_RAMP: Record<'easy' | 'medium' | 'hard', ('easy' | 'medium' | 'hard')[]> = {
  easy: ['easy', 'easy', 'medium'],
  medium: ['easy', 'medium', 'medium'],
  hard: ['medium', 'hard', 'hard'],
};

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

// ---- OpenStreetMap bathrooms (Overpass), fetched server-side and cached per ~500 m cell.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const OSM_TTL_MS = 24 * 3600 * 1000;
const OSM_TIMEOUT_MS = 14000;

type OsmPlace = { id: string; name: string; poiType: string; lat: number; lng: number };
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

function classify(tags: Record<string, string>): { poiType: string; label: string } | null {
  const a = tags.amenity;
  if (a === 'toilets') return { poiType: 'toilets', label: 'Public toilet' };
  if (a === 'fuel') return { poiType: 'fuel', label: 'Gas station' };
  if (a === 'fast_food') return { poiType: 'fast_food', label: 'Fast food' };
  if (a === 'bar' || a === 'pub' || a === 'nightclub') return { poiType: 'bar', label: a === 'nightclub' ? 'Club' : 'Bar' };
  if (a === 'restaurant' || a === 'cafe') return { poiType: 'restaurant', label: a === 'cafe' ? 'Cafe' : 'Restaurant' };
  if (tags.tourism === 'hotel' || tags.tourism === 'motel') return { poiType: 'hotel', label: 'Hotel' };
  if (tags.aeroway === 'terminal' || tags.aeroway === 'aerodrome') return { poiType: 'airport', label: 'Airport' };
  if (tags.leisure === 'stadium' || tags.building === 'stadium') return { poiType: 'stadium', label: 'Stadium' };
  if (tags.shop === 'supermarket' || tags.shop === 'mall' || tags.shop === 'department_store') return { poiType: 'retail', label: 'Store' };
  if (tags.highway === 'rest_area' || tags.highway === 'services') return { poiType: 'park', label: 'Rest stop' };
  return null;
}

function parsePlaces(elements: Element[]): OsmPlace[] {
  const out: OsmPlace[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const c = classify(tags);
    if (!c) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    out.push({ id: `osm:${el.type}:${el.id}`, name: tags.name || tags.brand || c.label, poiType: c.poiType, lat, lng });
  }
  return out;
}

const POI_TAGS: [string, string[]][] = [
  ['amenity', ['toilets', 'fuel', 'fast_food', 'bar', 'pub', 'nightclub', 'restaurant', 'cafe']],
  ['tourism', ['hotel', 'motel']],
  ['aeroway', ['terminal', 'aerodrome']],
  ['leisure', ['stadium']],
  ['shop', ['supermarket', 'mall', 'department_store']],
  ['highway', ['rest_area', 'services']],
];

/**
 * Nodes and ways only with exact tag values: `nwr` + regex + `around` makes
 * Overpass walk relation geometry and skip the value index, which is what
 * pushed the previous query past every mirror's patience.
 */
function overpassQuery(lat: number, lng: number, radius: number): string {
  const around = `(around:${radius},${lat},${lng})`;
  const clauses: string[] = [];
  for (const [k, vals] of POI_TAGS) for (const v of vals) clauses.push(`node["${k}"="${v}"]${around};way["${k}"="${v}"]${around};`);
  return `[out:json][timeout:12];(${clauses.join('')});out center 200;`;
}

// ---- Nominatim fallback: one category per request, inside a bounding box.
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_CATEGORIES: [string, string][] = [
  ['amenity', 'toilets'],
  ['amenity', 'fuel'],
  ['amenity', 'fast_food'],
  ['amenity', 'bar'],
  ['amenity', 'pub'],
  ['amenity', 'restaurant'],
  ['amenity', 'cafe'],
  ['tourism', 'hotel'],
  ['shop', 'supermarket'],
];

type TextFetcher = (url: string) => Promise<string>;

const edgeGet: TextFetcher = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'PuttPuttPotty/1.0 (bathroom mini golf; contact via github.com/NeetWorldXYZ/puttputtpotty)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return await res.text();
};
const dbGet: TextFetcher = (url) => dbFetch(url, null);

async function nominatimPlaces(lat: number, lng: number, radius: number, get: TextFetcher): Promise<OsmPlace[]> {
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
  const out: OsmPlace[] = [];
  const seen = new Set<string>();
  for (const [k, v] of NOMINATIM_CATEGORIES) {
    const url = `${NOMINATIM}?q=[${k}=${v}]&viewbox=${viewbox}&bounded=1&format=jsonv2&limit=50`;
    try {
      const rows = JSON.parse(await get(url)) as { osm_type: string; osm_id: number; lat: string; lon: string; name?: string; display_name?: string; category?: string; type?: string }[];
      for (const r of rows) {
        const id = `osm:${r.osm_type}:${r.osm_id}`;
        if (seen.has(id)) continue;
        const c = classify({ [k]: v });
        if (!c) continue;
        seen.add(id);
        out.push({ id, name: r.name || (r.display_name ?? '').split(',')[0] || c.label, poiType: c.poiType, lat: Number(r.lat), lng: Number(r.lon) });
      }
    } catch (e) {
      console.warn('nominatim failed', k, v, (e as Error).message);
    }
    // Nominatim's usage policy: at most one request per second.
    await new Promise((r) => setTimeout(r, 1100));
  }
  if (!out.length) throw new Error('Nominatim returned nothing');
  return out;
}

/**
 * Outbound request routed through Postgres (the `http` extension). The edge
 * runtime's own egress gets "connection refused" / timeouts from the Overpass
 * mirrors while the database reaches them in about a second.
 */
async function dbFetch(url: string, body: string | null): Promise<string> {
  const { data, error } = await admin.rpc('http_fetch_osm', { url, body });
  if (error) throw new Error(`db fetch: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { status: number; content: string } | undefined;
  if (!row) throw new Error('db fetch: empty');
  if (row.status !== 200) throw new Error(`db fetch: ${row.status}`);
  return row.content;
}

async function overpassViaDb(q: string): Promise<OsmPlace[]> {
  const errors: string[] = [];
  for (const url of OVERPASS.slice(0, 2)) {
    try {
      const text = await dbFetch(url, 'data=' + encodeURIComponent(q));
      const data = JSON.parse(text) as { elements?: Element[] };
      if (!Array.isArray(data.elements)) throw new Error('bad response');
      return parsePlaces(data.elements);
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
      console.warn('overpass via db failed', url, (e as Error).message);
    }
  }
  throw new Error(errors.join('; '));
}

async function overpassOne(url: string, q: string, signal: AbortSignal): Promise<OsmPlace[]> {
  const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PuttPuttPotty/1.0 (bathroom mini golf)' }, signal });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = (await res.json()) as { elements?: Element[] };
  if (!Array.isArray(data.elements)) throw new Error('overpass: bad response');
  return parsePlaces(data.elements);
}

/** Mirrors are raced; first good answer wins. */
function overpassRace(q: string): Promise<OsmPlace[]> {
  const controllers = OVERPASS.map(() => new AbortController());
  const timers = controllers.map((c) => setTimeout(() => c.abort(), OSM_TIMEOUT_MS));
  const errors: string[] = [];
  return new Promise<OsmPlace[]>((resolve, reject) => {
    let pending = OVERPASS.length;
    OVERPASS.forEach((url, i) => {
      overpassOne(url, q, controllers[i].signal).then(
        (places) => {
          controllers.forEach((c, j) => j !== i && c.abort());
          timers.forEach(clearTimeout);
          resolve(places);
        },
        (e: Error) => {
          errors.push(`${new URL(url).host}: ${e.name === 'AbortError' ? 'timed out' : e.message}`);
          console.warn('overpass mirror failed', url, e.message);
          if (--pending === 0) {
            timers.forEach(clearTimeout);
            reject(new Error(`OpenStreetMap is not answering (${errors.join('; ')})`));
          }
        },
      );
    });
  });
}

async function bathrooms(lat: number, lng: number, radius: number): Promise<{ places: OsmPlace[]; cached: boolean }> {
  const key = `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200},${radius}`;
  const { data: hit } = await admin.from('osm_cells').select('places, fetched_at').eq('key', key).maybeSingle();
  if (hit && Date.now() - new Date(hit.fetched_at).getTime() < OSM_TTL_MS) return { places: hit.places as OsmPlace[], cached: true };
  const q = overpassQuery(lat, lng, radius);
  const strategies: [string, () => Promise<OsmPlace[]>][] = [
    ['overpass-db', () => overpassViaDb(q)],
    ['overpass-edge', () => overpassRace(q)],
    ['nominatim-db', () => nominatimPlaces(lat, lng, radius, dbGet)],
    ['nominatim-edge', () => nominatimPlaces(lat, lng, radius, edgeGet)],
  ];
  let places: OsmPlace[] | null = null;
  let source = '';
  const errors: string[] = [];
  for (const [name, run] of strategies) {
    try {
      places = await run();
      source = name;
      break;
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
      console.warn('bathroom source failed', name, (e as Error).message);
    }
  }
  if (!places) throw new Error(`No bathroom source is answering (${errors.join(' | ')})`);
  console.log('bathrooms', key, source, places.length);
  await admin.from('osm_cells').upsert({ key, places, fetched_at: new Date().toISOString() });
  return { places, cached: false };
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
  if (existing && Array.isArray(existing.holes) && existing.holes.length === HOLES_PER_COURSE) return existing;
  const band = bandFor(loc.poiType, loc.id);
  // Three distinct archetypes from the course planner, difficulty from the band, one environment.
  const slots = courseSlots(loc.id, HOLES_PER_COURSE);
  const holes = slots.map((slot: { index: number; seed: string; archetype: string; difficulty: string; theme: string }, i: number) => {
    const g = generateSlot(loc.id, { ...slot, difficulty: COURSE_RAMP[band.difficulty][i], theme: band.theme });
    g.hole.theme = band.theme;
    g.hole.id = `${loc.id}#${i + 1}`;
    g.hole.name = `${loc.name} ${i + 1}`;
    return g.hole;
  });
  const par = holes.reduce((a: number, h: { par: number }) => a + h.par, 0);
  const row = {
    id: loc.id,
    name: (existing?.name ?? loc.name).slice(0, 80),
    poi_type: existing?.poi_type ?? loc.poiType,
    lat: existing?.lat ?? loc.lat,
    lng: existing?.lng ?? loc.lng,
    theme: band.theme,
    difficulty: band.difficulty,
    hole: holes[0],
    hole_par: holes[0].par,
    holes,
    par,
    founded_by: existing?.founded_by ?? userId,
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
      return json({ location: { id: row.id, name: row.name, poiType: row.poi_type, lat: row.lat, lng: row.lng, theme: row.theme, difficulty: row.difficulty }, hole: row.hole, holes: row.holes, par: row.par, king: throne });
    }

    if (action === 'bathrooms') {
      const { lat, lng, radius } = body;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'bad position' }, 400);
      const r = Math.min(20000, Math.max(500, typeof radius === 'number' ? Math.round(radius) : 3000));
      return json(await bathrooms(lat, lng, r));
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
      await ensureProfile(user.id);
      let holes: unknown[];
      let par: number;
      let strokeLists: Stroke[][];
      if (typeof locationId === 'string') {
        if (!Array.isArray(strokes) || strokes.length !== HOLES_PER_COURSE || !strokes.every(validStrokes)) return json({ error: 'bad strokes' }, 400);
        strokeLists = strokes as Stroke[][];
        const { data: loc } = await admin.from('locations').select('*').eq('id', locationId).maybeSingle();
        if (!loc || !Array.isArray(loc.holes) || loc.holes.length !== HOLES_PER_COURSE) return json({ error: 'unknown location' }, 404);
        holes = loc.holes;
        par = loc.par;
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
        if (!validStrokes(strokes)) return json({ error: 'bad strokes' }, 400);
        strokeLists = [strokes];
        const hole = await courseHole(courseSeed, holeIndex);
        holes = [hole];
        par = hole.par;
        const { data: dup } = await admin.from('runs').select('id').eq('user_id', user.id).eq('course_seed', courseSeed).eq('hole_index', holeIndex).maybeSingle();
        if (dup) return json({ error: 'already played this hole today' }, 409);
      } else return json({ error: 'nothing to submit to' }, 400);

      // Re-simulate every hole. The client's claimed score is ignored; the server's replay is the record.
      const holeScores: number[] = [];
      let sunk = true;
      for (let i = 0; i < holes.length; i++) {
        const st = replay(holes[i], 0, strokeLists[i], DEFAULT_PARAMS).state;
        if (!st.done) return json({ error: `hole ${i + 1} not finished` }, 400);
        holeScores.push(holeScore(st, (holes[i] as { par: number }).par));
        sunk = sunk && st.sunk;
      }
      const score = holeScores.reduce((a, b) => a + b, 0);
      const isLocation = typeof locationId === 'string';
      const { error } = await admin.from('runs').insert({
        user_id: user.id,
        location_id: isLocation ? locationId : null,
        course_seed: typeof courseSeed === 'string' ? courseSeed : null,
        hole_index: typeof holeIndex === 'number' ? holeIndex : 0,
        strokes: isLocation ? strokeLists : strokeLists[0],
        hole_scores: isLocation ? holeScores : null,
        score,
        par,
        season: currentSeason(),
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
      });
      if (error) return json({ error: error.message }, 500);
      let king = null;
      if (isLocation) {
        const { data } = await admin.from('thrones').select('*').eq('location_id', locationId).eq('season', currentSeason()).maybeSingle();
        king = data;
      }
      return json({ score, par, sunk, holeScores, king, isKing: king ? king.user_id === user.id : false });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error('potty error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
