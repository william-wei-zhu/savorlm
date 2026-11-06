// The questions Savvy can ask TypeSafe Jev about a place. Jev answers each
// with calibrated probabilities over fixed options, so a badge is either
// backed by the evidence text or not shown. Pure: no network here.

export const CHECKS = {
  lowcarb: { label: "Low-carb friendly", ask: "Does this restaurant offer good options for a low-carb diet (protein and vegetable dishes without bread, rice, pasta or sugary sauces)?" },
  vegetarian: { label: "Vegetarian friendly", ask: "Does this restaurant offer a satisfying vegetarian meal (a vegetarian menu or several vegetarian mains)?" },
  vegan: { label: "Vegan options", ask: "Does this restaurant offer vegan dishes or a vegan menu?" },
  glutenfree: { label: "Gluten-free options", ask: "Can this restaurant accommodate a gluten-free diet?" },
  date: { label: "Date-night vibe", ask: "Is this place a good fit for a romantic date night (intimate, special-occasion atmosphere)?" },
  business: { label: "Business dinner", ask: "Is this place well suited to a quiet business dinner (calm, conversation-friendly, polished service)?" },
  kids: { label: "Kid friendly", ask: "Is this place welcoming to families with young children?" },
  groups: { label: "Good for groups", ask: "Does this place handle groups of six or more well (large tables, private room, or group menus)?" },
  quiet: { label: "Quiet enough to talk", ask: "Is this place quiet enough for easy conversation?" },
  view: { label: "A view", ask: "Does this place have a notable view (skyline, water, or landmark)?" },
  outdoor: { label: "Outdoor seating", ask: "Does this place have outdoor seating, a patio or a terrace?" },
  latenight: { label: "Open late", ask: "Is this place open late (serving after 10pm on most nights)?" },
  walkin: { label: "Walk-ins welcome", ask: "Does this place accept walk-ins (no reservation needed)?" },
} as const;

export type CheckId = keyof typeof CHECKS;
export const CHECK_IDS = Object.keys(CHECKS) as CheckId[];

/** Badges need this much confidence in "yes". Below it, Savvy says nothing. */
export const MIN_P = 0.6;

export type Verdict = { choice: string; confidence: number; probabilities: Record<string, number> };

/** A badge only when Jev picks "yes" with enough confidence. "unknown" or "no" never becomes a claim. */
export function badgeFrom(id: CheckId, v: Verdict | undefined): { id: CheckId; label: string; p: number } | null {
  if (!v) return null;
  const p = v.probabilities?.yes ?? (v.choice === "yes" ? v.confidence : 0);
  if (v.choice !== "yes" || p < MIN_P) return null;
  return { id, label: CHECKS[id].label, p: Math.round(p * 100) / 100 };
}

/** Score a candidate for ranking: mean P(yes) over the asked checks (0.5 when nothing was asked). */
export function fitScore(ids: CheckId[], verdicts: Partial<Record<CheckId, Verdict>>): number {
  if (!ids.length) return 0.5;
  return ids.reduce((s, id) => s + (verdicts[id]?.probabilities?.yes ?? 0.3), 0) / ids.length;
}
