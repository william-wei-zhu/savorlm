// Pure geometry for tours: distances, walking time, and camera shots for the
// 3D map. No browser or network code here so it is unit-tested.

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in kilometres. */
export function km(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Compass bearing from a to b in degrees (0 = north). */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** City walking: ~4.8 km/h along streets, which run ~1.3x the straight line. */
export function walkMinutes(a: LatLng, b: LatLng): number {
  return Math.max(1, Math.round(((km(a, b) * 1.3) / 4.8) * 60));
}

/** How to get between two stops, in words: walk under ~25 min, otherwise a short ride. */
export function hop(a: LatLng, b: LatLng): { mode: "walk" | "ride"; minutes: number } {
  const w = walkMinutes(a, b);
  if (w <= 25) return { mode: "walk", minutes: w };
  return { mode: "ride", minutes: Math.max(5, Math.round(((km(a, b) * 1.4) / 22) * 60)) };
}

export type Shot = { lat: number; lng: number; altitude: number; range: number; tilt: number; heading: number; durationMs: number };

/** Establishing shot over a city: high, gently tilted. */
export function cityShot(c: LatLng): Shot {
  return { lat: c.lat, lng: c.lng, altitude: 0, range: 6500, tilt: 45, heading: 20, durationMs: 4200 };
}

/**
 * Arrival shot at a stop: close, tilted so buildings read in 3D, looking along
 * the direction of travel so each flight feels like moving forward.
 * Flight time scales with the distance covered (and stays watchable).
 */
export function stopShot(stop: LatLng, from: LatLng | null): Shot {
  const heading = from ? bearing(from, stop) : 30;
  const d = from ? km(from, stop) : 3;
  return { lat: stop.lat, lng: stop.lng, altitude: 0, range: 750, tilt: 58, heading: Math.round(heading), durationMs: Math.round(Math.min(5200, 2200 + d * 600)) };
}

export function center(points: LatLng[]): LatLng {
  const n = points.length || 1;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / n, lng: points.reduce((s, p) => s + p.lng, 0) / n };
}
