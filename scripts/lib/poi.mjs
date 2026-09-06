// Shared OpenStreetMap classification for the import and pre-build scripts.
// Mirrors classify() / bandFor() in server/potty/index.ts: keep them in step.

/** Tag set -> our place type and a default label, or null when the object is not a bathroom venue. */
export function classify(tags) {
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

/** The osmium tags-filter expression that keeps exactly what classify() accepts. */
export const OSMIUM_FILTER = ['nw/amenity=toilets,fuel,fast_food,bar,pub,nightclub,restaurant,cafe', 'nw/tourism=hotel,motel', 'nw/aeroway=terminal,aerodrome', 'nw/leisure=stadium', 'nw/building=stadium', 'nw/shop=supermarket,mall,department_store', 'nw/highway=rest_area,services'];

/** POI type -> environment + difficulty band. */
export function bandFor(poiType, id) {
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
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      const absurd = ['haunted', 'castle', 'spaceship', 'grandma'];
      return { theme: absurd[h % absurd.length], difficulty: 'medium' };
    }
  }
}

/** Difficulty ramp of a bathroom's three holes, by band (server COURSE_RAMP). */
export const COURSE_RAMP = {
  easy: ['easy', 'easy', 'medium'],
  medium: ['easy', 'medium', 'medium'],
  hard: ['medium', 'hard', 'hard'],
};

/**
 * osmium export ids ("n123", "w123", "a246") -> our ids. Areas carry
 * way id * 2 (even) or relation id * 2 + 1 (odd).
 */
export function osmId(unique) {
  const m = /^([nwa])(\d+)$/.exec(String(unique ?? ''));
  if (!m) return null;
  const n = Number(m[2]);
  if (m[1] === 'n') return `osm:node:${n}`;
  if (m[1] === 'w') return `osm:way:${n}`;
  return n % 2 === 0 ? `osm:way:${n / 2}` : `osm:relation:${(n - 1) / 2}`;
}

/** A representative point for any GeoJSON geometry: the point itself, or the mean of the outer ring. */
export function centroid(geometry) {
  if (!geometry) return null;
  const pts = [];
  const walk = (c) => {
    if (typeof c[0] === 'number') pts.push(c);
    else for (const x of c) walk(x);
  };
  if (geometry.type === 'Point') return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
  if (geometry.type === 'Polygon') walk(geometry.coordinates[0]);
  else if (geometry.type === 'MultiPolygon') walk(geometry.coordinates[0][0]);
  else walk(geometry.coordinates);
  if (!pts.length) return null;
  let lat = 0;
  let lng = 0;
  for (const [x, y] of pts) {
    lng += x;
    lat += y;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

/** One osmium geojsonseq feature -> an osm_places row, or null. */
export function placeFromFeature(feature) {
  const props = feature.properties ?? {};
  const id = osmId(props['@id'] ?? props.id ?? feature.id);
  if (!id) return null;
  const c = classify(props);
  if (!c) return null;
  const p = centroid(feature.geometry);
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  const name = String(props.name || props.brand || c.label).slice(0, 80);
  return { id, name, poi_type: c.poiType, lat: p.lat, lng: p.lng };
}
