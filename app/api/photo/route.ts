import { guard } from "@/lib/server/guard";
import { PHOTO_REF, photoByQuery, photoByRef, photoUri } from "@/lib/server/places";

// GET /api/photo?ref=<Places photo name>[&pid=<fallback place id>] | ?pid=<place id> | ?q=<name, address>
// -> 302 to a Google-hosted photo. The browser caches a found photo for a
// day; a miss only briefly and a failure (a daily cap, a timeout) not at all,
// so a photo that failed once loads the next time. SavorLM stores no photos.
const LIMIT_MS = 6000;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ref = sp.get("ref") ?? "";
  const pid = sp.get("pid") ?? "";
  const q = (sp.get("q") ?? "").trim();
  // One size for the card and its thumbnail, so each place costs one billed
  // photo call a day, not two (`w=160` is still accepted from older pages).
  const width = 800;
  const pidOk = !pid || /^[A-Za-z0-9_-]{10,300}$/.test(pid);
  const ok = !pidOk ? false : ref ? PHOTO_REF.test(ref) : pid ? true : q.length >= 3 && q.length <= 200;
  if (!ok) return new Response("Bad request", { status: 400 });
  const g = await guard(req, "photo");
  if (!g.ok) return new Response(null, { status: g.status, headers: { "Cache-Control": "no-store" } });
  // A saved list can outlive its photo name: fall back to the place id (free lookup).
  const lookup = ref ? photoByRef(ref, width).catch((e) => (pid ? photoUri(pid, width) : Promise.reject(e))) : pid ? photoUri(pid, width) : photoByQuery(q, width);
  const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), LIMIT_MS));
  let uri: string | null | "timeout";
  try {
    uri = await Promise.race([lookup, timeout]);
  } catch (e) {
    console.warn("photo failed", (e as Error).message);
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (uri === "timeout") return new Response(null, { status: 504, headers: { "Cache-Control": "no-store" } });
  if (!uri) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=600" } });
  return new Response(null, { status: 302, headers: { Location: uri, "Cache-Control": "public, max-age=86400" } });
}
