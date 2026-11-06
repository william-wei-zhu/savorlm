import { guard } from "@/lib/server/guard";
import { photoUri } from "@/lib/server/places";


// GET /api/photo?pid=<Google place id> -> 302 to a Google-hosted photo.
// The browser caches the redirect for a day; SavorLM stores no photos.
export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("pid") ?? "";
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(pid)) return new Response("Bad request", { status: 400 });
  const g = await guard(req, "photo");
  if (!g.ok) return new Response(null, { status: g.status });
  const uri = await photoUri(pid).catch(() => null);
  if (!uri) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(null, { status: 302, headers: { Location: uri, "Cache-Control": "public, max-age=86400" } });
}
