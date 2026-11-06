/** Gemini TTS can't voice markdown or emoji; keep plain words. */
export function cleanSpeech(s: string) {
  return s.replace(/[*_#`>\[\]]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}

const NEXT_STEP = /\b(first|then|afterwards?|after that|next|later|kick (?:things )?off|to start|start with|starting with|for now|begin)\b/i;

/**
 * Savvy's opening line with any sentence that hints at a next stop removed
 * (every answer is one list of four, never an itinerary). Falls back to a
 * plain line when nothing is left.
 */
export function oneListLine(s: string, fallback = "Let me round up the top spots.") {
  const kept = (s.match(/[^.!?]+[.!?]*/g) ?? []).map((x) => x.trim()).filter((x) => x && !NEXT_STEP.test(x));
  return kept.join(" ") || fallback;
}
