import type { MetadataRoute } from "next";
import { CITIES, CITY_IDS } from "@/lib/cities";
import { SITE } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    ...CITY_IDS.map((c) => ({ url: `${SITE}/${CITIES[c].slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
