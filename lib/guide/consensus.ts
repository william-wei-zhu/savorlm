// Web consensus: the "most popular, most famous" signal. A place named by
// several independent best-of lists and local guides is a place people love.
// Pure, so it is unit-tested; the network side lives in lib/server/guide.ts.

/** One venue a page named (from the extraction step). */
export type Mention = { name: string; area: string; url: string };

export type Consensus = {
  key: string;
  name: string;
  area: string;
  /** Distinct source sites that named it (a site counts once, its own site never counts). */
  mentions: number;
  domains: string[];
  urls: string[];
};

const LEADING = /^(the|la|le|el|il)\s+/;

/**
 * A venue's display name without page-title noise: "Hattie B's Hot Chicken -
 * Nashville - Lower Broadway" -> "Hattie B's Hot Chicken". Cuts at the first
 * spaced dash or bar, and drops a trailing "(Midtown)" location note.
 */
export function displayName(s: string): string {
  const head = s.split(/\s+[-–—|]\s+|\s*[|•·]\s*/)[0].replace(/\s*\([^)]*\)\s*$/, "").trim();
  return head.length >= 2 ? head : s.trim();
}

/** Comparable venue name: no accents, case, punctuation, "the", or "restaurant/bar" suffixes. */
export function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // "(Midtown)": a location note, not the name
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(LEADING, "")
    .replace(/\s+(restaurant|bar|cafe|kitchen|grill)$/, "")
    .trim();
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** A venue's own website is not an independent mention ("pinkdoorseattle.com" for "The Pink Door"). */
function ownSite(host: string, name: string) {
  const squashed = normName(name).replace(/ /g, "");
  const label = host.split(".").slice(0, -1).join("");
  return squashed.length >= 4 && (label.includes(squashed) || (label.length >= 5 && squashed.includes(label)));
}

/** Groups mentions by normalized name and counts distinct independent sites. Order: most mentions, then first seen. */
export function mergeMentions(list: Mention[]): Consensus[] {
  const by = new Map<string, Consensus & { first: number }>();
  list.forEach((m, i) => {
    const key = normName(m.name);
    if (key.length < 2) return;
    const host = hostOf(m.url);
    let c = by.get(key);
    if (!c) {
      c = { key, name: m.name.trim(), area: m.area, mentions: 0, domains: [], urls: [], first: i };
      by.set(key, c);
    }
    if (!c.area && m.area) c.area = m.area;
    if (m.url && !c.urls.includes(m.url)) c.urls.push(m.url);
    if (host && !ownSite(host, m.name) && !c.domains.includes(host)) {
      c.domains.push(host);
      c.mentions = c.domains.length;
    }
  });
  // "Hattie Bs" and "Hattie Bs Hot Chicken" are one place: merge a name that
  // is a whole-word prefix of a longer one (at least 5 letters, so "Joe" stays apart).
  const groups = [...by.values()].sort((a, b) => a.key.length - b.key.length);
  for (let i = 0; i < groups.length; i++) {
    const short = groups[i];
    if (short.key.replace(/ /g, "").length < 5) continue;
    for (let j = i + 1; j < groups.length; j++) {
      const long = groups[j];
      if (long.key.startsWith(`${short.key} `)) {
        for (const d of long.domains) if (!short.domains.includes(d)) short.domains.push(d);
        for (const u of long.urls) if (!short.urls.includes(u)) short.urls.push(u);
        short.mentions = short.domains.length;
        short.first = Math.min(short.first, long.first);
        if (!short.area) short.area = long.area;
        if (long.mentions > short.mentions || long.name.length > short.name.length) short.name = long.name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
        groups.splice(j--, 1);
      }
    }
  }
  return groups.sort((a, b) => b.mentions - a.mentions || a.first - b.first).map((c) => ({ key: c.key, name: c.name.replace(/\s*\([^)]*\)\s*/g, " ").trim(), area: c.area, mentions: c.mentions, domains: c.domains, urls: c.urls }));
}

/** Popularity for ranking: independent mentions dominate; a stated rating nudges ties. */
export function popularity(mentions: number, rating?: string): number {
  const r = Number((rating ?? "").match(/\d(\.\d)?/)?.[0] ?? 0);
  return mentions + (r >= 4 ? (r - 4) * 0.5 : 0);
}

// Best-of roundups feed discovery; they are never a venue themselves.
const ROUNDUP_TITLE = /\b(best|top \d+|\d+ (best|great|cozy|perfect|essential|favorite)|guide to|where to|ranked|list of|must[- ]try|essential)\b/i;
const ROUNDUP_URL = /\/(guides?|lists?|best-|top-|blog\/|news\/|articles?\/|eater|maps?\/)/i;

export function isRoundup(h: { title: string; url: string }) {
  return ROUNDUP_TITLE.test(h.title) || ROUNDUP_URL.test(h.url);
}
