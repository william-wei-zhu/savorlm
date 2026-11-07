"use client";

import { MapPin, Phone, CalendarCheck, Star, ShieldCheck, Heart, ChevronRight, Check } from "lucide-react";
import { photoSrc, type Option, type StopCard as Stop } from "@/lib/guide/scene";
import { Photo } from "./photo";

function reserveUrl(o: Option) {
  return o.website || `https://www.google.com/search?q=${encodeURIComponent(`${o.name} ${o.address} reservations`)}`;
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

/** The short facts for a pick ("Named by 7 guides · Open now · 4.5 Yelp"): never clamped. */
export function factsOf(x: Option): string {
  return [x.mentions >= 2 ? `Named by ${x.mentions} guides` : "", x.openNow === "open" ? "Open now" : x.openNow === "closed" ? "Closed now" : "", x.rating].filter(Boolean).join(" · ");
}

function Status({ o }: { o: Option }) {
  if (o.openNow === "open") return <span className="font-extrabold text-open">Open now</span>;
  if (o.openNow === "closed") return <span className="font-extrabold text-closed">Closed right now</span>;
  return null;
}

/**
 * One stop: Savvy's top pick in full (photo, facts, actions), then the other
 * top options as rows. Tapping a row makes it the pick and flies the map there.
 */
export function StopTicket({ stop, chosen, active, onSelect, onChoose }: { stop: Stop; chosen: number; active: boolean; onSelect: () => void; onChoose: (j: number) => void }) {
  const o = stop.options[chosen] ?? stop.options[0];
  // All four options as a fixed list (William: the list must never reshuffle when one is tapped).
  const rows = stop.options.map((x, j) => ({ x, j }));
  return (
    <article className={`ticket rise overflow-hidden transition-[outline] ${active ? "outline-2 outline-offset-2 outline-gold" : ""}`}>
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`Show ${o.name} on the map`}>
        <div className="relative h-44 bg-sunk">
          <Photo src={photoSrc(o)} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b] via-[#120d0b]/45 to-transparent" />
          <span className="kicker absolute left-3 top-3 max-w-[calc(100%-8.5rem)] rounded-full border border-[#c9a063] bg-[#120d0b] px-3 py-1 leading-snug text-[#f3d9ad]">{stop.role}</span>
          <span className="kicker absolute right-3 top-3 whitespace-nowrap rounded-full bg-[#f0c98e] px-3 py-1 text-[#1a1210]">{chosen === 0 ? "Top pick" : `Pick ${chosen + 1}`}</span>
          <div className="absolute inset-x-4 bottom-3">
            <h3 className="text-[1.6rem] text-[#faf6f1] drop-shadow">{o.name}</h3>
            {o.mentions >= 2 ? (
              <p className="flex items-start gap-1.5 font-bold leading-snug text-[#f3d9ad]">
                <Heart className="mt-[0.2em] size-4 shrink-0 fill-current" aria-hidden /> Local favorite · named by {o.mentions} guides
              </p>
            ) : o.cuisine ? (
              <p className="font-bold text-[#f3d9ad]">{o.cuisine}</p>
            ) : null}
          </div>
        </div>
      </button>
      <div className="space-y-2 px-4 pb-3 pt-3">
        {o.why && <p>{o.why}</p>}
        <p className="text-ink-2">{[o.mentions >= 2 ? o.cuisine : "", o.price, o.address.split(",")[0]].filter(Boolean).join(" · ")}</p>
        {(o.openNow !== "unknown" || o.hours || o.rating) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Status o={o} />
            {o.hours && <span className="text-ink-2">Today {o.hours}</span>}
            {o.rating && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <Star className="size-4" aria-hidden /> {o.rating}
              </span>
            )}
          </p>
        )}
        {o.badges.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Checked by TypeSafe Jev">
            {o.badges.map((b) => (
              <li key={b.id} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-0.5 text-[0.9rem] font-bold" title="Checked by TypeSafe Jev against the sources below">
                <ShieldCheck className="size-4" aria-hidden />
                {b.label} · {Math.round(b.p * 100)}%
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <a className="btn btn-primary" href={reserveUrl(o)} target="_blank" rel="noopener noreferrer">
          <CalendarCheck className="size-4" aria-hidden /> Reserve
        </a>
        <a className="btn border-2 border-gold text-ink hover:bg-sunk" href={o.mapsUrl} target="_blank" rel="noopener noreferrer">
          <MapPin className="size-4" aria-hidden /> Directions
        </a>
        {o.phone && (
          <a className="btn border-2 border-gold text-ink hover:bg-sunk" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>
            <Phone className="size-4" aria-hidden /> Call
          </a>
        )}
      </div>
      {o.sources.length > 0 && (
        <p className="px-4 pb-3 text-[0.9rem] text-ink-2">
          Sources:{" "}
          {o.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {hostOf(s.url)}
              </a>
            </span>
          ))}
        </p>
      )}
      {rows.length > 1 && (
        <>
          <div className="perf mx-4" />
          <div className="px-4 pb-3 pt-3">
            <p className="kicker text-gold-text">All 4 picks · tap to hear about one</p>
            <ul className="mt-1 space-y-1">
              {rows.map(({ x, j }) => (
                <li key={x.id}>
                  <button type="button" onClick={() => onChoose(j)} aria-current={j === chosen} className={`flex w-full items-center gap-3 rounded-xl border-2 px-2 py-2 text-left transition ${j === chosen ? "border-gold bg-[rgba(201,160,99,0.14)]" : "border-transparent hover:bg-[rgba(201,160,99,0.08)]"}`} aria-label={`Show ${x.name}`}>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl border-2 border-gold bg-sunk">
                      <Photo src={photoSrc(x)} className="absolute inset-0 h-full w-full" iconClass="size-5" />
                      <span className="absolute bottom-0.5 left-0.5 grid size-6 place-items-center rounded-full bg-[#120d0b] text-[0.8rem] font-extrabold text-[#f3d9ad]">{j + 1}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.1rem] font-bold leading-tight">{x.name}</span>
                      {factsOf(x) && <span className="mt-0.5 block text-[0.92rem] leading-snug text-ink-2">{factsOf(x)}</span>}
                      {/* The why is in the big ticket once tapped; phones skip it here to stay calm. */}
                      {x.why && <span className="mt-0.5 hidden text-[0.92rem] leading-snug text-ink-2 lg:block">{x.why}</span>}
                    </span>
                    {j === chosen ? (
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f0c98e] text-[#1a1210]" aria-label="Showing">
                        <Check className="size-4" strokeWidth={3} aria-hidden />
                      </span>
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-gold-text" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </article>
  );
}
