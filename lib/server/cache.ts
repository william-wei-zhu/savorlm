import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { db } from "./firebase-admin";

// Short-lived cache for live data (Exa results, Jev verdicts, photo URLs).
// Two layers: an in-memory map per warm instance, then Firestore
// `cache/{sha}` docs with `expireAt` (TTL policy deletes them). Nothing here is
// a source of truth: a miss just calls the provider again.

const mem = new Map<string, { at: number; ttl: number; value: unknown }>();

export function cacheKey(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - hit.at < hit.ttl * 1000) return hit.value as T;
  const store = db();
  if (store) {
    try {
      const snap = await Promise.race([store.doc(`cache/${key}`).get(), new Promise<null>((r) => setTimeout(() => r(null), 800))]);
      const exp = snap?.exists ? (snap.get("expireAt") as { toMillis(): number } | undefined)?.toMillis() : 0;
      if (snap?.exists && exp && exp > now) {
        const value = JSON.parse(snap.get("v") as string) as T;
        mem.set(key, { at: now, ttl: Math.round((exp - now) / 1000), value });
        return value;
      }
    } catch (e) {
      console.warn("cache read failed", (e as Error).message);
    }
  }
  const value = await fn();
  mem.set(key, { at: now, ttl: ttlSec, value });
  if (mem.size > 2000) mem.clear();
  if (store) {
    const v = JSON.stringify(value);
    if (v.length < 900_000) {
      after(() => store.doc(`cache/${key}`).set({ v, expireAt: new Date(now + ttlSec * 1000) }).catch((e) => console.warn("cache write failed", e.message)));
    }
  }
  return value;
}
