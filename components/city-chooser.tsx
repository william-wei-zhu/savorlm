"use client";

// Landing city chooser (BikeSim-style): the city near you first as a wide
// tile, then every city grouped by region, each with its food badge.
import Image from "next/image";
import { ChevronRight, LocateFixed } from "lucide-react";
import { CITIES, CITY_IDS, REGIONS, cityIcon, type CityId } from "@/lib/cities";

export function CityChooser({ near, onPick }: { near: CityId; onPick: (c: CityId) => void }) {
  return (
    <div className="space-y-5">
      <button type="button" onClick={() => onPick(near)} className="city-tile city-tile-near w-full" aria-label={`Start in ${CITIES[near].name}, near you`}>
        <Image src={cityIcon(near)} alt="" width={128} height={128} className="size-16 shrink-0 drop-shadow-md" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block font-display text-[1.45rem] font-bold leading-tight">{CITIES[near].name}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="kicker text-gold-text">{CITIES[near].state}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f0c98e] px-2.5 py-0.5 text-[0.8rem] font-bold text-[#1a1210]">
              <LocateFixed className="size-3.5" aria-hidden /> Near you
            </span>
          </span>
        </span>
        <ChevronRight className="size-6 shrink-0 text-gold-text" aria-hidden />
      </button>

      {REGIONS.map((r) => (
        <section key={r} aria-label={r}>
          <p className="kicker mb-2 text-gold-text">{r}</p>
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
            {CITY_IDS.filter((c) => CITIES[c].region === r && c !== near).map((c) => (
              <button key={c} type="button" onClick={() => onPick(c)} className="city-tile flex-col gap-1.5 py-3 text-center sm:flex-row sm:gap-3 sm:py-2.5 sm:text-left" aria-label={`Start in ${CITIES[c].name}`}>
                <Image src={cityIcon(c)} alt="" width={96} height={96} className="size-12 shrink-0 drop-shadow sm:size-11" />
                <span className="min-w-0">
                  <span className="block font-display text-[1.05rem] font-bold leading-tight [text-wrap:balance]">{CITIES[c].name}</span>
                  <span className="kicker text-gold-text">{CITIES[c].state}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
