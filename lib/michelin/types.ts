// The Michelin spine: the only restaurant data SavorLM stores. Facts only
// (no guide descriptions), built by scripts/spine.mts. Everything live
// (hours, open now, rating, menus, news) comes from Exa at request time.

export type Distinction = "3star" | "2star" | "1star" | "bib" | "selected";

export type Spot = {
  id: string;
  name: string;
  city: CityId;
  distinction: Distinction;
  cuisine: string;
  price: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  mapsUrl: string;
  website: string;
};

export type City = { name: string; country: string; center: { latitude: number; longitude: number }; tz: string };

export const CITIES = {
  nyc: { name: "New York", country: "US", center: { latitude: 40.7359, longitude: -73.9911 }, tz: "America/New_York" },
  sf: { name: "San Francisco", country: "US", center: { latitude: 37.7793, longitude: -122.4192 }, tz: "America/Los_Angeles" },
  dc: { name: "Washington, DC", country: "US", center: { latitude: 38.9047, longitude: -77.0164 }, tz: "America/New_York" },
  chicago: { name: "Chicago", country: "US", center: { latitude: 41.8919, longitude: -87.6278 }, tz: "America/Chicago" },
  la: { name: "Los Angeles", country: "US", center: { latitude: 34.0689, longitude: -118.3445 }, tz: "America/Los_Angeles" },
  miami: { name: "Miami", country: "US", center: { latitude: 25.7781, longitude: -80.1966 }, tz: "America/New_York" },
  boston: { name: "Boston", country: "US", center: { latitude: 42.3554, longitude: -71.0605 }, tz: "America/New_York" },
  philly: { name: "Philadelphia", country: "US", center: { latitude: 39.9502, longitude: -75.1667 }, tz: "America/New_York" },
  toronto: { name: "Toronto", country: "CA", center: { latitude: 43.6512, longitude: -79.3832 }, tz: "America/Toronto" },
  paris: { name: "Paris", country: "FR", center: { latitude: 48.8606, longitude: 2.3376 }, tz: "Europe/Paris" },
  london: { name: "London", country: "GB", center: { latitude: 51.5101, longitude: -0.1340 }, tz: "Europe/London" },
  singapore: { name: "Singapore", country: "SG", center: { latitude: 1.2903, longitude: 103.8519 }, tz: "Asia/Singapore" },
  tokyo: { name: "Tokyo", country: "JP", center: { latitude: 35.6702, longitude: 139.7400 }, tz: "Asia/Tokyo" },
} as const satisfies Record<string, City>;

export type CityId = keyof typeof CITIES;
export const CITY_IDS = Object.keys(CITIES) as CityId[];

export const DISTINCTION_LABEL: Record<Distinction, string> = {
  "3star": "Three Michelin Stars",
  "2star": "Two Michelin Stars",
  "1star": "One Michelin Star",
  bib: "Bib Gourmand",
  selected: "Michelin Guide",
};
