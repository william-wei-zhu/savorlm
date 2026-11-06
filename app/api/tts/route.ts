import { z } from "zod";
import { guard } from "@/lib/server/guard";
import { sameOrigin } from "@/lib/server/origin";
import { streamSpeech } from "@/lib/server/gemini";
import { cleanSpeech } from "@/lib/guide/speech";

export const maxDuration = 30;

const MOODS = ["warm", "excited", "curious", "cozy"] as const;
const Body = z.object({ text: z.string().trim().min(1).max(500), mood: z.enum(MOODS).default("warm") });

// Delivery tags must stay short adverbs: longer direction gets read aloud (HiBenny, 2026-09-28).
const TAG: Record<(typeof MOODS)[number], string> = { warm: "warmly", excited: "excitedly", curious: "curiously", cozy: "softly" };

// Streams raw PCM (24 kHz, 16-bit, mono) so Savvy starts talking in about half a second.
export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return new Response("Forbidden", { status: 403 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const g = await guard(req, "tts");
  if (!g.ok) return new Response(g.error, { status: g.status });
  try {
    const stream = await streamSpeech(cleanSpeech(body.text), TAG[body.mood], req.signal);
    return new Response(stream, { headers: { "Content-Type": "audio/L16;rate=24000;channels=1", "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("tts failed", e);
    return new Response("Voice unavailable", { status: 502 });
  }
}
