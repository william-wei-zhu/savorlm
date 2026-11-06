import "server-only";
import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import { clientIp } from "./client-ip";

// Paid-endpoint protection (building standard §14), ported from HiBenny:
// 1) in-memory per-IP burst guard, 2) durable per-IP daily cap,
// 3) global daily budget kill switch. Cheap to costly. Usage docs carry an
// `expireAt` for the Firestore TTL policy so IP addresses never pile up.

export type Kind = "guide" | "tts" | "hear" | "photo";

const BURST: Record<Kind, { max: number; windowMs: number }> = {
  guide: { max: 8, windowMs: 60_000 },
  hear: { max: 12, windowMs: 60_000 },
  tts: { max: 40, windowMs: 60_000 },
  photo: { max: 120, windowMs: 60_000 },
};
const PER_IP_DAILY: Record<Kind, number> = { guide: 80, hear: 120, tts: 500, photo: 1500 };
const GLOBAL_DAILY: Record<Kind, number> = {
  guide: Number(process.env.BUDGET_GUIDE_DAILY ?? 1500),
  hear: Number(process.env.BUDGET_HEAR_DAILY ?? 2000),
  tts: Number(process.env.BUDGET_TTS_DAILY ?? 8000),
  photo: Number(process.env.BUDGET_PHOTO_DAILY ?? 4000),
};

const buckets = new Map<string, number[]>();

export function burstOk(key: string, kind: Kind, now = Date.now()): boolean {
  const { max, windowMs } = BURST[kind];
  const h = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (h.length >= max) {
    buckets.set(key, h);
    return false;
  }
  h.push(now);
  buckets.set(key, h);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string };

const BUSY: GuardResult = { ok: false, status: 503, error: "Savvy is busy right now. Try again in a moment." };

export async function guard(req: Request, kind: Kind): Promise<GuardResult> {
  const ip = clientIp(req.headers);
  if (!burstOk(`${kind}:${ip}`, kind)) return { ok: false, status: 429, error: "That's a lot of questions at once. Try again in a minute." };
  const store = db();
  if (!store) return process.env.NODE_ENV === "production" ? BUSY : { ok: true };
  const day = new Date().toISOString().slice(0, 10);
  const ipRef = store.doc(`usage/${day}/ips/${encodeURIComponent(ip)}`);
  const globalRef = store.doc(`usage/${day}`);
  const read = Promise.all([ipRef.get(), globalRef.get()]);
  const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 2000));
  let result: Awaited<typeof read> | "timeout";
  try {
    result = await Promise.race([read, timeout]);
  } catch {
    return BUSY; // fail closed on store errors
  }
  if (result !== "timeout") {
    const [ipSnap, globalSnap] = result;
    if (((ipSnap.get(kind) as number | undefined) ?? 0) >= PER_IP_DAILY[kind]) return { ok: false, status: 429, error: "You've explored a lot today. Come back tomorrow for more." };
    if (((globalSnap.get(kind) as number | undefined) ?? 0) >= GLOBAL_DAILY[kind]) return { ok: false, status: 503, error: "Savvy is resting for today. Come back tomorrow." };
  } else {
    console.warn("guard: usage read timed out"); // burst guard passed; don't freeze the tour
  }
  const expireAt = new Date(Date.now() + 7 * 86_400_000);
  after(() =>
    Promise.all([
      ipRef.set({ [kind]: FieldValue.increment(1), expireAt }, { merge: true }),
      globalRef.set({ [kind]: FieldValue.increment(1), expireAt }, { merge: true }),
    ]).catch((e) => console.error("guard: increment failed", e)),
  );
  return { ok: true };
}
