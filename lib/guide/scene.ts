// The scene script: what /api/guide streams to the browser, one SSE event per
// line. The client plays events in order, so Savvy talks while the camera
// flies. Shared by server and client (types only + a tiny encoder).
import type { Distinction } from "../michelin/types";
import type { Shot } from "./geo";

export type Pose = "wave" | "listen" | "talk" | "think" | "point" | "wow" | "cheer" | "taste" | "laugh" | "clap" | "dance" | "look";

export type Badge = { id: string; label: string; p: number };
export type Source = { title: string; url: string };

export type StopCard = {
  /** Spine id for Michelin spots, otherwise a hash of name + address. */
  id: string;
  index: number;
  role: string;
  name: string;
  distinction: Distinction | null;
  cuisine: string;
  price: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  mapsUrl: string;
  website: string;
  phone: string;
  rating: string;
  openNow: "open" | "closed" | "unknown";
  hours: string;
  badges: Badge[];
  line: string;
  sources: Source[];
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
