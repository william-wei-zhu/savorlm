"use client";

// The SavorLM experience: Savvy stands on the map, the conversation and the
// picks live in the side panel (a printed evening menu). A small "director"
// plays the scene script from /api/guide in order: Savvy speaks while the
// camera moves, then the top 4 land as pins and a ticket.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, History, Keyboard, Mic, Send, Share2, Sparkles, Square, Trash2, Volume2, VolumeX, RotateCcw, Settings, X } from "lucide-react";
import { MapView, type MapHandle, type Pin } from "./map-view";
import { Savvy } from "./savvy";
import { StopTicket } from "./stop-card";
import { Photo } from "./photo";
import { audio } from "@/lib/audio/engine";
import { Mic as MicRecorder, blobToBase64 } from "@/lib/audio/recorder";
import { photoSrc, sseParser, type Pose, type SceneEvent, type SharedList, type StopCard } from "@/lib/guide/scene";
import { ago, chatTitle, clearChats, loadChats, newChatId, saveChat, type Answer, type Chat, type Exchange } from "@/lib/guide/history";
import { listSummary } from "@/lib/guide/speech";
import { CITIES, CITY_IDS, REGIONS, US_VIEW, cityForTz, cityIcon, type CityId } from "@/lib/cities";
import { CityChooser } from "./city-chooser";
import { track } from "@/lib/analytics";
import { NAME, TAGLINE } from "@/lib/brand";
import { cityShot } from "@/lib/guide/geo";

type Status = "idle" | "thinking" | "touring" | "listening" | "hearing";
type Mood = "warm" | "excited" | "curious" | "cozy";

const PROMPTS: Partial<Record<CityId | "default", string[]>> = {
  default: ["A quick healthy salad near me", "The most famous tacos in town", "A special-occasion dinner"],
  nyc: ["The most famous pizza slice in Manhattan", "An anniversary tasting menu", "A quick healthy lunch near Union Square"],
  sf: ["A date-night dinner in North Beach", "The best burrito in the Mission", "A quick healthy salad in SoMa"],
  la: ["Famous tacos in East LA", "A quick healthy lunch in Santa Monica", "A big-night sushi dinner in Beverly Hills"],
  sandiego: ["Fish tacos near the beach", "Brunch in Little Italy", "A special dinner in La Jolla"],
  seattle: ["A quick healthy salad near Pike Place", "The best oysters in town", "Famous teriyaki for a cheap lunch"],
  portland: ["The best food carts for lunch", "The most famous doughnuts and coffee", "A date-night dinner in the Pearl District"],
  vegas: ["A big-night dinner on the Strip", "The best cheap eats off the Strip", "A famous buffet or brunch"],
  phoenix: ["Fast casual lunch under $15 in Scottsdale", "The best Sonoran hot dogs", "A date night in Old Town Scottsdale"],
  denver: ["The best green chile in town", "A special dinner in LoHi", "A quick healthy lunch in RiNo"],
  austin: ["Famous brisket for lunch", "Breakfast tacos tomorrow morning", "A date-night dinner on South Congress"],
  houston: ["The best Viet-Cajun crawfish", "The most famous barbecue", "A special dinner in River Oaks"],
  dallas: ["Tex-Mex and margaritas in Deep Ellum", "The most famous steakhouse in town", "A quick healthy lunch in Uptown"],
  chicago: ["Deep dish or tavern pizza, the most famous one", "A big-night dinner in the West Loop", "A quick lunch near the Loop"],
  minneapolis: ["The most famous Juicy Lucy", "A date night in the North Loop", "A cozy casual dinner"],
  nashville: ["The best hot chicken", "A special dinner in The Gulch", "Biscuits for brunch in East Nashville"],
  atlanta: ["The best fried chicken", "A date night on the BeltLine", "A quick healthy lunch in Midtown"],
  neworleans: ["The best po'boys", "A big-night Creole dinner in the French Quarter", "The most famous gumbo in town"],
  miami: ["The best Cuban sandwich and cafecito", "A big-night dinner in Miami Beach", "A quick healthy lunch in Brickell"],
  boston: ["The most famous lobster roll", "A date night in the South End", "A quick lunch near Faneuil Hall"],
  philly: ["The cheesesteak locals actually love", "A BYOB date night in Center City", "A quick healthy lunch near Rittenhouse"],
  dc: ["A business dinner near the White House", "The best brunch in Logan Circle", "A quick healthy lunch near Union Station"],
};

function voicePref(): boolean {
  try {
    return localStorage.getItem("slm_voice") !== "0";
  } catch {
    return true;
  }
}

function guessCity(): CityId {
  try {
    return cityForTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "nyc";
  }
}

/** The option currently picked for a stop (Savvy's first unless the user chose another). */
const pickOf = (s: StopCard, choice: Record<number, number>) => s.options[choice[s.index] ?? 0] ?? s.options[0];

/** Tap-to-ask follow-ups when Savvy didn't suggest any. */
const FALLBACK_NEXT = ["Show me others", "Cheaper picks", "Somewhere quieter"];

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const center = (c: CityId) => ({ lat: CITIES[c].center.latitude, lng: CITIES[c].center.longitude });

export function GuideApp({ initialCity, initialTour }: { initialCity?: CityId; initialTour?: SharedList }) {
  const map = useRef<MapHandle>(null);
  const [city, setCity] = useState<CityId>(initialCity ?? "nyc");
  // The home page opens on the city chooser (BikeSim-style); a city URL skips it.
  const [landing, setLanding] = useState(!initialCity);
  const cityRef = useRef<CityId>(initialCity ?? "nyc");
  const [greet, setGreet] = useState(0); // bumps when a city is picked from the chooser
  const askRef = useRef<HTMLTextAreaElement>(null);
  const landingRef = useRef(!initialCity);
  const hushed = useRef(-1); // run id the user silenced with "Stop talking"
  const talking = useRef<Promise<void>>(Promise.resolve()); // what Savvy is saying now
  const userTook = useRef(0); // bumps when the user taps an option (takes over the voice)
  const [pose, setPose] = useState<Pose>("wave");
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState(initialTour ? `Here's the list: ${initialTour.title}. Tap any pick and I'll tell you about it.` : initialCity ? "Hi, I'm Savvy! Tell me what you're craving and I'll find the top 4 spots." : "Hi, I'm Savvy! Pick a city and I'll find the places locals love.");
  const [status, setStatus] = useState<Status>("idle");
  // The chat: every ask and Savvy's list. The open exchange's list lives in
  // the "live" state below (stops, choice, title, shareId, next, reply);
  // the others are folded into a slim row until tapped.
  const [thread, setThread] = useState<Exchange[]>(initialTour ? [{ id: initialTour.id, q: initialTour.message, a: null }] : []);
  const threadRef = useRef<Exchange[]>(thread);
  const [openIdx, setOpenIdx] = useState(0);
  const openRef = useRef(0);
  const chatId = useRef(newChatId());
  const [next, setNext] = useState<string[]>([]);
  const nextRef = useRef<string[]>([]);
  const [reply, setReply] = useState(""); // Savvy's line for an answer without a list (small talk, errors)
  const replyRef = useRef("");
  const titleRef = useRef(initialTour?.title ?? "");
  const shareIdRef = useRef<string | null>(initialTour?.id ?? null);
  const [recent, setRecent] = useState<Chat[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const openElRef = useRef<HTMLDivElement>(null);
  const [stops, setStops] = useState<StopCard[]>(initialTour?.stops ?? []);
  const [active, setActive] = useState<number | null>(null);
  const [choice, setChoice] = useState<Record<number, number>>({});
  const choiceRef = useRef<Record<number, number>>({});
  const [title, setTitle] = useState(initialTour?.title ?? "");
  const [shareId, setShareId] = useState<string | null>(initialTour?.id ?? null);
  const [copied, setCopied] = useState(false);
  const [streaming, setStreaming] = useState(false); // the server is still sending this answer
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState(true);
  const [micLv, setMicLv] = useState(0);
  const [intro, setIntro] = useState(true);
  const [capOpen, setCapOpen] = useState(""); // the caption the phone dock shows in full
  const mic = useRef<MicRecorder | null>(null);
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const stopsRef = useRef<StopCard[]>(initialTour?.stops ?? []);
  const voiceRef = useRef(true);
  const unlocked = useRef(false);
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const v = voicePref();
    // Restore per-viewer prefs once on mount (client-only values).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoice(v);
    voiceRef.current = v;
    // A city URL (savorlm.com/miami) wins; the home page guesses from the time zone.
    if (!initialCity) setCity(guessCity());
    const t = setTimeout(() => setIntro(false), 2900);
    // After the hello wave, Savvy settles into listening.
    const w = setTimeout(() => setPose((p) => (p === "wave" ? "listen" : p)), 5200);
    return () => {
      clearTimeout(t);
      clearTimeout(w);
    };
  }, [initialCity]);

  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  // A shared list: pins and camera on its first stop once the map is up.
  useEffect(() => {
    if (!initialTour?.stops.length) return;
    const t = setTimeout(() => {
      const first = initialTour.stops[0].options[0];
      setActive(0);
      drawPinsRef.current?.(0);
      void map.current?.fly({ lat: first.lat, lng: first.lng, altitude: 0, range: 750, tilt: 58, heading: 30, durationMs: 1800 });
    }, 1200);
    return () => clearTimeout(t);
  }, [initialTour]);

  /** City badges on the US map while choosing. */
  useEffect(() => {
    if (!landing) return;
    const t = setTimeout(() => map.current?.setStops(CITY_IDS.map((c) => ({ name: CITIES[c].name, lat: CITIES[c].center.latitude, lng: CITIES[c].center.longitude, label: "", icon: cityIcon(c) })), null), 50);
    return () => clearTimeout(t);
  }, [landing]);

  /** The open list as it stands now (the live state), or null when there is nothing yet. */
  const snapshot = useCallback((): Answer | null => {
    if (!stopsRef.current.length && !replyRef.current) return null;
    return { title: titleRef.current, shareId: shareIdRef.current, stops: stopsRef.current, choice: choiceRef.current, say: replyRef.current, next: nextRef.current };
  }, []);

  /** The thread with the open exchange's live list written back into it. */
  const liveThread = useCallback((): Exchange[] => {
    const t = threadRef.current;
    const a = snapshot();
    return a && t[openRef.current] ? t.map((e, j) => (j === openRef.current ? { ...e, a } : e)) : t;
  }, [snapshot]);

  const putThread = useCallback((t: Exchange[], open: number) => {
    threadRef.current = t;
    openRef.current = open;
    setThread(t);
    setOpenIdx(open);
  }, []);

  /** Make an answer the live one, or clear the live state with null. */
  const loadLive = useCallback((a: Answer | null) => {
    stopsRef.current = a?.stops ?? [];
    choiceRef.current = a?.choice ?? {};
    titleRef.current = a?.title ?? "";
    shareIdRef.current = a?.shareId ?? null;
    nextRef.current = a?.next ?? [];
    replyRef.current = a?.say ?? "";
    setStops(stopsRef.current);
    setChoice(choiceRef.current);
    setTitle(titleRef.current);
    setShareId(shareIdRef.current);
    setNext(nextRef.current);
    setReply(replyRef.current);
    setActive(null);
  }, []);

  /** Save this chat to the browser's recent chats (only chats with a list are kept). */
  const persist = useCallback(() => {
    const t = liveThread();
    if (t.length) setRecent(saveChat({ id: chatId.current, city: cityRef.current, updatedAt: Date.now(), thread: t }));
  }, [liveThread]);

  /** End this chat (it stays in Recent) and drop the answer: request, voice, picks, title, share link and pins. */
  const clearAnswer = useCallback(() => {
    persist();
    abort.current?.abort();
    run.current++;
    audio?.stopVoice();
    putThread([], 0);
    chatId.current = newChatId();
    loadLive(null);
    setStreaming(false);
    setStatus("idle");
    setSpeaking(false);
    map.current?.setStops([], null);
  }, [persist, putThread, loadLive]);

  /** Picking a city moves to its own URL without reloading (shareable links). */
  const pickCity = useCallback((c: CityId, from: "chooser" | "picker" | "map" = "picker") => {
    if (c !== cityRef.current || landingRef.current) track("city_picked", { city: c, from });
    // Another city starts fresh: the old city's picks and Savvy's last line go,
    // and he greets the new city.
    if (!landingRef.current && c !== cityRef.current) {
      clearAnswer();
      setGreet((g) => g + 1);
    }
    setCity(c);
    if (landingRef.current) {
      landingRef.current = false;
      setLanding(false);
      map.current?.setStops([], null);
      map.current?.fly(cityShot(center(c)));
      // The tap is a user gesture: unlock audio now so Savvy can greet out loud.
      unlocked.current = true;
      void audio?.unlock().catch(() => {});
      setGreet((g) => g + 1);
    }
    try {
      window.history.pushState(null, "", `/${CITIES[c].slug}`);
      document.title = `${NAME} ${CITIES[c].name}: ${TAGLINE}`;
    } catch {}
  }, [clearAnswer]);

  // Back / forward between city URLs.
  useEffect(() => {
    const onPop = () => {
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, "");
      if (!slug) {
        landingRef.current = true;
        setLanding(true);
        setCaption("Where to next? Pick a city and I'll find the places locals love.");
        map.current?.fly({ ...US_VIEW, altitude: 0, tilt: 0, heading: 0, durationMs: 1800 });
        document.title = `${NAME}: ${TAGLINE}`;
        return;
      }
      const c = CITY_IDS.find((x) => CITIES[x].slug === slug);
      if (c) {
        if (!landingRef.current && c !== cityRef.current) {
          clearAnswer();
          setGreet((g) => g + 1);
        }
        setCity(c);
        document.title = `${NAME} ${CITIES[c].name}: ${TAGLINE}`;
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [clearAnswer]);

  useEffect(() => {
    if (!landingRef.current) map.current?.fly(cityShot(center(city)));
  }, [city]);

  const unlock = useCallback(async () => {
    if (unlocked.current) return;
    unlocked.current = true;
    await audio?.unlock().catch(() => {});
  }, []);

  /** Show a gesture briefly, then a follow-up pose (HiBenny: replies open with a mood gesture). */
  const gesture = useCallback((first: Pose, then: Pose, ms = 1100) => {
    if (poseTimer.current) clearTimeout(poseTimer.current);
    setPose(first);
    if (first !== then) poseTimer.current = setTimeout(() => setPose(then), ms);
  }, []);

  /** Say a line: voiced when voice is on, otherwise held long enough to read. */
  const say = useCallback(
    async (text: string, opener: Pose, id: number, mood: Mood = "warm") => {
      if (!text || id !== run.current) return;
      setCaption(text);
      gesture(opener, "talk");
      if (!voiceRef.current || !audio || hushed.current === id) {
        await new Promise((r) => setTimeout(r, hushed.current === id ? 900 : Math.max(1800, words(text) * 300)));
        return;
      }
      setSpeaking(true);
      const h = audio.playStream((signal) => fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mood }), signal }));
      const r = await h.done;
      if (id === run.current) setSpeaking(false);
      if (r === "error") await new Promise((res) => setTimeout(res, Math.max(1200, words(text) * 250)));
    },
    [gesture],
  );

  /** Pins: each stop's current pick, plus the active stop's other options. */
  const drawPins = useCallback((activeIdx: number | null) => {
    const ch = choiceRef.current;
    const stops: Pin[] = stopsRef.current.map((s, i) => ({ ...pickOf(s, ch), label: String(i + 1) }));
    const act = activeIdx === null ? null : stopsRef.current[activeIdx];
    const alts: Pin[] = act ? act.options.map((o, j) => ({ ...o, label: `${activeIdx! + 1}.${j + 1}` })).filter((_, j) => j !== (ch[act.index] ?? 0)) : [];
    map.current?.setStops(stops, activeIdx, alts);
  }, []);

  // Onboarding greeting after a city is picked: Savvy says what to do next.
  useEffect(() => {
    if (!greet) return;
    const c = cityRef.current;
    const id = ++run.current;
    void say(`${CITIES[c].name}! Type what you're craving, tap the mic and tell me, or pick one of my ideas.`, "wave", id, "excited").then(() => {
      if (id === run.current) gesture("listen", "listen");
    });
    // Only when a city is picked; say and gesture are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greet]);

  const drawPinsRef = useRef(drawPins);
  useEffect(() => {
    drawPinsRef.current = drawPins;
  }, [drawPins]);

  const focusStop = useCallback(
    (i: number) => {
      const s = stopsRef.current[i];
      if (!s) return;
      const o = pickOf(s, choiceRef.current);
      setActive(i);
      drawPins(i);
      void map.current?.fly({ lat: o.lat, lng: o.lng, altitude: 0, range: 750, tilt: 58, heading: 30, durationMs: 2200 });
    },
    [drawPins],
  );

  /** Show an option as the stop's pick (card, pins, map). */
  const showOption = useCallback(
    (stopIdx: number, j: number) => {
      choiceRef.current = { ...choiceRef.current, [stopIdx]: j };
      setChoice(choiceRef.current);
      focusStop(stopIdx);
    },
    [focusStop],
  );

  /** The user taps an option: it becomes the pick and Savvy talks about that one (the tour keeps loading). */
  const choose = useCallback(
    (stopIdx: number, j: number) => {
      showOption(stopIdx, j);
      const o = stopsRef.current[stopIdx]?.options[j];
      if (!o) return;
      track("pick_tapped", { city: cityRef.current, pick: j + 1 });
      userTook.current++;
      audio?.stopVoice();
      const id = run.current;
      talking.current = say(o.intro || `${o.name}. ${o.why}`, "point", id, "warm").then(() => {
        if (id === run.current) gesture("listen", "listen");
      });
    },
    [showOption, say, gesture],
  );

  const send = useCallback(
    async (text: string, via: "typed" | "idea" | "voice" | "chip" = "typed") => {
      const message = text.trim();
      if (!message) return;
      track("search_sent", { city, via, followup: threadRef.current.length > 0 });
      await unlock();
      audio?.stopVoice();
      abort.current?.abort();
      const id = ++run.current;
      const ac = new AbortController();
      abort.current = ac;
      setInput("");
      setStatus("thinking");
      setCopied(false);
      setStreaming(true);
      // The chat so far: what Savvy listed (so "the second one" or "cheaper"
      // makes sense) and every place already shown (so "others" skips them).
      const prior = liveThread();
      const history = prior
        .slice(-3)
        .flatMap((e) => {
          const g = e.a ? listSummary(e.a.title, e.a.stops[0]?.options.map((o) => o.name) ?? [], e.a.say) : "";
          return g ? [{ role: "user" as const, text: e.q }, { role: "guide" as const, text: g.slice(0, 800) }] : [{ role: "user" as const, text: e.q }];
        })
        .slice(-6);
      const seen = [...new Set(prior.flatMap((e) => e.a?.stops.flatMap((s) => s.options.map((o) => o.name.slice(0, 120))) ?? []))].slice(-24);
      const t = [...prior, { id: newChatId(), q: message, a: null }];
      putThread(t, t.length - 1);
      loadLive(null);
      map.current?.setStops([], null);
      gesture("think", "think");
      setCaption("Ooh, let me sniff around...");
      // Bring the new ask into view so the scouting card shows right away.
      setTimeout(() => openElRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

      // The director: events are queued as they stream and played in order.
      const queue: SceneEvent[] = [];
      const sig: { done: boolean; wake: (() => void) | null } = { done: false, wake: null };
      const push = (e: SceneEvent) => {
        // The list's title and share link apply the moment they arrive, not
        // after Savvy finishes talking (William: Share must always be there).
        if (id === run.current && e.t === "share") {
          shareIdRef.current = e.id;
          setShareId(e.id);
          try {
            window.history.replaceState(null, "", `/t/${e.id}`);
          } catch {}
          return;
        }
        if (id === run.current && e.t === "done") {
          if (e.title) {
            titleRef.current = e.title;
            setTitle(e.title);
          }
          nextRef.current = e.next ?? [];
          setNext(nextRef.current);
        }
        queue.push(e);
        sig.wake?.();
      };
      const next = async (): Promise<SceneEvent | null> => {
        while (!queue.length && !sig.done) await new Promise<void>((r) => (sig.wake = r));
        sig.wake = null;
        return queue.shift() ?? null;
      };

      (async () => {
        try {
          const res = await fetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, city, history, seen }), signal: ac.signal });
          if (!res.ok || !res.body) throw new Error(String(res.status));
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          const feed = sseParser(push);
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            feed(value);
          }
        } catch (e) {
          if (!ac.signal.aborted) push({ t: "error", text: String(e).includes("429") ? "That's a lot of questions at once. Give me a minute." : "My nose went fuzzy for a second. Mind asking again?" });
        } finally {
          sig.done = true;
          sig.wake?.();
          if (id === run.current) setStreaming(false);
        }
      })();

      talking.current = Promise.resolve();
      // Wait until Savvy is done, including anything a tap started meanwhile.
      const settle = async () => {
        for (let p = talking.current; ; p = talking.current) {
          await p;
          if (p === talking.current) return;
        }
      };
      const picked: string[] = [];
      let lastLine = "";
      for (;;) {
        const e = await next();
        if (!e || id !== run.current) break;
        if (e.t === "city") {
          // Savvy planned for another city than the one on screen: follow him.
          if (e.city !== cityRef.current) {
            cityRef.current = e.city;
            setCity(e.city);
            try {
              window.history.pushState(null, "", `/${CITIES[e.city].slug}`);
              document.title = `${NAME} ${CITIES[e.city].name}: ${TAGLINE}`;
            } catch {}
          }
        } else if (e.t === "say") {
          setStatus("touring");
          lastLine = e.text;
          replyRef.current = e.text;
          talking.current = say(e.text, e.pose === "think" ? "wow" : e.pose, id, "excited").then(() => {
            if (id === run.current) gesture("look", "look");
          });
        } else if (e.t === "fly") {
          await map.current?.fly(e.shot);
        } else if (e.t === "stop") {
          await settle();
          if (id !== run.current) break;
          stopsRef.current = [...stopsRef.current, e.stop];
          setStops(stopsRef.current);
          setActive(e.stop.index);
          drawPins(e.stop.index);
          gesture("look", "look");
          await map.current?.fly(e.shot);
          audio?.chime();
          track("list_shown", { city: cityRef.current, picks: e.stop.options.length, top_mentions: e.stop.options[0].mentions });
          picked.push(e.stop.options[0].name);
          // One option at a time: Savvy introduces the top three in turn, the
          // card and map following him; a tap on any option takes over.
          const stop = e.stop;
          const took = userTook.current;
          talking.current = (async () => {
            const n = Math.min(3, stop.options.length);
            for (let j = 0; j < n; j++) {
              if (id !== run.current || userTook.current !== took) return;
              if (j > 0) showOption(stop.index, j);
              const o = stop.options[j];
              await say(o.intro || `${o.name}. ${o.why}`, j === 0 && o.mentions >= 2 ? "wow" : "point", id, "warm");
            }
            if (id === run.current && userTook.current === took) {
              if (n > 1) showOption(stop.index, 0); // back to Savvy's pick
              gesture("think", "think");
            }
          })();
        } else if (e.t === "done") {
          await settle();
          if (id !== run.current) break; // a new request or city took over
          if (e.text) await say(e.text, "dance", id, "cozy");
          if (id === run.current && picked.length) gesture("cheer", "listen", 1900);
          if (id === run.current) {
            if (!picked.length) setReply(lastLine);
            persist();
          }
        } else if (e.t === "error") {
          await settle();
          if (id !== run.current) break;
          replyRef.current = e.text;
          setReply(e.text);
          await say(e.text, "listen", id, "warm");
        }
      }
      if (id === run.current) {
        setStatus("idle");
        setPose((p) => (p === "talk" || p === "think" || p === "look" ? "listen" : p));
      }
    },
    [city, say, unlock, gesture, drawPins, showOption, liveThread, putThread, loadLive, persist],
  );

  const listen = useCallback(async () => {
    await unlock();
    if (status === "listening" && mic.current) {
      await mic.current.stop();
      return;
    }
    audio?.stopVoice();
    run.current++;
    setSpeaking(false);
    try {
      if (!MicRecorder.supported()) throw new Error("unsupported");
      mic.current ??= new MicRecorder();
      await mic.current.open(audio!.ensure());
    } catch {
      setCaption("I can't hear you yet. Allow the microphone in your browser, or type below.");
      setPose("listen");
      return;
    }
    setStatus("listening");
    track("talk_started", { city: cityRef.current });
    gesture("listen", "listen");
    setCaption("I'm all ears...");
    audio?.blip();
    let raf = 0;
    const meter = () => {
      setMicLv(mic.current?.level() ?? 0);
      raf = requestAnimationFrame(meter);
    };
    raf = requestAnimationFrame(meter);
    const rec = await mic.current.listen();
    cancelAnimationFrame(raf);
    setMicLv(0);
    if (!rec) {
      setStatus("idle");
      setCaption("I didn't catch anything. Tap the mic and try again?");
      return;
    }
    setStatus("hearing");
    gesture("think", "think");
    try {
      const r = await fetch("/api/hear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: await blobToBase64(rec.blob) }) });
      const j = (await r.json()) as { text?: string; error?: string };
      if (!j.text) throw new Error(j.error ?? "empty");
      setStatus("idle");
      void send(j.text, "voice");
    } catch {
      setStatus("idle");
      setPose("listen");
      setCaption("I couldn't make that out. Try again, or type it below.");
    }
  }, [send, status, unlock, gesture]);

  /** Share the saved list: the phone's share sheet when there is one, else copy the link. */
  const shareList = async () => {
    if (!shareId) return;
    const url = `${window.location.origin}/t/${shareId}`;
    try {
      if (navigator.share) {
        track("list_shared", { city, method: "share_sheet" });
        await navigator.share({ title: `${title} | ${NAME}`, text: `${title}: Savvy's picks in ${CITIES[city].name}`, url });
        return;
      }
    } catch {
      return; // the user closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      track("list_shared", { city, method: "copy" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  /** Silence Savvy for the rest of this answer (captions keep going). The mute button turns voice off for good. */
  const stopTalking = () => {
    hushed.current = run.current;
    audio?.stopVoice();
    setSpeaking(false);
  };

  const toggleVoice = () => {
    const v = !voice;
    track("voice_toggled", { on: v });
    setVoice(v);
    voiceRef.current = v;
    if (!v) audio?.stopVoice();
    try {
      localStorage.setItem("slm_voice", v ? "1" : "0");
    } catch {}
  };

  const reset = () => {
    clearAnswer();
    gesture("wave", "listen", 2400);
    setCaption("New chat. What are we eating?");
    map.current?.fly(cityShot(center(city)));
  };

  /** Unfold an earlier list in this chat: it becomes the open one (cards, pins, map). */
  const reopen = (i: number) => {
    if (i === openRef.current || streaming) return;
    const t = liveThread();
    const a = t[i]?.a;
    if (!a?.stops.length) return;
    run.current++;
    audio?.stopVoice();
    setSpeaking(false);
    setStatus("idle");
    putThread(t, i);
    loadLive(a);
    focusStop(0);
    track("list_reopened", { city: cityRef.current });
    gesture("point", "listen", 1400);
    setCaption(`Back to ${a.title || "these picks"}. Tap any pick and I'll tell you about it.`);
    setTimeout(() => openElRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  /** Open a saved chat from Recent, straight from this browser's storage (no new search). */
  const restoreChat = (c: Chat) => {
    setRecentOpen(false);
    const lists = c.thread.filter((e) => e.a?.stops.length);
    track("chat_restored", { city: c.city, lists: lists.length });
    clearAnswer();
    if (!CITIES[c.city] || !lists.length) return;
    chatId.current = c.id;
    let i = c.thread.length - 1;
    while (i > 0 && !c.thread[i].a?.stops.length) i--;
    putThread(c.thread, i);
    loadLive(c.thread[i].a);
    if (landingRef.current) {
      landingRef.current = false;
      setLanding(false);
      unlocked.current = true;
      void audio?.unlock().catch(() => {});
    }
    cityRef.current = c.city;
    setCity(c.city);
    try {
      window.history.pushState(null, "", `/${CITIES[c.city].slug}`);
      document.title = `${NAME} ${CITIES[c.city].name}: ${TAGLINE}`;
    } catch {}
    gesture("wave", "listen", 1600);
    setCaption(`Welcome back! Here's ${c.thread[i].a?.title || "your list"}. Tap any pick, or ask me a follow-up.`);
    // After the city move settles, pin the list and fly to its top pick.
    setTimeout(() => focusStop(0), 450);
    setTimeout(() => openElRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  const openRecent = () => {
    const list = loadChats();
    setRecent(list);
    setRecentOpen(true);
    track("history_opened", { chats: list.length });
  };

  const busy = status === "thinking" || status === "touring" || status === "hearing";
  /** A city is open and nothing has been asked yet: show Savvy's three ways to start. */
  const onboarding = !landing && !thread.length && (status === "idle" || status === "touring") && !stops.length;
  const prompts = PROMPTS[city] ?? PROMPTS.default!;
  const chatting = !landing && thread.length > 0;

  /** The follow-up box: pinned under the chat on desktop, in Savvy's dock on phones. */
  const composer = (id: string, withMic: boolean, hint: string) => (
    <form
      className="flex items-end gap-2 rounded-2xl border-2 border-gold bg-surface p-2 shadow-[var(--shadow)]"
      onSubmit={(e) => {
        e.preventDefault();
        void send(input);
      }}
    >
      <label htmlFor={id} className="sr-only">
        Ask Savvy a follow-up
      </label>
      <textarea
        id={id}
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send(input);
          }
        }}
        placeholder={busy ? "Savvy is on it..." : hint}
        maxLength={500}
        className="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border-2 border-transparent bg-sunk px-3 py-2 text-[1rem] font-bold leading-snug text-ink placeholder:text-ink-2 focus:border-gold"
      />
      {withMic && (
        <button
          type="button"
          onClick={() => void listen()}
          disabled={status === "hearing"}
          className={`btn size-11 shrink-0 border-2 border-gold p-0 ${status === "listening" ? "btn-primary mic-live" : "text-ink hover:bg-sunk"}`}
          style={{ ["--lv" as string]: micLv }}
          aria-label={status === "listening" ? "Send what you said" : "Talk to Savvy"}
          title={status === "listening" ? "Send what you said" : "Talk to Savvy"}
        >
          {status === "listening" ? <Send className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
        </button>
      )}
      <button type="submit" disabled={!input.trim()} className="btn btn-primary size-11 shrink-0 p-0 disabled:opacity-60" aria-label="Send to Savvy">
        <Send className="size-5" />
      </button>
    </form>
  );

  const poke = () => !speaking && gesture("laugh", "listen", 1300);

  const allCities = () => {
    reset();
    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  /** The city picker in the header's city bar. */
  const citySelect = (id: string, cls: string) => (
    <div className="relative min-w-0 flex-1">
      <select id={id} value={city} onChange={(e) => pickCity(e.target.value as CityId)} aria-label="City" className={`w-full cursor-pointer appearance-none rounded-xl border-2 border-gold bg-surface pl-3 pr-10 font-display font-bold text-ink ${cls}`}>
        {REGIONS.map((r) => (
          <optgroup key={r} label={r}>
            {CITY_IDS.filter((c) => CITIES[c].region === r).map((c) => (
              <option key={c} value={c}>
                {CITIES[c].name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 rotate-90 text-gold-text" aria-hidden />
    </div>
  );

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(25rem,32rem)_minmax(0,1fr)]">
      {intro && <Intro />}

      {/* The map with Savvy standing on it (desktop). On phones the map sits
          between the header and the panel, and is hidden while choosing a city. */}
      <section className={`relative order-1 ${stops.length || busy ? "h-[48dvh]" : "h-[36dvh]"} transition-[height] duration-500 lg:sticky lg:top-0 lg:order-2 lg:block lg:h-dvh lg:self-start ${landing ? "hidden" : ""}`} aria-label="Map">
        <MapView ref={map} className="absolute inset-0" initial={landing ? US_VIEW : center(city)} onPick={(i) => (landingRef.current ? pickCity(CITY_IDS[i], "map") : focusStop(i))} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 hidden items-end gap-3 p-6 lg:flex">
          <div className="savvy-stage pointer-events-auto w-56 shrink-0 xl:w-64 2xl:w-72">
            <Savvy pose={pose} speaking={speaking} className="h-auto w-full" onPoke={poke} />
          </div>
          <div className="bubble pointer-events-auto mb-16 max-w-[34rem] px-5 pb-4 pt-5" aria-live="polite">
            <span className="kicker name-tag">Savvy</span>
            <p className="text-[1.2rem] leading-snug">{caption}</p>
            {onboarding && (
              <div className="rise mt-2.5 flex flex-wrap gap-2">
                <button type="button" onClick={() => void listen()} className="btn btn-primary py-1.5">
                  <Mic className="size-4" aria-hidden /> Talk to me
                </button>
                <button
                  type="button"
                  onClick={() => {
                    askRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    askRef.current?.focus({ preventScroll: true });
                  }}
                  className="btn border-2 border-ink py-1.5 hover:bg-sunk"
                >
                  <Keyboard className="size-4" aria-hidden /> Type it
                </button>
                <button type="button" onClick={() => void send(prompts[0], "idea")} className="btn border-2 border-ink py-1.5 text-left hover:bg-sunk">
                  <Sparkles className="size-4 shrink-0" aria-hidden /> {prompts[0]}
                </button>
              </div>
            )}
            {speaking && (
              <button type="button" onClick={stopTalking} className="btn mt-2 border-2 border-ink py-1 text-[0.95rem] hover:bg-sunk">
                <Square className="size-3.5 fill-current" aria-hidden /> Stop talking
              </button>
            )}
            {(status === "thinking" || status === "hearing") && (
              <span className="mt-1.5 flex gap-1.5" aria-label="Savvy is thinking">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="dot size-2.5 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* The left column: a printed evening menu. On phones it dissolves
          (display: contents) so the header sits above the map and the panel below. */}
      <div className="menu contents lg:order-1 lg:flex lg:min-h-dvh lg:flex-col">
        <header className="menu-part order-0 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-5 pb-3 pt-4 lg:gap-x-3 lg:gap-y-2.5 lg:px-6 lg:pt-6">
          <div className="rounded-full border-2 border-gold p-1">
            <Image src="/savvy/avatar.webp" alt="" width={64} height={64} className="size-9 rounded-full bg-[#2a211d] sm:size-10 lg:size-14" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.4rem] font-extrabold max-[380px]:text-[1.2rem] leading-tight tracking-tight lg:text-[2rem] lg:leading-none">{NAME}</h1>
          </div>
          <button type="button" onClick={openRecent} className="btn size-10 shrink-0 border-2 border-gold p-0 text-ink hover:bg-sunk lg:size-11" aria-label="Recent chats" title="Recent chats">
            <History className="size-5" />
          </button>
          <button type="button" onClick={toggleVoice} className="btn size-10 shrink-0 border-2 border-gold p-0 text-ink hover:bg-sunk lg:size-11" aria-label={voice ? "Mute Savvy" : "Unmute Savvy"} title={voice ? "Mute Savvy" : "Unmute Savvy"}>
            {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <Link href="/settings" className="btn size-10 shrink-0 border-2 border-gold p-0 text-ink hover:bg-sunk lg:size-11" aria-label="Settings" title="Settings">
            <Settings className="size-5" />
          </Link>
          {/* The city bar: compact, in the header (above the map on phones). */}
          {!landing && (
            <div className="flex basis-full items-center gap-2 pt-1">
              <button type="button" onClick={allCities} className="btn shrink-0 border-2 border-gold py-1.5 pl-2 pr-3 text-[0.9rem] text-ink hover:bg-sunk">
                <ChevronLeft className="size-4" aria-hidden /> All cities
              </button>
              {citySelect("city", "py-1.5 text-[1.15rem]")}
              {thread.length > 0 && (
                <button type="button" onClick={reset} className="btn size-10 shrink-0 border-2 border-gold p-0 text-ink hover:bg-sunk" aria-label="New chat" title="New chat">
                  <RotateCcw className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </header>

        {/* The panel: the ask, the picks, the footer. */}
        <section className={`menu-part order-2 flex flex-1 flex-col ${chatting ? "pb-48" : "pb-32"} lg:pb-0`}>
        <div className="hidden px-6 lg:block">
          <div className="ornament text-[0.8rem]" aria-hidden>
            ✦
          </div>
        </div>

        {landing ? (
          <div className="flex-1 px-6 pb-8 pt-5">
            <h2 className="text-[2rem] leading-tight">Where are we eating?</h2>
            <p className="mb-5 mt-2 text-ink-2">Pick a city. Then tell Savvy what you&apos;re craving, from a quick salad to a big night out, and he&apos;ll find the places locals love.</p>
            <CityChooser near={city} onPick={(c) => pickCity(c, "chooser")} />
          </div>
        ) : (
          <>
        {/* The first ask: the first thing in the menu, by voice or by typing.
            Once a chat starts, follow-ups go in the composer below the chat. */}
        {!thread.length && (
        <form
          key={`ask-${city}`}
          className={`mx-6 mt-3 rounded-2xl border-2 border-gold bg-surface p-3 shadow-[var(--shadow)] ${onboarding ? "ask-glow" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="ask" className="kicker block px-1 text-gold-text">
            {onboarding ? "What are you craving? Type it or tap the mic" : "What are you craving?"}
          </label>
          <div className="mt-2 flex items-end gap-2">
            <textarea
              id="ask"
              ref={askRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter adds a line.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={busy ? "Savvy is on it..." : "The best tacos in town..."}
              maxLength={500}
              className="min-h-[4.6rem] min-w-0 flex-1 resize-y rounded-xl border-2 border-line bg-sunk px-3 py-2.5 text-[1.05rem] font-bold leading-snug text-ink placeholder:text-ink-2 focus:border-gold"
            />
            <button type="submit" disabled={!input.trim()} className="btn btn-primary size-13 shrink-0 p-0 disabled:opacity-60" aria-label="Send to Savvy">
              <Send className="size-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={listen}
            disabled={status === "hearing"}
            className={`btn mt-2 w-full border-2 border-gold py-2.5 ${status === "listening" ? "btn-primary mic-live" : "text-ink hover:bg-sunk"}`}
            style={{ ["--lv" as string]: micLv }}
          >
            <Mic className="size-5" aria-hidden />
            {status === "listening" ? "Listening... tap to send" : status === "hearing" ? "Savvy is listening back..." : "Or just talk to Savvy"}
          </button>
        </form>
        )}

        {/* The chat: each ask, then Savvy's list. The open list is in full;
            earlier ones fold into a slim row that unfolds on tap. */}
        <div className="flex-1 space-y-4 px-6 pb-5 pt-4">
          {thread.map((ex, i) => (
            <div key={ex.id} ref={i === openIdx ? openElRef : undefined} className="scroll-mt-3 space-y-4">
              <div className="flex justify-end">
                <p className="user-bubble max-w-[88%] px-4 py-2.5">{ex.q}</p>
              </div>
              {i !== openIdx ? (
                ex.a?.stops.length ? <FoldedList a={ex.a} onOpen={() => reopen(i)} /> : ex.a?.say ? <SavvyLine text={ex.a.say} /> : null
              ) : (
                <>
                  {(title || stops.length > 0) && (
                    <div className="rise text-center">
                      <p className="kicker text-gold-text">Savvy&apos;s top 4</p>
                      <h2 className="mt-1 text-[1.75rem]">{title || "Savvy's picks"}</h2>
                      {shareId ? (
                        <button type="button" onClick={() => void shareList()} className="btn mt-2 border-2 border-gold py-1.5 text-ink hover:bg-sunk">
                          {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                          {copied ? "Link copied" : "Share this list"}
                        </button>
                      ) : streaming ? (
                        <button type="button" disabled className="btn mt-2 border-2 border-gold py-1.5 text-ink opacity-70">
                          <Share2 className="size-4" aria-hidden /> Saving your link…
                        </button>
                      ) : null}
                    </div>
                  )}
                  {busy && stops.length < 1 && i === thread.length - 1 && (
                    <div className="ticket shimmer h-56 overflow-hidden" aria-label="Savvy is scouting">
                      <div className="h-36 bg-sunk" />
                      <p className="kicker px-4 pt-4 text-gold-text">Scouting {CITIES[city].name}</p>
                    </div>
                  )}
                  {stops.map((st, k) => (
                    <div key={`${st.index}-${st.options[0]?.id}`}>
                      <StopTicket stop={st} chosen={choice[st.index] ?? 0} active={active === k} onSelect={() => focusStop(k)} onChoose={(j) => choose(k, j)} />
                    </div>
                  ))}
                  {!stops.length && reply && !busy && <SavvyLine text={reply} />}
                  {i === thread.length - 1 && stops.length > 0 && !streaming && status !== "thinking" && (
                    <div className="rise">
                      <p className="kicker text-gold-text">Ask Savvy next</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(next.length ? next : FALLBACK_NEXT).map((n) => (
                          <button key={n} type="button" onClick={() => void send(n, "chip")} className="btn border-2 border-gold py-1.5 text-left text-ink hover:bg-sunk">
                            <Sparkles className="size-4 shrink-0" aria-hidden /> {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {!thread.length && (
            <div className="pt-1">
              <p className="kicker text-gold-text">Or tap an idea to start</p>
              <ul className="mt-1 border-t border-line">
                {prompts.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => void send(p, "idea")} className="menu-item">
                      <span className="font-display text-[1.15rem] font-semibold leading-snug">{p}</span>
                      <span className="chev" aria-hidden>
                        <ChevronRight className="size-5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Desktop: the follow-up box stays pinned at the bottom of the menu while the chat scrolls. */}
        {chatting && (
          <div className="sticky bottom-0 z-20 hidden px-6 pb-4 pt-6 lg:block" style={{ background: "linear-gradient(to bottom, transparent, var(--paper) 1.5rem)" }}>
            {composer("ask-next", true, "Ask a follow-up: cheaper, closer, others...")}
          </div>
        )}
          </>
        )}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-5 text-[0.9rem]">
          <a href="https://www.linkedin.com/in/william-wei-zhu/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Built by William Zhu
          </a>
          <Link href="/about" className="underline underline-offset-2">
            About
          </Link>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </footer>
        </section>

        {/* Phones: Savvy docks at the bottom like a "now playing" bar. It is
            opaque and the panel pads for it, so he never covers the text. */}
        <div className="menu fixed inset-x-0 bottom-0 z-30 border-t-2 border-gold lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {/* In a chat, the follow-up box rides on top of the dock (the dock's mic is the voice button). */}
          {chatting && <div className="mx-auto max-w-2xl px-3 pt-2.5">{composer("ask-next-m", false, "Ask a follow-up...")}</div>}
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2">
            <div className={`savvy-stage shrink-0 ${chatting ? "w-[4rem]" : "-mt-7 w-[4.75rem]"}`}>
              <Savvy pose={pose} speaking={speaking} className="h-auto w-full" onPoke={poke} />
            </div>
            <button type="button" onClick={() => setCapOpen((o) => (o === caption ? "" : caption))} className="min-w-0 flex-1 text-left" aria-expanded={capOpen === caption} aria-live="polite">
              <span className="flex items-center gap-2">
                <span className="kicker text-gold-text">Savvy</span>
                {(status === "thinking" || status === "hearing") && (
                  <span className="flex gap-1" aria-label="Savvy is thinking">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="dot size-2 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </span>
              <span className={`text-[1rem] leading-snug ${capOpen === caption ? "block" : chatting ? "line-clamp-2" : "line-clamp-3"}`}>{caption}</span>
            </button>
            {speaking ? (
              <button type="button" onClick={stopTalking} className="btn size-12 shrink-0 border-2 border-gold p-0 text-ink" aria-label="Stop talking">
                <Square className="size-4 fill-current" aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={() => void listen()} disabled={status === "hearing"} className={`btn btn-primary size-12 shrink-0 p-0 ${status === "listening" ? "mic-live" : ""}`} style={{ ["--lv" as string]: micLv }} aria-label={status === "listening" ? "Send what you said" : "Talk to Savvy"}>
                {status === "listening" ? <Send className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
              </button>
            )}
          </div>
        </div>
      </div>

      {recentOpen && <RecentChats chats={recent} onPick={restoreChat} onClose={() => setRecentOpen(false)} onClear={() => (clearChats(), setRecent([]))} />}
    </div>
  );
}

/** An earlier list in the chat, folded: its title, four photos and the names. Tap to unfold. */
function FoldedList({ a, onOpen }: { a: Answer; onOpen: () => void }) {
  const opts = a.stops[0]?.options ?? [];
  return (
    <button type="button" onClick={onOpen} className="rise flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3 text-left shadow-[var(--shadow)] transition-colors hover:border-gold" aria-label={`Show ${a.title || "this list"} again`}>
      <span className="flex shrink-0 -space-x-3" aria-hidden>
        {opts.slice(0, 4).map((o) => (
          <span key={o.id} className="relative size-11 overflow-hidden rounded-full border-2 border-surface bg-sunk">
            <Photo src={photoSrc(o)} className="absolute inset-0 h-full w-full" iconClass="size-4" />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="kicker block text-gold-text">Savvy&apos;s top {opts.length}</span>
        <span className="block truncate font-display text-[1.1rem] font-bold leading-tight">{a.title || "Savvy's picks"}</span>
        <span className="block truncate text-[0.9rem] text-ink-2">{opts.map((o) => o.name).join(", ")}</span>
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-gold text-gold-text" aria-hidden>
        <ChevronRight className="size-5" />
      </span>
    </button>
  );
}

/** Savvy's reply when there's no list (small talk, or he couldn't find a match). */
function SavvyLine({ text }: { text: string }) {
  return (
    <div className="rise flex items-start gap-2.5">
      <Image src="/savvy/avatar.webp" alt="" width={36} height={36} className="size-9 shrink-0 rounded-full border-2 border-gold bg-[#2a211d]" />
      <p className="rounded-2xl rounded-tl-md border-2 border-line bg-surface px-4 py-2.5 leading-snug">{text}</p>
    </div>
  );
}

/** Recent chats: a bottom sheet on phones, a panel over the menu on desktop. Saved only in this browser. */
function RecentChats({ chats, onPick, onClose, onClear }: { chats: Chat[]; onPick: (c: Chat) => void; onClose: () => void; onClear: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 lg:items-start" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recent chats"
        onClick={(e) => e.stopPropagation()}
        className="menu rise max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border-2 border-gold px-5 pt-5 lg:ml-6 lg:mt-24 lg:max-h-[72dvh] lg:w-[29rem] lg:rounded-3xl"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-3">
          <History className="size-6 text-gold-text" aria-hidden />
          <h2 className="flex-1 text-[1.6rem]">Recent chats</h2>
          <button type="button" onClick={onClose} className="btn size-10 shrink-0 border-2 border-gold p-0 text-ink hover:bg-sunk" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-[0.95rem] text-ink-2">Saved only on this device. Tap one to pick up where you left off.</p>
        {chats.length ? (
          <>
            <ul className="mt-3 border-t border-line">
              {chats.map((c) => {
                const n = c.thread.filter((e) => e.a?.stops.length).length;
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => onPick(c)} className="menu-item">
                      <span className="min-w-0 flex-1">
                        <span className="kicker block text-gold-text">
                          {CITIES[c.city]?.name ?? "Somewhere"} · {ago(c.updatedAt)}
                        </span>
                        <span className="block truncate font-display text-[1.15rem] font-semibold leading-snug">{chatTitle(c)}</span>
                        <span className="block text-[0.9rem] text-ink-2">{n === 1 ? "1 list" : `${n} lists`}</span>
                      </span>
                      <span className="chev" aria-hidden>
                        <ChevronRight className="size-5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={onClear} className="btn mt-4 border-2 border-gold py-1.5 text-ink hover:bg-sunk">
              <Trash2 className="size-4" aria-hidden /> Clear history
            </button>
          </>
        ) : (
          <p className="mt-4 border-t border-line pt-4">No chats yet. Ask Savvy for something tasty and it shows up here.</p>
        )}
      </div>
    </div>
  );
}

/** Logo draw-in: the gold rings draw themselves, Savvy pops through, the wordmark settles. Plays once per load. */
function Intro() {
  return (
    <div className="intro-out menu fixed inset-0 z-50 grid place-items-center" aria-hidden>
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-60">
          <svg viewBox="0 0 220 220" className="absolute inset-0 size-full">
            <circle className="ring-draw" cx="110" cy="110" r="104" fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" transform="rotate(-90 110 110)" />
            <circle className="ring-draw" style={{ animationDelay: "0.25s" }} cx="110" cy="110" r="96" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" transform="rotate(90 110 110)" />
          </svg>
          <div className="peek absolute inset-6 overflow-hidden rounded-full bg-[#2a211d]">
            <Image src="/savvy/avatar.webp" alt="" width={320} height={320} priority className="size-full object-cover" />
          </div>
        </div>
        <p className="rise font-display text-[2.8rem] font-extrabold" style={{ animationDelay: "1.2s" }}>
          {NAME}
        </p>
        <p className="rise text-gold-text" style={{ animationDelay: "1.45s" }}>
          {TAGLINE}
        </p>
      </div>
    </div>
  );
}
