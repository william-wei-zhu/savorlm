import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./firebase-admin";
import type { CityId } from "../cities";
import type { StopCard } from "../guide/scene";

// Shareable result lists (savorlm.com/t/<id>). The server saves exactly what
// it generated (never client-sent data), so a shared list can't be forged.
// Docs expire via the `tours` TTL policy on expireAt.

export type SavedTour = { id: string; city: CityId; message: string; title: string; stops: StopCard[]; createdAt: number };

const TTL_DAYS = 180;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function newTourId(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const TOUR_ID = /^[A-Za-z0-9]{10}$/;

export async function saveTour(t: Omit<SavedTour, "id" | "createdAt">): Promise<string | null> {
  const store = db();
  if (!store || !t.stops.length) return null;
  const id = newTourId();
  const doc = { ...t, message: t.message.slice(0, 500), createdAt: Date.now(), expireAt: new Date(Date.now() + TTL_DAYS * 86_400_000) };
  const json = JSON.stringify(doc.stops);
  if (json.length > 400_000) return null;
  await store.doc(`tours/${id}`).set({ city: doc.city, message: doc.message, title: doc.title, stops: json, createdAt: doc.createdAt, expireAt: doc.expireAt });
  return id;
}

export async function getTour(id: string): Promise<SavedTour | null> {
  if (!TOUR_ID.test(id)) return null;
  const store = db();
  if (!store) return null;
  const snap = await store.doc(`tours/${id}`).get();
  if (!snap.exists) return null;
  const exp = (snap.get("expireAt") as { toMillis(): number } | undefined)?.toMillis() ?? 0;
  if (exp && exp < Date.now()) return null;
  return { id, city: snap.get("city"), message: snap.get("message"), title: snap.get("title"), stops: JSON.parse(snap.get("stops")), createdAt: snap.get("createdAt") };
}
