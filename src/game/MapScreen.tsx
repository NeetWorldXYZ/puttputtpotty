import { MenuVolume } from './MenuControls';
import { placeNameProblem } from '../net/wordfilter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COURSE_STYLE, circlePolygon } from './mapStyle';
import { themeById } from '../render/themes';
import { HOLES_PER_COURSE, api, fmtElapsed, type King, type LocationRow, type NearbyLocation, type PlaceQueue, type PlaceReason } from '../net/api';
import { currentUserId, ensureSession, getSavedAvatar } from '../net/supabase';
import { loadProfile } from '../net/supabase';
import { fetchBathrooms, type OsmPlace } from '../net/overpass';
import { fmtDistance, haversine, watchPosition, type Fix } from '../net/geo';
import { CLAIM_RADIUS_M } from '../net/config';
import { POI_ICON, POI_LABEL, bandFor, checkinAt, recallFix, recordCheckin, rememberFix, rememberPlace } from '../net/places';
import { getSavedName } from '../net/supabase';
import { loadCourse } from '../net/course';
import { navigate } from '../router';
import { AccountSheet } from './AccountSheet';
import { ReportSheet } from './ReportSheet';
import { Avatar } from './Avatar';
import { TabBar } from './TabBar';
import { sfx, unlockAudio } from './sound';
import { GameIcon } from './GameIcon';
import './ThroneSheet.css';

const SEARCH_RADIUS_M = 3000;
const WIDE_RADIUS_M = 12000;
const MIN_RESULTS_BEFORE_WIDENING = 4;
/** Auto-search when the map centre drifts this far from the last search. */
const RESEARCH_DISTANCE_M = 1800;
const MIN_AUTO_ZOOM = 10;
const MAX_PINS = 400;
/** Bathrooms this close get their course built in the background, a few at a time. */
const WARM_RADIUS_M = 800;
const WARM_MAX = 4;
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
function rememberThrones(rows: NearbyLocation[], gone: string[] = []): void {
  if (!rows.length && !gone.length) return;
  try {
    const have = JSON.parse(localStorage.getItem(THRONES_CACHE_KEY) ?? '[]') as NearbyLocation[];
    const m = new Map<string, NearbyLocation>();
    for (const r of have) m.set(r.id, r);
    for (const r of rows) m.set(r.id, r);
    // Places the server no longer lists (hidden, closed) leave the cache too, or they would haunt the map.
    for (const id of gone) m.delete(id);
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

const THRONE_GLYPH = `<svg class="throne-glyph" viewBox="0 0 40 48" aria-hidden="true"><path d="m8 12-3-9 9 5 6-7 6 7 9-5-3 9Z" fill="#ffdc65" stroke="#14213d" stroke-width="2"/><rect x="9" y="14" width="22" height="13" rx="3" fill="white" stroke="#14213d" stroke-width="2"/><path d="M6 27h28q0 13-11 14l3 5H14l3-5Q6 40 6 27Z" fill="white" stroke="#14213d" stroke-width="2"/><ellipse cx="20" cy="28" rx="12" ry="4" fill="#55d9f0" stroke="#14213d" stroke-width="2"/></svg>`;

/**
 * A pin says one thing at a glance: empty throne (white), taken (gold with
 * the king's score), or yours (gold with a glow).
 */
function pinHtml(_p: OsmPlace, king: NearbyLocation | undefined, selected: boolean, mine: boolean): string {
  const claimed = !!king?.king_name;
  const pending = king?.status === 'pending';
  const badge = claimed && king!.king_score !== null ? `<span class="pin-score">${king!.king_score}</span>` : '';
  return `<div class="pin${selected ? ' selected' : ''}${claimed ? ' claimed' : ''}${mine ? ' mine' : ''}${pending ? ' pending' : ''}"><span class="pin-icon">${THRONE_GLYPH}</span>${badge}</div>`;
}

/** A throne row for a place the server has not scored yet. */
function emptyKing(p: OsmPlace): NearbyLocation {
  const band = bandFor(p.poiType, p.id);
  return { id: p.id, name: p.name, poi_type: p.poiType, lat: p.lat, lng: p.lng, theme: band.theme, difficulty: band.difficulty, hole_par: null, par: null, distance_m: 0, king_name: null, king_score: null, king_user: null, king_since: null, king_holes: null, king_elapsed_ms: null, king_avatar: null, run_count: 0, status: 'live' };
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
  return `<div class="cluster${c.claimed ? ' claimed' : ''}${big ? ' big' : ''}"><span class="cluster-count">${c.members.length}</span><span class="cluster-icon">${THRONE_GLYPH}</span></div>`;
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

/** "Found a bathroom here": name it, say what it is, and it goes on the map at your feet (or where you drop the pin). */
type FoundDraft = { name: string; type: string };

function FoundSheet({
  fix,
  pin,
  draft,
  setDraft,
  isAdmin,
  onDropPin,
  onClose,
  onFound,
}: {
  fix: { lat: number; lng: number; accuracy: number };
  pin: { lat: number; lng: number } | null;
  draft: FoundDraft;
  setDraft: (d: FoundDraft) => void;
  isAdmin: boolean;
  onDropPin: () => void;
  onClose: () => void;
  onFound: (p: OsmPlace, status: 'live' | 'pending') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = draft.name.trim();
  const gpsBad = fix.accuracy > 100 && !isAdmin;
  const pinDist = pin ? haversine(fix.lat, fix.lng, pin.lat, pin.lng) : 0;
  const submit = async () => {
    const problem = trimmed.length < 2 ? 'Give it a name.' : placeNameProblem(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { location, status } = await api.found(trimmed, draft.type, fix.lat, fix.lng, fix.accuracy, pin);
      sfx.jingle();
      onFound(location, status);
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
        <div className="sub">
          {pin ? `The pin is set, ${fmtDistance(pinDist)} from you.` : `It goes where you're standing${gpsBad ? ` (GPS is ${Math.round(fix.accuracy)} m off, get outside first)` : ''}. Somewhere else? Drop a pin on the map.`}
          {!isAdmin && ' New places show up for everyone once they are approved.'}
        </div>
        <input className="name-input" maxLength={40} placeholder="What's it called?" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
        <div className="found-types">
          {FOUND_TYPES.map(([id, label]) => (
            <button key={id} className={`chip${draft.type === id ? ' active' : ''}`} onClick={() => setDraft({ ...draft, type: id })}>
              {POI_ICON[id] ?? '🚽'} {label}
            </button>
          ))}
        </div>
        {error && <div className="err">{error}</div>}
        <button className="primary" disabled={trimmed.length < 2 || busy || gpsBad} onClick={() => void submit()}>
          {busy ? 'Adding…' : 'Put it on the map'}
        </button>
        <button onClick={onDropPin}>{pin ? '📍 Move the pin' : '📍 Drop a pin on the map'}</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

/** Something is wrong with a place: closed, a new name, or not a bathroom at all. */
function PlaceReportSheet({ place, isAdmin, onClose }: { place: OsmPlace; isAdmin: boolean; onClose: (r: { hidden?: boolean; name?: string; msg: string } | null) => void }) {
  const [reason, setReason] = useState<PlaceReason>('closed');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = newName.trim();
  const submit = async () => {
    if (reason === 'renamed') {
      const problem = trimmed.length < 2 ? 'What is it called now?' : placeNameProblem(trimmed);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.reportPlace({ id: place.id, name: place.name, poiType: place.poiType, lat: place.lat, lng: place.lng }, reason, reason === 'renamed' ? trimmed : undefined);
      if (r.applied && reason === 'renamed') onClose({ name: r.name, msg: `${place.name} is now ${r.name}.` });
      else if (r.applied) onClose({ hidden: true, msg: `Thanks. ${place.name} is off the map.` });
      else {
        const left = Math.max(1, (r.needed ?? 3) - (r.reports ?? 1));
        onClose({ msg: `Thanks. ${left} more ${left === 1 ? 'player' : 'players'} saying so and it changes for everyone.` });
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const options: [PlaceReason, string][] = [
    ['closed', "It's closed"],
    ['renamed', 'New name'],
    ['wrong', 'Not a bathroom'],
  ];
  return (
    <div className="overlay" onClick={() => onClose(null)}>
      <div className="card pop found" onClick={(e) => e.stopPropagation()}>
        <h2>What's wrong with {place.name}?</h2>
        <div className="sub">{isAdmin ? 'You are an admin: this applies right away.' : 'When a few players agree, the map changes for everyone.'}</div>
        <div className="found-types">
          {options.map(([id, label]) => (
            <button key={id} className={`chip${reason === id ? ' active' : ''}`} onClick={() => setReason(id)}>
              {label}
            </button>
          ))}
        </div>
        {reason === 'renamed' && <input className="name-input" maxLength={40} placeholder="What's it called now?" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />}
        {error && <div className="err">{error}</div>}
        <button className="primary" disabled={busy || (reason === 'renamed' && trimmed.length < 2)} onClick={() => void submit()}>
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button onClick={() => onClose(null)}>Cancel</button>
      </div>
    </div>
  );
}

/** Admin: players' finds waiting for approval and places with open reports. */
function ReviewSheet({ fix, onClose, onChanged }: { fix: Fix | null; onClose: () => void; onChanged: (id: string, r: { status: string | null; name: string | null }) => void }) {
  const [queue, setQueue] = useState<PlaceQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const load = useCallback(() => {
    api
      .placeQueue(fix?.lat, fix?.lng)
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  }, [fix?.lat, fix?.lng]);
  useEffect(load, [load]);
  const decide = async (id: string, decision: 'approve' | 'hide' | 'restore' | 'rename' | 'dismiss', name?: string) => {
    setBusy(id);
    try {
      const r = await api.curate(id, decision, name);
      onChanged(id, r);
      setRenaming(null);
      setQueue((q) =>
        q
          ? {
              finds: q.finds.filter((f) => f.id !== id),
              reported: q.reported.filter((f) => f.id !== id),
            }
          : q,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const reasonText = (r: { reason: PlaceReason; details: string | null; count: number }) =>
    `${r.count} ${r.count === 1 ? 'says' : 'say'} ${r.reason === 'closed' ? 'closed' : r.reason === 'wrong' ? 'not a bathroom' : `renamed to "${r.details ?? ''}"`}`;
  const empty = queue && !queue.finds.length && !queue.reported.length;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card pop found review" onClick={(e) => e.stopPropagation()}>
        <h2>Review places</h2>
        {error && <div className="err">{error}</div>}
        {!queue && !error && <div className="sub">Loading…</div>}
        {empty && <div className="sub">Nothing waiting. Nice.</div>}
        {queue && queue.finds.length > 0 && (
          <>
            <div className="sheet-section-title">New finds</div>
            {queue.finds.map((f) => (
              <div key={f.id} className="review-row">
                <div className="review-text">
                  <strong>{f.name}</strong>
                  <span>
                    {POI_LABEL[f.poiType] ?? 'Bathroom'}
                    {fix ? ` · ${fmtDistance(f.distance_m)} away` : ''}
                  </span>
                </div>
                <div className="review-actions">
                  <button className="primary" disabled={busy === f.id} onClick={() => void decide(f.id, 'approve')}>
                    Approve
                  </button>
                  <button disabled={busy === f.id} onClick={() => void decide(f.id, 'hide')}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        {queue && queue.reported.length > 0 && (
          <>
            <div className="sheet-section-title">Reported</div>
            {queue.reported.map((f) => (
              <div key={f.id} className="review-row">
                <div className="review-text">
                  <strong>{f.name}</strong>
                  <span>{f.reports.map(reasonText).join(' · ')}</span>
                </div>
                {renaming?.id === f.id ? (
                  <div className="review-actions">
                    <input className="name-input" maxLength={40} value={renaming.name} onChange={(e) => setRenaming({ id: f.id, name: e.target.value })} autoFocus />
                    <button className="primary" disabled={busy === f.id || renaming.name.trim().length < 2} onClick={() => void decide(f.id, 'rename', renaming.name.trim())}>
                      Save
                    </button>
                    <button onClick={() => setRenaming(null)}>Back</button>
                  </div>
                ) : (
                  <div className="review-actions">
                    <button disabled={busy === f.id} onClick={() => void decide(f.id, 'hide')}>
                      Remove
                    </button>
                    <button disabled={busy === f.id} onClick={() => setRenaming({ id: f.id, name: f.reports.find((r) => r.reason === 'renamed')?.details ?? f.name })}>
                      Rename
                    </button>
                    <button disabled={busy === f.id} onClick={() => void decide(f.id, 'dismiss')}>
                      Keep
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        <button onClick={onClose}>Close</button>
      </div>
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

/** An empty throne waiting for a king: the pin's crowned toilet, uncrowned, with the crown's outline hovering above. */
function EmptyThroneArt() {
  return (
    <svg className="ts-empty-art" viewBox="0 0 80 84" aria-hidden="true">
      <ellipse cx="40" cy="76" rx="26" ry="5" fill="#08263b" opacity=".35" />
      <path d="m26 22-3-11 9 5 8-9 8 9 9-5-3 11Z" fill="none" stroke="#ffd34c" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="4 3" className="ts-ghost-crown" />
      <rect x="22" y="30" width="36" height="22" rx="4" fill="#fffdf3" stroke="#08263b" strokeWidth="3" />
      <path d="M18 50h44q0 18-16 20l4 7H30l4-7Q18 68 18 50Z" fill="#fffdf3" stroke="#08263b" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="40" cy="51" rx="18" ry="6" fill="#fff" stroke="#08263b" strokeWidth="3" />
      <ellipse cx="40" cy="51" rx="10" ry="3" fill="#5fd0e7" stroke="#08263b" strokeWidth="1.5" />
      <text x="40" y="45" textAnchor="middle" fontFamily="Impact, 'Arial Narrow', sans-serif" fontSize="14" fill="#08263b">?</text>
    </svg>
  );
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
  const [, setLoading] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  /** 'stale': showing remembered thrones while the server is unreachable; 'empty': nothing to show yet. */
  const [thronesDown, setThronesDown] = useState<'none' | 'stale' | 'empty'>('none');
  /** The first throne answer (or failure) is in: warm-up may judge which pins still lack a course. */
  const [thronesSettled, setThronesSettled] = useState(false);
  const retryRef = useRef(0);
  useEffect(() => () => window.clearTimeout(retryRef.current), []);
  const [selected, setSelected] = useState<OsmPlace | null>(null);
  const [preview, setPreview] = useState<{ id: string; par: number; king: King | null } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [board, setBoard] = useState<{ id: string; rows: LocationRow[] } | null>(null);
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    // A first-ever visit has no session yet: open one so your own thrones read as yours.
    void currentUserId().then((id) => (id ? setMe(id) : ensureSession().then((s) => setMe(s.user.id)).catch(() => {})));
    void loadProfile().then((p) => p?.name && setName(p.name));
  }, []);
  const [moved, setMoved] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinTick, setCheckinTick] = useState(0);
  const [askName, setAskName] = useState(false);
  const [founding, setFounding] = useState(false);
  const [foundDraft, setFoundDraft] = useState<FoundDraft>({ name: '', type: 'toilets' });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reporting, setReporting] = useState<OsmPlace | null>(null);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    api
      .me()
      .then((m) => setIsAdmin(m.role === 'admin'))
      .catch(() => {});
  }, []);
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
  const [, setWide] = useState(false);

  /** Drops a place from the map and the throne list after it was hidden. */
  const forgetPlace = useCallback((id: string) => {
    rememberThrones([], [id]);
    placesRef.current.delete(id);
    setPlaces([...placesRef.current.values()]);
    setKings((k) => {
      const m = { ...k };
      delete m[id];
      return m;
    });
    setSelected((cur) => (cur?.id === id ? null : cur));
  }, []);

  /** A place changed name: the pin, the throne row and the open sheet follow. */
  const renamePlace = useCallback((id: string, name: string) => {
    const p = placesRef.current.get(id);
    if (p) {
      placesRef.current.set(id, { ...p, name });
      setPlaces([...placesRef.current.values()]);
    }
    setKings((k) => (k[id] ? { ...k, [id]: { ...k[id], name } } : k));
    setSelected((cur) => (cur?.id === id ? { ...cur, name } : cur));
  }, []);

  const curate = async (p: OsmPlace, decision: 'approve' | 'hide') => {
    try {
      await api.curate(p.id, decision);
      if (decision === 'hide') {
        forgetPlace(p.id);
        setNotice(`${p.name} is off the map.`);
      } else {
        setKings((k) => ({ ...k, [p.id]: { ...(k[p.id] ?? emptyKing(p)), status: 'live' } }));
        setNotice(`${p.name} is live for everyone.`);
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  /** Adds places to the pin set, dropping the farthest from the search centre past the cap. */
  const addPlaces = useCallback((lat: number, lng: number, incoming: OsmPlace[]) => {
    const m = placesRef.current;
    for (const p of incoming) {
      // Our database's name for a place (renamed by players) beats the map source's.
      const ours = kingsRef.current[p.id]?.name;
      m.set(p.id, ours && ours !== p.name ? { ...p, name: ours } : p);
    }
    // Claimed bathrooms and places players founded by hand must never be absorbed: keep them ahead of anything else.
    const claimedIds = new Set(Object.values(kingsRef.current).filter((k) => k.king_name).map((k) => k.id));
    for (const id of m.keys()) if (id.startsWith('ppp:')) claimedIds.add(id);
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
        // The live answer is the truth: anything remembered here that the server no longer lists is gone.
        const live = new Set(rows.map((r) => r.id));
        const gone = cached.filter((c) => !live.has(c.id)).map((c) => c.id);
        for (const id of gone) forgetPlace(id);
        applyThrones(lat, lng, rows);
        rememberThrones(rows, gone);
        setThronesDown('none');
      } catch {
        setThronesDown(cached.length || Object.keys(kingsRef.current).length ? 'stale' : 'empty');
        retryRef.current = window.setTimeout(() => {
          const last = lastSearchRef.current;
          if (last && last.lat === lat && last.lng === lng) void loadThrones(lat, lng);
        }, THRONES_RETRY_MS);
      }
      setLoading(false);
      setThronesSettled(true);
    },
    [applyThrones, forgetPlace],
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
          // The freshest copy of the place (a rename since the marker was made must show).
          setSelected(placesRef.current.get(p.id) ?? p);
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

  // Warm-up: the nearest bathrooms without a course yet get built in the background,
  // so by the time you walk in there is nothing to wait for.
  const warmedRef = useRef<Set<string>>(new Set());
  const warmingRef = useRef(false);
  useEffect(() => {
    if (!fix || !thronesSettled || warmingRef.current) return;
    const todo = places
      .filter((p) => !warmedRef.current.has(p.id) && (kings[p.id]?.par ?? null) === null && kings[p.id]?.status !== 'pending')
      .map((p) => ({ p, d: haversine(fix.lat, fix.lng, p.lat, p.lng) }))
      .filter((x) => x.d <= WARM_RADIUS_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, WARM_MAX);
    if (!todo.length) return;
    warmingRef.current = true;
    const signal = { cancelled: false };
    (async () => {
      for (const { p } of todo) {
        if (signal.cancelled) break;
        warmedRef.current.add(p.id);
        try {
          const r = await loadCourse(p, { signal });
          setKings((k) => ({ ...k, [p.id]: { ...(k[p.id] ?? emptyKing(p)), theme: r.location.theme, difficulty: r.location.difficulty, par: r.par } }));
        } catch {
          // Not now; the sheet builds it on demand anyway.
        }
      }
    })().finally(() => {
      warmingRef.current = false;
    });
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix?.lat, fix?.lng, places, thronesSettled]);

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
    loadCourse(selected, { signal })
      .then((r) => {
        if (cancelled) return;
        setPreview({ id: selected.id, par: r.par, king: r.king });
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

  // Keep check-in expiry current while a sheet is open.
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
  const checkinFresh = ci !== null && Date.now() - ci < 45 * 60 * 1000;

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
  const myBest = board && selected && board.id === selected.id ? (board.rows.find((r) => r.user_id === me)?.score ?? null) : null;

  return (
    <div className={`map-screen ${zoomClass}`}>
      <div ref={mapEl} className="map-canvas" />

      <div className="map-head menu-controls-only">
        <MenuVolume />
        <button className="name-chip menu-golfer" onClick={() => setAskName(true)} title="Your account">
          <Avatar av={getSavedAvatar()} size={22} className="chip-avatar" />
          {name ?? 'Set name'}
        </button>
      </div>

      {!placing && (
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
      )}

      {!placing && (
      <div className="map-tools">
        {moved && fix && osmLoading && <div className="map-tool quiet">searching…</div>}
        {thronesDown === 'stale' && <div className="map-tool quiet">reconnecting…</div>}
        <button className="map-tool" onClick={closest} title="Closest bathroom">
          🚽 Closest
        </button>
        {fix && !selected && (
          <button
            className="map-tool"
            onClick={() => {
              setFoundDraft({ name: '', type: 'toilets' });
              setPin(null);
              setFounding(true);
            }}
            title="Add a bathroom at your location"
          >
            ➕ Found one
          </button>
        )}
        {isAdmin && !selected && (
          <button className="map-tool" onClick={() => setReviewing(true)} title="Finds and reports waiting for you">
            🛠 Review
          </button>
        )}
        <button className="map-tool round" onClick={recentre} title="Recentre">
          ◎
        </button>
      </div>
      )}

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

      {founding && fix && !placing && (
        <FoundSheet
          fix={fix}
          pin={pin}
          draft={foundDraft}
          setDraft={setFoundDraft}
          isAdmin={isAdmin}
          onDropPin={() => {
            setFounding(false);
            setPlacing(true);
            // Start from where the map already is (the player may have panned to the spot); only an existing pin pulls the view.
            const map = mapRef.current;
            if (!map) return;
            if (pin) map.flyTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
            else if (map.getZoom() < 15) map.easeTo({ zoom: 16, duration: 300 });
          }}
          onClose={() => setFounding(false)}
          onFound={(p, status) => {
            setFounding(false);
            setPin(null);
            addPlaces(p.lat, p.lng, [p]);
            if (status === 'pending') setKings((k) => ({ ...k, [p.id]: { ...(k[p.id] ?? emptyKing(p)), status: 'pending' } }));
            setSelected(p);
            setNotice(status === 'pending' ? `${p.name} is on your map. It shows for everyone once it's approved.` : `${p.name} is on the map. First to sink it takes the throne.`);
          }}
        />
      )}

      {placing && (
        <>
          <div className="pin-drop" aria-hidden="true">
            <div className="pin-drop-cross">📍</div>
          </div>
          <div className="pin-drop-bar">
            <div className="pd-hint">Drag the map until the pin sits on the bathroom.</div>
            <button
              className="primary"
              onClick={() => {
                const c = mapRef.current?.getCenter();
                if (!c) {
                  setNotice('The map is not ready yet, try again.');
                  return;
                }
                setPin({ lat: c.lat, lng: c.lng });
                setPlacing(false);
                setFounding(true);
              }}
            >
              Put it here
            </button>
            <button
              onClick={() => {
                setPlacing(false);
                setFounding(true);
              }}
            >
              Back
            </button>
          </div>
        </>
      )}

      {reporting && (
        <PlaceReportSheet
          place={reporting}
          isAdmin={isAdmin}
          onClose={(r) => {
            const p = reporting;
            setReporting(null);
            if (!r) return;
            if (r.hidden) forgetPlace(p.id);
            else if (r.name) renamePlace(p.id, r.name);
            setNotice(r.msg);
          }}
        />
      )}

      {reviewing && (
        <ReviewSheet
          fix={fix}
          onClose={() => setReviewing(false)}
          onChanged={(id, r) => {
            if (r.status === 'hidden') forgetPlace(id);
            else {
              if (r.name) renamePlace(id, r.name);
              if (r.status === 'live') setKings((k) => (k[id] ? { ...k, [id]: { ...k[id], status: 'live' } } : k));
            }
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
        <div className="map-sheet pop ts">
          <button className="sheet-close" onClick={() => setSelected(null)} aria-label="Close">
            ✕
          </button>
          <div className="ts-head">
            <span className="ts-icon" aria-hidden="true">
              {POI_ICON[selected.poiType] ?? '🚽'}
            </span>
            <div className="ts-head-text">
              <h2 className="ts-name">{selected.name}</h2>
              <div className="ts-sub">
                {POI_LABEL[selected.poiType] ?? 'Bathroom'}
                {themeName && themeName.toLowerCase() !== (POI_LABEL[selected.poiType] ?? '').toLowerCase() ? ` · ${themeName} course` : ''}
                {` · ${HOLES_PER_COURSE} holes`}
                {preview?.id === selected.id ? ` · par ${preview.par}` : king?.par ? ` · par ${king.par}` : ''}
                {king?.status === 'pending' ? ' · awaiting approval' : ''}
              </div>
            </div>
          </div>

          {king?.king_name ? (
            <div className={`ts-throne held${king.king_user === me ? ' mine' : ''}`}>
              <span className="ts-shine" aria-hidden="true" />
              <div className="ts-king-avatar">
                <Avatar av={king.king_avatar} size={72} />
                <span className="ts-crown" aria-hidden="true">
                  <GameIcon kind="crown" />
                </span>
              </div>
              <div className="ts-king-text">
                <div className="ts-eyebrow">{king.king_user === me ? 'You hold this throne' : 'King of the throne'}</div>
                <button className="ts-king-name" onClick={() => navigate('profile', null, null, { user: king.king_user ?? undefined })}>
                  {king.king_name}
                </button>
                <div className="ts-king-line">
                  <b>{king.king_score}</b>
                  {king.par ? <span>on par {king.par}</span> : null}
                  {king.king_elapsed_ms !== null && king.king_elapsed_ms !== undefined && <span>⏱ {fmtElapsed(king.king_elapsed_ms)}</span>}
                  {king.king_since && <span>· crowned {ago(king.king_since)}</span>}
                </div>
              </div>
              {king.king_user && king.king_user !== me && (
                <button className="ts-flag" title="Report this player" aria-label="Report this player" onClick={() => setReport({ id: king.king_user!, name: king.king_name! })}>
                  ⚑
                </button>
              )}
            </div>
          ) : (
            <div className="ts-throne vacant">
              <EmptyThroneArt />
              <div className="ts-king-text">
                <div className="ts-eyebrow">No king yet</div>
                <div className="ts-empty-title">The throne is empty</div>
                <div className="ts-empty-sub">Sink {HOLES_PER_COURSE} holes faster than anyone and it&apos;s yours.</div>
              </div>
            </div>
          )}

          {(king?.king_score !== null && king?.king_score !== undefined) || myBest !== null || (king?.run_count ?? 0) > 0 ? (
            <div className="ts-facts">
              {king?.king_score !== null && king?.king_score !== undefined && (
                <span className="ts-fact">
                  <b>{king.king_score}</b> record
                </span>
              )}
              {myBest !== null && (
                <span className="ts-fact you">
                  <b>{myBest}</b> your best
                </span>
              )}
              {king?.run_count !== undefined && king.run_count > 0 && (
                <span className="ts-fact">
                  <b>{king.run_count}</b> {king.run_count === 1 ? 'round' : 'rounds'}
                </span>
              )}
            </div>
          ) : null}

          {distance !== null && (
            <div className={`ts-dist${inRange ? ' here' : ''}`}>
              <span className="ts-dist-emoji" aria-hidden="true">
                {inRange ? '📍' : '🚶'}
              </span>
              <strong>{inRange ? "You're here" : `${fmtDistance(distance)} away`}</strong>
              <span>{inRange ? 'check in below' : `about ${Math.max(1, Math.round(distance / 80))} min walk`}</span>
            </div>
          )}

          {board?.id === selected.id && board.rows.length > 0 && (
            <div className="sheet-leaders">
              <div className="sheet-section-title">Top scores</div>
              <ol className="sheet-board">
                {board.rows.map((r) => (
                  <li key={r.user_id} className={r.user_id === me ? 'me' : ''}>
                    <span className="rank">{r.rank === 1 ? '👑' : r.rank}</span>
                    <span className="who">
                      <Avatar av={r.avatar} size={22} className="row-avatar" />
                      {r.display_name}
                    </span>
                    <strong className="stat">{r.score}</strong>
                    <span className="when">{r.elapsed_ms !== null ? fmtElapsed(r.elapsed_ms) : ''}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {previewError && <div className="sheet-err">Course details will load when you play.</div>}

          <div className="sheet-actions ts-actions">
            {!fix ? (
              <button className="ts-cta" disabled>
                Waiting for GPS…
              </button>
            ) : !inRange ? (
              <button className="ts-cta far" disabled>
                Get within {fmtDistance(CLAIM_RADIUS_M)} <small>· you&apos;re {distance !== null ? fmtDistance(distance) : '?'} away</small>
              </button>
            ) : !checkinFresh ? (
              <button className="ts-cta" disabled={checkinBusy} onClick={() => void doCheckin()}>
                {checkinBusy ? 'Checking in…' : "Check in · I'm here"} <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button className="ts-cta go" onClick={playThrone}>
                {king?.king_name ? (king.king_user === me ? 'Defend your throne' : `Challenge ${king.king_name}`) : 'Claim the empty throne'} <span aria-hidden="true">→</span>
              </button>
            )}
            {checkinError && <div className="sheet-err">{checkinError}</div>}
            <button className="ts-secondary" onClick={playPractice}>
              ⛳ Practice this course
            </button>
            {isAdmin && king?.status === 'pending' && (
              <div className="admin-row">
                <button className="primary" onClick={() => void curate(selected, 'approve')}>
                  Approve
                </button>
                <button onClick={() => void curate(selected, 'hide')}>Remove</button>
              </div>
            )}
            <button className="quiet" onClick={() => setReporting(selected)}>
              Closed, renamed or wrong? Tell us
            </button>
          </div>
        </div>
      )}

      {!placing && <TabBar active="map" />}

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
