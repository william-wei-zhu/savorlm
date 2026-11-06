import { z } from "zod";
import { guard } from "@/lib/server/guard";
import { sameOrigin } from "@/lib/server/origin";
import { runGuide } from "@/lib/server/guide";
import { saveTour } from "@/lib/server/tours";
import type { StopCard } from "@/lib/guide/scene";
import type { CityId } from "@/lib/cities";
import { CITY_IDS } from "@/lib/cities";
import { sse } from "@/lib/guide/scene";

export const maxDuration = 60;

const Body = z.object({
  message: z.string().trim().min(1).max(500),
  city: z.enum(CITY_IDS as [string, ...string[]]).nullable().default(null),
  history: z.array(z.object({ role: z.enum(["user", "guide"]), text: z.string().max(800) })).max(8).default([]),
});

// Streams the scene script (see lib/guide/scene.ts) as server-sent events.
export async function POST(req: Request) {
  if (!sameOrigin(req.headers)) return new Response("Forbidden", { status: 403 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const g = await guard(req, "guide");
  if (!g.ok) return new Response(sse({ t: "error", text: g.error }), { status: 200, headers: { "Content-Type": "text/event-stream" } });

  const enc = new TextEncoder();
  const t0 = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stops: StopCard[] = [];
        let city: CityId | null = body.city as CityId | null;
        for await (const e of runGuide({ message: body.message, history: body.history, city: body.city as never, signal: req.signal })) {
          controller.enqueue(enc.encode(sse(e)));
          console.log(`guide +${Date.now() - t0}ms ${e.t}`);
          if (e.t === "stop") stops.push(e.stop);
          if (e.t === "city") city = e.city;
          // Save the finished list so it can be shared (exactly what was generated).
          if (e.t === "done" && stops.length && city) {
            const id = await saveTour({ city, message: body.message, title: e.title || "Savvy's picks", stops }).catch((err) => (console.warn("saveTour", err.message), null));
            if (id) controller.enqueue(enc.encode(sse({ t: "share", id })));
          }
        }
      } catch (e) {
        console.error("guide failed", e);
        controller.enqueue(enc.encode(sse({ t: "error", text: "My nose went fuzzy for a second. Mind asking again?" })));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
