import "server-only";
import { cached, cacheKey } from "./cache";

// Exa search, the live layer. One call returns web pages and, since Exa
// Places (2026-10-05), place records with hours, open status, rating and
// phone. `lite` is the low-latency mode for interactive use. Results are
// cached briefly (hours change; menus and reviews change slowly).

const BASE = "https://api.exa.ai";

export type ExaHit = { title: string; url: string; published: string | null; text: string; place: Record<string, unknown> | null };

export function exaConfigured() {
  return Boolean(process.env.EXA_API_KEY);
}

type Loc = { country?: string; latitude?: number; longitude?: number };

export async function exaSearch(query: string, opts: { num?: number; loc?: Loc; ttlSec?: number; maxChars?: number; signal?: AbortSignal } = {}): Promise<ExaHit[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  const body = {
    query,
    type: "lite",
    numResults: opts.num ?? 5,
    contents: { highlights: { maxCharacters: opts.maxChars ?? 700 } },
    ...(opts.loc ? { userLocation: opts.loc } : {}),
  };
  return cached(cacheKey("exa", body), opts.ttlSec ?? 6 * 3600, async () => {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
      signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { results?: Record<string, unknown>[] };
    console.log(`exa ok ms=${Date.now() - t0} n=${data.results?.length ?? 0} q=${query.slice(0, 60)}`);
    return (data.results ?? []).map(toHit);
  });
}

function toHit(r: Record<string, unknown>): ExaHit {
  const highlights = Array.isArray(r.highlights) ? (r.highlights as string[]) : [];
  const text = [highlights.join(" … "), typeof r.text === "string" ? r.text : "", typeof r.summary === "string" ? r.summary : ""].filter(Boolean).join("\n").slice(0, 1400);
  // Place records: accept any of the shapes Exa may use (an `entities` entry of
  // type place, or a top-level `place`), and keep them as plain data.
  const ents = Array.isArray(r.entities) ? (r.entities as Record<string, unknown>[]) : [];
  const place = (ents.find((e) => /place|business|poi/i.test(String(e.type ?? ""))) ?? (r.place as Record<string, unknown> | undefined) ?? null) as Record<string, unknown> | null;
  return { title: String(r.title ?? ""), url: String(r.url ?? ""), published: (r.publishedDate as string | undefined) ?? null, text, place };
}
