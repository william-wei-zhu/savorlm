import type { Metadata } from "next";
import { Card, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <PageShell title="Savvy plans the evening and shows his sources">
      <Card title="What SavorLM is">
        <p>Savvy is a raccoon food guide. Tell him what you&apos;re craving, by voice or by typing, and he plans an outing around Michelin Guide restaurants and the best places nearby, then walks you through it on the map.</p>
      </Card>
      <Card title="How a plan comes together">
        <p>Savvy reads your request and decides the stops (dinner, then drinks, for example) and what matters to you (a date-night feel, a low-carb menu).</p>
        <p>Michelin stops come from a small list of Michelin Guide restaurants, about 440 places in 12 cities, holding only the name, distinction, cuisine and location. Everything live comes from Exa web search at the moment you ask: opening hours, ratings, menus and recent news. Other stops (bars, coffee, dessert) are found the same way, near the first stop.</p>
        <p>Each fit claim is checked by TypeSafe Jev, a model that answers yes or no with a calibrated confidence. A badge such as &quot;Date-night vibe 83%&quot; appears only when Jev says yes with at least 60% confidence from the sources. Otherwise Savvy says nothing.</p>
        <p>Every ticket links its sources, so you can check what Savvy said.</p>
      </Card>
      <Card title="What it's built with">
        <p>Next.js on Vercel, Gemini for planning, narration and Savvy&apos;s voice, Exa for live search, TypeSafe Jev for checks, Google Maps for the 2D map and the optional 3D flight, and Firestore for a short-lived cache.</p>
      </Card>
    </PageShell>
  );
}
