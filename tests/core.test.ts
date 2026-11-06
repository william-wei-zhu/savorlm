import { describe, expect, it } from "vitest";
import { km, hop, stopShot, walkMinutes, bearing } from "@/lib/guide/geo";
import { badgeFrom, fitScore, MIN_P } from "@/lib/guide/checks";
import { CITIES, CITY_IDS, SLUG_ALIASES, cityBySlug, cityForTz } from "@/lib/cities";
import { mergeMentions, normName, popularity, isRoundup } from "@/lib/guide/consensus";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sse, sseParser, type SceneEvent } from "@/lib/guide/scene";
import { cleanSpeech } from "@/lib/guide/speech";
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
  it("covers the 21 US cities and nothing abroad", () => {
    expect(CITY_IDS.length).toBe(21);
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
