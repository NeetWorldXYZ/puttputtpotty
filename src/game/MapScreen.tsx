import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COURSE_STYLE, circlePolygon } from './mapStyle';
import type { Hole } from '../sim/types';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { themeById } from '../render/themes';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import { HOLES_PER_COURSE, api, fmtElapsed, type King, type LocationRow, type NearbyLocation } from '../net/api';
import { currentUserId, getSavedAvatar } from '../net/supabase';
import { loadProfile } from '../net/supabase';
import { fetchBathrooms, type OsmPlace } from '../net/overpass';
import { fmtDistance, haversine, watchPosition, type Fix } from '../net/geo';
import { CLAIM_RADIUS_M, DWELL_SECONDS } from '../net/config';
import { POI_ICON, POI_LABEL, bandFor, checkinAt, recallFix, recordCheckin, rememberFix, rememberPlace } from '../net/places';
import { getSavedName } from '../net/supabase';
import { loadCourse } from '../net/course';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { ReportSheet } from './ReportSheet';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';
import { sfx, unlockAudio } from './sound';

const SEARCH_RADIUS_M = 3000;
const WIDE_RADIUS_M = 12000;
const MIN_RESULTS_BEFORE_WIDENING = 4;
/** Auto-search when the map centre drifts this far from the last search. */
const RESEARCH_DISTANCE_M = 1800;
const MIN_AUTO_ZOOM = 10;
const MAX_PINS = 400;
const THRONES_RETRY_MS = 8000;
const THRONES_CACHE_KEY = 'ppp.thrones.v1';
const THRONES_CACHE_MAX = 600;

/** Thrones this phone has seen, so the map is never empty while the server is unreachable. */
function recallThrones(lat: number, lng: number, radiusM: number): NearbyLocation[] {
  try {
    const rows = JSON.parse(localStorage.getItem(THRONES_CACHE_KEY) ?? '[]') as NearbyLocation[];
    return rows.filter((r) => haversine(lat, lng, r.lat, r.lng) <= radiusM);
  } catch {
    return [];
  }
}
function rememberThrones(rows: NearbyLocation[]): void {
  if (!rows.length) return;
  try {
    const have = JSON.parse(localStorage.getItem(THRONES_CACHE_KEY) ?? '[]') as NearbyLocation[];
    const m = new Map<string, NearbyLocation>();
    for (const r of have) m.set(r.id, r);
    for (const r of rows) m.set(r.id, r);
    localStorage.setItem(THRONES_CACHE_KEY, JSON.stringify([...m.values()].slice(-THRONES_CACHE_MAX)));
  } catch {
    /* ignore */
  }
}

/** Same building, several OpenStreetMap objects: keep one pin (mirrors the server's rule). */
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
      return p.poiType === 'toilets' ? d < 80 : d < 40;
    });
    if (!absorbed) kept.push(p);
  }
  return kept;
}

/** Founded bathrooms from the database render as pins even if OpenStreetMap never answers. */
function mergePlaces(osm: OsmPlace[], db: NearbyLocation[]): OsmPlace[] {
  const seen = new Set(osm.map((p) => p.id));
  const out = osm.slice();
  for (const l of db) if (!seen.has(l.id)) out.push({ id: l.id, name: l.name, poiType: l.poi_type, lat: l.lat, lng: l.lng });
  return out;
}

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/**
 * A pin says one thing at a glance: empty throne (white), taken (gold with
 * the king's score), or yours (gold with a glow).
 */
function pinHtml(_p: OsmPlace, king: NearbyLocation | undefined, selected: boolean, mine: boolean): string {
  const icon = `<svg class="throne-glyph" viewBox="0 0 40 48" aria-hidden="true"><path d="m8 12-3-9 9 5 6-7 6 7 9-5-3 9Z" fill="#ffdc65" stroke="#14213d" stroke-width="2"/><rect x="9" y="14" width="22" height="13" rx="3" fill="white" stroke="#14213d" stroke-width="2"/><path d="M6 27h28q0 13-11 14l3 5H14l3-5Q6 40 6 27Z" fill="white" stroke="#14213d" stroke-width="2"/><ellipse cx="20" cy="28" rx="12" ry="4" fill="#55d9f0" stroke="#14213d" stroke-width="2"/></svg>`;
  const claimed = !!king?.king_name;
  const badge = claimed && king!.king_score !== null ? `<span class="pin-score">${king!.king_score}</span>` : '';
  return `<div class="pin${selected ? ' selected' : ''}${claimed ? ' claimed' : ''}${mine ? ' mine' : ''}"><span class="pin-icon">${icon}</span>${badge}</div>`;
}

/** Zoomed out past this, nearby flags fold into count bubbles that split apart as you zoom in. */
const CLUSTER_MAX_ZOOM = 14.5;
const CLUSTER_CELL_PX = 56;

type Cluster = { key: string; lat: number; lng: number; members: OsmPlace[]; claimed: number };

/**
 * Grid clustering in world-pixel space at the current zoom: stable while
 * panning, re-bucketed when the zoom changes. Singles come back as-is.
 */
function clusterPlaces(places: OsmPlace[], zoom: number, kings: Record<string, NearbyLocation>, keepId: string | null): { singles: OsmPlace[]; clusters: Cluster[] } {
  if (zoom >= CLUSTER_MAX_ZOOM) return { singles: places, clusters: [] };
  const scale = (512 * Math.pow(2, zoom)) / CLUSTER_CELL_PX;
  const buckets = new Map<string, OsmPlace[]>();
  const singles: OsmPlace[] = [];
  for (const p of places) {
    if (p.id === keepId) {
      singles.push(p);
      continue;
    }
    const m = maplibregl.MercatorCoordinate.fromLngLat([p.lng, p.lat]);
    const key = `${Math.floor(m.x * scale)}:${Math.floor(m.y * scale)}`;
    const b = buckets.get(key);
    if (b) b.push(p);
    else buckets.set(key, [p]);
  }
  const clusters: Cluster[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) {
      singles.push(...members);
      continue;
    }
    let lat = 0;
    let lng = 0;
    let claimed = 0;
    for (const p of members) {
      lat += p.lat;
      lng += p.lng;
      if (kings[p.id]?.king_name) claimed++;
    }
    clusters.push({ key: `${Math.round(zoom * 2)}:${key}`, lat: lat / members.length, lng: lng / members.length, members, claimed });
  }
  return { singles, clusters };
}

function clusterHtml(c: Cluster): string {
  const big = c.members.length >= 10;
  return `<div class="cluster${c.claimed ? ' claimed' : ''}${big ? ' big' : ''}"><span class="cluster-count">${c.members.length}</span><span class="cluster-icon">${c.claimed ? '👑' : '🚽'}</span></div>`;
}

const FOUND_TYPES: [string, string][] = [
  ['toilets', 'Public toilet'],
  ['fuel', 'Gas station'],
  ['bar', 'Bar'],
  ['fast_food', 'Fast food'],
  ['restaurant', 'Restaurant'],
  ['hotel', 'Hotel'],
  ['retail', 'Store'],
  ['park', 'Rest stop'],
];

/** "Found a bathroom here": name it, say what it is, and it goes on the map at your feet. */
function FoundSheet({ fix, onClose, onFound }: { fix: { lat: number; lng: number; accuracy: number }; onClose: () => void; onFound: (p: OsmPlace) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('toilets');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { location } = await api.found(trimmed, type, fix.lat, fix.lng, fix.accuracy);
      sfx.jingle();
      onFound(location);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card pop found" onClick={(e) => e.stopPropagation()}>
        <h2>Found a bathroom?</h2>
        <div className="sub">It goes on the map right where you're standing{fix.accuracy > 100 ? ` (GPS is ${Math.round(fix.accuracy)} m off, get outside first)` : ''}.</div>
        <input className="name-input" maxLength={40} placeholder="What's it called?" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="found-types">
          {FOUND_TYPES.map(([id, label]) => (
            <button key={id} className={`chip${type === id ? ' active' : ''}`} onClick={() => setType(id)}>
              {POI_ICON[id] ?? '🚽'} {label}
            </button>
          ))}
        </div>
        {error && <div className="err">{error}</div>}
        <button className="primary" disabled={trimmed.length < 2 || busy || fix.accuracy > 100} onClick={() => void submit()}>
          {busy ? 'Adding…' : 'Put it on the map'}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/** Hole preview drawn once per hole into a small canvas. */
function HolePreview({ hole, label }: { hole: Hole; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 150;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = themeById(hole.theme).page;
    ctx.fillRect(0, 0, w, h);
    const cam = fitCamera(hole.bounds, w, h, 6);
    drawHole(ctx, hole, cam, { ballRadius: DEFAULT_PARAMS.ballRadius, cupRadius: cupRadius(DEFAULT_PARAMS), ball: { x: hole.tee.x, y: hole.tee.y }, dpr, time: 0 });
  }, [hole]);
  return (
    <div className="sheet-hole">
      <canvas ref={ref} className="sheet-preview" />
      {label && <span className="sheet-hole-label">{label}</span>}
    </div>
  );
}

/** You are here: a golf cart. Mirrored to face the way you last moved. */
const CART_SVG = `<svg viewBox="0 0 64 48" aria-hidden="true">
<ellipse cx="32" cy="44" rx="24" ry="3.5" fill="rgba(0,0,0,0.3)"/>
<!-- bag on the back -->
<rect x="4" y="14" width="10" height="18" rx="4" fill="#ff6f3c" stroke="#1f2a44" stroke-width="3"/>
<path d="M6 14 l2 -6 M9 14 l1 -7 M12 14 l0 -6" stroke="#1f2a44" stroke-width="2.5" stroke-linecap="round"/>
<!-- body -->
<path d="M12 30 L12 22 Q12 18 16 18 L40 18 L46 26 L56 26 Q60 26 60 30 L60 34 L12 34 Z" fill="#fffaf0" stroke="#1f2a44" stroke-width="3" stroke-linejoin="round"/>
<!-- seat -->
<rect x="20" y="12" width="14" height="7" rx="3" fill="#4db8ff" stroke="#1f2a44" stroke-width="3"/>
<!-- canopy + posts -->
<rect x="14" y="2" width="36" height="6" rx="3" fill="#5fae4c" stroke="#1f2a44" stroke-width="3"/>
<path d="M18 8 V18 M46 8 V26" stroke="#1f2a44" stroke-width="3" stroke-linecap="round"/>
<!-- wheels -->
<circle cx="22" cy="36" r="6.5" fill="#1f2a44"/><circle cx="22" cy="36" r="2.5" fill="#fff"/>
<circle cx="50" cy="36" r="6.5" fill="#1f2a44"/><circle cx="50" cy="36" r="2.5" fill="#fff"/>
<!-- headlight -->
<circle cx="58" cy="29" r="1.8" fill="#ffd166"/>
</svg>`;

function cartElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'you-wrap';
  el.innerHTML = `<div class="you-ring"></div><div class="cart">${CART_SVG}</div>`;
  return el;
}

export function MapScreen() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  const clustersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  /** Zoom in half steps; markers re-cluster when it changes. */
  const [zoomStep, setZoomStep] = useState(30);
  const userRef = useRef<maplibregl.Marker | null>(null);
  const lastFixRef = useRef<Fix | null>(null);
  const lastSearchRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const placesRef = useRef<Map<string, OsmPlace>>(new Map());
  const [zoomClass, setZoomClass] = useState('z-mid');

  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [kings, setKings] = useState<Record<string, NearbyLocation>>({});
  const kingsRef = useRef<Record<string, NearbyLocation>>({});
  kingsRef.current = kings;
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  /** 'stale': showing remembered thrones while the server is unreachable; 'empty': nothing to show yet. */
  const [thronesDown, setThronesDown] = useState<'none' | 'stale' | 'empty'>('none');
  const retryRef = useRef(0);
  useEffect(() => () => window.clearTimeout(retryRef.current), []);
  const [selected, setSelected] = useState<OsmPlace | null>(null);
  const [preview, setPreview] = useState<{ id: string; holes: Hole[]; par: number; king: King | null } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ id: string; n: number } | null>(null);
  const [board, setBoard] = useState<{ id: string; rows: LocationRow[] } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void currentUserId().then(setMe);
    void loadProfile().then((p) => p?.name && setName(p.name));
  }, []);
  const [moved, setMoved] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinTick, setCheckinTick] = useState(0);
  const [askName, setAskName] = useState(false);
  const [founding, setFounding] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unclaimed' | 'mine'>('all');
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState(getSavedName());
  const searchedRef = useRef(false);

  // --- map
  useEffect(() => {
    const el = mapEl.current;
    if (!el || mapRef.current) return;
    const start = recallFix() ?? { lat: 40.7484, lng: -73.9857 };
    const map = new maplibregl.Map({
      container: el,
      style: COURSE_STYLE,
      center: [start.lng, start.lat],
      zoom: recallFix() ? 14 : 2,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenFreeMap · © OpenMapTiles' }), 'bottom-right');
    map.on('click', () => setSelected(null));
    map.on('dragend', () => setMoved(true));
    map.on('zoomend', () => setMoved(true));
    const onZoom = () => {
      const z = map.getZoom();
      setZoomClass(z < 11 ? 'z-low' : z < 13.5 ? 'z-mid' : 'z-high');
    };
    map.on('zoomend', onZoom);
    onZoom();
    map.on('load', () => {
      map.addSource('accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy', paint: { 'fill-color': '#ffd166', 'fill-opacity': 0.15 } });
      map.addLayer({ id: 'accuracy-line', type: 'line', source: 'accuracy', paint: { 'line-color': '#1f2a44', 'line-width': 1, 'line-dasharray': [2, 2] } });
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#1f2a44', 'line-width': 3, 'line-dasharray': [1.5, 2], 'line-opacity': 0.85 } });
      loadedRef.current = true;
      setMapLoaded(true);
    });
    map.on('error', (e) => {
      // Tile and font hiccups are non-fatal; keep them out of the user's face.
      console.warn('map', (e as { error?: Error }).error?.message ?? e);
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __pppMap?: maplibregl.Map }).__pppMap = map; // headless tests drive the zoom
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  // --- position
  useEffect(() => {
    return watchPosition(
      (f) => {
        setFix(f);
        setGeoError(null);
        rememberFix(f.lat, f.lng);
      },
      (msg) => setGeoError(msg),
    );
  }, []);

  const [osmLoading, setOsmLoading] = useState(false);
  const [wide, setWide] = useState(false);

  /** Adds places to the pin set, dropping the farthest from the search centre past the cap. */
  const addPlaces = useCallback((lat: number, lng: number, incoming: OsmPlace[]) => {
    const m = placesRef.current;
    for (const p of incoming) m.set(p.id, p);
    // Claimed bathrooms must never be absorbed: keep them ahead of anything else.
    const claimedIds = new Set(Object.values(kingsRef.current).filter((k) => k.king_name).map((k) => k.id));
    const all = [...m.values()];
    const claimed = all.filter((p) => claimedIds.has(p.id));
    const deduped = dedupePlaces(all.filter((p) => !claimedIds.has(p.id)));
    m.clear();
    for (const p of claimed) m.set(p.id, p);
    for (const p of deduped) if (!m.has(p.id)) m.set(p.id, p);
    if (m.size > MAX_PINS) {
      const sorted = [...m.values()].sort((a, b) => haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng));
      m.clear();
      for (const p of sorted.slice(0, MAX_PINS)) m.set(p.id, p);
    }
    setPlaces([...m.values()]);
  }, []);

  const applyThrones = useCallback(
    (lat: number, lng: number, rows: NearbyLocation[]) => {
      setKings((k) => {
        const m = { ...k };
        for (const r of rows) m[r.id] = r;
        return m;
      });
      addPlaces(lat, lng, mergePlaces([], rows));
    },
    [addPlaces],
  );

  /**
   * Thrones from our database. Whatever this phone saw before shows at once;
   * the live answer replaces it. If the server can't be reached the map keeps
   * what it has and quietly tries again, never a dead end.
   */
  const loadThrones = useCallback(
    async (lat: number, lng: number) => {
      window.clearTimeout(retryRef.current);
      const cached = recallThrones(lat, lng, WIDE_RADIUS_M);
      if (cached.length) {
        applyThrones(lat, lng, cached);
        setLoading(false);
      }
      try {
        const rows = await api.nearby(lat, lng, WIDE_RADIUS_M);
        applyThrones(lat, lng, rows);
        rememberThrones(rows);
        setThronesDown('none');
      } catch {
        setThronesDown(cached.length || Object.keys(kingsRef.current).length ? 'stale' : 'empty');
        retryRef.current = window.setTimeout(() => {
          const last = lastSearchRef.current;
          if (last && last.lat === lat && last.lng === lng) void loadThrones(lat, lng);
        }, THRONES_RETRY_MS);
      }
      setLoading(false);
    },
    [applyThrones],
  );

  const search = useCallback(
    async (lat: number, lng: number) => {
      lastSearchRef.current = { lat, lng };
      setLoading(true);
      setOsmLoading(true);
      setNetError(null);
      setWide(false);
      // Thrones come from our own database: the cached copy first, then the live answer.
      const kingsP = loadThrones(lat, lng);
      // Bathrooms from OpenStreetMap; widen once if the neighbourhood is thin.
      try {
        let osm = await fetchBathrooms(lat, lng, SEARCH_RADIUS_M);
        addPlaces(lat, lng, osm);
        if (osm.length < MIN_RESULTS_BEFORE_WIDENING) {
          setWide(true);
          osm = await fetchBathrooms(lat, lng, WIDE_RADIUS_M);
          addPlaces(lat, lng, osm);
        }
      } catch (e) {
        setNetError(`Bathroom search failed: ${(e as Error).message}`);
      }
      setOsmLoading(false);
      await kingsP;
      setMoved(false);
    },
    [addPlaces, loadThrones],
  );

  // Auto-search as the map moves: once the centre is far enough from the last search.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let timer = 0;
    const onMove = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (map.getZoom() < MIN_AUTO_ZOOM) return;
        const c = map.getCenter();
        const last = lastSearchRef.current;
        if (last && haversine(c.lat, c.lng, last.lat, last.lng) < RESEARCH_DISTANCE_M) return;
        void search(c.lat, c.lng);
      }, 500);
    };
    const onZoom = () => setZoomStep(Math.round(map.getZoom() * 2));
    map.on('moveend', onMove);
    map.on('zoomend', onZoom);
    onZoom();
    return () => {
      window.clearTimeout(timer);
      map.off('moveend', onMove);
      map.off('zoomend', onZoom);
    };
  }, [search]);

  // First fix: centre and search.
  useEffect(() => {
    if (!fix || !mapRef.current) return;
    const map = mapRef.current;
    if (!userRef.current) {
      userRef.current = new maplibregl.Marker({ element: cartElement(), anchor: 'center' }).setLngLat([fix.lng, fix.lat]).addTo(map);
    } else userRef.current.setLngLat([fix.lng, fix.lat]);
    // Face the way you're moving (side view: just mirror east/west).
    const prev = lastFixRef.current;
    if (prev && haversine(prev.lat, prev.lng, fix.lat, fix.lng) > 6) {
      userRef.current.getElement().classList.toggle('west', fix.lng < prev.lng);
    }
    lastFixRef.current = fix;
    if (loadedRef.current) {
      const src = map.getSource('accuracy') as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features: [circlePolygon(fix.lng, fix.lat, fix.accuracy)] });
    }
    if (!searchedRef.current) {
      searchedRef.current = true;
      map.jumpTo({ center: [fix.lng, fix.lat], zoom: 15 });
      void search(fix.lat, fix.lng);
      setMoved(false);
    }
  }, [fix, search, mapLoaded]);

  // Markers: every bathroom is a flag coloured by throne state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const shown = filter === 'all' ? places : places.filter((p) => (filter === 'unclaimed' ? !kings[p.id]?.king_name : !!me && kings[p.id]?.king_user === me));
    const { singles, clusters } = clusterPlaces(shown, zoomStep / 2, kings, selected?.id ?? null);
    for (const p of singles) {
      seen.add(p.id);
      const html = pinHtml(p, kings[p.id], selected?.id === p.id, !!me && kings[p.id]?.king_user === me);
      let m = markersRef.current.get(p.id);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'pin-wrap';
        el.innerHTML = html;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          unlockAudio();
          setSelected(p);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
        m = { marker, el };
        markersRef.current.set(p.id, m);
      } else if (m.el.innerHTML !== html) m.el.innerHTML = html;
      m.el.style.zIndex = selected?.id === p.id ? '30' : kings[p.id]?.king_name ? '20' : '10';
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.marker.remove();
        markersRef.current.delete(id);
      }
    }
    // Count bubbles: tap one to zoom into it.
    const seenClusters = new Set<string>();
    for (const c of clusters) {
      seenClusters.add(c.key);
      const html = clusterHtml(c);
      let m = clustersRef.current.get(c.key);
      if (!m) {
        const el = document.createElement('div');
        el.className = 'pin-wrap';
        el.innerHTML = html;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          unlockAudio();
          const b = new maplibregl.LngLatBounds();
          for (const p of c.members) b.extend([p.lng, p.lat]);
          map.fitBounds(b, { padding: 90, maxZoom: Math.max(map.getZoom() + 2, CLUSTER_MAX_ZOOM + 0.5), duration: 500 });
        });
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lng, c.lat]).addTo(map);
        m = { marker, el };
        clustersRef.current.set(c.key, m);
      } else if (m.el.innerHTML !== html) m.el.innerHTML = html;
      m.el.style.zIndex = c.claimed ? '21' : '11';
    }
    for (const [key, m] of clustersRef.current) {
      if (!seenClusters.has(key)) {
        m.marker.remove();
        clustersRef.current.delete(key);
      }
    }
  }, [places, kings, selected, fix, zoomStep, me, filter]);

  // Preview + founding on select.
  useEffect(() => {
    if (!selected) return;
    rememberPlace(selected);
    setPreviewError(null);
    if (board?.id !== selected.id) {
      const id = selected.id;
      api
        .locationBoard(id, 5)
        .then((rows) => setBoard((b) => (selected && id === selected.id ? { id, rows } : b)))
        .catch(() => setBoard({ id, rows: [] }));
    }
    if (preview?.id === selected.id) return;
    let cancelled = false;
    const signal = { cancelled: false };
    setBuilding(null);
    loadCourse(selected, { signal, onProgress: (n) => !cancelled && setBuilding({ id: selected.id, n }) })
      .then((r) => {
        if (cancelled) return;
        setBuilding(null);
        setPreview({ id: selected.id, holes: r.holes, par: r.par, king: r.king });
        const kg = r.king;
        if (kg) {
          setKings((k) => ({
            ...k,
            [selected.id]: {
              ...(k[selected.id] ?? { id: selected.id, name: selected.name, poi_type: selected.poiType, lat: selected.lat, lng: selected.lng, theme: r.location.theme, difficulty: r.location.difficulty, hole_par: null, distance_m: 0, run_count: 0 }),
              par: r.par,
              king_name: kg.display_name,
              king_score: kg.score,
              king_user: kg.user_id,
              king_since: kg.created_at,
              king_holes: kg.hole_scores,
              king_elapsed_ms: kg.elapsed_ms,
            },
          }));
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setPreviewError(e.message);
      });
    return () => {
      cancelled = true;
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Dashed line from you to the selected bathroom, kept current as you move.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!fix || !selected) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [fix.lng, fix.lat],
              [selected.lng, selected.lat],
            ],
          },
        },
      ],
    });
  }, [fix, selected, mapLoaded]);

  // Dwell countdown ticks once a second while a sheet is open.
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => setCheckinTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);

  const distance = useMemo(() => (fix && selected ? haversine(fix.lat, fix.lng, selected.lat, selected.lng) : null), [fix, selected]);
  const inRange = distance !== null && fix !== null && distance <= CLAIM_RADIUS_M + Math.min(fix.accuracy, CLAIM_RADIUS_M);
  const ci = selected ? checkinAt(selected.id) : null;
  void checkinTick;
  const dwellLeft = ci ? Math.max(0, DWELL_SECONDS - (Date.now() - ci) / 1000) : null;
  const checkinFresh = ci !== null && Date.now() - ci < 45 * 60 * 1000;
  const ready = inRange && checkinFresh && dwellLeft === 0;

  const doCheckin = async () => {
    if (!selected || !fix) return;
    setCheckinBusy(true);
    setCheckinError(null);
    try {
      await api.checkin(selected.id, fix.lat, fix.lng, fix.accuracy);
      recordCheckin(selected.id);
    } catch (e) {
      setCheckinError((e as Error).message);
    } finally {
      setCheckinBusy(false);
    }
  };

  const playThrone = () => {
    if (!selected) return;
    if (!name) {
      setAskName(true);
      return;
    }
    navigate('play', null, null, { loc: selected.id, mode: 'throne' });
  };
  const playPractice = () => {
    if (!selected) return;
    navigate('play', null, null, { loc: selected.id, mode: 'practice' });
  };

  const closest = () => {
    if (!fix) {
      setNotice('Waiting for your location…');
      return;
    }
    if (!places.length) {
      setNotice('No bathrooms loaded yet. Give the search a second.');
      return;
    }
    let best: OsmPlace | null = null;
    let bestD = Infinity;
    for (const p of places) {
      const d = haversine(fix.lat, fix.lng, p.lat, p.lng);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    unlockAudio();
    setNotice(null);
    setSelected(best);
    mapRef.current?.fitBounds(
      [
        [Math.min(fix.lng, best.lng), Math.min(fix.lat, best.lat)],
        [Math.max(fix.lng, best.lng), Math.max(fix.lat, best.lat)],
      ],
      { padding: { top: 120, bottom: 420, left: 60, right: 60 }, maxZoom: 17, duration: 600 },
    );
  };

  const recentre = () => {
    if (fix && mapRef.current) {
      mapRef.current.flyTo({ center: [fix.lng, fix.lat], zoom: 15, duration: 500 });
      setMoved(false);
    }
  };

  const king = selected ? kings[selected.id] : undefined;
  const band = selected ? bandFor(selected.poiType, selected.id) : null;
  const themeName = selected ? themeById(king?.theme ?? band!.theme).name : '';
  const difficulty = (king?.difficulty ?? band?.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard';
  const difficultyRolls = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2;
  const difficultyLabel = difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Medium';
  const coursePar = preview && selected && preview.id === selected.id ? preview.par : (king?.par ?? null);
  const myBest = board && selected && board.id === selected.id ? (board.rows.find((r) => r.user_id === me)?.score ?? null) : null;
  const claimedCount = Object.values(kings).filter((k) => k.king_name).length;

  return (
    <div className={`map-screen ${zoomClass}`}>
      <div ref={mapEl} className="map-canvas" />

      <div className="map-head">
        <div className="map-badge">📍</div>
        <div className="map-title">
          <div className="map-title-main">Nearby thrones</div>
          <div className="map-title-sub">
            {!fix && !geoError
              ? 'finding you…'
              : geoError && !places.length
                ? 'no location'
                : osmLoading
                  ? `${wide ? 'widening the search' : 'searching OpenStreetMap'}… ${places.length ? `${places.length} so far` : ''}`
                  : loading
                    ? `${places.length} bathrooms · loading thrones…`
                    : places.length
                      ? `${places.length} bathrooms · ${claimedCount} claimed`
                      : 'no bathrooms found here'}
          </div>
        </div>
        <button className="name-chip" onClick={() => setAskName(true)} title="Your account">
          <Avatar av={getSavedAvatar()} size={22} className="chip-avatar" />
          {name ?? 'Set name'}
        </button>
      </div>

      <div className="map-filters">
        {(
          [
            ['all', 'All'],
            ['unclaimed', 'Unclaimed'],
            ['mine', 'Yours'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="map-tools">
        {moved && fix && osmLoading && <div className="map-tool quiet">searching…</div>}
        {thronesDown === 'stale' && <div className="map-tool quiet">reconnecting…</div>}
        <button className="map-tool" onClick={closest} title="Closest bathroom">
          🚽 Closest
        </button>
        {fix && !selected && (
          <button className="map-tool" onClick={() => setFounding(true)} title="Add a bathroom at your location">
            ➕ Found one
          </button>
        )}
        <button className="map-tool round" onClick={recentre} title="Recentre">
          ◎
        </button>
      </div>

      {notice && <div className="map-toast">{notice}</div>}

      {report && (
        <ReportSheet
          userId={report.id}
          name={report.name}
          onClose={(msg) => {
            setReport(null);
            if (msg) setNotice(msg);
          }}
        />
      )}

      {founding && fix && (
        <FoundSheet
          fix={fix}
          onClose={() => setFounding(false)}
          onFound={(p) => {
            setFounding(false);
            addPlaces(p.lat, p.lng, [p]);
            setSelected(p);
            setNotice(`${p.name} is on the map. First to sink it takes the throne.`);
          }}
        />
      )}

      {thronesDown === 'empty' && !geoError && !netError && !selected && (
        <div className="map-notice">
          Can't reach the clubhouse right now. Trying again…
          {fix && <button onClick={() => void loadThrones(fix.lat, fix.lng)}>Retry</button>}
        </div>
      )}
      {(geoError || netError) && !selected && (
        <div className="map-notice">
          {geoError ?? netError}
          {!geoError && netError && fix && (
            <button onClick={() => void search(fix.lat, fix.lng)}>Retry</button>
          )}
          {geoError && (
            <button
              onClick={() => {
                setGeoError(null);
                navigator.geolocation?.getCurrentPosition(
                  (p) => setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
                  (e) => setGeoError(e.message),
                  { enableHighAccuracy: true },
                );
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {selected && (
        <div className="map-sheet pop">
          <button className="sheet-close" onClick={() => setSelected(null)}>
            ✕
          </button>
          <div className="sheet-head">
            <span className="sheet-icon">{POI_ICON[selected.poiType] ?? '🚽'}</span>
            <div>
              <div className="sheet-name">{selected.name}</div>
              <div className="sheet-sub">
                {POI_LABEL[selected.poiType] ?? 'Bathroom'} · {themeName}
                {` · ${HOLES_PER_COURSE} holes`}
                {preview?.id === selected.id ? ` · par ${preview.par}` : king?.par ? ` · par ${king.par}` : ''}
              </div>
            </div>
          </div>

          {distance !== null && (
            <div className={`sheet-dist${inRange ? ' here' : ''}`}>
              <span className="dist-num">{fmtDistance(distance)}</span>
              <span className="dist-sub">{inRange ? "you're here" : `about ${Math.max(1, Math.round(distance / 80))} min walk`}</span>
            </div>
          )}

          <div className={`king-banner${king?.king_name ? (king.king_user === me ? ' mine' : ' held') : ' empty'}`}>
            {king?.king_name ? (
              <>
                <Avatar av={king.king_avatar} size={76} className="kb-avatar" />
                <div className="kb-text">
                  <div className="kb-label">👑 {king.king_user === me ? 'You are King of the Throne' : 'King of the Throne'}</div>
                  <button className="kb-name" onClick={() => navigate('profile', null, null, { user: king.king_user ?? undefined })}>
                    {king.king_name}
                  </button>
                  <div className="kb-score">
                    <strong>{king.king_score}</strong>
                    {king.par ? <span> on par {king.par}</span> : null}
                    {king.king_holes && <span className="dim"> · {king.king_holes.join('-')}</span>}
                    {king.king_elapsed_ms !== null && king.king_elapsed_ms !== undefined && <span className="dim"> · ⏱ {fmtElapsed(king.king_elapsed_ms)}</span>}
                  </div>
                  {king.king_since && <div className="kb-since">holding it {ago(king.king_since)}</div>}
                </div>
                {king.king_user && king.king_user !== me && (
                  <button className="flag-btn kb-flag" title="Report this player" onClick={() => setReport({ id: king.king_user!, name: king.king_name! })}>
                    ⚑
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="kb-empty-icon">🪑</span>
                <div className="kb-text">
                  <div className="kb-label">No king yet</div>
                  <div className="kb-name static">The throne is empty</div>
                  <div className="kb-score dim">Three holes. Fewest strokes takes it; ties go to the faster round.</div>
                </div>
              </>
            )}
          </div>

          <div className="facts">
            <span className="fact" title="Difficulty">
              {'🧻'.repeat(difficultyRolls)} {difficultyLabel}
            </span>
            {coursePar !== null && <span className="fact">Par {coursePar}</span>}
            {king?.king_score !== null && king?.king_score !== undefined && <span className="fact">Record {king.king_score}</span>}
            {king?.run_count !== undefined && king.run_count > 0 && <span className="fact">{king.run_count} {king.run_count === 1 ? 'run' : 'runs'}</span>}
            {myBest !== null && <span className="fact you">You {myBest}</span>}
          </div>

          {board?.id === selected.id && board.rows.length > 0 && (
            <ol className="sheet-board">
              {board.rows.map((r) => (
                <li key={r.user_id} className={r.user_id === me ? 'me' : ''}>
                  <span className="rank">{r.rank === 1 ? '👑' : r.rank}</span>
                  <span className="who">
                    <Avatar av={r.avatar} size={22} className="row-avatar" />
                    {r.display_name}
                  </span>
                  <span className="stat">
                    {r.score}
                    {r.hole_scores && <small> {r.hole_scores.join('-')}</small>}
                  </span>
                  <span className="when">{r.elapsed_ms !== null ? fmtElapsed(r.elapsed_ms) : ''}</span>
                </li>
              ))}
            </ol>
          )}

          {preview?.id === selected.id ? (
            <div className="sheet-holes">
              {preview.holes.map((h, i) => (
                <HolePreview key={h.id} hole={h} label={`${i + 1} · par ${h.par}`} />
              ))}
            </div>
          ) : previewError ? (
            <div className="sheet-err">{previewError}</div>
          ) : (
            <div className="sheet-preview loading">{building?.id === selected.id ? `building hole ${building.n} of ${HOLES_PER_COURSE}…` : 'loading course…'}</div>
          )}

          <div className="sheet-actions">
            {!fix ? (
              <button className="primary" disabled>
                Waiting for GPS…
              </button>
            ) : !inRange ? (
              <button className="primary" disabled>
                Get within {CLAIM_RADIUS_M} m · you&apos;re {distance !== null ? fmtDistance(distance) : '?'} away
              </button>
            ) : !checkinFresh ? (
              <button className="primary" disabled={checkinBusy} onClick={() => void doCheckin()}>
                {checkinBusy ? 'Checking in…' : "Check in · I'm here"}
              </button>
            ) : !ready ? (
              <button className="primary" disabled>
                Warming the seat… {Math.ceil(dwellLeft ?? 0)} s
              </button>
            ) : (
              <button className="primary throne" onClick={playThrone}>
                {king?.king_name ? (king.king_user === me ? '👑 Defend your throne' : `⚔️ Challenge ${king.king_name}`) : '👑 Claim the empty throne'}
              </button>
            )}
            {checkinError && <div className="sheet-err">{checkinError}</div>}
            <button onClick={playPractice}>Practice this course</button>
          </div>
        </div>
      )}

      {!selected && !askName && <TabBar active="map" />}

      {askName && (
        <AccountSheet
          onClose={(n) => {
            setName(n);
            setAskName(false);
          }}
        />
      )}
    </div>
  );
}
