"use client";

// The map, driven by the scene script: a styled 2D Google map (the cheapest
// Maps SKU, 10k free loads a month). The 3D flight was removed on
// 2026-11-06 (William: unnecessary). The parent calls fly() / setStops()
// through the ref; the map never decides anything itself.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Shot } from "@/lib/guide/geo";

/** A place on the map: a stop's pick, one of the active stop's other options, or a city on the landing page. */
export type Pin = { name: string; lat: number; lng: number; label: string; icon?: string };

export type MapHandle = {
  fly: (shot: Shot) => Promise<void>;
  /** Pins in order (clickable), the active one, and smaller secondary pins (the active stop's other options). */
  setStops: (stops: Pin[], active: number | null, alts?: Pin[]) => void;
};

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as unknown as { google?: { maps?: { importLibrary?: unknown } } }).google?.maps?.importLibrary) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const cb = "__slmMapsReady";
    (window as unknown as Record<string, () => void>)[cb] = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("maps script failed"));
    document.head.appendChild(s);
  });
  return loader;
}

/** Parchment: cream land, soft water, ink labels, no business icons competing with our pins. */
const PARCHMENT: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f3ece2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3a2e29" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#faf6f1" }, { weight: 3 }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dfe3cf" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fbf3e6" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ecd9bd" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d6bd97" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c6d5d6" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b6064" }] },
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#6b1d2a" }] },
];

/** Burgundy medallions in tour order; the stop Savvy is on turns gold. */
const PIN = { base: "#6B1D2A", active: "#A87632" };

/** Custom pin: a gold-ringed medallion (a number, or a city badge image) and its name. */
function pinEl(s: Pin, big: boolean, alt = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `slm-pin${big ? " slm-pin-big" : ""}${alt ? " slm-pin-alt" : ""}${s.icon ? " slm-pin-city" : ""}`;
  el.setAttribute("aria-label", `${s.name} on the map`);
  const medal = document.createElement("span");
  medal.className = "slm-medal";
  if (s.icon) {
    const img = document.createElement("img");
    img.src = s.icon;
    img.alt = "";
    medal.append(img);
  } else {
    medal.style.background = big ? PIN.active : PIN.base;
    medal.textContent = s.label;
  }
  const name = document.createElement("span");
  name.className = "slm-name";
  name.textContent = s.name;
  el.append(medal, name);
  return el;
}

/** Zoom that frames a shot's range (metres across the view) at its latitude. */
function zoomFor(range: number, lat: number, px: number) {
  const metersPerPx = range / Math.max(320, px);
  return Math.max(3, Math.min(19, Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPx)));
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Props = { className?: string; initial: { lat: number; lng: number; range?: number }; onPick?: (index: number) => void };

export const MapView = forwardRef<MapHandle, Props>(function MapView({ className = "", initial, onPick }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{ remove: () => void }[]>([]);
  const anim = useRef(0);
  const last = useRef<{ stops: Pin[]; active: number | null; alts: Pin[] }>({ stops: [], active: null, alts: [] });
  const onPickRef = useRef(onPick);
  const [state, setState] = useState<"loading" | "ready" | "off">(KEY ? "loading" : "off");

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const drawStops = useCallback((stops: Pin[], active: number | null, alts: Pin[] = []) => {
    overlays.current.forEach((o) => o.remove());
    overlays.current = [];
    const g = map.current;
    if (!g) return;
    if (stops.length > 1 && !stops[0].icon) {
      const route = new google.maps.Polyline({ map: g, path: stops.map((s) => ({ lat: s.lat, lng: s.lng })), strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#6B1D2A", strokeWeight: 4, scale: 3 }, offset: "0", repeat: "16px" }] });
      overlays.current.push({ remove: () => route.setMap(null) });
    }
    const items = [...alts.map((s) => ({ s, big: false, alt: true, i: -1 })), ...stops.map((s, i) => ({ s, big: i === active, alt: false, i }))];
    for (const { s, big, alt, i } of items) {
      const el = pinEl(s, big, alt);
      if (i >= 0) el.addEventListener("click", () => onPickRef.current?.(i));
      class Marker extends google.maps.OverlayView {
        onAdd() {
          this.getPanes()!.overlayMouseTarget.appendChild(el);
        }
        draw() {
          const p = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(s.lat, s.lng));
          if (p) {
            el.style.left = `${p.x}px`;
            el.style.top = `${p.y}px`;
          }
        }
        onRemove() {
          el.remove();
        }
      }
      const o = new Marker();
      o.setMap(g);
      overlays.current.push({ remove: () => o.setMap(null) });
    }
  }, []);

  useEffect(() => {
    if (!KEY || !host.current) return;
    let dead = false;
    const el = host.current;
    (async () => {
      try {
        await loadMaps();
        const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        if (dead) return;
        map.current = new Map(el, { center: { lat: initial.lat, lng: initial.lng }, zoom: zoomFor(initial.range ?? 9000, initial.lat, el.clientWidth), styles: PARCHMENT, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false, backgroundColor: "#f3ece2" });
        setState("ready");
        drawStops(last.current.stops, last.current.active, last.current.alts);
      } catch (e) {
        console.warn("map failed", e);
        if (!dead) setState("off");
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(anim.current);
      overlays.current.forEach((o) => o.remove());
      overlays.current = [];
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
      el.replaceChildren();
    };
    // initial only seeds the first camera; later moves go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawStops]);

  useImperativeHandle(
    ref,
    () => ({
      fly(shot) {
        return new Promise<void>((resolve) => {
          const g = map.current;
          if (!g || !host.current) return resolve();
          // A smooth "flight": ease center and zoom together, pulling back a
          // little mid-way on long hops, like a camera lifting off.
          cancelAnimationFrame(anim.current);
          const c0 = g.getCenter()!;
          const z0 = g.getZoom() ?? 12;
          const z1 = zoomFor(shot.range * 1.6, shot.lat, host.current.clientWidth);
          const dist = Math.hypot(shot.lat - c0.lat(), shot.lng - c0.lng());
          const dip = Math.min(2.5, dist * 40);
          const ms = Math.min(2600, Math.max(900, shot.durationMs * 0.55));
          const t0 = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - t0) / ms);
            const k = ease(t);
            g.moveCamera({ center: { lat: c0.lat() + (shot.lat - c0.lat()) * k, lng: c0.lng() + (shot.lng - c0.lng()) * k }, zoom: z0 + (z1 - z0) * k - dip * Math.sin(Math.PI * t) });
            if (t < 1) anim.current = requestAnimationFrame(step);
            else resolve();
          };
          anim.current = requestAnimationFrame(step);
        });
      },
      setStops(stops, active, alts = []) {
        last.current = { stops, active, alts };
        drawStops(stops, active, alts);
      },
    }),
    [drawStops],
  );

  return (
    <div className={`overflow-hidden bg-[#f3ece2] ${className || "relative"}`}>
      <div ref={host} className="absolute inset-0" />
      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="kicker text-ink-2">Unfolding the map</p>
        </div>
      )}
      {state === "off" && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="font-bold">The map could not load here. Savvy can still plan your evening; open any stop in Google Maps from its card.</p>
        </div>
      )}
    </div>
  );
});
