"use client";

// Savvy's cartoon rig (adapted from HiBenny's Benny). Three layers: a looping
// mood motion per pose (CSS), a per-frame voice bob / tilt driven by his real
// voice loudness, and a springy "pop" on each pose change. In the talk pose
// quiet moments show the mouth-closed frame (lip flap), and he blinks.
import { useEffect, useRef } from "react";
import Image from "next/image";
import { audio } from "@/lib/audio/engine";
import type { Pose } from "@/lib/guide/scene";

export const FRAMES = ["wave", "wave2", "listen", "talk", "think", "point", "wow", "cheer", "taste", "laugh", "clap", "dance", "dance2", "look", "talk2", "talk-blink", "listen-blink"];

const MOOD: Record<Pose, string> = { wave: "m-wave", listen: "m-listen", think: "m-think", cheer: "m-cheer", talk: "breathe", point: "m-nod", wow: "m-nod", taste: "m-nod", laugh: "m-wave", clap: "m-nod", dance: "m-cheer", look: "m-listen" };

/** Two-frame cycles that make a gesture read as motion (HiBenny-style frame swaps). */
const CYCLE: Partial<Record<Pose, { frame: string; ms: number }>> = { wave: { frame: "wave2", ms: 260 }, dance: { frame: "dance2", ms: 300 } };

const LABEL: Record<Pose, string> = { wave: "waving hello", listen: "listening", talk: "talking", think: "looking things up", point: "pointing at the map", wow: "amazed", cheer: "cheering", taste: "tasting something delicious", laugh: "giggling", clap: "clapping", dance: "doing a happy dance", look: "scouting through his binoculars" };

export function Savvy({ pose, speaking, className = "", onPoke }: { pose: Pose; speaking: boolean; className?: string; onPoke?: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLImageElement>(null);
  const blinkRef = useRef<HTMLImageElement>(null);
  const cycleRef = useRef<HTMLImageElement>(null); // second frame of a wave / dance cycle
  const poseRef = useRef<Pose>(pose);
  const voiceLv = useRef(0);
  const pokeAt = useRef(-9);
  const blink = useRef({ at: -9, next: 2 });

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const raw = audio?.level() ?? 0;
      voiceLv.current += (raw - voiceLv.current) * (raw > voiceLv.current ? 0.55 : 0.18);
      const lv = voiceLv.current;
      const t = performance.now() / 1000;
      const poke = Math.max(0, 1 - (t - pokeAt.current) / 0.8);
      const tilt = Math.sin(t * 5.2) * lv * 5 + Math.sin(t * 34) * 7 * poke;
      const hop = lv * 14 + Math.abs(Math.sin(t * 18)) * 14 * poke;
      if (bodyRef.current) bodyRef.current.style.transform = `translateY(${-hop}px) rotate(${tilt}deg) scale(${1 - lv * 0.02 + poke * 0.04}, ${1 + lv * 0.06 - poke * 0.05})`;
      const p = poseRef.current;
      if (mouthRef.current) mouthRef.current.style.opacity = p === "talk" && raw < 0.08 ? "1" : "0";
      const b = blink.current;
      if (t > b.next) {
        b.at = t;
        b.next = t + (Math.random() < 0.2 ? 0.3 : 2 + Math.random() * 3);
      }
      if (blinkRef.current) blinkRef.current.style.opacity = (p === "listen" || p === "talk") && t - b.at < 0.13 ? "1" : "0";
      const c = CYCLE[p];
      if (cycleRef.current && c) cycleRef.current.style.opacity = Math.floor((t * 1000) / c.ms) % 2 ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const mood = speaking && pose === "talk" ? "" : MOOD[pose];
  return (
    <div className={mood} style={{ transformOrigin: "50% 100%" }}>
      <div
        ref={bodyRef}
        className="will-change-transform cursor-pointer"
        style={{ transformOrigin: "50% 100%" }}
        onPointerDown={() => {
          pokeAt.current = performance.now() / 1000;
          audio?.giggle();
          onPoke?.();
        }}
        role="img"
        aria-label={`Savvy the raccoon guide is ${LABEL[pose]}`}
      >
        <div key={pose} className="pop relative">
          <Image src={`/savvy/${pose}.webp`} alt="" width={640} height={640} loading="eager" className={`pointer-events-none select-none drop-shadow-[0_18px_20px_rgba(0,0,0,0.35)] ${className}`} />
          {pose === "talk" && <Image ref={mouthRef} src="/savvy/talk2.webp" alt="" width={640} height={640} className="pointer-events-none select-none absolute inset-0 h-full w-full opacity-0" />}
          {CYCLE[pose] && <Image ref={cycleRef} src={`/savvy/${CYCLE[pose]!.frame}.webp`} alt="" width={640} height={640} className="pointer-events-none select-none absolute inset-0 h-full w-full opacity-0" />}
          {(pose === "talk" || pose === "listen") && <Image ref={blinkRef} src={`/savvy/${pose}-blink.webp`} alt="" width={640} height={640} className="pointer-events-none select-none absolute inset-0 h-full w-full opacity-0" />}
        </div>
      </div>
      {/* Preload every frame so pose swaps never flash. */}
      <div className="hidden" aria-hidden>
        {FRAMES.map((f) => (
          <Image key={f} src={`/savvy/${f}.webp`} alt="" width={640} height={640} />
        ))}
      </div>
    </div>
  );
}
