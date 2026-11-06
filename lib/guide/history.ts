// Recent chats, kept only in this browser (no accounts: William 2026-11-06).
// Each chat is a thread of asks and Savvy's lists, restored without any API
// call. Every read and write is guarded: storage can be missing or full.
import type { CityId } from "../cities";
import type { StopCard } from "./scene";

/** One of Savvy's answers: a list of 4 (stops) or, for small talk, just his line. */
export type Answer = { title: string; shareId: string | null; stops: StopCard[]; choice: Record<number, number>; say: string; next: string[] };
/** One ask and its answer (null while Savvy is still working, or if it failed). */
export type Exchange = { id: string; q: string; a: Answer | null };
export type Chat = { id: string; city: CityId; updatedAt: number; thread: Exchange[] };

export const HISTORY_KEY = "savorlm.chats.v1";
export const MAX_CHATS = 20;
const MAX_BYTES = 1_500_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isChat = (c: unknown): c is Chat => !!c && typeof c === "object" && typeof (c as Chat).id === "string" && typeof (c as Chat).city === "string" && Array.isArray((c as Chat).thread);

/** Saved chats, newest first. */
export function loadChats(store: Store | null = local()): Chat[] {
  try {
    const raw = store?.getItem(HISTORY_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isChat).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/** Save (or update) a chat. Only chats with at least one list are kept; the oldest go first past the caps. */
export function saveChat(chat: Chat, store: Store | null = local()): Chat[] {
  if (!store) return [];
  const keep = chat.thread.some((e) => e.a?.stops.length);
  let list = [...(keep ? [chat] : []), ...loadChats(store).filter((c) => c.id !== chat.id)].slice(0, MAX_CHATS);
  for (;;) {
    const json = JSON.stringify(list);
    if (json.length <= MAX_BYTES || list.length <= 1) {
      try {
        store.setItem(HISTORY_KEY, json);
      } catch {
        if (list.length > 1) {
          list = list.slice(0, -1);
          continue;
        }
      }
      return list;
    }
    list = list.slice(0, -1);
  }
}

export function clearChats(store: Store | null = local()) {
  try {
    store?.removeItem(HISTORY_KEY);
  } catch {}
}

/** The chat's title: its first list's name. */
export function chatTitle(c: Chat): string {
  return c.thread.find((e) => e.a?.title)?.a?.title || c.thread[0]?.q || "Savvy's picks";
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago", or a short date (it is shown in capitals, so no bare "m"). */
export function ago(ts: number, now = Date.now()): string {
  const m = Math.round((now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const newChatId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
