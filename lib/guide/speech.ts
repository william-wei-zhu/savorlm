/** Gemini TTS can't voice markdown or emoji; keep plain words. */
export function cleanSpeech(s: string) {
  return s.replace(/[*_#`>\[\]]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
}
