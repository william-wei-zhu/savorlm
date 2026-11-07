// The cities Savvy knows (US only). Restaurants are never stored: every pick
// is found live on the web. A city is just a name, a map center and a clock.

export type Region = "Northeast" | "South" | "Texas" | "Midwest" | "Southwest" | "West";

export type City = { name: string; slug: string; state: string; region: Region; center: { latitude: number; longitude: number }; tz: string };

export const CITIES = {
  nyc: { name: "New York", slug: "new-york", state: "NY", region: "Northeast", center: { latitude: 40.7359, longitude: -73.9911 }, tz: "America/New_York" },
  boston: { name: "Boston", slug: "boston", state: "MA", region: "Northeast", center: { latitude: 42.3554, longitude: -71.0605 }, tz: "America/New_York" },
  philly: { name: "Philadelphia", slug: "philadelphia", state: "PA", region: "Northeast", center: { latitude: 39.9502, longitude: -75.1667 }, tz: "America/New_York" },
  dc: { name: "Washington, DC", slug: "washington-dc", state: "DC", region: "Northeast", center: { latitude: 38.9047, longitude: -77.0164 }, tz: "America/New_York" },
  atlanta: { name: "Atlanta", slug: "atlanta", state: "GA", region: "South", center: { latitude: 33.7629, longitude: -84.3880 }, tz: "America/New_York" },
  nashville: { name: "Nashville", slug: "nashville", state: "TN", region: "South", center: { latitude: 36.1588, longitude: -86.7816 }, tz: "America/Chicago" },
  neworleans: { name: "New Orleans", slug: "new-orleans", state: "LA", region: "South", center: { latitude: 29.9537, longitude: -90.0700 }, tz: "America/Chicago" },
  miami: { name: "Miami", slug: "miami", state: "FL", region: "South", center: { latitude: 25.7781, longitude: -80.1966 }, tz: "America/New_York" },
  orlando: { name: "Orlando", slug: "orlando", state: "FL", region: "South", center: { latitude: 28.5383, longitude: -81.3792 }, tz: "America/New_York" },
  austin: { name: "Austin", slug: "austin", state: "TX", region: "Texas", center: { latitude: 30.2672, longitude: -97.7431 }, tz: "America/Chicago" },
  houston: { name: "Houston", slug: "houston", state: "TX", region: "Texas", center: { latitude: 29.7470, longitude: -95.3880 }, tz: "America/Chicago" },
  dallas: { name: "Dallas", slug: "dallas", state: "TX", region: "Texas", center: { latitude: 32.7900, longitude: -96.8000 }, tz: "America/Chicago" },
  chicago: { name: "Chicago", slug: "chicago", state: "IL", region: "Midwest", center: { latitude: 41.8919, longitude: -87.6278 }, tz: "America/Chicago" },
  minneapolis: { name: "Minneapolis", slug: "minneapolis", state: "MN", region: "Midwest", center: { latitude: 44.9778, longitude: -93.2650 }, tz: "America/Chicago" },
  denver: { name: "Denver", slug: "denver", state: "CO", region: "Southwest", center: { latitude: 39.7480, longitude: -104.9950 }, tz: "America/Denver" },
  phoenix: { name: "Phoenix & Scottsdale", slug: "phoenix", state: "AZ", region: "Southwest", center: { latitude: 33.5400, longitude: -111.9900 }, tz: "America/Phoenix" },
  vegas: { name: "Las Vegas", slug: "las-vegas", state: "NV", region: "Southwest", center: { latitude: 36.1147, longitude: -115.1728 }, tz: "America/Los_Angeles" },
  sf: { name: "San Francisco", slug: "san-francisco", state: "CA", region: "West", center: { latitude: 37.7793, longitude: -122.4192 }, tz: "America/Los_Angeles" },
  la: { name: "Los Angeles", slug: "los-angeles", state: "CA", region: "West", center: { latitude: 34.0689, longitude: -118.3445 }, tz: "America/Los_Angeles" },
  sandiego: { name: "San Diego", slug: "san-diego", state: "CA", region: "West", center: { latitude: 32.7200, longitude: -117.1600 }, tz: "America/Los_Angeles" },
  seattle: { name: "Seattle", slug: "seattle", state: "WA", region: "West", center: { latitude: 47.6100, longitude: -122.3380 }, tz: "America/Los_Angeles" },
  portland: { name: "Portland", slug: "portland", state: "OR", region: "West", center: { latitude: 45.5200, longitude: -122.6780 }, tz: "America/Los_Angeles" },
} as const satisfies Record<string, City>;

export type CityId = keyof typeof CITIES;
export const CITY_IDS = Object.keys(CITIES) as CityId[];
export const REGIONS: Region[] = ["Northeast", "South", "Texas", "Midwest", "Southwest", "West"];

/** Best default city for a browser time zone (several cities share one). */
export function cityForTz(tz: string): CityId {
  const pref: Record<string, CityId> = { "America/Los_Angeles": "sf", "America/Chicago": "chicago", "America/Denver": "denver", "America/Phoenix": "phoenix", "America/New_York": "nyc" };
  return pref[tz] ?? CITY_IDS.find((c) => CITIES[c].tz === tz) ?? "nyc";
}

/** City for a URL slug (savorlm.com/miami). Short forms are redirected in next.config.ts. */
export function cityBySlug(slug: string): CityId | null {
  return CITY_IDS.find((c) => CITIES[c].slug === slug) ?? null;
}

/** Short forms people type, permanently redirected to the canonical slug. */
export const SLUG_ALIASES: Record<string, string> = {
  nyc: "new-york", ny: "new-york", "new-york-city": "new-york", manhattan: "new-york", brooklyn: "new-york",
  sf: "san-francisco", "bay-area": "san-francisco", la: "los-angeles", sd: "san-diego",
  dc: "washington-dc", washington: "washington-dc", philly: "philadelphia", nola: "new-orleans", neworleans: "new-orleans",
  vegas: "las-vegas", lv: "las-vegas", scottsdale: "phoenix", "phoenix-scottsdale": "phoenix", atl: "atlanta",
  pdx: "portland", msp: "minneapolis", sandiego: "san-diego", sanfrancisco: "san-francisco", losangeles: "los-angeles", newyork: "new-york", lasvegas: "las-vegas",
  orl: "orlando", "orlando-fl": "orlando", "winter-park": "orlando",
};

/** Badge art for a city (public/cities/<slug>.webp, food-themed, made with art/cities.py). */
export const cityIcon = (c: CityId) => `/cities/${CITIES[c].slug}.webp`;

/** US overview for the landing map. */
export const US_VIEW = { lat: 38.5, lng: -97, range: 4_800_000 };
