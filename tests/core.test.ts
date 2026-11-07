import { describe, expect, it } from "vitest";
import { km, hop, stopShot, walkMinutes, bearing } from "@/lib/guide/geo";
import { badgeFrom, fitScore, MIN_P } from "@/lib/guide/checks";
import { CITIES, CITY_IDS, SLUG_ALIASES, cityBySlug, cityForTz } from "@/lib/cities";
import { displayName, mergeMentions, normName, popularity, isRoundup, wasSeen } from "@/lib/guide/consensus";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sse, sseParser, type SceneEvent } from "@/lib/guide/scene";
import { NEXT_STEP, cleanSpeech, followUps, listSummary, oneListLine } from "@/lib/guide/speech";
import { IDEAS, IDEA_KINDS, pickIdeas } from "@/lib/ideas";
import { OLD_CHATS_KEY, forgetSavedChats } from "@/lib/guide/thread";
import { newTourId, TOUR_ID } from "@/lib/server/tours";
import { clientIp } from "@/lib/server/client-ip";
import { sameOrigin } from "@/lib/server/origin";

describe("geo", () => {
  const a = { lat: 40.7614, lng: -73.9818 }; // Le Bernardin
  const b = { lat: 40.7648, lng: -73.9808 };
  it("measures short city hops", () => {
    expect(km(a, b)).toBeGreaterThan(0.3);
    expect(km(a, b)).toBeLessThan(0.5);
    expect(walkMinutes(a, b)).toBeGreaterThanOrEqual(4);
  });
  it("walks short hops and rides long ones", () => {
    expect(hop(a, b).mode).toBe("walk");
    expect(hop(a, { lat: 40.6782, lng: -73.9442 }).mode).toBe("ride");
  });
  it("points the camera along the direction of travel", () => {
    expect(Math.round(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(0);
    expect(stopShot(b, a).heading).toBe(Math.round(bearing(a, b)));
    expect(stopShot(b, a).durationMs).toBeLessThanOrEqual(5200);
  });
});

describe("Jev badges", () => {
  it("shows a badge only for a confident yes", () => {
    expect(badgeFrom("date", { choice: "yes", confidence: 0.9, probabilities: { yes: 0.9, no: 0.05, unknown: 0.05 } })?.p).toBe(0.9);
    expect(badgeFrom("date", { choice: "yes", confidence: MIN_P - 0.01, probabilities: { yes: MIN_P - 0.01 } })).toBeNull();
    expect(badgeFrom("date", { choice: "unknown", confidence: 0.8, probabilities: { unknown: 0.8, yes: 0.15 } })).toBeNull();
    expect(badgeFrom("date", undefined)).toBeNull();
  });
  it("ranks by mean P(yes)", () => {
    expect(fitScore([], {})).toBe(0.5);
    expect(fitScore(["date", "quiet"], { date: { choice: "yes", confidence: 1, probabilities: { yes: 1 } }, quiet: { choice: "no", confidence: 1, probabilities: { yes: 0 } } })).toBe(0.5);
  });
});

describe("cities", () => {
  it("covers the 22 US cities and nothing abroad", () => {
    expect(CITY_IDS.length).toBe(22);
    expect(CITY_IDS).not.toContain("paris");
    expect(CITY_IDS.every((c) => CITIES[c].tz.startsWith("America/"))).toBe(true);
  });
  it("gives every city a unique kebab-case URL, and aliases point at real ones", () => {
    const slugs = CITY_IDS.map((c) => CITIES[c].slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => /^[a-z]+(-[a-z]+)*$/.test(s))).toBe(true);
    expect(cityBySlug("miami")).toBe("miami");
    expect(cityBySlug("paris")).toBeNull();
    for (const [from, to] of Object.entries(SLUG_ALIASES)) {
      expect(slugs).toContain(to);
      expect(slugs).not.toContain(from);
    }
  });
  it("defaults a browser time zone to a sensible city", () => {
    expect(cityForTz("America/Los_Angeles")).toBe("sf");
    expect(cityForTz("America/Phoenix")).toBe("phoenix");
    expect(cityForTz("Europe/Paris")).toBe("nyc");
  });
});

describe("web consensus", () => {
  it("normalizes venue names", () => {
    expect(normName("The Pink Door")).toBe(normName("Pink Door"));
    expect(normName("Franklin Barbecue")).toBe("franklin barbecue");
    expect(normName("Café Rouge Restaurant")).toBe("cafe rouge");
  });
  it("counts distinct independent sites, not pages, and not the venue's own site", () => {
    const m = mergeMentions([
      { name: "The Pink Door", area: "Pike Place", url: "https://seattle.eater.com/maps/best-seattle" },
      { name: "Pink Door", area: "", url: "https://seattle.eater.com/maps/date-night" },
      { name: "The Pink Door", area: "", url: "https://www.theinfatuation.com/seattle/guides/best" },
      { name: "The Pink Door", area: "", url: "https://thepinkdoor.net/" },
      { name: "Canlis", area: "", url: "https://www.theinfatuation.com/seattle/guides/best" },
    ]);
    expect(m[0].name).toBe("The Pink Door");
    expect(m[0].mentions).toBe(2);
    expect(m[0].urls.length).toBe(4);
    expect(m[1].mentions).toBe(1);
  });
  it("merges a name with its longer form and drops location notes", () => {
    const m = mergeMentions([
      { name: "Hattie B's (Midtown)", area: "", url: "https://a.com/best" },
      { name: "Hattie B's Hot Chicken (Midtown)", area: "Midtown", url: "https://b.com/best" },
      { name: "Prince's Hot Chicken Shack", area: "", url: "https://c.com/best" },
      { name: "Joe's", area: "", url: "https://a.com/best" },
      { name: "Joe's Pizza", area: "", url: "https://b.com/best" },
    ]);
    const hattie = m.find((c) => c.name.startsWith("Hattie"))!;
    expect(hattie.mentions).toBe(2);
    expect(hattie.name).toBe("Hattie B's Hot Chicken");
    expect(m.filter((c) => c.name.startsWith("Joe")).length).toBe(2);
  });
  it("ranks by mentions, a stated rating breaking ties", () => {
    expect(popularity(3)).toBeGreaterThan(popularity(2, "4.9 Google"));
    expect(popularity(2, "4.8")).toBeGreaterThan(popularity(2, "4.2"));
  });
  it("treats best-of lists as discovery, not venues", () => {
    expect(isRoundup({ title: "The 18 Best Tacos in Austin", url: "https://x.com/a" })).toBe(true);
    expect(isRoundup({ title: "Veracruz All Natural", url: "https://veracruztacos.com/" })).toBe(false);
  });
});

describe("brand", () => {
  it("never shows the word Michelin in the UI", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== "api") walk(p);
        } else if (/\.(tsx|ts)$/.test(f)) files.push(p);
      }
    };
    walk("app");
    walk("components");
    files.push("lib/brand.ts");
    const hits = files.filter((f) => /michelin/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("scene stream", () => {
  it("round-trips events across arbitrary chunk splits", () => {
    const events: SceneEvent[] = [
      { t: "say", text: "Hello: there", pose: "wave" },
      { t: "done", text: "Bye", title: "A Night" },
    ];
    const wire = events.map(sse).join("");
    const got: SceneEvent[] = [];
    const feed = sseParser((e) => got.push(e));
    for (let i = 0; i < wire.length; i += 7) feed(wire.slice(i, i + 7));
    expect(got).toEqual(events);
  });
});

describe("shared lists", () => {
  it("makes unguessable 10-character link ids that pass the route check", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newTourId()));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(TOUR_ID.test(id)).toBe(true);
    expect(TOUR_ID.test("../etc")).toBe(false);
  });
});

describe("speech + guards", () => {
  it("strips markdown and emoji before TTS", () => {
    expect(cleanSpeech("**Wow** 🎉 [slowly] _yes_")).toBe("Wow slowly yes");
  });
  it("trusts the platform IP, never the leftmost forwarded hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "6.6.6.6" }))).toBe("9.9.9.9");
  });
  it("accepts only our own origins in production", () => {
    expect(sameOrigin(new Headers({ origin: "https://savorlm.com", host: "x" }), true)).toBe(true);
    expect(sameOrigin(new Headers({ origin: "https://evil-savorlm.com", host: "savorlm.com" }), true)).toBe(false);
    expect(sameOrigin(new Headers({ origin: "http://localhost:3000", host: "x" }), true)).toBe(false);
    expect(sameOrigin(new Headers({ "sec-fetch-site": "cross-site" }), true)).toBe(false);
  });
});

describe("displayName", () => {
  it("drops page-title location suffixes", () => {
    expect(displayName("Hattie B's Hot Chicken - Nashville - Lower Broadway")).toBe("Hattie B's Hot Chicken");
    expect(displayName("Franklin Barbecue | Austin, TX")).toBe("Franklin Barbecue");
    expect(displayName("Joe's Stone Crab (Miami Beach)")).toBe("Joe's Stone Crab");
  });
  it("keeps real names intact", () => {
    expect(displayName("Bolton's Spicy Chicken & Fish")).toBe("Bolton's Spicy Chicken & Fish");
    expect(displayName("Kuya-Ja's Lechon Belly")).toBe("Kuya-Ja's Lechon Belly");
    expect(displayName("LeRoy and Lewis Barbecue")).toBe("LeRoy and Lewis Barbecue");
  });
});

describe("oneListLine", () => {
  it("drops sentences that hint at a next stop", () => {
    expect(oneListLine("Nothing hits like Nashville hot chicken. Let us get your spice fix sorted first.")).toBe("Nothing hits like Nashville hot chicken.");
    expect(oneListLine("Hot chicken to kick things off!")).toBe("Let me round up the top spots.");
  });
  it("keeps a clean line", () => {
    expect(oneListLine("Austin runs on great tortillas, so let me find four taco spots.")).toBe("Austin runs on great tortillas, so let me find four taco spots.");
  });
});

describe("follow-ups", () => {
  it("tells Savvy what he listed, in order", () => {
    expect(listSummary("Austin's Taco Titans", ["Veracruz", "Suerte"])).toBe("List: Austin's Taco Titans. 1) Veracruz 2) Suerte");
    expect(listSummary("", [], "Hi there!")).toBe("Hi there!");
  });
  it("keeps short, distinct chips and drops next-stop ones", () => {
    expect(followUps(["Cheaper picks.", "cheaper picks", "Then grab dessert", "Somewhere quieter", "A very long follow-up request that goes on and on", 7, "Closer to downtown", "Best birria instead"])).toEqual(["Cheaper picks", "Somewhere quieter", "Closer to downtown"]);
    expect(followUps(undefined)).toEqual([]);
  });
  it("skips places already shown, including longer forms of the name", () => {
    const seen = new Set([normName("Hattie B's"), normName("Prince's Hot Chicken Shack")]);
    expect(wasSeen(normName("Hattie B's Hot Chicken"), seen)).toBe(true);
    expect(wasSeen(normName("Prince's Hot Chicken Shack"), seen)).toBe(true);
    expect(wasSeen(normName("Bolton's Spicy Chicken & Fish"), seen)).toBe(false);
  });
});

describe("removed recent chats", () => {
  it("clears what older visits saved, and survives missing storage", () => {
    const m = new Map([[OLD_CHATS_KEY, "[]"]]);
    forgetSavedChats({ removeItem: (k: string) => void m.delete(k) });
    expect(m.has(OLD_CHATS_KEY)).toBe(false);
    expect(() => forgetSavedChats(null)).not.toThrow();
  });
});

describe("Savvy's ideas", () => {
  const all = CITY_IDS.flatMap((c) => IDEA_KINDS.flatMap((k) => IDEAS[c][k]));
  it("gives every city 12 ideas, 3 of each kind, all different", () => {
    for (const c of CITY_IDS) for (const k of IDEA_KINDS) expect(IDEAS[c][k].length).toBe(3);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(CITY_IDS.length * 12);
  });
  it("keeps them short, award-free and one list (never a next stop)", () => {
    for (const s of all) {
      expect(s.length).toBeLessThanOrEqual(60);
      expect(s).not.toMatch(/michelin|\bstars?\b/i);
      expect(s).not.toMatch(NEXT_STEP);
      expect(s).not.toMatch(/—/);
    }
  });
  it("shows three of different kinds, stable for a visit and varied across visits", () => {
    const kindOf = (s: string) => IDEA_KINDS.find((k) => Object.values(IDEAS).some((p) => p[k].includes(s)));
    const a = pickIdeas("orlando", 12345);
    expect(a.length).toBe(3);
    expect(new Set(a.map(kindOf)).size).toBe(3);
    expect(pickIdeas("orlando", 12345)).toEqual(a);
    const sets = new Set(Array.from({ length: 20 }, (_, i) => pickIdeas("orlando", i + 1).join("|")));
    expect(sets.size).toBeGreaterThan(5);
  });
});
