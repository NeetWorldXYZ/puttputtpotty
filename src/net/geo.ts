export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Geolocation error codes: 1 denied, 2 unavailable (services off, no signal), 3 timed out; 0 means no support at all. */
export type GeoErrorCode = 0 | 1 | 2 | 3;

export function watchPosition(onFix: (f: Fix) => void, onError: (msg: string, code: GeoErrorCode) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('This device has no location support.', 0);
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
    (e) => onError(geoHelp(e.code as GeoErrorCode).title, e.code as GeoErrorCode),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const IS_IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/.test(UA);
/** Added to the home screen: on iPhone that app has its own location switch, separate from Safari's. */
const STANDALONE = typeof window !== 'undefined' && ((navigator as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);

/**
 * What to tell a player whose phone won't give us a position. Once a site is
 * denied, browsers never ask again, so the fix is always in the phone's
 * settings; the steps depend on the phone and on whether the app is on the
 * home screen.
 */
export function geoHelp(code: GeoErrorCode): { title: string; why: string; steps: string[]; retry: boolean } {
  if (code === 0) return { title: 'This device has no location support.', why: 'Thrones need to know you are at the bathroom. Everything else still works.', steps: [], retry: false };
  if (code === 2)
    return {
      title: 'Your phone could not find its location.',
      why: 'Location Services may be off, or there is no signal indoors.',
      steps: IS_IOS
        ? ['Open Settings → Privacy & Security → Location Services and turn it on.', 'Step outside or near a window and try again.']
        : ['Pull down the quick settings and turn Location on.', 'Step outside or near a window and try again.'],
      retry: true,
    };
  if (code === 3) return { title: 'Finding your location is taking a while.', why: 'Usually a weak signal indoors.', steps: ['Step outside or near a window and try again.'], retry: true };
  // Denied.
  const steps = IS_IOS
    ? STANDALONE
      ? ['Open Settings → Privacy & Security → Location Services.', 'Find Putt Putt Potty in the list (it may be under Safari Websites) and choose While Using the App.', 'Come back here and tap Try again.']
      : ['Open Settings → Apps → Safari → Location and choose Ask or Allow.', 'Also check Settings → Privacy & Security → Location Services → Safari Websites is set to While Using the App.', 'Come back here and tap Try again.']
    : IS_ANDROID
      ? STANDALONE
        ? ['Press and hold the Putt Putt Potty icon → App info → Permissions → Location → Allow only while using the app.', 'Come back here and tap Try again.']
        : ['Tap the lock or tune icon next to the address at the top of the screen → Permissions → Location → Allow.', 'Come back here and tap Try again.']
      : ['Click the lock icon in the address bar, allow Location, then reload the page.'];
  return {
    title: 'Location is turned off for Putt Putt Potty.',
    why: 'Your phone remembered a "don\'t allow" and will not ask again, so it has to be switched on in Settings. Thrones need it; the daily course and matches do not.',
    steps,
    retry: true,
  };
}

/** US phones read feet and miles; everyone else metres and kilometres. */
export const IMPERIAL = typeof navigator !== 'undefined' && /^en-US$/i.test(navigator.language ?? '');

export function fmtDistance(m: number): string {
  if (IMPERIAL) {
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft / 10) * 10} ft`;
    const mi = m / 1609.344;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
