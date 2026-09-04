/**
 * Client-side helpers for bathrooms: the same POI -> environment band the
 * server uses (for previews and offline practice), the selected place
 * handed from the map to the play route, and local check-in timestamps.
 */
import type { OsmPlace } from './overpass';

export type Difficulty = 'easy' | 'medium' | 'hard';

export function bandFor(poiType: string, id: string): { theme: string; difficulty: Difficulty } {
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

export const POI_LABEL: Record<string, string> = {
  toilets: 'Public toilet',
  fuel: 'Gas station',
  fast_food: 'Fast food',
  bar: 'Bar',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  airport: 'Airport',
  stadium: 'Stadium',
  retail: 'Store',
  park: 'Rest stop',
};

export const POI_ICON: Record<string, string> = {
  toilets: '🚽',
  fuel: '⛽',
  fast_food: '🍔',
  bar: '🍺',
  restaurant: '🍽️',
  hotel: '🏨',
  airport: '✈️',
  stadium: '🏟️',
  retail: '🛒',
  park: '🛣️',
};

const PLACE_KEY = 'ppp.place.v1';

/** Remembers the tapped place so the play route survives a reload. */
export function rememberPlace(p: OsmPlace): void {
  try {
    const m = JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? '{}') as Record<string, OsmPlace>;
    m[p.id] = p;
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function recallPlace(id: string): OsmPlace | null {
  try {
    const m = JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? '{}') as Record<string, OsmPlace>;
    return m[id] ?? null;
  } catch {
    return null;
  }
}

const CHECKIN_KEY = 'ppp.checkin.v1';

export function checkinAt(id: string): number | null {
  try {
    const m = JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? '{}') as Record<string, number>;
    return typeof m[id] === 'number' ? m[id] : null;
  } catch {
    return null;
  }
}

export function recordCheckin(id: string, at = Date.now()): void {
  try {
    const m = JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? '{}') as Record<string, number>;
    m[id] = at;
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

const LAST_FIX_KEY = 'ppp.fix.v1';

export function rememberFix(lat: number, lng: number): void {
  try {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat, lng }));
  } catch {
    /* ignore */
  }
}

export function recallFix(): { lat: number; lng: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_FIX_KEY) ?? 'null') as { lat: number; lng: number } | null;
    return v && typeof v.lat === 'number' ? v : null;
  } catch {
    return null;
  }
}
