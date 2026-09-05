/**
 * Bathrooms from OpenStreetMap: public toilets plus places that have one
 * (gas stations, bars, restaurants, hotels, airports, stadiums, big shops,
 * rest stops). The server does the Overpass query and caches it (mobile
 * browsers drop cross-origin Overpass calls surprisingly often); if our
 * API is unreachable the phone races the public mirrors directly. Cached
 * locally per ~500 m cell for 15 minutes.
 */

import { api } from './api';

export interface OsmPlace {
  id: string; // osm:node:123
  name: string;
  poiType: string;
  lat: number;
  lng: number;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const CACHE_KEY = 'ppp.osm.v1';
const TTL = 15 * 60 * 1000;
const PER_ENDPOINT_TIMEOUT_MS = 14000;

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

function cellKey(lat: number, lng: number, radiusM: number): string {
  return `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200},${radiusM}`;
}

function readCache(key: string): OsmPlace[] | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; places: OsmPlace[] }>;
    const hit = cache[key];
    return hit && Date.now() - hit.at < TTL ? hit.places : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, places: OsmPlace[]): void {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; places: OsmPlace[] }>;
    cache[key] = { at: Date.now(), places };
    const keys = Object.keys(cache);
    if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete cache[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

function parse(elements: Element[]): OsmPlace[] {
  const places: OsmPlace[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const c = classify(tags);
    if (!c) continue;
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    if (plat === undefined || plng === undefined) continue;
    places.push({ id: `osm:${el.type}:${el.id}`, name: tags.name || tags.brand || c.label, poiType: c.poiType, lat: plat, lng: plng });
  }
  return places;
}

async function queryOne(url: string, q: string, signal: AbortSignal): Promise<OsmPlace[]> {
  const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = (await res.json()) as { elements?: Element[] };
  if (!Array.isArray(data.elements)) throw new Error('overpass: bad response');
  return parse(data.elements);
}

/** First mirror to answer wins; the rest are aborted. */
async function race(q: string): Promise<OsmPlace[]> {
  const controllers = ENDPOINTS.map(() => new AbortController());
  const timers = controllers.map((c) => setTimeout(() => c.abort(), PER_ENDPOINT_TIMEOUT_MS));
  const errors: string[] = [];
  return new Promise<OsmPlace[]>((resolve, reject) => {
    let pending = ENDPOINTS.length;
    ENDPOINTS.forEach((url, i) => {
      queryOne(url, q, controllers[i].signal).then(
        (places) => {
          controllers.forEach((c, j) => j !== i && c.abort());
          timers.forEach(clearTimeout);
          resolve(places);
        },
        (e: Error) => {
          errors.push(e.name === 'AbortError' ? 'timed out' : e.message);
          if (--pending === 0) {
            timers.forEach(clearTimeout);
            reject(new Error(`OpenStreetMap is not answering (${errors[0]})`));
          }
        },
      );
    });
  });
}

export async function fetchBathrooms(lat: number, lng: number, radiusM = 3000): Promise<OsmPlace[]> {
  const key = cellKey(lat, lng, radiusM);
  const cached = readCache(key);
  if (cached) return cached;
  const around = `(around:${radiusM},${lat},${lng})`;
  const tags: [string, string[]][] = [
    ['amenity', ['toilets', 'fuel', 'fast_food', 'bar', 'pub', 'nightclub', 'restaurant', 'cafe']],
    ['tourism', ['hotel', 'motel']],
    ['aeroway', ['terminal', 'aerodrome']],
    ['leisure', ['stadium']],
    ['shop', ['supermarket', 'mall', 'department_store']],
    ['highway', ['rest_area', 'services']],
  ];
  const clauses: string[] = [];
  for (const [k, vals] of tags) for (const v of vals) clauses.push(`node["${k}"="${v}"]${around};way["${k}"="${v}"]${around};`);
  const q = `[out:json][timeout:12];(${clauses.join('')});out center 200;`;
  let places: OsmPlace[];
  try {
    places = (await api.bathrooms(lat, lng, radiusM)).places;
  } catch (serverErr) {
    try {
      places = await race(q);
    } catch (directErr) {
      throw new Error(`${(serverErr as Error).message}; ${(directErr as Error).message}`);
    }
  }
  writeCache(key, places);
  return places;
}
