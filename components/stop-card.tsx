"use client";

import { useEffect, useRef } from "react";
import { MapPin, Phone, CalendarCheck, Star, ShieldCheck, Heart, ChevronRight } from "lucide-react";
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
 * The four picks as an accordion (William 2026-11-06): one row is open at a
 * time, with the tall photo and everything about that place; the others are
 * slim rows. Tapping a row opens it in place (and Savvy talks about it); the
 * order never changes. Tapping the open photo shows it on the map.
 */
export function StopTicket({ stop, chosen, active, onSelect, onChoose }: { stop: Stop; chosen: number; active: boolean; onSelect: () => void; onChoose: (j: number) => void }) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const first = useRef(true);
  // Keep the newly opened row in view while the others fold (not on first render).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => rowRefs.current[chosen]?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 320);
    return () => clearTimeout(t);
  }, [chosen]);
  return (
    <article className={`ticket no-notch rise overflow-hidden transition-[outline] ${active ? "outline-2 outline-offset-2 outline-gold" : ""}`}>
      <p className="kicker px-4 pb-1 pt-3 text-gold-text">Savvy&apos;s {stop.options.length} picks · tap one to open it</p>
      <ol>
        {stop.options.map((o, j) => {
          const open = j === chosen;
          return (
            <li key={o.id} ref={(el) => void (rowRefs.current[j] = el)} className={`scroll-mt-24 ${j > 0 ? "border-t border-line" : ""}`}>
              {/* Closed: a slim row. */}
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "0fr" : "1fr" }}>
                <div className="min-h-0 overflow-hidden">
                  <button type="button" onClick={() => onChoose(j)} tabIndex={open ? -1 : 0} aria-expanded={false} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(201,160,99,0.08)]" aria-label={`Open ${o.name}`}>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl border-2 border-gold bg-sunk">
                      <Photo src={photoSrc(o)} className="absolute inset-0 h-full w-full" iconClass="size-5" />
                      <span className="absolute bottom-0.5 left-0.5 grid size-6 place-items-center rounded-full bg-[#120d0b] text-[0.8rem] font-extrabold text-[#f3d9ad]">{j + 1}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.1rem] font-bold leading-tight">{o.name}</span>
                      {factsOf(o) && <span className="mt-0.5 block text-[0.92rem] leading-snug text-ink-2">{factsOf(o)}</span>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 rotate-90 text-gold-text" aria-hidden />
                  </button>
                </div>
              </div>
              {/* Open: the full card. */}
              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                <div className="min-h-0 overflow-hidden" aria-hidden={!open}>
                  {open && <PickDetail o={o} n={j + 1} onSelect={onSelect} />}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/** Everything about one pick: tall photo with its name, why, facts, fit badges, actions, sources. */
function PickDetail({ o, n, onSelect }: { o: Option; n: number; onSelect: () => void }) {
  return (
    <div className="pb-1">
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`Show ${o.name} on the map`}>
        <div className="relative h-60 bg-sunk">
          <Photo src={photoSrc(o)} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b] via-[#120d0b]/45 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 flex items-end gap-3">
            <span className="mb-1 grid size-9 shrink-0 place-items-center rounded-full border-2 border-[#c9a063] bg-[#120d0b] font-extrabold text-[#f3d9ad]">{n}</span>
            <div className="min-w-0">
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
          <MapPin className="size-4" aria-hidden /> Google Maps
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
          {o.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && ", "}
              <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {hostOf(src.url)}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
