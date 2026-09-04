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

export function watchPosition(onFix: (f: Fix) => void, onError: (msg: string) => void): () => void {
  if (!('geolocation' in navigator)) {
    onError('This device has no location support.');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
    (e) => onError(e.code === 1 ? 'Location permission denied. Allow location to find bathrooms near you.' : e.message),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
