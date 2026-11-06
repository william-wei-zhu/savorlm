import type { NextConfig } from "next";
import { SLUG_ALIASES } from "./lib/cities";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PostHog reverse proxy: analytics go through our own domain so ad blockers
  // don't drop them. The static rule must precede the catch-all.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  // PostHog API endpoints rely on trailing slashes.
  skipTrailingSlashRedirect: true,
  // Short city names people type (savorlm.com/nyc) go to the canonical city URL.
  async redirects() {
    return Object.entries(SLUG_ALIASES).map(([from, to]) => ({ source: `/${from}`, destination: `/${to}`, permanent: true }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
