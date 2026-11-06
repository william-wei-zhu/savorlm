import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GuideApp } from "@/components/guide-app";
import { getTour } from "@/lib/server/tours";
import { CITIES } from "@/lib/cities";
import { NAME } from "@/lib/brand";

// A shared list (savorlm.com/t/<id>): exactly what Savvy found, replayed
// from Firestore with no new search. Params are runtime data here, so the
// read sits inside <Suspense> (Cache Components).

export async function generateMetadata({ params }: PageProps<"/t/[id]">): Promise<Metadata> {
  const tour = await getTour((await params).id).catch(() => null);
  if (!tour) return { title: "List not found", robots: { index: false } };
  const city = CITIES[tour.city];
  const picks = tour.stops.flatMap((s) => s.options.slice(0, 1).map((o) => o.name));
  const top = tour.stops[0]?.options.map((o) => o.name).slice(0, 4) ?? [];
  const title = `${tour.title} · ${city.name}`;
  const description = tour.stops.length > 1 ? `Savvy's picks: ${picks.join(", then ")}.` : `Top picks: ${top.join(", ")}.`;
  const image = { url: "/og/savorlm.jpg", width: 1200, height: 630, alt: "SavorLM: Savvy the raccoon food guide" };
  return {
    title: { absolute: `${title} | ${NAME}` },
    description,
    robots: { index: false },
    openGraph: { title, description, siteName: NAME, type: "article", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

async function SharedTour({ params }: { params: PageProps<"/t/[id]">["params"] }) {
  const tour = await getTour((await params).id).catch(() => null);
  if (!tour) notFound();
  return <GuideApp initialCity={tour.city} initialTour={tour} />;
}

export default function Page({ params }: PageProps<"/t/[id]">) {
  return (
    <Suspense fallback={<div className="menu grid min-h-dvh place-items-center"><p className="kicker text-gold-text">Opening the list</p></div>}>
      <SharedTour params={params} />
    </Suspense>
  );
}
