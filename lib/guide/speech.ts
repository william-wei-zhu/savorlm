/** Gemini TTS can't voice markdown or emoji; keep plain words. */
export function cleanSpeech(s: string) {
  return s.replace(/[*_#`>\[\]]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

export const NEXT_STEP = /\b(first|then|afterwards?|after that|next|later|kick (?:things )?off|to start|start with|starting with|for now|begin)\b/i;

/**
 * Savvy's opening line with any sentence that hints at a next stop removed
 * (every answer is one list of four, never an itinerary). Falls back to a
 * plain line when nothing is left.
 */
export function oneListLine(s: string, fallback = "Let me round up the top spots.") {
  const kept = (s.match(/[^.!?]+[.!?]*/g) ?? []).map((x) => x.trim()).filter((x) => x && !NEXT_STEP.test(x));
  return kept.join(" ") || fallback;
}

/** Savvy's tap-to-ask follow-ups: short, distinct, and never a next stop. */
export function followUps(list: unknown, max = 3): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const s = raw.replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
    if (!s || s.length > 40 || s.split(" ").length > 6 || NEXT_STEP.test(s) || /\b(dessert after|drinks after)\b/i.test(s)) continue;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
    out.push(s[0].toUpperCase() + s.slice(1));
    if (out.length === max) break;
  }
  return out;
}

/** What Savvy's earlier answer was, for the conversation history: the list title and its picks in order. */
export function listSummary(title: string, names: string[], fallback = ""): string {
  if (!names.length) return fallback;
  return `List: ${title || "Savvy's picks"}. ${names.map((n, i) => `${i + 1}) ${n}`).join(" ")}`;
}
