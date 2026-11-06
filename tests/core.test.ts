import { describe, expect, it } from "vitest";
import { km, hop, stopShot, walkMinutes, bearing } from "@/lib/guide/geo";
import { badgeFrom, fitScore, MIN_P } from "@/lib/guide/checks";
import { findByName, findSpots, SPINE } from "@/lib/michelin";
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

describe("Michelin spine", () => {
  it("has every city loaded", () => {
    expect(SPINE.sf.length).toBeGreaterThan(50);
    expect(SPINE.paris.length).toBeGreaterThan(10);
  });
  it("finds a restaurant by name, accents and case aside", () => {
    expect(findByName("le bernardin", "nyc")?.distinction).toBe("3star");
    expect(findByName("atelier crenn", null)?.city).toBe("sf");
  });
  it("filters by distinction and ranks stars first", () => {
    const r = findSpots({ city: "sf", distinctions: ["3star"], limit: 3 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.distinction === "3star")).toBe(true);
    const any = findSpots({ city: "nyc", limit: 5 });
    expect(any[0].distinction).toBe("3star");
  });
  it("falls back instead of returning nothing for an unknown cuisine", () => {
    expect(findSpots({ city: "sf", cuisine: "martian fusion", limit: 2 }).length).toBe(2);
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
