"use client";

// The SavorLM experience: Savvy stands on the map, the conversation and the
// tour tickets live in the side panel (a printed evening menu). A small
// "director" plays the scene script from /api/guide in order: Savvy speaks
// while the camera moves, each stop lands as a pin and a ticket.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Mic, Send, Volume2, VolumeX, RotateCcw, Settings } from "lucide-react";
import { MapView, type MapHandle } from "./map-view";
import { Savvy } from "./savvy";
import { Hop, StopTicket } from "./stop-card";
import { audio } from "@/lib/audio/engine";
import { Mic as MicRecorder, blobToBase64 } from "@/lib/audio/recorder";
import { sseParser, type Pose, type SceneEvent, type StopCard } from "@/lib/guide/scene";
import { CITIES, CITY_IDS, type CityId } from "@/lib/michelin/types";
import { NAME, TAGLINE } from "@/lib/brand";
import { cityShot } from "@/lib/guide/geo";

type Turn = { role: "user" | "guide"; text: string };
type Status = "idle" | "thinking" | "touring" | "listening" | "hearing";
type Mood = "warm" | "excited" | "curious" | "cozy";

const PROMPTS: Partial<Record<CityId | "default", string[]>> = {
  default: ["Plan my anniversary night: a starred dinner, then cocktails nearby", "Best Bib Gourmand lunch that's open now", "A whole food day: coffee, lunch, a snack and a starred dinner"],
  sf: ["Plan my anniversary night in North Beach: a starred dinner, then cocktails", "Omakase in San Francisco, then a dessert spot", "A cheerful Bib Gourmand lunch in the Mission"],
  nyc: ["A three-star dinner in Manhattan, then a jazz bar after", "Best Bib Gourmand ramen in New York", "A food day in Brooklyn: bagels, pizza, and a starred dinner"],
  paris: ["A food day in Paris: coffee, a Bib Gourmand lunch, and a starred dinner", "A romantic three-star dinner by the Seine, then a wine bar", "The best croissant in the Marais, then a bistro lunch"],
  london: ["A starred dinner in Mayfair, then a cocktail bar", "Best Bib Gourmand lunch in Soho", "Sunday roast, then a dessert spot"],
  dc: ["A starred dinner in Georgetown, then a rooftop bar", "Best Bib Gourmand brunch in DC", "A business dinner near the White House"],
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
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "America/Los_Angeles") return "sf";
    return CITY_IDS.find((c) => CITIES[c].tz === tz) ?? "nyc";
  } catch {
    return "nyc";
  }
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const center = (c: CityId) => ({ lat: CITIES[c].center.latitude, lng: CITIES[c].center.longitude });

export function GuideApp() {
  const map = useRef<MapHandle>(null);
  const [city, setCity] = useState<CityId>("sf");
  const [pose, setPose] = useState<Pose>("wave");
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("Hi, I'm Savvy! Tell me what you're craving and I'll plan the whole evening.");
  const [status, setStatus] = useState<Status>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stops, setStops] = useState<StopCard[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState(true);
  const [micLv, setMicLv] = useState(0);
  const [intro, setIntro] = useState(true);
  const mic = useRef<MicRecorder | null>(null);
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const stopsRef = useRef<StopCard[]>([]);
  const voiceRef = useRef(true);
  const unlocked = useRef(false);
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const v = voicePref();
    // Restore per-viewer prefs once on mount (client-only values).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoice(v);
    voiceRef.current = v;
    setCity(guessCity());
    const t = setTimeout(() => setIntro(false), 2900);
    // After the hello wave, Savvy settles into listening.
    const w = setTimeout(() => setPose((p) => (p === "wave" ? "listen" : p)), 5200);
    return () => {
      clearTimeout(t);
      clearTimeout(w);
    };
  }, []);

  useEffect(() => {
    map.current?.fly(cityShot(center(city)));
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
      if (!voiceRef.current || !audio) {
        await new Promise((r) => setTimeout(r, Math.max(1800, words(text) * 300)));
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

  const focusStop = useCallback((i: number) => {
    const s = stopsRef.current[i];
    if (!s) return;
    setActive(i);
    map.current?.setStops(stopsRef.current, i);
    map.current?.fly({ lat: s.lat, lng: s.lng, altitude: 0, range: 750, tilt: 58, heading: 30, durationMs: 2200 }).then(() => map.current?.orbit(s));
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message) return;
      await unlock();
      audio?.stopVoice();
      abort.current?.abort();
      const id = ++run.current;
      const ac = new AbortController();
      abort.current = ac;
      setInput("");
      setStatus("thinking");
      setTitle("");
      setStops([]);
      stopsRef.current = [];
      setActive(null);
      map.current?.setStops([], null);
      gesture("think", "think");
      setCaption("Ooh, let me sniff around...");
      const history = turns.slice(-6);
      setTurns((t) => [...t, { role: "user", text: message }]);

      // The director: events are queued as they stream and played in order.
      const queue: SceneEvent[] = [];
      const sig: { done: boolean; wake: (() => void) | null } = { done: false, wake: null };
      const push = (e: SceneEvent) => {
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
          const res = await fetch("/api/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, city, history }), signal: ac.signal });
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
        }
      })();

      let speech: Promise<void> = Promise.resolve();
      const picked: string[] = [];
      let lastLine = "";
      for (;;) {
        const e = await next();
        if (!e || id !== run.current) break;
        if (e.t === "say") {
          setStatus("touring");
          lastLine = e.text;
          speech = say(e.text, e.pose === "think" ? "wow" : e.pose, id, "excited").then(() => {
            if (id === run.current) gesture("look", "look");
          });
        } else if (e.t === "fly") {
          await map.current?.fly(e.shot);
        } else if (e.t === "stop") {
          await speech;
          if (id !== run.current) break;
          stopsRef.current = [...stopsRef.current, e.stop];
          setStops(stopsRef.current);
          setActive(e.stop.index);
          map.current?.setStops(stopsRef.current, e.stop.index);
          gesture("look", "look");
          await map.current?.fly(e.shot);
          audio?.chime();
          map.current?.orbit(e.stop);
          picked.push(`${e.stop.name} (${e.stop.role})`);
          speech = say(e.stop.line, e.stop.distinction ? "wow" : "point", id, "warm").then(() => {
            if (id === run.current) gesture("think", "think");
          });
        } else if (e.t === "done") {
          await speech;
          if (e.title) setTitle(e.title);
          if (e.text) await say(e.text, "dance", id, "cozy");
          if (id === run.current && picked.length) gesture("cheer", "listen", 1900);
          setTurns((t) => [...t, { role: "guide", text: picked.length ? `I picked ${picked.join(", then ")}.` : lastLine }]);
        } else if (e.t === "error") {
          await speech;
          await say(e.text, "listen", id, "warm");
        }
      }
      if (id === run.current) {
        setStatus("idle");
        setPose((p) => (p === "talk" || p === "think" || p === "look" ? "listen" : p));
      }
    },
    [city, turns, say, unlock, gesture],
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
      void send(j.text);
    } catch {
      setStatus("idle");
      setPose("listen");
      setCaption("I couldn't make that out. Try again, or type it below.");
    }
  }, [send, status, unlock, gesture]);

  const toggleVoice = () => {
    const v = !voice;
    setVoice(v);
    voiceRef.current = v;
    if (!v) audio?.stopVoice();
    try {
      localStorage.setItem("slm_voice", v ? "1" : "0");
    } catch {}
  };

  const reset = () => {
    abort.current?.abort();
    run.current++;
    audio?.stopVoice();
    setTurns([]);
    setStops([]);
    stopsRef.current = [];
    setTitle("");
    setActive(null);
    setStatus("idle");
    setSpeaking(false);
    gesture("wave", "listen", 2400);
    setCaption("Fresh page. Where are we eating?");
    map.current?.setStops([], null);
    map.current?.fly(cityShot(center(city)));
  };

  const busy = status === "thinking" || status === "touring" || status === "hearing";
  const prompts = PROMPTS[city] ?? PROMPTS.default!;
  const lastUser = [...turns].reverse().find((t) => t.role === "user");

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:h-dvh lg:grid-cols-[minmax(25rem,32rem)_minmax(0,1fr)]">
      {intro && <Intro />}

      {/* The map with Savvy standing on it. */}
      <section className="relative order-1 h-[52dvh] lg:order-2 lg:h-auto" aria-label="Map">
        <MapView ref={map} className="absolute inset-0" initial={center(city)} onPick={focusStop} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-1 p-2 pb-4 sm:gap-3 sm:p-6">
          <div className="savvy-stage pointer-events-auto w-40 shrink-0 sm:w-60 lg:w-72">
            <Savvy pose={pose} speaking={speaking} className="h-auto w-full" onPoke={() => !speaking && gesture("laugh", "listen", 1300)} />
          </div>
          <div className="bubble pointer-events-auto mb-10 max-w-[34rem] px-4 pb-3 pt-4 sm:mb-16 sm:px-5 sm:pb-4 sm:pt-5" aria-live="polite">
            <span className="kicker name-tag">Savvy</span>
            <p className="text-[1.02rem] leading-snug sm:text-[1.2rem]">{caption}</p>
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

      {/* The panel: a printed evening menu. */}
      <section className="menu order-2 flex min-h-0 flex-col lg:order-1">
        <header className="flex items-center gap-3 px-6 pb-3 pt-6">
          <div className="rounded-full border-2 border-gold p-1">
            <Image src="/savvy/avatar.webp" alt="" width={64} height={64} className="size-14 rounded-full bg-[#2a211d]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] font-extrabold leading-none tracking-tight">{NAME}</h1>
            <p className="mt-1.5 text-[0.95rem] leading-snug text-gold-text [text-wrap:balance]">{TAGLINE}</p>
          </div>
          <button type="button" onClick={toggleVoice} className="btn size-11 border-2 border-gold p-0 text-ink hover:bg-sunk" aria-label={voice ? "Mute Savvy" : "Unmute Savvy"} title={voice ? "Mute Savvy" : "Unmute Savvy"}>
            {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          <Link href="/settings" className="btn size-11 border-2 border-gold p-0 text-ink hover:bg-sunk" aria-label="Settings" title="Settings">
            <Settings className="size-5" />
          </Link>
        </header>

        <div className="px-6">
          <div className="ornament text-[0.8rem]" aria-hidden>
            ✦
          </div>
        </div>

        <div className="flex items-end gap-3 px-6 pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="city" className="kicker text-gold-text">
              Tonight in
            </label>
            <div className="relative mt-1">
              <select id="city" value={city} onChange={(e) => setCity(e.target.value as CityId)} className="w-full cursor-pointer appearance-none rounded-xl border-2 border-gold bg-surface py-2 pl-3 pr-10 font-display text-[1.45rem] font-bold text-ink">
                {CITY_IDS.map((c) => (
                  <option key={c} value={c}>
                    {CITIES[c].name}
                  </option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 rotate-90 text-gold-text" aria-hidden />
            </div>
          </div>
          {turns.length > 0 && (
            <button type="button" onClick={reset} className="btn border-2 border-gold py-2.5 text-ink hover:bg-sunk">
              <RotateCcw className="size-4" aria-hidden /> New plan
            </button>
          )}
        </div>

        {/* The ask: the first thing in the menu, by voice or by typing. */}
        <form
          className="mx-6 mt-3 rounded-2xl border-2 border-gold bg-surface p-3 shadow-[var(--shadow)]"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="ask" className="kicker block px-1 text-gold-text">
            What are you craving?
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="ask"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? "Savvy is on it..." : "A starred dinner, then a jazz bar..."}
              maxLength={500}
              className="min-w-0 flex-1 rounded-xl border-2 border-line bg-sunk px-3 py-3 text-[1.05rem] font-bold text-ink placeholder:text-ink-2 focus:border-gold"
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 pt-4">
          {lastUser && (
            <div className="flex justify-end">
              <p className="user-bubble max-w-[88%] px-4 py-2.5">{lastUser.text}</p>
            </div>
          )}
          {title && (
            <div className="rise text-center">
              <p className="kicker text-gold-text">Your evening</p>
              <h2 className="mt-1 text-[1.75rem]">{title}</h2>
            </div>
          )}
          {busy && stops.length < 1 && (
            <div className="ticket shimmer h-56 overflow-hidden" aria-label="Savvy is scouting">
              <div className="h-36 bg-sunk" />
              <p className="kicker px-4 pt-4 text-gold-text">Scouting {CITIES[city].name}</p>
            </div>
          )}
          {stops.map((s, i) => (
            <div key={s.id}>
              {s.hop && i > 0 && <Hop hop={s.hop} />}
              <StopTicket stop={s} active={active === i} onSelect={() => focusStop(i)} />
            </div>
          ))}
          {!turns.length && (
            <div className="pt-1">
              <p className="kicker text-gold-text">Ask Savvy for</p>
              <ul className="mt-1 border-t border-line">
                {prompts.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => send(p)} className="menu-item">
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
