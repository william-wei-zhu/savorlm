// Builds the Michelin "spine": data/michelin/<city>.json with facts only
// (name, distinction, cuisine, price, address, coords, Google place id).
// Input: a seed list (the 2025 guide picks carried over from DishLM, or a
// city file written by scripts/michelin-exa.mts). Geocoding uses Places
// Text Search (New) with a tight field mask. Re-runs keep already-located
// rows, so only new names are paid for.
//
//   npx tsx --env-file=.env.local scripts/spine.mts <seed.json> [city,...]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CITIES, type CityId, type Spot } from "../lib/michelin/types";

const key = process.env.GOOGLE_PLACES_KEY;
if (!key) throw new Error("GOOGLE_PLACES_KEY missing");

type Seed = { name: string; stars?: number; distinction: string; cuisine?: string; price_range?: string; address?: string };
const seed = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Seed[]>;
const only = process.argv[3]?.split(",");

const DIST: Record<string, Spot["distinction"]> = { "3_star": "3star", "2_star": "2star", "1_star": "1star", bib_gourmand: "bib", bib: "bib", selected: "selected", recommended: "selected" };

async function locate(s: Seed, city: CityId) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key!,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.googleMapsUri,places.websiteUri",
    },
    body: JSON.stringify({ textQuery: `${s.name}, ${s.address ?? CITIES[city].name}`, includedType: "restaurant", maxResultCount: 1, locationBias: { circle: { center: CITIES[city].center, radius: 50000 } } }),
  });
  if (!res.ok) throw new Error(`places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const p = ((await res.json()) as { places?: { id: string; location?: { latitude: number; longitude: number }; formattedAddress?: string; googleMapsUri?: string; websiteUri?: string }[] }).places?.[0];
  return p ?? null;
}

function slug(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

for (const [cityRaw, list] of Object.entries(seed)) {
  const city = cityRaw as CityId;
  if (!(city in CITIES) || (only && !only.includes(city))) continue;
  const file = `data/michelin/${city}.json`;
  const prev: Spot[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  const byName = new Map(prev.map((p) => [p.name.toLowerCase(), p]));
  const out: Spot[] = [];
  let paid = 0;
  for (const s of list) {
    const distinction = DIST[s.distinction] ?? (s.stars ? (`${s.stars}star` as Spot["distinction"]) : "selected");
    const old = byName.get(s.name.toLowerCase());
    if (old) {
      out.push({ ...old, distinction, cuisine: s.cuisine ?? old.cuisine, price: s.price_range ?? old.price });
      continue;
    }
    paid++;
    const p = await locate(s, city).catch((e) => (console.warn(city, s.name, e.message), null));
    if (!p?.location) {
      console.warn(`  not found: ${s.name}`);
      continue;
    }
    out.push({
      id: `${city}-${slug(s.name)}`,
      name: s.name,
      city,
      distinction,
      cuisine: s.cuisine ?? "",
      price: s.price_range ?? "",
      address: p.formattedAddress ?? s.address ?? "",
      lat: Math.round(p.location.latitude * 1e6) / 1e6,
      lng: Math.round(p.location.longitude * 1e6) / 1e6,
      placeId: p.id,
      mapsUrl: p.googleMapsUri ?? "",
      website: p.websiteUri ?? "",
    });
  }
  const order = { "3star": 0, "2star": 1, "1star": 2, bib: 3, selected: 4 } as const;
  out.sort((a, b) => order[a.distinction] - order[b.distinction] || a.name.localeCompare(b.name));
  writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  const gone = prev.filter((p) => !out.some((o) => o.id === p.id)).map((p) => p.name);
  console.log(`${city}: ${out.length} spots (${paid} looked up)${gone.length ? `, removed: ${gone.join(", ")}` : ""}`);
}
