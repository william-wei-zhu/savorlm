import type { Metadata } from "next";
import { Card, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <PageShell title="Savvy finds the places locals love, and shows his sources">
      <Card title="What SavorLM is">
        <p>Savvy is a raccoon food guide for 21 US cities. Tell him what you&apos;re craving, a quick salad, famous tacos, or a big anniversary dinner, by voice or by typing. He finds the places people love most and walks you through them on the map.</p>
      </Card>
      <Card title="How he finds the top spots">
        <p>For every stop Savvy reads the web live: local best-of lists, food guides and the places&apos; own pages, through Exa search. He counts how many independent sites name each place. The ones many guides agree on rise to the top, and each ticket says how many guides named it.</p>
        <p>Every stop has four picks: Savvy&apos;s top pick and three more, in a fixed list. He talks you through them one at a time (tap Stop talking any time), and tapping any pick shows it and has him tell you about it.</p>
        <p>Fit claims are checked by TypeSafe Jev, a model that answers yes or no with a calibrated confidence. A badge such as &quot;Date-night vibe 83%&quot; appears only when Jev says yes with at least 60% confidence from the sources. Every ticket links its sources.</p>
      </Card>
      <Card title="What it&apos;s built with">
        <p>Next.js on Vercel, Gemini for planning, narration and Savvy&apos;s voice, Exa for live search, TypeSafe Jev for checks, Google Maps for the map, and Firestore for a short-lived cache. No restaurant database: everything is found fresh.</p>
      </Card>
    </PageShell>
  );
}
