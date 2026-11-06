"use client";

import { useState } from "react";
import { Footprints, CarTaxiFront, MapPin, Phone, CalendarCheck, Star, ShieldCheck } from "lucide-react";
import type { StopCard as Stop } from "@/lib/guide/scene";
import { DISTINCTION_LABEL } from "@/lib/michelin/types";

const STARS: Record<string, string> = { "3star": "★★★", "2star": "★★", "1star": "★" };

export function Hop({ hop }: { hop: NonNullable<Stop["hop"]> }) {
  const Icon = hop.mode === "walk" ? Footprints : CarTaxiFront;
  return (
    <div className="flex items-center justify-center gap-2 py-1 text-ink-2">
      <Icon className="size-5" strokeWidth={2} aria-hidden />
      <span className="font-bold">
        {hop.minutes} min {hop.mode === "walk" ? "walk" : "ride"}
      </span>
    </div>
  );
}

function reserveUrl(s: Stop) {
  return s.website || `https://www.google.com/search?q=${encodeURIComponent(`${s.name} ${s.address} reservations`)}`;
}

export function StopTicket({ stop, active, onSelect }: { stop: Stop; active: boolean; onSelect: () => void }) {
  const [photoOk, setPhotoOk] = useState(true);
  const status = stop.openNow === "open" ? { text: "Open now", cls: "text-open" } : stop.openNow === "closed" ? { text: "Closed right now", cls: "text-closed" } : null;
  return (
    <article className={`ticket rise overflow-hidden transition-[outline] ${active ? "outline-2 outline-offset-2 outline-gold" : ""}`}>
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`Show ${stop.name} on the map`}>
        <div className="relative h-44 bg-sunk">
          {stop.placeId && photoOk ? (
            // Google-hosted photo via our redirect; nothing is stored.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/photo?pid=${encodeURIComponent(stop.placeId)}`} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setPhotoOk(false)} />
          ) : (
            <div className="grid h-full place-items-center">
              <MapPin className="size-10 text-gold-text" aria-hidden />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b] via-[#120d0b]/45 to-transparent" />
          <span className="kicker absolute left-3 top-3 rounded-full border border-[#c9a063] bg-[#120d0b] px-3 py-1 text-[#f3d9ad]">{stop.role}</span>
          <div className="absolute inset-x-4 bottom-3">
            <h3 className="text-[1.6rem] text-[#faf6f1] drop-shadow">{stop.name}</h3>
            {stop.distinction ? (
              <p className="font-bold text-[#f3d9ad]">
                {STARS[stop.distinction] ? <span aria-hidden>{STARS[stop.distinction]} </span> : null}
                {DISTINCTION_LABEL[stop.distinction]}
              </p>
            ) : (
              <p className="font-bold text-[#f3d9ad]">Savvy&apos;s local pick</p>
            )}
          </div>
        </div>
        <div className="px-4 pt-3">
          <p className="text-ink-2">{[stop.cuisine, stop.price].filter(Boolean).join(" · ") || stop.address}</p>
        </div>
      </button>
      <div className="space-y-2 px-4 pb-3 pt-2">
        {(status || stop.hours || stop.rating) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {status && <span className={`font-extrabold ${status.cls}`}>{status.text}</span>}
            {stop.hours && <span className="text-ink-2">Today {stop.hours}</span>}
            {stop.rating && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <Star className="size-4" aria-hidden /> {stop.rating}
              </span>
            )}
          </p>
        )}
        {stop.badges.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Checked by TypeSafe Jev">
            {stop.badges.map((b) => (
              <li key={b.id} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-0.5 text-[0.9rem] font-bold" title="Checked by TypeSafe Jev against the sources below">
                <ShieldCheck className="size-4" aria-hidden />
                {b.label} · {Math.round(b.p * 100)}%
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="perf mx-4" />
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <a className="btn btn-primary" href={reserveUrl(stop)} target="_blank" rel="noopener noreferrer">
          <CalendarCheck className="size-4" aria-hidden /> Reserve
        </a>
        <a className="btn btn-outline" href={stop.mapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin className="size-4" aria-hidden /> Directions
        </a>
        {stop.phone && (
          <a className="btn btn-outline" href={`tel:${stop.phone.replace(/[^\d+]/g, "")}`}>
            <Phone className="size-4" aria-hidden /> Call
          </a>
        )}
      </div>
      {stop.sources.length > 0 && (
        <p className="px-4 pb-4 text-[0.9rem] text-ink-2">
          Sources:{" "}
          {stop.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {hostOf(s.url)}
              </a>
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
