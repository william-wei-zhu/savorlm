"use client";

import { useState } from "react";
import { Footprints, CarTaxiFront, MapPin, Phone, CalendarCheck, Star, ShieldCheck, Heart, ChevronRight } from "lucide-react";
import { photoSrc, type Option, type StopCard as Stop } from "@/lib/guide/scene";

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
  const [badPhoto, setBadPhoto] = useState<Record<string, boolean>>({});
  const o = stop.options[chosen] ?? stop.options[0];
  const others = stop.options.map((x, j) => ({ x, j })).filter(({ j }) => j !== chosen);
  return (
    <article className={`ticket rise overflow-hidden transition-[outline] ${active ? "outline-2 outline-offset-2 outline-gold" : ""}`}>
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`Show ${o.name} on the map`}>
        <div className="relative h-44 bg-sunk">
          {!badPhoto[o.id] ? (
            // Google-hosted photo via our redirect (by place id, or looked up
            // by name + address for the other options); nothing is stored.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={o.id} src={photoSrc(o)} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBadPhoto((b) => ({ ...b, [o.id]: true }))} />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#3a2a22,#1a1210)]">
              <MapPin className="size-10 text-gold-text" aria-hidden />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b] via-[#120d0b]/45 to-transparent" />
          <span className="kicker absolute left-3 top-3 rounded-full border border-[#c9a063] bg-[#120d0b] px-3 py-1 text-[#f3d9ad]">{stop.role}</span>
          <span className="kicker absolute right-3 top-3 rounded-full bg-[#f0c98e] px-3 py-1 text-[#1a1210]">{chosen === 0 ? "Savvy's pick" : `Option ${chosen + 1}`}</span>
          <div className="absolute inset-x-4 bottom-3">
            <h3 className="text-[1.6rem] text-[#faf6f1] drop-shadow">{o.name}</h3>
            {o.mentions >= 2 ? (
              <p className="inline-flex items-center gap-1.5 font-bold text-[#f3d9ad]">
                <Heart className="size-4 fill-current" aria-hidden /> Local favorite · named by {o.mentions} guides
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
      {others.length > 0 && (
        <>
          <div className="perf mx-4" />
          <div className="px-4 pb-3 pt-3">
            <p className="kicker text-gold-text">More top picks</p>
            <ul className="mt-1">
              {others.map(({ x, j }) => (
                <li key={x.id} className="border-b border-line last:border-0">
                  <button type="button" onClick={() => onChoose(j)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-[rgba(201,160,99,0.08)]" aria-label={`Make ${x.name} the pick for ${stop.role}`}>
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border-2 border-gold bg-sunk">
                      {!badPhoto[x.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoSrc(x, 160)} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBadPhoto((b) => ({ ...b, [x.id]: true }))} />
                      )}
                      <span className="absolute bottom-0.5 left-0.5 grid size-6 place-items-center rounded-full bg-[#120d0b] text-[0.8rem] font-extrabold text-[#f3d9ad]">{j + 1}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.1rem] font-bold leading-tight">{x.name}</span>
                      <span className="block text-[0.92rem] leading-snug text-ink-2">
                        {[x.mentions >= 2 ? `Named by ${x.mentions} guides` : "", x.openNow === "open" ? "Open now" : x.openNow === "closed" ? "Closed now" : "", x.rating, x.why].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-gold-text" aria-hidden />
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
