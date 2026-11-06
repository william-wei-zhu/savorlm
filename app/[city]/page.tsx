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
  const name = CITIES[id].name;
  return {
    title: { absolute: `${NAME} ${name}: ${TAGLINE}` },
    description: `The places locals love in ${name}, from a quick lunch to a big night out. Ask Savvy by voice or text and he plans it on the map with live hours.`,
    alternates: { canonical: `/${CITIES[id].slug}` },
  };
}

export default async function CityPage({ params }: PageProps<"/[city]">) {
  const id = cityBySlug((await params).city);
  if (!id) notFound();
  return <GuideApp initialCity={id} />;
}
