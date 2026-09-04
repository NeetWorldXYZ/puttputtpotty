/**
 * Bathrooms from OpenStreetMap via the Overpass API: public toilets plus
 * places that have one (gas stations, bars, restaurants, hotels, airports,
 * stadiums, big shops, rest stops). Cached per ~500 m cell for 15 minutes
 * so panning around doesn't hammer the public server.
 */

export interface OsmPlace {
  id: string; // osm:node:123
  name: string;
  poiType: string;
  lat: number;
  lng: number;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const CACHE_KEY = 'ppp.osm.v1';
const TTL = 15 * 60 * 1000;

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

function cellKey(lat: number, lng: number): string {
  return `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200}`;
}

export async function fetchBathrooms(lat: number, lng: number, radiusM = 1500): Promise<OsmPlace[]> {
  const key = cellKey(lat, lng);
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; places: OsmPlace[] }>;
    const hit = cache[key];
    if (hit && Date.now() - hit.at < TTL) return hit.places;
  } catch {
    /* ignore */
  }
  const q = `[out:json][timeout:20];
(
  nwr["amenity"="toilets"](around:${radiusM},${lat},${lng});
  nwr["amenity"~"^(fuel|fast_food|bar|pub|nightclub|restaurant|cafe)$"](around:${radiusM},${lat},${lng});
  nwr["tourism"~"^(hotel|motel)$"](around:${radiusM},${lat},${lng});
  nwr["aeroway"~"^(terminal|aerodrome)$"](around:${radiusM},${lat},${lng});
  nwr["leisure"="stadium"](around:${radiusM},${lat},${lng});
  nwr["shop"~"^(supermarket|mall|department_store)$"](around:${radiusM},${lat},${lng});
  nwr["highway"~"^(rest_area|services)$"](around:${radiusM},${lat},${lng});
);
out center 120;`;
  let lastErr: unknown = null;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const data = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
      const places: OsmPlace[] = [];
      for (const el of data.elements) {
        const tags = el.tags ?? {};
        const c = classify(tags);
        if (!c) continue;
        const plat = el.lat ?? el.center?.lat;
        const plng = el.lon ?? el.center?.lon;
        if (plat === undefined || plng === undefined) continue;
        places.push({ id: `osm:${el.type}:${el.id}`, name: tags.name || tags.brand || c.label, poiType: c.poiType, lat: plat, lng: plng });
      }
      try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; places: OsmPlace[] }>;
        cache[key] = { at: Date.now(), places };
        const keys = Object.keys(cache);
        if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete cache[k];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch {
        /* ignore */
      }
      return places;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('could not load bathrooms');
}
