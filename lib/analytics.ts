import posthog from "posthog-js";

// Named product events. Never the request text, voice or anything about the
// person: only which city, how they asked, and what they did with the picks.
type Events = {
  city_picked: { city: string; from: "chooser" | "picker" | "map" };
  search_sent: { city: string; via: "typed" | "idea" | "voice" };
  list_shown: { city: string; picks: number; top_mentions: number };
  pick_tapped: { city: string; pick: number };
  list_shared: { city: string; method: "share_sheet" | "copy" };
  talk_started: { city: string };
  voice_toggled: { on: boolean };
};

export function track<E extends keyof Events>(event: E, props: Events[E]) {
  try {
    if (posthog.__loaded) posthog.capture(event, props);
  } catch {}
}
