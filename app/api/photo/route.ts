import { guard } from "@/lib/server/guard";
import { PHOTO_REF, photoByQuery, photoByRef, photoUri } from "@/lib/server/places";

// GET /api/photo?ref=<Places photo name> | ?pid=<place id> | ?q=<name, address>  [&w=160]
// -> 302 to a Google-hosted photo. The browser caches a found photo for a
// day; a miss only briefly and a failure (a daily cap, a timeout) not at all,
// so a photo that failed once loads the next time. SavorLM stores no photos.
const LIMIT_MS = 6000;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const ref = sp.get("ref") ?? "";
  const pid = sp.get("pid") ?? "";
  const q = (sp.get("q") ?? "").trim();
  const width = sp.get("w") === "160" ? 160 : 800;
  const ok = ref ? PHOTO_REF.test(ref) : pid ? /^[A-Za-z0-9_-]{10,300}$/.test(pid) : q.length >= 3 && q.length <= 200;
  if (!ok) return new Response("Bad request", { status: 400 });
  const g = await guard(req, "photo");
  if (!g.ok) return new Response(null, { status: g.status, headers: { "Cache-Control": "no-store" } });
  const lookup = ref ? photoByRef(ref, width) : pid ? photoUri(pid, width) : photoByQuery(q, width);
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
