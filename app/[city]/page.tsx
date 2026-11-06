import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideApp } from "@/components/guide-app";
import { CITIES, CITY_IDS, cityBySlug } from "@/lib/cities";
import { NAME, TAGLINE } from "@/lib/brand";

// One URL per city (savorlm.com/miami). Prerendered for all 21; anything else
// 404s (dynamicParams is unavailable with Cache Components, so notFound()).
// All 21 are prerendered and the picker switches cities with pushState (no
// router navigation), so a blocking route is fine here.
export const instant = false;

export function generateStaticParams() {
  return CITY_IDS.map((c) => ({ city: CITIES[c].slug }));
}

export async function generateMetadata({ params }: PageProps<"/[city]">): Promise<Metadata> {
  const id = cityBySlug((await params).city);
  if (!id) return {};
  const { name, slug } = CITIES[id];
  const title = `${NAME} ${name}`;
  const description = `${TAGLINE}. The places locals love in ${name}, from a quick salad to a big night out, planned on the map by Savvy with live hours.`;
  const image = { url: `/og/${slug}.jpg`, width: 1200, height: 630, alt: `${NAME} ${name}: Savvy the raccoon food guide` };
  return {
    title: { absolute: `${title}: ${TAGLINE}` },
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title, description, url: `/${slug}`, siteName: NAME, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CityPage({ params }: PageProps<"/[city]">) {
  const id = cityBySlug((await params).city);
  if (!id) notFound();
  return <GuideApp initialCity={id} />;
}
