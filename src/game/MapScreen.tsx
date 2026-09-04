import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Hole } from '../sim/types';
import { drawHole } from '../render/drawHole';
import { fitCamera } from '../render/camera';
import { themeById } from '../render/themes';
import { DEFAULT_PARAMS, cupRadius } from '../sim/params';
import { api, type King, type NearbyLocation } from '../net/api';
import { fetchBathrooms, type OsmPlace } from '../net/overpass';
import { fmtDistance, haversine, watchPosition, type Fix } from '../net/geo';
import { CLAIM_RADIUS_M, DWELL_SECONDS } from '../net/config';
import { POI_ICON, POI_LABEL, bandFor, checkinAt, recallFix, recordCheckin, rememberFix, rememberPlace } from '../net/places';
import { getSavedName } from '../net/supabase';
import { navigate } from '../router';
import { NamePrompt } from './NamePrompt';
import { unlockAudio } from './sound';

const SEARCH_RADIUS_M = 1500;

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
function HolePreview({ hole }: { hole: Hole }) {
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
  return <canvas ref={ref} className="sheet-preview" />;
}

export function MapScreen() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userRef = useRef<{ dot: L.CircleMarker; ring: L.Circle } | null>(null);

  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [places, setPlaces] = useState<OsmPlace[]>([]);
  const [kings, setKings] = useState<Record<string, NearbyLocation>>({});
  const [loading, setLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OsmPlace | null>(null);
  const [preview, setPreview] = useState<{ id: string; hole: Hole; king: King | null } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
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

  const search = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setNetError(null);
    const [placesRes, kingsRes] = await Promise.allSettled([fetchBathrooms(lat, lng, SEARCH_RADIUS_M), api.nearby(lat, lng, SEARCH_RADIUS_M * 2)]);
    if (placesRes.status === 'fulfilled') setPlaces(placesRes.value);
    else setNetError(`Bathroom search failed: ${(placesRes.reason as Error).message}`);
    if (kingsRes.status === 'fulfilled') {
      const m: Record<string, NearbyLocation> = {};
      for (const k of kingsRes.value) m[k.id] = k;
      setKings(m);
    } else if (placesRes.status === 'fulfilled') setNetError(`Thrones unavailable: ${(kingsRes.reason as Error).message}`);
    setLoading(false);
    setMoved(false);
  }, []);

  // First fix: centre and search.
  useEffect(() => {
    if (!fix || !mapRef.current) return;
    if (!userRef.current) {
      const ring = L.circle([fix.lat, fix.lng], { radius: fix.accuracy, color: '#4da3ff', weight: 1, fillColor: '#4da3ff', fillOpacity: 0.12, interactive: false }).addTo(mapRef.current);
      const dot = L.circleMarker([fix.lat, fix.lng], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2f7fff', fillOpacity: 1, interactive: false }).addTo(mapRef.current);
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
    if (preview?.id === selected.id) return;
    let cancelled = false;
    api
      .hole(selected)
      .then((r) => {
        if (cancelled) return;
        setPreview({ id: selected.id, hole: r.hole, king: r.king });
        const kg = r.king;
        if (kg) {
          setKings((k) => ({
            ...k,
            [selected.id]: {
              ...(k[selected.id] ?? { id: selected.id, name: selected.name, poi_type: selected.poiType, lat: selected.lat, lng: selected.lng, theme: r.location.theme, difficulty: r.location.difficulty, distance_m: 0, run_count: 0 }),
              hole_par: r.hole.par,
              king_name: kg.display_name,
              king_score: kg.score,
              king_user: kg.user_id,
              king_since: kg.created_at,
            },
          }));
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setPreviewError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Dwell countdown ticks once a second while a sheet is open.
  useEffect(() => {
    if (!selected) return;
    const id = setInterval(() => setCheckinTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [selected]);

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

  const recentre = () => {
    if (fix && mapRef.current) {
      mapRef.current.setView([fix.lat, fix.lng], 16);
      setMoved(false);
    }
  };
  const searchHere = () => {
    const c = mapRef.current?.getCenter();
    if (c) void search(c.lat, c.lng);
  };

  const king = selected ? kings[selected.id] : undefined;
  const band = selected ? bandFor(selected.poiType, selected.id) : null;
  const themeName = selected ? themeById(king?.theme ?? band!.theme).name : '';
  const claimedCount = Object.values(kings).filter((k) => k.king_name).length;

  return (
    <div className="map-screen">
      <div ref={mapEl} className="map-canvas" />

      <div className="map-head">
        <button className="corner-btn" onClick={() => navigate('play')} title="Title screen">
          ⌂
        </button>
        <div className="map-title">
          <div className="map-title-main">Nearby thrones</div>
          <div className="map-title-sub">
            {loading ? 'searching…' : places.length ? `${places.length} bathrooms · ${claimedCount} claimed` : geoError ? 'no location' : fix ? 'no bathrooms in range' : 'finding you…'}
          </div>
        </div>
        <button className="name-chip" onClick={() => setAskName(true)} title="Change name">
          {name ?? 'Set name'}
        </button>
      </div>

      <div className="map-tools">
        {moved && fix && (
          <button className="map-tool" onClick={searchHere}>
            Search this area
          </button>
        )}
        <button className="map-tool round" onClick={recentre} title="Recentre">
          ◎
        </button>
      </div>

      {(geoError || netError) && !selected && (
        <div className="map-notice">
          {geoError ?? netError}
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
                {preview?.hole ? ` · par ${preview.hole.par}` : king?.hole_par ? ` · par ${king.hole_par}` : ''}
                {distance !== null && ` · ${fmtDistance(distance)} away`}
              </div>
            </div>
          </div>

          <div className={`throne-line${king?.king_name ? ' held' : ''}`}>
            {king?.king_name ? (
              <>
                <span className="crown">👑</span>
                <span>
                  <strong>{king.king_name}</strong> holds the throne with <strong>{king.king_score}</strong>
                  {king.king_since && <span className="dim"> · {ago(king.king_since)}</span>}
                </span>
              </>
            ) : (
              <>
                <span className="crown">🪑</span>
                <span>The throne is empty. First to finish it is King.</span>
              </>
            )}
          </div>

          {preview?.id === selected.id ? <HolePreview hole={preview.hole} /> : previewError ? <div className="sheet-err">{previewError}</div> : <div className="sheet-preview loading">loading hole…</div>}

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
            <button onClick={playPractice}>Practice this hole</button>
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
