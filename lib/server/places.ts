import "server-only";
import { cached, cacheKey } from "./cache";

// Google Places (New), server key only, on the cheapest SKUs (2026-11-06):
// - Text Search asking only for `places.id` is "Essentials (IDs Only)": free, unlimited.
// - Place Details asking only for `photos` is also "IDs Only": free, unlimited.
// - Place Details for location + address + photos is "Essentials": 10k free a month.
// - Only the photo image itself (GetPhotoMedia) is billed past 1k a month.
// The old path asked Text Search for photos and links (the Pro SKU, $32/1k),
// so it had to be capped at 150 a day and photos vanished once it ran out.
// Photos are never stored by SavorLM.

const KEY = () => process.env.GOOGLE_PLACES_KEY ?? "";
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

export type Located = { placeId: string; lat: number; lng: number; address: string; photo: string | null };

/** The best-matching place id for a text query (free SKU), cached 30 days; "" when Google has none. */
async function findId(text: string, near?: { lat: number; lng: number }): Promise<string> {
  return cached(cacheKey("pid1", text.toLowerCase(), near && [near.lat.toFixed(2), near.lng.toFixed(2)]), 30 * 86400, async () => {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify({ textQuery: text, maxResultCount: 1, ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 20000 } } } : {}) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`places search ${res.status}`);
    return ((await res.json()) as { places?: { id: string }[] }).places?.[0]?.id ?? "";
  });
}

/** Put a place on the map: id (free) then location, address and first photo (Essentials), cached 30 days. */
export async function locate(text: string, near?: { lat: number; lng: number }): Promise<Located | null> {
  if (!KEY()) return null;
  try {
    const id = await findId(text, near);
    if (!id) return null;
    return await cached(cacheKey("pdet1", id), 30 * 86400, async () => {
      const d = await fetch(`https://places.googleapis.com/v1/places/${id}`, { headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "location,formattedAddress,photos" }, signal: AbortSignal.timeout(4000) });
      if (!d.ok) throw new Error(`place details ${d.status}`);
      const p = (await d.json()) as { location?: { latitude: number; longitude: number }; formattedAddress?: string; photos?: { name: string }[] };
      if (!p.location) return null;
      return { placeId: id, lat: p.location.latitude, lng: p.location.longitude, address: p.formattedAddress ?? "", photo: p.photos?.[0]?.name ?? null };
    });
  } catch (e) {
    console.warn("locate failed", (e as Error).message);
    return null;
  }
}

// Failures (a daily cap's 429, a timeout) throw, so they are never cached:
// caching them once left a restaurant photo-less for 30 days (2026-11-06).
// Only a real "Google has no photo" is cached, and only for a day.

async function mediaUri(photoName: string, width: number): Promise<string> {
  const m = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${width}&skipHttpRedirect=true`, { headers: { "X-Goog-Api-Key": KEY() }, signal: AbortSignal.timeout(4000) });
  if (!m.ok) throw new Error(`photo media ${m.status}`);
  const uri = ((await m.json()) as { photoUri?: string }).photoUri;
  if (!uri) throw new Error("photo media: no uri");
  return uri;
}

export const PHOTO_REF = /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,600}$/;

/** A photo URI from a photo resource name we already have (from locate): one billed media call. */
export async function photoByRef(ref: string, width = 800): Promise<string | null> {
  if (!KEY() || !PHOTO_REF.test(ref)) return null;
  return cached(cacheKey("photor", ref, width), 86400, () => mediaUri(ref, width));
}

/** A photo URI for a place id (Google-hosted), or null if Google has none. */
export async function photoUri(placeId: string, width = 800): Promise<string | null> {
  if (!KEY() || !PLACE_ID.test(placeId)) return null;
  const name = await cached(cacheKey("photon", placeId), 86400, async () => {
    const d = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, { headers: { "X-Goog-Api-Key": KEY(), "X-Goog-FieldMask": "photos" }, signal: AbortSignal.timeout(4000) });
    if (!d.ok) throw new Error(`place details ${d.status}`);
    return ((await d.json()) as { photos?: { name: string }[] }).photos?.[0]?.name ?? "";
  });
  return name ? cached(cacheKey("photor", name, width), 86400, () => mediaUri(name, width)) : null;
}

/** A photo for a place we only know by name and address (older shared lists): free id search, then photoUri. */
export async function photoByQuery(q: string, width = 800): Promise<string | null> {
  if (!KEY()) return null;
  const id = await findId(q);
  return id ? photoUri(id, width) : null;
}

/** Address -> coordinates via the Geocoding API (10k free a month; cheaper than Places for alternates). */
export async function geocode(address: string): Promise<{ lat: number; lng: number; address: string } | null> {
  if (!KEY()) return null;
  return cached(cacheKey("geocode", address.toLowerCase()), 30 * 86400, async () => {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY()}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { status: string; results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
    const r = j.results?.[0];
    return r ? { lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address } : null;
  }).catch((e) => (console.warn("geocode failed", (e as Error).message), null));
}
