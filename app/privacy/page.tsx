import type { Metadata } from "next";
import { Card, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <PageShell title="Privacy and disclaimer">
      <Card title="Informational only">
        <p>SavorLM is a demo for planning ideas. Hours, prices and ratings come from the web and can change or be wrong. Check with the place before you go. Nothing here is professional advice.</p>
        <p>SavorLM is not affiliated with Google, any guide or publication, or any restaurant.</p>
      </Card>
      <Card title="What we keep">
        <p>No accounts. Your voice recordings are transcribed and never stored. Requests are sent to Gemini, Exa and TypeSafe to answer you. Search results are cached for a few hours to a few days so repeat questions are faster, then deleted automatically.</p>
        <p>Each finished list is saved for 180 days so it can be shared by link (savorlm.com/t/…). It holds your request text and the places Savvy picked, nothing about you. Anyone with the link can see it; lists are hidden from search engines.</p>
        <p>To stop abuse, we count requests per IP address for the day. Those counters expire after 7 days.</p>
        <p>Your voice and theme settings stay in your own browser.</p>
      </Card>
    </PageShell>
  );
}
