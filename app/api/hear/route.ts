import { z } from "zod";
import { guard } from "@/lib/server/guard";
import { sameOrigin } from "@/lib/server/origin";
import { transcribe } from "@/lib/server/gemini";

export const maxDuration = 20;

// ~25 s of 16 kHz mono WAV is ~800 KB, ~1.07 MB as base64.
const Body = z.object({ audio: z.string().min(100).max(1_200_000) });

// Voice in: the browser records WAV, we return what was said. Recordings are never stored.
export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return new Response("Forbidden", { status: 403 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const g = await guard(req, "hear");
  if (!g.ok) return Response.json({ error: g.error }, { status: g.status });
  try {
    return Response.json({ text: await transcribe(body.audio, req.signal) });
  } catch (e) {
    console.error("hear failed", e);
    return Response.json({ error: "I couldn't catch that. Try again?" }, { status: 502 });
  }
}
