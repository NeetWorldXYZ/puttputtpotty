// Putt Putt Potty API: founds bathrooms (server-generated holes), caches
// daily-course holes, and verifies submitted runs by re-simulating them.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
// The engine (sim + solver + generator) is imported from a pinned commit of the public repo;
// bump the commit when server/potty/engine.js changes (npm run build:engine).
import { generateHole, generateSlot, courseSlots, replay, holeScore, DEFAULT_PARAMS, nameProblem, sloganProblem, normalizeAvatar, solveHole } from 'https://raw.githubusercontent.com/NeetWorldXYZ/puttputtpotty/8993d37b72e4cca0b182f62261ad1f51df2398ba/server/potty/engine.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CLAIM_RADIUS_M = 25;
const MAX_ACCURACY_M = 150;
const CHECKIN_MAX_AGE_S = 45 * 60;
const COOLDOWN_HOURS = 1;
const MAX_SPEED_MPS = 70;
const STROKE_CAP = 8;
const FOUND_PER_DAY = 5;
const REPORTS_PER_DAY = 10;
const REPORTS_TO_RESET = 3;
/** Distinct players agreeing on a report (closed, renamed, wrong) before it is applied; an admin does it alone. */
const PLACE_REPORTS_TO_APPLY = 3;
/** How far from their own position a player may drop a new place's pin. Admins have no limit. */
const PIN_DRIFT_M = 200;
/** Two places this close with the same name are one place. */
const SAME_PLACE_M = 25;
const LINK_CODE_TTL_MIN = 10;
/** Light solver settings for a bot's hole: well inside the edge CPU budget. */
const BOT_SOLVE = { randomShots: 40, randomCone: (75 * Math.PI) / 180, randomPlays: 10, runs: 6, candidatesPerStroke: 10, strongRuns: 1, strongCandidates: 24, trapProbeShots: 6 };
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
/** Edge functions get ~2 s of CPU per request, so a course is built one hole (two attempts) per request. */
const GEN_ATTEMPTS_PER_REQUEST = 2;
const GEN_MAX_TRIES = 5;
const GEN_SOLVE = { randomShots: 60, randomPlays: 24, runs: 4, candidatesPerStroke: 10, strongRuns: 1, trapProbeShots: 10 };
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
const OSM_TIMEOUT_MS = 12000;

type OsmPlace = { id: string; name: string; poiType: string; lat: number; lng: number };
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

function classify(tags: Record<string, string>): { poiType: string; label: string } | null {
  // Mappers retag closed businesses (disused:amenity=*) or flag them; neither is a place to play.
  if (tags.disused === 'yes' || tags.abandoned === 'yes' || tags['disused:amenity'] || tags['abandoned:amenity'] || tags.end_date) return null;
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

/** First promise to succeed wins; if all fail, one error carrying every reason. */
async function firstSuccess<T>(tasks: [string, () => Promise<T>][]): Promise<T> {
  const errors: string[] = [];
  return await Promise.any(
    tasks.map(([name, run]) =>
      run().catch((e: Error) => {
        errors.push(`${name}: ${e.message}`);
        console.warn('source failed', name, e.message);
        throw e;
      }),
    ),
  ).catch(() => {
    throw new Error(errors.join('; '));
  });
}

async function overpassViaDbOne(url: string, q: string): Promise<OsmPlace[]> {
  const text = await dbFetch(url, 'data=' + encodeURIComponent(q));
  const data = JSON.parse(text) as { elements?: Element[] };
  if (!Array.isArray(data.elements)) throw new Error('bad response');
  return parsePlaces(data.elements);
}

/** Both database-routed mirrors at once. */
function overpassViaDb(q: string): Promise<OsmPlace[]> {
  return firstSuccess(OVERPASS.slice(0, 2).map((url) => [new URL(url).host, () => overpassViaDbOne(url, q)] as [string, () => Promise<OsmPlace[]>]));
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

async function bathrooms(lat: number, lng: number, radius: number): Promise<{ places: OsmPlace[]; cached: boolean; source?: string }> {
  // Imported OpenStreetMap data first (scripts/osm-import.mjs): inside a covered region it is the answer.
  try {
    const { data, error } = await admin.rpc('bathrooms_near', { in_lat: lat, in_lng: lng, radius_m: radius, lim: 400 });
    if (error) throw new Error(error.message);
    const near = data as { covered: boolean; places: OsmPlace[] } | null;
    if (near?.covered) return { places: dedupePlaces(near.places ?? []), cached: true, source: 'import' };
  } catch (e) {
    console.warn('imported places lookup failed', (e as Error).message);
  }
  const key = `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200},${radius}`;
  const { data: hit } = await admin.from('osm_cells').select('places, fetched_at').eq('key', key).maybeSingle();
  if (hit && Date.now() - new Date(hit.fetched_at).getTime() < OSM_TTL_MS) return { places: dedupePlaces(hit.places as OsmPlace[]), cached: true };
  const q = overpassQuery(lat, lng, radius);
  // Every Overpass route at once (database-routed and direct); Nominatim only if all of them fail.
  const strategies: [string, () => Promise<OsmPlace[]>][] = [
    ['overpass', () => firstSuccess([['overpass-db', () => overpassViaDb(q)], ['overpass-edge', () => overpassRace(q)]])],
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
  if (!places) {
    // Nothing is answering: an old answer beats no answer.
    if (hit && Array.isArray(hit.places) && hit.places.length) {
      console.warn('bathrooms', key, 'serving stale cache;', errors.join(' | '));
      return { places: dedupePlaces(hit.places as OsmPlace[]), cached: true };
    }
    throw new Error(`No bathroom source is answering (${errors.join(' | ')})`);
  }
  places = dedupePlaces(places);
  console.log('bathrooms', key, source, places.length);
  await admin.from('osm_cells').upsert({ key, places, fetched_at: new Date().toISOString() });
  return { places, cached: false };
}

type Stroke = { angle: number; power: number; t?: number };
type Hole = { id: string; name?: string; theme?: string; par: number; tee: { x: number; y: number }; cup: { x: number; y: number } } & Record<string, unknown>;

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

const NAME_RE = /^[A-Za-z0-9 _.'\-]{2,24}$/;

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (m) => '\\' + m);
}

/** Case-insensitive uniqueness, excluding the caller. */
async function nameTaken(name: string, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('id').ilike('display_name', escapeLike(name)).neq('id', userId).limit(1);
  return !!data && data.length > 0;
}

async function ensureProfile(userId: string, displayName?: string): Promise<void> {
  const { data } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!data) {
    // Default names are unique by construction: Golfer + a slice of the id.
    for (const len of [4, 6, 8, 12]) {
      const fallback = `Golfer ${userId.replace(/-/g, '').slice(0, len).toUpperCase()}`;
      const { error } = await admin.from('profiles').insert({ id: userId, display_name: displayName?.slice(0, 24) || fallback });
      if (!error) return;
      if (displayName) throw new Error(error.message);
    }
  } else if (displayName) {
    const { error } = await admin.from('profiles').update({ display_name: displayName.slice(0, 24) }).eq('id', userId);
    if (error) throw new Error(error.message);
  }
}

type LocationRow = {
  id: string;
  name: string;
  poi_type: string;
  lat: number;
  lng: number;
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  holes: unknown[] | null;
  par: number | null;
  gen_holes: number;
  gen_tries: number;
  founded_by: string | null;
  status: 'live' | 'pending' | 'hidden';
};

/** Founds the row if needed (no holes yet). */
async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

/** Lowercased letters and digits only, so "Sully's Tavern" and "Sullys tavern" compare equal. */
function nameKey(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}
function sameName(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
}

async function ensureLocation(loc: { id: string; name: string; poiType: string; lat: number; lng: number }, userId: string, status: 'live' | 'pending' = 'live'): Promise<LocationRow> {
  const { data: existing } = await admin.from('locations').select('*').eq('id', loc.id).maybeSingle();
  if (existing) return existing as LocationRow;
  const band = bandFor(loc.poiType, loc.id);
  const row = {
    id: loc.id,
    name: loc.name.slice(0, 80),
    poi_type: loc.poiType,
    lat: loc.lat,
    lng: loc.lng,
    theme: band.theme,
    difficulty: band.difficulty,
    hole: null,
    hole_par: null,
    holes: [],
    par: null,
    gen_holes: 0,
    gen_tries: 0,
    founded_by: userId,
    status,
  };
  const { data, error } = await admin.from('locations').upsert(row, { onConflict: 'id', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as LocationRow;
  const { data: again } = await admin.from('locations').select('*').eq('id', loc.id).single();
  return again as LocationRow;
}

/**
 * Builds the next hole of a course. Each request runs at most two generator
 * attempts; a hole that fails both is retried under a new seed suffix next
 * request, and after GEN_MAX_TRIES the undecorated fallback is accepted.
 * Deterministic given the request sequence, and the row is the source of truth.
 */
async function buildNextHole(row: LocationRow): Promise<LocationRow> {
  const holes = Array.isArray(row.holes) ? row.holes.slice() : [];
  const i = holes.length;
  if (i >= HOLES_PER_COURSE) return row;
  const k = row.gen_tries;
  const slot = courseSlots(row.id, HOLES_PER_COURSE)[i] as { seed: string; archetype: string };
  const seed = k === 0 ? slot.seed : `${slot.seed}:try${k}`;
  const g = generateHole({ seed, archetype: slot.archetype, difficulty: COURSE_RAMP[row.difficulty][i], maxAttempts: GEN_ATTEMPTS_PER_REQUEST, solve: GEN_SOLVE });
  const accepted = !g.fallback || k + 1 >= GEN_MAX_TRIES;
  let patch: Record<string, unknown>;
  if (accepted) {
    g.hole.theme = row.theme;
    g.hole.id = `${row.id}#${i + 1}`;
    g.hole.name = `${row.name} ${i + 1}`;
    holes.push(g.hole);
    const done = holes.length === HOLES_PER_COURSE;
    patch = {
      holes,
      gen_holes: holes.length,
      gen_tries: 0,
      hole: holes[0],
      hole_par: (holes[0] as { par: number }).par,
      par: done ? holes.reduce((a: number, h) => a + (h as { par: number }).par, 0) : null,
    };
  } else patch = { gen_tries: k + 1 };
  // Optimistic: only apply if nobody else advanced this row meanwhile.
  const { data } = await admin.from('locations').update(patch).eq('id', row.id).eq('gen_holes', i).eq('gen_tries', k).select('*').maybeSingle();
  if (data) return data as LocationRow;
  const { data: fresh } = await admin.from('locations').select('*').eq('id', row.id).single();
  return fresh as LocationRow;
}

/** Same building, several OpenStreetMap objects: keep one pin. */
const POI_PRIORITY = ['fuel', 'restaurant', 'fast_food', 'bar', 'hotel', 'retail', 'stadium', 'airport', 'park', 'toilets'];
function dedupePlaces(places: OsmPlace[]): OsmPlace[] {
  const rank = (p: OsmPlace) => {
    const r = POI_PRIORITY.indexOf(p.poiType);
    return (r < 0 ? POI_PRIORITY.length : r) * 2 + (p.name && p.name !== 'Public toilet' ? 0 : 1);
  };
  const sorted = places.slice().sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const kept: OsmPlace[] = [];
  for (const p of sorted) {
    const absorbed = kept.some((q) => {
      const d = haversine(p.lat, p.lng, q.lat, q.lng);
      // A standalone toilet on a venue's lot is that venue's bathroom; two venues merge only when they share a footprint.
      return p.poiType === 'toilets' ? d < 80 : d < 40;
    });
    if (!absorbed) kept.push(p);
  }
  return kept;
}

/**
 * A hole of a seeded course. Daily holes are generated in full (the phone
 * generates the same hole itself, so the two must match exactly). Match holes
 * come from the server only, so they are built like a bathroom's: two
 * attempts per request under the edge CPU budget, retried under a new seed
 * suffix next request, the undecorated fallback accepted after GEN_MAX_TRIES.
 * Returns null while a match hole is still being built.
 */
async function courseHole(seed: string, index: number): Promise<Hole | null> {
  const { data: cached } = await admin.from('course_holes').select('hole, par').eq('seed', seed).eq('hole_index', index).maybeSingle();
  if (cached) return cached.hole as Hole;
  // The first N slots of a plan are the same for any count, so one 18-hole plan serves 3, 9 and 18.
  const slot = courseSlots(seed, 18)[index] as { seed: string; archetype: string; difficulty: 'easy' | 'medium' | 'hard'; theme: string; index: number } | undefined;
  if (!slot) throw new Error('bad hole index');
  if (!seed.startsWith('m-')) {
    const g = generateSlot(seed, slot);
    await admin.from('course_holes').upsert({ seed, hole_index: index, hole: g.hole, par: g.hole.par });
    return g.hole as Hole;
  }
  const { data: prog } = await admin.from('course_gen').select('tries').eq('seed', seed).eq('hole_index', index).maybeSingle();
  const k = prog?.tries ?? 0;
  const trySeed = k === 0 ? slot.seed : `${slot.seed}:try${k}`;
  const g = generateHole({ seed: trySeed, archetype: slot.archetype, difficulty: slot.difficulty, maxAttempts: GEN_ATTEMPTS_PER_REQUEST, solve: GEN_SOLVE });
  g.hole.id = `${seed}-${index + 1}`;
  g.hole.theme = slot.theme;
  if (!g.fallback || k + 1 >= GEN_MAX_TRIES) {
    // Two players load the same course at once: the first one in wins, the other reads it back.
    await admin.from('course_holes').upsert({ seed, hole_index: index, hole: g.hole, par: g.hole.par }, { onConflict: 'seed,hole_index', ignoreDuplicates: true });
    const { data: row } = await admin.from('course_holes').select('hole').eq('seed', seed).eq('hole_index', index).maybeSingle();
    return (row?.hole ?? g.hole) as Hole;
  }
  await admin.from('course_gen').upsert({ seed, hole_index: index, tries: k + 1, updated_at: new Date().toISOString() });
  return null;
}

/** Above average, beatable: usually a solid competent line, sometimes the best one, never the worst. */
function pickBotLine(report: { bestRun: { solution: Stroke[]; strokes: number | null } | null; runs: { solution: Stroke[]; strokes: number | null }[] }, seed: number, par: number): Stroke[] | null {
  const ok = report.runs.filter((r) => r.strokes !== null && r.solution.length > 0);
  if (report.bestRun && report.bestRun.solution.length > 0) ok.push(report.bestRun);
  if (!ok.length) return report.bestRun?.solution ?? null;
  const roll = (x: number) => ((x * 1103515245 + 12345) >>> 0) / 4294967296;
  const r1 = roll(seed);
  const r2 = roll((seed ^ 0x9e3779b9) >>> 0);
  // A decent-not-deadly golfer: mostly par, a birdie now and then, a bogey or a double about as often.
  const target = par + (r1 < 0.1 ? -1 : r1 < 0.55 ? 0 : r1 < 0.85 ? 1 : 2);
  // The known line closest to that score; among equals, any of them.
  let closest: typeof ok = [];
  let gap = Infinity;
  for (const r of ok) {
    const g = Math.abs((r.strokes ?? 99) - target);
    if (g < gap) {
      gap = g;
      closest = [r];
    } else if (g === gap) closest.push(r);
  }
  return closest[Math.min(closest.length - 1, Math.floor(r2 * closest.length))].solution;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await userFrom(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await req.json();
    const action = body.action as string;

    if (action === 'profile') {
      const raw = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
      const slogan = typeof body.slogan === 'string' ? body.slogan.trim().replace(/\s+/g, ' ').slice(0, 60) : undefined;
      if (raw !== undefined) {
        const problem = nameProblem(raw);
        if (problem) return json({ error: problem }, 400);
        if (await nameTaken(raw, user.id)) return json({ error: 'That name is taken' }, 409);
      }
      if (slogan !== undefined && slogan !== '') {
        const problem = sloganProblem(slogan);
        if (problem) return json({ error: problem }, 400);
      }
      try {
        await ensureProfile(user.id, raw);
      } catch (e) {
        if (/profiles_display_name_unique/.test((e as Error).message)) return json({ error: 'That name is taken' }, 409);
        throw e;
      }
      if (slogan !== undefined) await admin.from('profiles').update({ slogan: slogan || null }).eq('id', user.id);
      if (body.avatar && typeof body.avatar === 'object') await admin.from('profiles').update({ avatar: normalizeAvatar(body.avatar) }).eq('id', user.id);
      return json({ ok: true });
    }

    if (action === 'me') {
      await ensureProfile(user.id);
      const { data: prof } = await admin.from('profiles').select('display_name, slogan, avatar, role').eq('id', user.id).maybeSingle();
      return json({ id: user.id, displayName: prof?.display_name ?? null, slogan: prof?.slogan ?? null, avatar: prof?.avatar ?? null, role: prof?.role ?? 'player' });
    }

    if (action === 'report') {
      // A name or slogan that shouldn't be on a throne. Three different reporters reset it.
      const reported = String(body.userId ?? '');
      const reason = String(body.reason ?? '').slice(0, 40);
      if (!/^[0-9a-f-]{36}$/.test(reported)) return json({ error: 'bad report' }, 400);
      if (reported === user.id) return json({ error: "that's you" }, 400);
      if (!['name', 'slogan', 'cheating', 'other'].includes(reason)) return json({ error: 'bad reason' }, 400);
      await ensureProfile(user.id);
      const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: mine } = await admin.from('reports').select('id', { count: 'exact', head: true }).eq('reporter', user.id).gte('created_at', day);
      if ((mine ?? 0) >= REPORTS_PER_DAY) return json({ error: 'enough reports for today' }, 429);
      const month = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: dup } = await admin.from('reports').select('id').eq('reporter', user.id).eq('reported', reported).gte('created_at', month).limit(1);
      if (!dup?.length) {
        const { error } = await admin.from('reports').insert({ reporter: user.id, reported, reason });
        if (error) return json({ error: /reports_reported_fkey/.test(error.message) ? 'no such player' : error.message }, 400);
      }
      const { data: rows } = await admin.from('reports').select('reporter').eq('reported', reported).gte('created_at', month);
      const distinct = new Set((rows ?? []).map((r) => r.reporter)).size;
      let reset = false;
      if (distinct >= REPORTS_TO_RESET) {
        const { data: prof } = await admin.from('profiles').select('flagged_at').eq('id', reported).maybeSingle();
        if (prof && (!prof.flagged_at || new Date(prof.flagged_at).getTime() < Date.now() - 30 * 24 * 3600 * 1000)) {
          for (const len of [4, 6, 8, 12]) {
            const fallback = `Golfer ${reported.replace(/-/g, '').slice(0, len).toUpperCase()}`;
            const { error } = await admin.from('profiles').update({ display_name: fallback, slogan: null, flagged_at: new Date().toISOString() }).eq('id', reported);
            if (!error) {
              reset = true;
              break;
            }
          }
        }
      }
      return json({ ok: true, reset });
    }

    if (action === 'hole') {
      const loc = body.location;
      if (!loc || typeof loc.id !== 'string' || !/^(osm:(node|way|relation):\d+|ppp:[a-f0-9]{12})$/.test(loc.id) || typeof loc.lat !== 'number' || typeof loc.lng !== 'number')
        return json({ error: 'bad location' }, 400);
      await ensureProfile(user.id);
      let row = await ensureLocation({ id: loc.id, name: String(loc.name ?? 'Bathroom'), poiType: String(loc.poiType ?? 'toilets'), lat: loc.lat, lng: loc.lng }, user.id);
      if (row.status === 'hidden') return json({ error: 'this place is off the map' }, 410);
      const have = Array.isArray(row.holes) ? row.holes.length : 0;
      if (have < HOLES_PER_COURSE) row = await buildNextHole(row);
      const holes = Array.isArray(row.holes) ? row.holes : [];
      const ready = holes.length >= HOLES_PER_COURSE;
      const location = { id: row.id, name: row.name, poiType: row.poi_type, lat: row.lat, lng: row.lng, theme: row.theme, difficulty: row.difficulty };
      if (!ready) return json({ location, ready: false, holes, building: holes.length + 1, par: null, king: null });
      const { data: throne } = await admin.from('thrones').select('*').eq('location_id', row.id).eq('season', currentSeason()).maybeSingle();
      return json({ location, ready: true, holes, par: row.par, hole: holes[0], king: throne });
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

    if (action === 'start') {
      // Starts the throne-run clock. Needs a live check-in at this bathroom.
      const { locationId } = body;
      if (typeof locationId !== 'string') return json({ error: 'bad start' }, 400);
      const { data: ci } = await admin.from('checkins').select('at').eq('user_id', user.id).eq('location_id', locationId).maybeSingle();
      if (!ci) return json({ error: 'check in first' }, 400);
      const startedAt = new Date().toISOString();
      await admin.from('checkins').update({ started_at: startedAt }).eq('user_id', user.id).eq('location_id', locationId);
      return json({ ok: true, startedAt });
    }

    if (action === 'course-hole') {
      const { seed, index } = body;
      if (typeof seed !== 'string' || !/^(\d{4}-\d{2}-\d{2}(-am|-pm)?|m-[a-f0-9]{8})$/.test(seed) || typeof index !== 'number' || index < 0 || index > 17) return json({ error: 'bad course' }, 400);
      const hole = await courseHole(seed, index);
      return json(hole ? { hole } : { building: true });
    }

    if (action === 'submit') {
      const { locationId, courseSeed, holeIndex, matchId, strokes, lat, lng, accuracy } = body;
      await ensureProfile(user.id);
      let holes: unknown[];
      let par: number;
      let strokeLists: Stroke[][];
      let elapsedMs: number | null = null;
      if (typeof matchId === 'string') {
        // Quick match: the match's holes of its seed, timed from when the second player joined.
        const { data: m } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
        if (!m) return json({ error: 'no such match' }, 404);
        const n = Number(m.holes) || 9;
        if (!Array.isArray(strokes) || strokes.length !== n || !strokes.every(validStrokes)) return json({ error: 'bad strokes' }, 400);
        const side = m.p1 === user.id ? 'p1' : m.p2 === user.id ? 'p2' : null;
        if (!side) return json({ error: 'not your match' }, 403);
        if (m.status !== 'playing') return json({ error: m.status === 'waiting' ? 'opponent has not joined yet' : 'match is over' }, 400);
        if (m[`${side}_score`] !== null) return json({ error: 'already submitted' }, 409);
        const mh: unknown[] = [];
        for (let i = 0; i < n; i++) {
          const h = await courseHole(m.seed, i);
          if (!h) return json({ error: `hole ${i + 1} is still being built` }, 409);
          mh.push(h);
        }
        const scores: number[] = [];
        for (let i = 0; i < mh.length; i++) {
          const st = replay(mh[i], 0, (strokes as Stroke[][])[i], DEFAULT_PARAMS).state;
          if (!st.done) return json({ error: `hole ${i + 1} not finished` }, 400);
          scores.push(holeScore(st, (mh[i] as { par: number }).par));
        }
        const total = scores.reduce((a, b) => a + b, 0);
        const elapsed = Math.max(0, Date.now() - new Date(m.started_at).getTime());
        const patch: Record<string, unknown> = { [`${side}_score`]: total, [`${side}_holes`]: scores, [`${side}_elapsed_ms`]: elapsed };
        const other = side === 'p1' ? 'p2' : 'p1';
        if (m[`${other}_score`] !== null) {
          const os = m[`${other}_score`] as number;
          const oe = m[`${other}_elapsed_ms`] as number;
          const iWin = total < os || (total === os && elapsed < oe);
          const tie = total === os && elapsed === oe;
          patch.status = 'done';
          patch.finished_at = new Date().toISOString();
          patch.winner = tie ? null : iWin ? user.id : m[other];
        }
        const { error } = await admin.from('matches').update(patch).eq('id', matchId).is(`${side}_score`, null);
        if (error) return json({ error: error.message }, 500);
        return json({ score: total, holeScores: scores, elapsedMs: elapsed, done: patch.status === 'done', winner: patch.winner ?? null });
      }
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
        // Require a valid, unexpired check-in; no minimum wait before playing.
        const { data: ci } = await admin.from('checkins').select('at, started_at').eq('user_id', user.id).eq('location_id', locationId).maybeSingle();
        if (!ci) return json({ error: 'check in first' }, 400);
        const age = (Date.now() - new Date(ci.at).getTime()) / 1000;
        if (age > CHECKIN_MAX_AGE_S) return json({ error: 'check-in expired, check in again' }, 400);
        // Round time, measured here: from the start action to this submission.
        if (!ci.started_at) return json({ error: 'round was not started' }, 400);
        elapsedMs = Date.now() - new Date(ci.started_at).getTime();
        if (elapsedMs < 0 || elapsedMs > CHECKIN_MAX_AGE_S * 1000) return json({ error: 'round took too long, start again' }, 400);
        await admin.from('checkins').update({ started_at: null }).eq('user_id', user.id).eq('location_id', locationId);
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
        if (!hole) return json({ error: 'that hole is still being built' }, 409);
        holes = [hole];
        par = hole.par;
        const { data: dup } = await admin.from('runs').select('id').eq('user_id', user.id).eq('course_seed', courseSeed).eq('hole_index', holeIndex).maybeSingle();
        if (dup) return json({ error: 'already played this hole today' }, 409);
      } else return json({ error: 'nothing to submit to' }, 400);

      // Re-simulate every hole. The client's claimed score is ignored; the server's replay is the record.
      const holeScores: number[] = [];
      let sunk = true;
      let simMs = 0;
      for (let i = 0; i < holes.length; i++) {
        const st = replay(holes[i], 0, strokeLists[i], DEFAULT_PARAMS).state;
        if (!st.done) return json({ error: `hole ${i + 1} not finished` }, 400);
        holeScores.push(holeScore(st, (holes[i] as { par: number }).par));
        sunk = sunk && st.sunk;
        simMs += Math.round((st.totalTime ?? 0) * 1000);
      }
      // Daily/custom holes are timed by the simulation itself (ball rolling time): deterministic and unfakeable.
      if (elapsedMs === null && typeof locationId !== 'string') elapsedMs = simMs;
      const score = holeScores.reduce((a, b) => a + b, 0);
      const isLocation = typeof locationId === 'string';
      const { error } = await admin.from('runs').insert({
        user_id: user.id,
        location_id: isLocation ? locationId : null,
        course_seed: typeof courseSeed === 'string' ? courseSeed : null,
        hole_index: typeof holeIndex === 'number' ? holeIndex : 0,
        strokes: isLocation ? strokeLists : strokeLists[0],
        hole_scores: isLocation ? holeScores : null,
        elapsed_ms: elapsedMs,
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
      return json({ score, par, sunk, holeScores, elapsedMs, king, isKing: king ? king.user_id === user.id : false });
    }

    if (action === 'found') {
      // A bathroom the map doesn't know about. Usually at the player's feet; the pin can be
      // dropped a little way off (across the street, inside the mall) but not across town.
      const { name, poiType, lat, lng, accuracy, pin } = body;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: 'no position' }, 400);
      const acc = typeof accuracy === 'number' ? accuracy : 999;
      const adminUser = await isAdmin(user.id);
      if (acc > 100 && !adminUser) return json({ error: `GPS accuracy too low (${Math.round(acc)} m); step outside or wait a moment` }, 400);
      let placeLat = lat;
      let placeLng = lng;
      if (pin && typeof pin.lat === 'number' && typeof pin.lng === 'number' && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
        const drift = haversine(lat, lng, pin.lat, pin.lng);
        if (drift > PIN_DRIFT_M && !adminUser) return json({ error: `that pin is ${Math.round(drift)} m from you; get closer or drop it nearer` }, 400);
        placeLat = pin.lat;
        placeLng = pin.lng;
      }
      const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (cleanName.length < 2) return json({ error: 'give it a name' }, 400);
      if (nameProblem(cleanName)) return json({ error: "that name won't fly here" }, 400);
      const type = typeof poiType === 'string' && ['toilets', 'fuel', 'fast_food', 'bar', 'restaurant', 'hotel', 'retail', 'park', 'stadium', 'airport'].includes(poiType) ? poiType : 'toilets';
      await ensureProfile(user.id);
      if (!adminUser) {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { count } = await admin.from('locations').select('id', { count: 'exact', head: true }).eq('founded_by', user.id).like('id', 'ppp:%').gte('created_at', since);
        if ((count ?? 0) >= FOUND_PER_DAY) return json({ error: `that's ${FOUND_PER_DAY} new bathrooms today; more tomorrow` }, 429);
      }
      // The same place under the same name is a duplicate; a different business next door is not.
      const d = 0.001;
      const { data: near } = await admin.from('locations').select('id, name, poi_type, lat, lng, status').neq('status', 'hidden').gte('lat', placeLat - d).lte('lat', placeLat + d).gte('lng', placeLng - d * 2).lte('lng', placeLng + d * 2);
      for (const n of near ?? []) {
        if (haversine(placeLat, placeLng, n.lat, n.lng) <= SAME_PLACE_M && sameName(n.name, cleanName)) return json({ error: `${n.name} is already here`, existing: { id: n.id, name: n.name, poiType: n.poi_type, lat: n.lat, lng: n.lng } }, 409);
      }
      const { data: imported } = await admin.rpc('bathrooms_near', { in_lat: placeLat, in_lng: placeLng, radius_m: SAME_PLACE_M, lim: 10 });
      for (const ip of ((imported as { places?: OsmPlace[] } | null)?.places ?? [])) {
        if (sameName(ip.name, cleanName)) return json({ error: `${ip.name} is already here`, existing: ip }, 409);
      }
      const id = `ppp:${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const status = adminUser ? 'live' : 'pending';
      const row = await ensureLocation({ id, name: cleanName, poiType: type, lat: placeLat, lng: placeLng }, user.id, status);
      return json({ location: { id: row.id, name: row.name, poiType: row.poi_type, lat: row.lat, lng: row.lng }, status });
    }

    if (action === 'report-place') {
      // Something is wrong with a place: it closed, it has a new name, or it is not a
      // bathroom / in the wrong spot. Three different players make it so; an admin does it alone.
      const place = body.place;
      const reason = body.reason === 'wrong' ? 'wrong' : body.reason === 'renamed' ? 'renamed' : 'closed';
      const details = reason === 'renamed' ? String(body.details ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) : '';
      if (!place || typeof place.id !== 'string' || !/^(osm:(node|way|relation):\d+|ppp:[a-f0-9]{12})$/.test(place.id) || typeof place.lat !== 'number' || typeof place.lng !== 'number')
        return json({ error: 'bad place' }, 400);
      if (reason === 'renamed' && (details.length < 2 || nameProblem(details))) return json({ error: 'what is it called now?' }, 400);
      await ensureProfile(user.id);
      const adminUser = await isAdmin(user.id);
      const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: mine } = await admin.from('place_reports').select('id', { count: 'exact', head: true }).eq('reporter', user.id).gte('created_at', day);
      if ((mine ?? 0) >= REPORTS_PER_DAY && !adminUser) return json({ error: 'enough reports for today' }, 429);
      const row = await ensureLocation({ id: place.id, name: String(place.name ?? 'Bathroom'), poiType: String(place.poiType ?? 'toilets'), lat: place.lat, lng: place.lng }, user.id);
      if (row.status === 'hidden') return json({ ok: true, applied: true, hidden: true });
      if (reason === 'renamed' && sameName(row.name, details)) return json({ ok: true, applied: true, name: row.name });
      const window = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      // One open report per player per place; a new one replaces it.
      await admin.from('place_reports').delete().eq('reporter', user.id).eq('location_id', row.id);
      await admin.from('place_reports').insert({ reporter: user.id, location_id: row.id, reason, details: details || null });
      const { data: rows } = await admin.from('place_reports').select('reporter, reason, details').eq('location_id', row.id).gte('created_at', window);
      const agree = (rows ?? []).filter((r) => r.reason === reason && (reason !== 'renamed' || sameName(String(r.details ?? ''), details)));
      const distinct = new Set(agree.map((r) => r.reporter)).size;
      const apply = adminUser || distinct >= PLACE_REPORTS_TO_APPLY;
      if (apply) {
        const patch = reason === 'renamed' ? { name: details } : { status: 'hidden' };
        const { error } = await admin.from('locations').update(patch).eq('id', row.id);
        if (error) return json({ error: error.message }, 500);
        await admin.from('place_reports').delete().eq('location_id', row.id);
      }
      return json({ ok: true, applied: apply, hidden: apply && reason !== 'renamed', name: apply && reason === 'renamed' ? details : row.name, reports: distinct, needed: PLACE_REPORTS_TO_APPLY });
    }

    if (action === 'place-queue') {
      // Admin only: players' finds waiting for approval and open reports, nearest first.
      if (!(await isAdmin(user.id))) return json({ error: 'admins only' }, 403);
      const { lat, lng } = body;
      const here = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      const dist = (r: { lat: number; lng: number }) => (here ? haversine(here.lat, here.lng, r.lat, r.lng) : 0);
      const { data: pending } = await admin.from('locations').select('id, name, poi_type, lat, lng, created_at, founded_by').eq('status', 'pending').order('created_at', { ascending: false }).limit(200);
      const { data: reports } = await admin.from('place_reports').select('location_id, reason, details, reporter, created_at').order('created_at', { ascending: false }).limit(500);
      const byPlace = new Map<string, { reason: string; details: string | null; reporters: Set<string>; latest: string }[]>();
      for (const r of reports ?? []) {
        const list = byPlace.get(r.location_id) ?? [];
        let g = list.find((x) => x.reason === r.reason && (r.reason !== 'renamed' || sameName(String(x.details ?? ''), String(r.details ?? ''))));
        if (!g) {
          g = { reason: r.reason, details: r.details, reporters: new Set(), latest: r.created_at };
          list.push(g);
        }
        g.reporters.add(r.reporter);
        byPlace.set(r.location_id, list);
      }
      const ids = [...byPlace.keys()];
      const { data: locs } = ids.length ? await admin.from('locations').select('id, name, poi_type, lat, lng, status').in('id', ids) : { data: [] };
      const reported = (locs ?? [])
        .filter((l) => l.status !== 'hidden')
        .map((l) => ({
          id: l.id,
          name: l.name,
          poiType: l.poi_type,
          lat: l.lat,
          lng: l.lng,
          distance_m: dist(l),
          reports: (byPlace.get(l.id) ?? []).map((g) => ({ reason: g.reason, details: g.details, count: g.reporters.size, latest: g.latest })),
        }))
        .sort((a, b) => a.distance_m - b.distance_m);
      const finds = (pending ?? []).map((l) => ({ id: l.id, name: l.name, poiType: l.poi_type, lat: l.lat, lng: l.lng, distance_m: dist(l), created_at: l.created_at })).sort((a, b) => a.distance_m - b.distance_m);
      return json({ finds, reported });
    }

    if (action === 'curate') {
      // Admin only: approve a player's find, take a place off the map, put it back, rename it, or clear its reports.
      if (!(await isAdmin(user.id))) return json({ error: 'admins only' }, 403);
      const locationId = String(body.locationId ?? '');
      const decision = String(body.decision ?? '');
      if (!/^(osm:(node|way|relation):\d+|ppp:[a-f0-9]{12})$/.test(locationId)) return json({ error: 'bad request' }, 400);
      let patch: Record<string, unknown> | null = null;
      if (decision === 'approve' || decision === 'restore') patch = { status: 'live' };
      else if (decision === 'hide') patch = { status: 'hidden' };
      else if (decision === 'rename') {
        const name = String(body.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        if (name.length < 2 || nameProblem(name)) return json({ error: 'give it a name' }, 400);
        patch = { name };
      } else if (decision !== 'dismiss') return json({ error: 'bad request' }, 400);
      if (patch) {
        const { error } = await admin.from('locations').update(patch).eq('id', locationId);
        if (error) return json({ error: error.message }, 500);
      }
      // Any decision settles the open reports on this place.
      await admin.from('place_reports').delete().eq('location_id', locationId);
      const { data: row } = await admin.from('locations').select('name, status').eq('id', locationId).maybeSingle();
      return json({ ok: true, status: row?.status ?? null, name: row?.name ?? null });
    }

    if (action === 'bot-join') {
      // Nobody came: seat a bot. It looks like any other player and plays the same holes.
      const matchId = String(body.matchId ?? '');
      if (!/^[0-9a-f-]{36}$/.test(matchId)) return json({ error: 'bad match' }, 400);
      const { data: m } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!m) return json({ error: 'no such match' }, 404);
      if (m.p1 !== user.id) return json({ error: 'not your match' }, 403);
      if (m.status !== 'waiting') return json({ ok: true, status: m.status });
      if (m.code) return json({ error: 'invites wait for the friend' }, 400);
      // The pool, the look and the clock live in SQL (seat_bot), shared with match_state's own seating.
      const { error } = await admin.rpc('seat_bot', { in_match: matchId });
      if (error) return json({ error: error.message }, 500);
      const { data: plan } = await admin.from('bot_plans').select('hole_times').eq('match_id', matchId).maybeSingle();
      if (!plan) return json({ ok: true, status: 'taken' });
      return json({ ok: true, status: 'playing', holeTimes: plan.hole_times });
    }

    if (action === 'bot-plan') {
      // Plans one hole of the bot's round: solve it, pick a good-not-perfect line, verify by replay.
      const matchId = String(body.matchId ?? '');
      const index = Number(body.index);
      if (!/^[0-9a-f-]{36}$/.test(matchId) || !Number.isInteger(index) || index < 0 || index > 17) return json({ error: 'bad request' }, 400);
      const { data: m } = await admin.from('matches').select('id, p1, seed, holes, started_at, status').eq('id', matchId).maybeSingle();
      if (!m || m.p1 !== user.id) return json({ error: 'not your match' }, 403);
      const { data: plan } = await admin.from('bot_plans').select('*').eq('match_id', matchId).maybeSingle();
      if (!plan) return json({ error: 'no bot in this match' }, 404);
      const n = Number(m.holes) || 9;
      if (index >= n) return json({ error: 'bad hole' }, 400);
      const strokesAll = (Array.isArray(plan.strokes) ? plan.strokes : []) as (Stroke[] | null)[];
      const scores = (Array.isArray(plan.scores) ? plan.scores : []) as (number | null)[];
      if (strokesAll[index]) return json({ ok: true, index, score: scores[index] ?? null, planned: plan.planned });
      const hole = await courseHole(m.seed, index);
      if (!hole) return json({ error: 'hole not built yet' }, 409);
      let seed = 0;
      for (const ch of `${matchId}:${index}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const report = solveHole(hole, DEFAULT_PARAMS, { ...BOT_SOLVE, seed: seed || 1 });
      const line = pickBotLine(report, seed, hole.par);
      let strokes: Stroke[] = line ?? [{ angle: Math.atan2(hole.cup.y - hole.tee.y, hole.cup.x - hole.tee.x), power: 0.7 }];
      let st = replay(hole, 0, strokes, DEFAULT_PARAMS).state;
      if (!st.done && line) {
        // The chosen line did not hold up under the exact replay: fall back to the best known one.
        strokes = report.bestRun?.solution ?? strokes;
        st = replay(hole, 0, strokes, DEFAULT_PARAMS).state;
      }
      const score = st.done ? holeScore(st, hole.par) : STROKE_CAP + 1;
      while (strokesAll.length < n) strokesAll.push(null);
      while (scores.length < n) scores.push(null);
      strokesAll[index] = strokes;
      scores[index] = score;
      const planned = strokesAll.filter((x) => x).length;
      const patch: Record<string, unknown> = { strokes: strokesAll, scores: scores.map((x) => x ?? 0), planned };
      if (planned >= n && m.started_at) {
        const times = plan.hole_times as number[];
        patch.settle_at = new Date(new Date(m.started_at).getTime() + times[times.length - 1]).toISOString();
      }
      await admin.from('bot_plans').update(patch).eq('match_id', matchId);
      return json({ ok: true, index, score, planned });
    }

    if (action === 'link-code') {
      // Six digits that let another phone take over this account for ten minutes.
      await ensureProfile(user.id);
      await admin.from('link_codes').delete().eq('user_id', user.id);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
        const expires = new Date(Date.now() + LINK_CODE_TTL_MIN * 60000).toISOString();
        const { error } = await admin.from('link_codes').insert({ code, user_id: user.id, expires_at: expires });
        if (!error) return json({ code, expiresAt: expires });
      }
      return json({ error: 'try again' }, 500);
    }

    if (action === 'link-claim') {
      const code = String(body.code ?? '').replace(/\D/g, '');
      if (code.length !== 6) return json({ error: 'codes are six digits' }, 400);
      await admin.from('link_codes').delete().lt('expires_at', new Date().toISOString());
      const { data: lc } = await admin.from('link_codes').select('user_id').eq('code', code).maybeSingle();
      if (!lc) return json({ error: 'that code is wrong or expired' }, 404);
      if (lc.user_id === user.id) return json({ error: 'that is this phone' }, 400);
      await ensureProfile(user.id);
      const { data: name, error } = await admin.rpc('move_account', { old_id: lc.user_id, new_id: user.id });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, displayName: name });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error('potty error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
