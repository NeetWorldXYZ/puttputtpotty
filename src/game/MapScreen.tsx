import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Hole } from '../sim/types';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { themeById } from '../render/themes';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import { HOLES_PER_COURSE, api, fmtElapsed, type King, type LocationRow, type NearbyLocation } from '../net/api';
import { currentUserId } from '../net/supabase';
import { fetchBathrooms, type OsmPlace } from '../net/overpass';
import { fmtDistance, haversine, watchPosition, type Fix } from '../net/geo';
import { CLAIM_RADIUS_M, DWELL_SECONDS } from '../net/config';
import { POI_ICON, POI_LABEL, bandFor, checkinAt, recallFix, recordCheckin, rememberFix, rememberPlace } from '../net/places';
import { getSavedName } from '../net/supabase';
import { loadCourse } from '../net/course';
import { navigate } from '../router';
import { NamePrompt } from './NamePrompt';
import { unlockAudio } from './sound';

const SEARCH_RADIUS_M = 3000;
const WIDE_RADIUS_M = 12000;
const MIN_RESULTS_BEFORE_WIDENING = 4;
/** Auto-search when the map centre drifts this far from the last search. */
const RESEARCH_DISTANCE_M = 1800;
const MIN_AUTO_ZOOM = 11;
const MAX_PINS = 400;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
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
      return p.poiType === 'toilets' ? d < 150 : d < 40;
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

function pinHtml(p: OsmPlace, king: NearbyLocation | undefined, selected: boolean): string {
  const icon = POI_ICON[p.poiType] ?? '🚽';
  const crown = king?.king_name ? '<span class="pin-crown">👑</span>' : '';
  const score = king?.king_score != null ? `<span class="pin-score">${king.king_score}</span>` : '';
  return `<div class="pin${selected ? ' selected' : ''}${king?.king_name ? ' claimed' : ''}">${crown}<span class="pin-icon">${icon}</span>${score}</div>`;
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

/** Golf-ball "you are here" marker. */
function ballIcon(): L.DivIcon {
  return L.divIcon({ html: '<div class="you-ring"></div><div class="you-ball"><i></i><i></i><i></i></div>', className: 'you-wrap', iconSize: [36, 36], iconAnchor: [18, 18] });
}

export function MapScreen() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userRef = useRef<{ dot: L.Marker; ring: L.Circle } | null>(null);
  const lastSearchRef = useRef<{ lat: number; lng: number } | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
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
  const [selected, setSelected] = useState<OsmPlace | null>(null);
  const [preview, setPreview] = useState<{ id: string; holes: Hole[]; par: number; king: King | null } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ id: string; n: number } | null>(null);
  const [board, setBoard] = useState<{ id: string; rows: LocationRow[] } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void currentUserId().then(setMe);
  }, []);
  const [moved, setMoved] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinTick, setCheckinTick] = useState(0);
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState(getSavedName());
  const searchedRef = useRef(false);

  // --- map
  useEffect(() => {
    const el = mapEl.current;
    if (!el || mapRef.current) return;
    const start = recallFix() ?? { lat: 40.7484, lng: -73.9857 };
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], recallFix() ? 15 : 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    map.on('click', () => setSelected(null));
    map.on('dragend zoomend', () => setMoved(true));
    const onZoom = () => {
      const z = map.getZoom();
      setZoomClass(z < 12 ? 'z-low' : z < 14.5 ? 'z-mid' : 'z-high');
    };
    map.on('zoomend', onZoom);
    onZoom();
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
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
    const deduped = dedupePlaces([...m.values()].filter((p) => !claimedIds.has(p.id)));
    m.clear();
    for (const p of incoming) if (claimedIds.has(p.id)) m.set(p.id, p);
    for (const p of deduped) if (!m.has(p.id)) m.set(p.id, p);
    if (m.size > MAX_PINS) {
      const sorted = [...m.values()].sort((a, b) => haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng));
      m.clear();
      for (const p of sorted.slice(0, MAX_PINS)) m.set(p.id, p);
    }
    setPlaces([...m.values()]);
  }, []);

  const search = useCallback(
    async (lat: number, lng: number) => {
      lastSearchRef.current = { lat, lng };
      setLoading(true);
      setOsmLoading(true);
      setNetError(null);
      setWide(false);
      // Thrones come from our own database and are fast; show them as soon as they land.
      const kingsP = withTimeout(api.nearby(lat, lng, WIDE_RADIUS_M), 12000, 'Thrones').then(
        (rows) => {
          setKings((k) => {
            const m = { ...k };
            for (const r of rows) m[r.id] = r;
            return m;
          });
          addPlaces(lat, lng, mergePlaces([], rows));
          setLoading(false);
        },
        (e: Error) => {
          setNetError(`Thrones unavailable: ${e.message}`);
          setLoading(false);
        },
      );
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
    [addPlaces],
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
    map.on('moveend', onMove);
    return () => {
      window.clearTimeout(timer);
      map.off('moveend', onMove);
    };
  }, [search]);

  // First fix: centre and search.
  useEffect(() => {
    if (!fix || !mapRef.current) return;
    if (!userRef.current) {
      const ring = L.circle([fix.lat, fix.lng], { radius: fix.accuracy, color: '#1f2a44', weight: 1, dashArray: '4 4', fillColor: '#ffd166', fillOpacity: 0.12, interactive: false }).addTo(mapRef.current);
      const dot = L.marker([fix.lat, fix.lng], { icon: ballIcon(), interactive: false, zIndexOffset: 2000 }).addTo(mapRef.current);
      userRef.current = { dot, ring };
    } else {
      userRef.current.dot.setLatLng([fix.lat, fix.lng]);
      userRef.current.ring.setLatLng([fix.lat, fix.lng]).setRadius(fix.accuracy);
    }
    if (!searchedRef.current) {
      searchedRef.current = true;
      mapRef.current.setView([fix.lat, fix.lng], 16);
      void search(fix.lat, fix.lng);
      setMoved(false);
    }
  }, [fix, search]);

  // Markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const p of places) {
      seen.add(p.id);
      const html = pinHtml(p, kings[p.id], selected?.id === p.id);
      const icon = L.divIcon({ html, className: 'pin-wrap', iconSize: [44, 44], iconAnchor: [22, 40] });
      let m = markersRef.current.get(p.id);
      if (!m) {
        m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        m.on('click', () => {
          unlockAudio();
          setSelected(p);
        });
        markersRef.current.set(p.id, m);
      } else m.setIcon(icon);
      m.setZIndexOffset(selected?.id === p.id ? 1000 : kings[p.id]?.king_name ? 100 : 0);
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
  }, [places, kings, selected]);

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
    if (!map) return;
    if (!fix || !selected) {
      lineRef.current?.remove();
      lineRef.current = null;
      return;
    }
    const pts: [number, number][] = [
      [fix.lat, fix.lng],
      [selected.lat, selected.lng],
    ];
    if (!lineRef.current) lineRef.current = L.polyline(pts, { color: '#1f2a44', weight: 3, dashArray: '6 8', opacity: 0.8, interactive: false }).addTo(map);
    else lineRef.current.setLatLngs(pts);
  }, [fix, selected]);

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
      L.latLngBounds([
        [fix.lat, fix.lng],
        [best.lat, best.lng],
      ]),
      { paddingTopLeft: [60, 120], paddingBottomRight: [60, 420], maxZoom: 18 },
    );
  };

  const recentre = () => {
    if (fix && mapRef.current) {
      mapRef.current.setView([fix.lat, fix.lng], 16);
      setMoved(false);
    }
  };

  const king = selected ? kings[selected.id] : undefined;
  const band = selected ? bandFor(selected.poiType, selected.id) : null;
  const themeName = selected ? themeById(king?.theme ?? band!.theme).name : '';
  const claimedCount = Object.values(kings).filter((k) => k.king_name).length;

  return (
    <div className={`map-screen ${zoomClass}`}>
      <div ref={mapEl} className="map-canvas" />

      <div className="map-head">
        <button className="corner-btn" onClick={() => navigate('play')} title="Title screen">
          ⌂
        </button>
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
        <button className="corner-btn" onClick={() => navigate('leaders')} title="Leaderboard">
          🏆
        </button>
        <button className="name-chip" onClick={() => setAskName(true)} title="Change name">
          {name ?? 'Set name'}
        </button>
      </div>

      <div className="map-tools">
        {moved && fix && osmLoading && <div className="map-tool quiet">searching…</div>}
        <button className="map-tool" onClick={closest} title="Closest bathroom">
          🚽 Closest
        </button>
        <button className="map-tool round" onClick={recentre} title="Recentre">
          ◎
        </button>
      </div>

      {notice && <div className="map-toast">{notice}</div>}

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

          <div className={`throne-line${king?.king_name ? ' held' : ''}`}>
            {king?.king_name ? (
              <>
                <span className="crown">👑</span>
                <span>
                  <strong>{king.king_name}</strong> holds the throne with <strong>{king.king_score}</strong>
                  {king.king_holes && <span className="dim"> ({king.king_holes.join('-')})</span>}
                  {king.king_elapsed_ms !== null && king.king_elapsed_ms !== undefined && <span className="dim"> in {fmtElapsed(king.king_elapsed_ms)}</span>}
                  {king.king_since && <span className="dim"> · {ago(king.king_since)}</span>}
                </span>
              </>
            ) : (
              <>
                <span className="crown">🪑</span>
                <span>The throne is empty. Fewest strokes over three holes wins; ties go to the faster round.</span>
              </>
            )}
          </div>

          {board?.id === selected.id && board.rows.length > 0 && (
            <ol className="sheet-board">
              {board.rows.map((r) => (
                <li key={r.user_id} className={r.user_id === me ? 'me' : ''}>
                  <span className="rank">{r.rank === 1 ? '👑' : r.rank}</span>
                  <span className="who">{r.display_name}</span>
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
                Get within {CLAIM_RADIUS_M} m to play for the throne
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
                👑 Play for the throne
              </button>
            )}
            {checkinError && <div className="sheet-err">{checkinError}</div>}
            <button onClick={playPractice}>Practice this course</button>
          </div>
        </div>
      )}

      {askName && (
        <NamePrompt
          onDone={(n) => {
            setName(n);
            setAskName(false);
          }}
          onCancel={() => setAskName(false)}
        />
      )}
    </div>
  );
}
