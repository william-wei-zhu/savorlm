// The chat thread's types: every ask and Savvy's answer. The thread lives only
// in memory for this visit (Recent chats was removed, William 2026-11-06).
import type { StopCard } from "./scene";

/** One of Savvy's answers: a list of 4 (stops) or, for small talk, just his line. */
export type Answer = { title: string; shareId: string | null; stops: StopCard[]; choice: Record<number, number>; say: string; next: string[] };
/** One ask and its answer (null while Savvy is still working, or if it failed). */
export type Exchange = { id: string; q: string; a: Answer | null };

export const newExchangeId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Older visits saved recent chats here; the feature is gone, so the data goes too. */
export const OLD_CHATS_KEY = "savorlm.chats.v1";
export function forgetSavedChats(store: Pick<Storage, "removeItem"> | null = typeof window === "undefined" ? null : window.localStorage) {
  try {
    store?.removeItem(OLD_CHATS_KEY);
  } catch {}
}
