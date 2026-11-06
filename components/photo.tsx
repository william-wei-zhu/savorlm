"use client";

// A restaurant photo from /api/photo with honest states: a gold shimmer while
// it loads, one retry on failure (a daily cap or a slow Google call is not
// cached, so the second try can succeed), and a clean placeholder if it still
// fails or takes longer than 9 s. Never a blank or half-stuck image.
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

type State = "loading" | "ok" | "fail";

export function Photo({ src, className = "", iconClass = "size-10" }: { src: string; className?: string; iconClass?: string }) {
  const [state, setState] = useState<State>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A new photo (another pick) starts over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    setAttempt(0);
  }, [src]);

  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("fail"), 9000);
    return () => clearTimeout(t);
  }, [state, attempt, src]);

  const url = attempt ? `${src}&retry=${attempt}` : src;
  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#3a2a22,#1a1210)] ${className}`}>
      {state !== "fail" && (
        // Google-hosted photo via our redirect; nothing is stored.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition-opacity duration-300 ${state === "ok" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setState("ok")}
          onError={() => {
            if (attempt === 0) setTimeout(() => setAttempt(1), 1200);
            else setState("fail");
          }}
        />
      )}
      {state === "loading" && <div className="shimmer absolute inset-0" aria-hidden />}
      {state === "fail" && (
        <div className="absolute inset-0 grid place-items-center">
          <MapPin className={`${iconClass} text-gold-text`} aria-hidden />
        </div>
      )}
    </div>
  );
}
