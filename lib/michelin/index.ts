// The Michelin spine in memory: every city file is bundled (about 230 KB), so
// lookups are pure and instant. No database.
import { CITIES, type CityId, type Distinction, type Spot } from "./types";
import { km } from "../guide/geo";
import nyc from "@/data/michelin/nyc.json";
import sf from "@/data/michelin/sf.json";
import dc from "@/data/michelin/dc.json";
import chicago from "@/data/michelin/chicago.json";
import la from "@/data/michelin/la.json";
import miami from "@/data/michelin/miami.json";
import boston from "@/data/michelin/boston.json";
import philly from "@/data/michelin/philly.json";
import toronto from "@/data/michelin/toronto.json";
import paris from "@/data/michelin/paris.json";
import london from "@/data/michelin/london.json";
import singapore from "@/data/michelin/singapore.json";
import tokyo from "@/data/michelin/tokyo.json";

export const SPINE: Record<CityId, Spot[]> = { nyc, sf, dc, chicago, la, miami, boston, philly, toronto, paris, london, singapore, tokyo } as Record<CityId, Spot[]>;

const RANK: Record<Distinction, number> = { "3star": 0, "2star": 1, "1star": 2, bib: 3, selected: 4 };

export function spotById(id: string): Spot | undefined {
  const city = id.split("-")[0] as CityId;
  return SPINE[city]?.find((s) => s.id === id);
}

function norm(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Best name match in a city (or anywhere when city is null). Exact, then contains, then all-words. */
export function findByName(name: string, city: CityId | null): Spot | undefined {
  const q = norm(name).replace(/^the /, "");
  if (!q) return undefined;
  const pool = city ? SPINE[city] : Object.values(SPINE).flat();
  return (
    pool.find((s) => norm(s.name).replace(/^the /, "") === q) ??
    pool.find((s) => norm(s.name).includes(q) || q.includes(norm(s.name))) ??
    pool.find((s) => q.split(" ").every((w) => norm(s.name).includes(w)))
  );
}

export type SpotQuery = {
  city: CityId;
  distinctions?: Distinction[];
  /** Free-text cuisine words; a spot matches if any word appears in its cuisine or name. */
  cuisine?: string;
  near?: { lat: number; lng: number };
  /** Kilometres; spots farther than this from `near` are dropped. */
  radiusKm?: number;
  exclude?: string[];
  limit?: number;
};

const STOP = new Set(["food", "restaurant", "cuisine", "and", "or", "the", "a", "style", "fine", "dining"]);

/** Filter + rank: better distinction first, then distance. Cuisine falls back to no filter if nothing matches. */
export function findSpots(q: SpotQuery): Spot[] {
  let pool = SPINE[q.city].filter((s) => !q.exclude?.includes(s.id));
  if (q.distinctions?.length) {
    const f = pool.filter((s) => q.distinctions!.includes(s.distinction));
    if (f.length) pool = f;
  }
  const words = norm(q.cuisine ?? "").split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length) {
    const f = pool.filter((s) => words.some((w) => norm(`${s.cuisine} ${s.name}`).includes(w)));
    if (f.length) pool = f;
  }
  if (q.near && q.radiusKm) {
    const f = pool.filter((s) => km(q.near!, s) <= q.radiusKm!);
    if (f.length) pool = f;
  }
  const d = (s: Spot) => (q.near ? km(q.near, s) : 0);
  return [...pool].sort((a, b) => RANK[a.distinction] - RANK[b.distinction] || d(a) - d(b)).slice(0, q.limit ?? 6);
}

export function cityCounts(city: CityId) {
  const c = { "3star": 0, "2star": 0, "1star": 0, bib: 0, selected: 0 } as Record<Distinction, number>;
  for (const s of SPINE[city]) c[s.distinction]++;
  return c;
}

export { CITIES };
