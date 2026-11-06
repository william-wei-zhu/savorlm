import { guard } from "@/lib/server/guard";
import { photoByQuery, photoUri } from "@/lib/server/places";

// GET /api/photo?pid=<Google place id>  or  ?q=<name, address>  [&w=160|800]
// -> 302 to a Google-hosted photo. The browser caches the redirect for a day;
// SavorLM stores no photos.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const pid = sp.get("pid") ?? "";
  const q = (sp.get("q") ?? "").trim();
  const width = sp.get("w") === "160" ? 160 : 800;
  if (pid ? !/^[A-Za-z0-9_-]{10,300}$/.test(pid) : q.length < 3 || q.length > 200) return new Response("Bad request", { status: 400 });
  const g = await guard(req, "photo");
  if (!g.ok) return new Response(null, { status: g.status });
  const uri = await (pid ? photoUri(pid, width) : photoByQuery(q, width)).catch(() => null);
  if (!uri) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(null, { status: 302, headers: { Location: uri, "Cache-Control": "public, max-age=86400" } });
}
