// Savvy's suggested asks: 12 per city in four kinds (a cuisine, an occasion,
// a time of day, near a landmark). Each visit shows three of different kinds,
// shuffled by a per-visit seed (William 2026-11-06: more variety). Rules
// (tested): no restaurant or company names, no awards, never a next stop,
// short enough for a phone row.
import type { CityId } from "./cities";

export type IdeaKind = "cuisine" | "occasion" | "time" | "near";
export const IDEA_KINDS: IdeaKind[] = ["cuisine", "occasion", "time", "near"];

export const IDEAS: Record<CityId, Record<IdeaKind, string[]>> = {
  nyc: {
    cuisine: ["The most famous pizza slice in Manhattan", "Hand-pulled noodles in Flushing", "A classic pastrami sandwich"],
    occasion: ["An anniversary tasting menu", "A birthday dinner for a group of eight", "A solo dinner at a great bar counter"],
    time: ["A bagel breakfast before work", "Late-night eats after a Broadway show", "A long Sunday brunch in the West Village"],
    near: ["Lunch near the Empire State Building", "Dinner near the Brooklyn Bridge", "A quick bite near Central Park"],
  },
  boston: {
    cuisine: ["The most famous lobster roll", "Real cannoli in the North End", "Fresh oysters at a raw bar"],
    occasion: ["A date night in the South End", "A business lunch near Post Office Square", "A family dinner after a long walk"],
    time: ["A quick lunch near Faneuil Hall", "A cozy Sunday brunch in Cambridge", "Clam chowder on a cold evening"],
    near: ["Dinner near Fenway Park", "Seafood near the Boston Harbor", "Lunch near Harvard Square"],
  },
  philly: {
    cuisine: ["The cheesesteak locals actually love", "A roast pork sandwich with sharp provolone", "The best soft pretzels in town"],
    occasion: ["A BYOB date night in Center City", "A group dinner in East Passyunk", "A celebration dinner with a view"],
    time: ["A quick healthy lunch near Rittenhouse", "Weekend brunch in Fishtown", "Late-night eats in Old City"],
    near: ["Lunch near the Liberty Bell", "A bite near the Art Museum steps", "Dinner near Reading Terminal Market"],
  },
  dc: {
    cuisine: ["The best Ethiopian food in town", "A famous half-smoke", "Chesapeake crab cakes worth the price"],
    occasion: ["A business dinner near the White House", "A date night in Georgetown", "A birthday dinner on 14th Street"],
    time: ["The best brunch in Logan Circle", "A quick healthy lunch near Union Station", "Late-night food in Adams Morgan"],
    near: ["Lunch near the Smithsonian museums", "Dinner near the Wharf", "A bite near the Capitol"],
  },
  atlanta: {
    cuisine: ["The best fried chicken", "Korean barbecue on Buford Highway", "A classic Southern meat-and-three"],
    occasion: ["A date night on the BeltLine", "A big group dinner in Midtown", "A special anniversary dinner in Buckhead"],
    time: ["A quick healthy lunch in Midtown", "Sunday brunch in Inman Park", "Late-night wings after a game"],
    near: ["Lunch near Ponce City Market", "Dinner near Centennial Olympic Park", "A bite near the Georgia Aquarium"],
  },
  nashville: {
    cuisine: ["The best hot chicken", "Smoked barbecue with all the sides", "A meat-and-three that locals love"],
    occasion: ["A special dinner in The Gulch", "A bachelorette group dinner", "A quiet date night in 12 South"],
    time: ["Biscuits for brunch in East Nashville", "Late-night food near Lower Broadway", "A quick lunch near Music Row"],
    near: ["Dinner near the Ryman Auditorium", "Lunch near the Parthenon in Centennial Park", "A bite near Broadway's honky-tonks"],
  },
  neworleans: {
    cuisine: ["The best po'boys", "The most famous gumbo in town", "Char-grilled oysters"],
    occasion: ["A big-night Creole dinner in the French Quarter", "A jazz brunch to celebrate", "A date night on Magazine Street"],
    time: ["Beignets and coffee for breakfast", "Late-night eats on Frenchmen Street", "A quick lunch in the Central Business District"],
    near: ["Lunch near Jackson Square", "Dinner in the Garden District", "A bite near the French Market"],
  },
  miami: {
    cuisine: ["The best Cuban sandwich and cafecito", "Fresh ceviche", "Stone crab in season"],
    occasion: ["A big-night dinner in Miami Beach", "A rooftop date night downtown", "A birthday dinner in the Design District"],
    time: ["A quick healthy lunch in Brickell", "Weekend brunch in Coconut Grove", "Late-night bites in Wynwood"],
    near: ["Lunch on Calle Ocho in Little Havana", "Dinner near the Wynwood Walls", "A bite near South Beach"],
  },
  orlando: {
    cuisine: ["The best Vietnamese food in Mills 50", "Fresh Florida seafood", "Barbecue that locals line up for"],
    occasion: ["A date night in Winter Park", "A family dinner with picky eaters", "A special anniversary dinner"],
    time: ["A big breakfast before a theme park day", "Late-night eats downtown", "A quick lunch near the convention center"],
    near: ["Dinner near Lake Eola", "A meal off International Drive", "Lunch on Park Avenue in Winter Park"],
  },
  austin: {
    cuisine: ["Famous brisket for lunch", "The best breakfast tacos", "Tex-Mex with great queso"],
    occasion: ["A date-night dinner on South Congress", "A group dinner with live music", "A birthday dinner on East Sixth"],
    time: ["Breakfast tacos tomorrow morning", "Late-night eats after a show", "A quick healthy lunch downtown"],
    near: ["Lunch near the Texas State Capitol", "Dinner near Lady Bird Lake", "A bite near Zilker Park"],
  },
  houston: {
    cuisine: ["The best Viet-Cajun crawfish", "Pho that locals swear by", "The most famous barbecue"],
    occasion: ["A special dinner in River Oaks", "A big group dinner in Chinatown", "A date night in Montrose"],
    time: ["A kolache breakfast", "Late-night tacos", "A quick lunch near the Medical Center"],
    near: ["Lunch near the Museum District", "Dinner near Buffalo Bayou", "A bite near Space Center Houston"],
  },
  dallas: {
    cuisine: ["Tex-Mex and margaritas in Deep Ellum", "The most famous steakhouse in town", "Smoked brisket worth the wait"],
    occasion: ["A business dinner in Uptown", "A date night in Bishop Arts", "A celebration dinner with a skyline view"],
    time: ["A quick healthy lunch in Uptown", "Weekend brunch on Lower Greenville", "Late-night eats in Deep Ellum"],
    near: ["Lunch near Klyde Warren Park", "Dinner near Dealey Plaza", "A bite near the Arts District"],
  },
  chicago: {
    cuisine: ["Deep dish or tavern pizza, the most famous one", "The best Italian beef", "Real Mexican food in Pilsen"],
    occasion: ["A big-night dinner in the West Loop", "A date night in Logan Square", "A group dinner in Chinatown"],
    time: ["A quick lunch near the Loop", "Weekend brunch in Wicker Park", "Late-night hot dogs"],
    near: ["Lunch near Millennium Park", "Dinner near Navy Pier", "A bite near the Art Institute"],
  },
  minneapolis: {
    cuisine: ["The most famous Juicy Lucy", "The best Hmong and Southeast Asian food", "Scandinavian comfort food"],
    occasion: ["A date night in the North Loop", "A cozy casual dinner", "A family dinner with kids"],
    time: ["Weekend brunch in Northeast", "A warm lunch on a snowy day", "Late-night eats in Uptown"],
    near: ["Lunch near the Stone Arch Bridge", "Dinner near the Guthrie Theater", "A bite near Lake Bde Maka Ska"],
  },
  denver: {
    cuisine: ["The best green chile in town", "A great breakfast burrito", "Craft-beer-friendly pizza"],
    occasion: ["A special dinner in LoHi", "A date night in Cherry Creek", "A group dinner before a concert"],
    time: ["A quick healthy lunch in RiNo", "Weekend brunch in Highland", "Late-night eats on Colfax"],
    near: ["Lunch near Union Station", "Dinner near Larimer Square", "A bite near Red Rocks"],
  },
  phoenix: {
    cuisine: ["The best Sonoran hot dogs", "Famous Sonoran-style Mexican food", "Pizza locals rave about"],
    occasion: ["A date night in Old Town Scottsdale", "A celebration dinner with a desert view", "A group dinner after golf"],
    time: ["Fast casual lunch under $15 in Scottsdale", "A patio brunch on a sunny morning", "Late-night tacos in downtown Phoenix"],
    near: ["Lunch near Roosevelt Row", "Dinner near Camelback Mountain", "A bite near the Desert Botanical Garden"],
  },
  vegas: {
    cuisine: ["The best cheap eats off the Strip", "Famous Chinatown hot pot", "A great steak dinner"],
    occasion: ["A big-night dinner on the Strip", "A bachelor party group dinner", "A birthday celebration with a show"],
    time: ["A famous buffet or brunch", "Late-night food after midnight", "A quick lunch between shows"],
    near: ["Dinner near the Welcome to Las Vegas sign", "A bite on Fremont Street", "Lunch in the Arts District"],
  },
  sf: {
    cuisine: ["The best burrito in the Mission", "Dim sum in Chinatown", "Sourdough and fresh crab"],
    occasion: ["A date-night dinner in North Beach", "A business lunch in the Financial District", "A birthday dinner with a view"],
    time: ["A quick healthy salad in SoMa", "Weekend brunch in Hayes Valley", "Late-night eats in the Mission"],
    near: ["Lunch near the Ferry Building", "Dinner near Fisherman's Wharf", "A bite near Golden Gate Park"],
  },
  la: {
    cuisine: ["Famous tacos in East LA", "Korean barbecue in Koreatown", "The best Thai food in Thai Town"],
    occasion: ["A big-night sushi dinner in Beverly Hills", "A date night in Silver Lake", "A celebration dinner with an ocean view"],
    time: ["A quick healthy lunch in Santa Monica", "Weekend brunch in Venice", "Late-night tacos from a truck"],
    near: ["Lunch near the Getty Center", "Dinner near the Hollywood Walk of Fame", "A bite near the Santa Monica Pier"],
  },
  sandiego: {
    cuisine: ["Fish tacos near the beach", "A California burrito", "Fresh sushi and poke"],
    occasion: ["A special dinner in La Jolla", "A date night in Little Italy", "A group dinner in North Park"],
    time: ["Weekend brunch in Hillcrest", "A quick lunch in the East Village", "Late-night tacos after the beach"],
    near: ["Lunch near Balboa Park", "Dinner in the Gaslamp Quarter", "A bite near the USS Midway Museum"],
  },
  seattle: {
    cuisine: ["The best oysters in town", "Famous teriyaki for a cheap lunch", "Dim sum in the International District"],
    occasion: ["A date night in Capitol Hill", "A business dinner downtown", "A special dinner with a water view"],
    time: ["A quick healthy salad near Pike Place", "Weekend brunch in Ballard", "Late-night eats on Capitol Hill"],
    near: ["Lunch near Pike Place Market", "Dinner near the Space Needle", "A bite near Pioneer Square"],
  },
  portland: {
    cuisine: ["The best food carts for lunch", "The most famous doughnuts and coffee", "Northern Thai food locals love"],
    occasion: ["A date-night dinner in the Pearl District", "A cozy group dinner", "A special tasting menu"],
    time: ["Weekend brunch on Alberta Street", "A quick lunch in the Pearl", "Late-night eats on Division Street"],
    near: ["Lunch near Pioneer Courthouse Square", "Dinner near the Willamette waterfront", "A bite near Washington Park"],
  },
};

let seed = 0;
/** This visit's idea seed: made once, kept in sessionStorage so reloads keep the same mix (browser only). */
export function visitSeed(): number {
  if (seed) return seed;
  try {
    seed = Number(sessionStorage.getItem("slm_ideas_seed")) || 0;
    if (!seed) sessionStorage.setItem("slm_ideas_seed", String((seed = Math.floor(Math.random() * 2 ** 31) + 1)));
  } catch {
    seed ||= Math.floor(Math.random() * 2 ** 31) + 1;
  }
  return seed;
}

/** Small seeded random numbers (mulberry32): the same seed always gives the same mix. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n ideas for a city, each of a different kind, in an order set by the visit's seed. */
export function pickIdeas(city: CityId, seed: number, n = 3): string[] {
  const pool = IDEAS[city];
  const r = rng(seed ^ hash(city));
  // Fisher-Yates (a random sort comparator differs between JS engines and broke hydration).
  const kinds = [...IDEA_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  kinds.length = Math.min(n, kinds.length);
  return kinds.map((k) => pool[k][Math.floor(r() * pool[k].length)]);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
