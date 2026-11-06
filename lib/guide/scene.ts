// The scene script: what /api/guide streams to the browser, one SSE event per
// line. The client plays events in order, so Savvy talks while the camera
// flies. Shared by server and client (types only + a tiny encoder).
import type { Shot } from "./geo";

export type Pose = "wave" | "listen" | "talk" | "think" | "point" | "wow" | "cheer" | "taste" | "laugh" | "clap" | "dance" | "look";

export type Badge = { id: string; label: string; p: number };
export type Source = { title: string; url: string };

/** One place for a stop. Every stop offers 3 to 5, best first. */
export type Option = {
  /** Stable hash of the normalized name + city. */
  id: string;
  name: string;
  /** Short reason it made the list (max ~14 words). */
  why: string;
  /** What Savvy says when the user picks this option by hand (max ~30 words). */
  intro: string;
  /** Independent best-of sites that named it (web consensus), and which ones. */
  mentions: number;
  praisedBy: string[];
  cuisine: string;
  price: string;
  address: string;
  lat: number;
  lng: number;
  /** Google place id when known (photo + maps link); only the top option is looked up. */
  placeId: string | null;
  mapsUrl: string;
  website: string;
  phone: string;
  rating: string;
  openNow: "open" | "closed" | "unknown";
  hours: string;
  badges: Badge[];
  sources: Source[];
};

/** Photo URL for an option: by place id when known, else looked up by name + address on demand. */
export function photoSrc(o: Pick<Option, "placeId" | "name" | "address">, w: 160 | 800 = 800): string {
  if (o.placeId) return `/api/photo?pid=${encodeURIComponent(o.placeId)}${w === 160 ? "&w=160" : ""}`;
  return `/api/photo?q=${encodeURIComponent(`${o.name}, ${o.address}`.slice(0, 200))}${w === 160 ? "&w=160" : ""}`;
}

export type StopCard = {
  index: number;
  role: string;
  /** What Savvy says on arrival, about options[0]. */
  line: string;
  options: Option[];
  /** Travel from the previous stop's top option. */
  hop: { mode: "walk" | "ride"; minutes: number } | null;
};

export type SceneEvent =
  | { t: "say"; text: string; pose: Pose }
  | { t: "fly"; shot: Shot; label?: string }
  | { t: "stop"; stop: StopCard; shot: Shot }
  | { t: "done"; text: string; title: string }
  | { t: "error"; text: string };

export function sse(e: SceneEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

/** Splits an SSE byte stream into events (client side). Tolerates partial chunks. */
export function sseParser(onEvent: (e: SceneEvent) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          onEvent(JSON.parse(line.slice(5)) as SceneEvent);
        } catch {
          /* ignore a malformed line */
        }
      }
    }
  };
}
