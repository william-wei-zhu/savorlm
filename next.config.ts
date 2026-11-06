import type { NextConfig } from "next";
import { SLUG_ALIASES } from "./lib/cities";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
