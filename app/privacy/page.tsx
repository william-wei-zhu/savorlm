import type { Metadata } from "next";
import { Card, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <PageShell title="Privacy and disclaimer">
      <Card title="Informational only">
        <p>SavorLM is a demo for planning ideas. Hours, prices, ratings and Michelin distinctions can change or be wrong. Check with the restaurant before you go. Nothing here is professional advice.</p>
        <p>Michelin distinctions come from the published Michelin Guide and may lag the latest edition. SavorLM is not affiliated with Michelin, Google, or any restaurant.</p>
      </Card>
      <Card title="What we keep">
        <p>No accounts. Your voice recordings are transcribed and never stored. Requests are sent to Gemini, Exa and TypeSafe to answer you. Search results are cached for a few hours to a few days so repeat questions are faster, then deleted automatically.</p>
        <p>To stop abuse, we count requests per IP address for the day. Those counters expire after 7 days.</p>
        <p>Your voice and theme settings stay in your own browser.</p>
      </Card>
    </PageShell>
  );
}
