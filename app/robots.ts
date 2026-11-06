import type { MetadataRoute } from "next";
import { SITE } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }], sitemap: `${SITE}/sitemap.xml` };
}
