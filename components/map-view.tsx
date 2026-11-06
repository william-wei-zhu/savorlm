"use client";

// The map, driven by the scene script. A styled 2D map by default (cheapest
// Google SKU, 10k free loads a month); the photorealistic 3D map loads only
// when someone presses "Fly in 3D" (Immersive Maps SKU, 5k free a month).
// The parent calls fly() / orbit() / setStops() through the ref in both modes.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Box, Map as MapIcon } from "lucide-react";
import type { Shot } from "@/lib/guide/geo";

/** A place on the map: each stop's current pick, or one of the active stop's other options. */
export type Pin = { name: string; lat: number; lng: number; label: string };

export type MapHandle = {
  fly: (shot: Shot) => Promise<void>;
  orbit: (stop: { lat: number; lng: number }) => void;
  /** Stops in tour order (one pin each), the active one, and the active stop's other options. */
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

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
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

/** Custom pin for the 2D map: a gold-ringed medallion with the stop's mark, and its name. */
function pinEl(s: Pin, big: boolean, alt = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `slm-pin${big ? " slm-pin-big" : ""}${alt ? " slm-pin-alt" : ""}`;
  el.setAttribute("aria-label", `${s.name} on the map`);
  const medal = document.createElement("span");
  medal.className = "slm-medal";
  medal.style.background = big ? PIN.active : PIN.base;
  medal.textContent = s.label;
  const name = document.createElement("span");
  name.className = "slm-name";
  name.textContent = s.name;
  el.append(medal, name);
  return el;
}

/** 2D zoom that frames a shot's range (metres across the view) at its latitude. */
function zoomFor(range: number, lat: number, px: number) {
  const metersPerPx = range / Math.max(320, px);
  return Math.max(3, Math.min(19, Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPx)));
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Props = { className?: string; initial: { lat: number; lng: number }; onPick?: (index: number) => void };

export const MapView = forwardRef<MapHandle, Props>(function MapView({ className = "", initial, onPick }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const map3d = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const map2d = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{ remove: () => void }[]>([]);
  const anim = useRef(0);
  const last = useRef<{ stops: Pin[]; active: number | null; alts: Pin[]; shot: Shot | null }>({ stops: [], active: null, alts: [], shot: null });
  const onPickRef = useRef(onPick);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [state, setState] = useState<"loading" | "ready" | "off">(KEY ? "loading" : "off");
  const [can3d, setCan3d] = useState(true);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const clearOverlays = () => {
    overlays.current.forEach((o) => o.remove());
    overlays.current = [];
  };

  const drawStops = useCallback(async (stops: Pin[], active: number | null, alts: Pin[] = []) => {
    clearOverlays();
    if (map3d.current) {
      const m3 = (await google.maps.importLibrary("maps3d")) as google.maps.Maps3DLibrary;
      const mk = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;
      stops.forEach((s, i) => {
        const big = i === active;
        const pin = new mk.PinElement({ background: big ? PIN.active : PIN.base, borderColor: "#C5995E", glyphColor: "#FAF6F1", glyphText: s.label, scale: big ? 1.6 : 1.15 });
        // Mesh-relative so pins sit above rooftops; drawn even when a tower hides them.
        const marker = new m3.Marker3DInteractiveElement({ position: { lat: s.lat, lng: s.lng, altitude: big ? 40 : 20 }, altitudeMode: "RELATIVE_TO_MESH", extruded: true, drawsWhenOccluded: true, label: s.name });
        marker.append(pin);
        marker.addEventListener("gmp-click", () => onPickRef.current?.(i));
        map3d.current!.append(marker);
        overlays.current.push(marker);
      });
      alts.forEach((a) => {
        const pin = new mk.PinElement({ background: "#FAF6F1", borderColor: "#6B1D2A", glyphColor: "#6B1D2A", glyphText: a.label, scale: 0.9 });
        const marker = new m3.Marker3DElement({ position: { lat: a.lat, lng: a.lng, altitude: 15 }, altitudeMode: "RELATIVE_TO_MESH", extruded: true, drawsWhenOccluded: true, label: a.name });
        marker.append(pin);
        map3d.current!.append(marker);
        overlays.current.push(marker);
      });
      if (stops.length > 1) {
        const pl = new m3.Polyline3DElement({ path: stops.map((s) => ({ lat: s.lat, lng: s.lng, altitude: 12 })), altitudeMode: "RELATIVE_TO_MESH", strokeColor: "#C5995E", outerColor: "#6B1D2A", strokeWidth: 9, outerWidth: 0.4, drawsOccludedSegments: true });
        map3d.current.append(pl);
        overlays.current.push(pl);
      }
      return;
    }
    const g = map2d.current;
    if (!g) return;
    if (stops.length > 1) {
      const route = new google.maps.Polyline({ map: g, path: stops.map((s) => ({ lat: s.lat, lng: s.lng })), strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#6B1D2A", strokeWeight: 4, scale: 3 }, offset: "0", repeat: "16px" }] });
      overlays.current.push({ remove: () => route.setMap(null) });
    }
    const items: { s: Pin; big: boolean; alt: boolean; i: number }[] = [...alts.map((a) => ({ s: a, big: false, alt: true, i: -1 })), ...stops.map((s, i) => ({ s, big: i === active, alt: false, i }))];
    items.forEach(({ s, big, alt, i }) => {
      const el = pinEl(s, big, alt);
      if (i >= 0) el.addEventListener("click", () => onPickRef.current?.(i));
      class Pin extends google.maps.OverlayView {
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
      const o = new Pin();
      o.setMap(g);
      overlays.current.push({ remove: () => o.setMap(null) });
    });
  }, []);

  // Build (or rebuild) the map whenever the mode changes.
  useEffect(() => {
    if (!KEY || !host.current) return;
    let dead = false;
    const el = host.current;
    (async () => {
      try {
        await loadMaps();
        const at = last.current.shot ?? { lat: initial.lat, lng: initial.lng, range: 9000, tilt: 50, heading: 15, altitude: 0, durationMs: 0 };
        if (mode === "3d" && webglOk()) {
          try {
            const m3 = (await google.maps.importLibrary("maps3d")) as google.maps.Maps3DLibrary;
            if (dead) return;
            const m = new m3.Map3DElement({ center: { lat: at.lat, lng: at.lng, altitude: 0 }, range: at.range, tilt: at.tilt, heading: at.heading, mode: "SATELLITE", defaultUIHidden: true, gestureHandling: "GREEDY" });
            m.style.width = "100%";
            m.style.height = "100%";
            el.appendChild(m);
            map3d.current = m;
            setState("ready");
            await drawStops(last.current.stops, last.current.active, last.current.alts);
            return;
          } catch (e) {
            console.warn("3D map unavailable", e);
            setCan3d(false);
            setMode("2d");
            return;
          }
        }
        const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        if (dead) return;
        map2d.current = new Map(el, { center: { lat: at.lat, lng: at.lng }, zoom: zoomFor(at.range, at.lat, el.clientWidth), styles: PARCHMENT, disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", clickableIcons: false, backgroundColor: "#f3ece2" });
        setState("ready");
        await drawStops(last.current.stops, last.current.active, last.current.alts);
      } catch (e) {
        console.warn("map failed", e);
        if (!dead) setState("off");
      }
    })();
    return () => {
      dead = true;
      cancelAnimationFrame(anim.current);
      clearOverlays();
      map3d.current?.remove();
      map3d.current = null;
      if (map2d.current) google.maps.event.clearInstanceListeners(map2d.current);
      map2d.current = null;
      el.replaceChildren();
    };
    // initial only seeds the first camera; later moves go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, drawStops]);

  useImperativeHandle(
    ref,
    () => ({
      fly(shot) {
        last.current.shot = shot;
        return new Promise<void>((resolve) => {
          const m = map3d.current;
          if (m) {
            m.stopCameraAnimation();
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              m.removeEventListener("gmp-animationend", done);
              resolve();
            };
            m.addEventListener("gmp-animationend", done);
            setTimeout(done, shot.durationMs + 800);
            m.flyCameraTo({ endCamera: { center: { lat: shot.lat, lng: shot.lng, altitude: shot.altitude }, range: shot.range, tilt: shot.tilt, heading: shot.heading }, durationMillis: shot.durationMs });
            return;
          }
          const g = map2d.current;
          if (!g || !host.current) return resolve();
          // A smooth 2D "flight": ease center and zoom together, pulling back a
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
      orbit(stop) {
        const m = map3d.current;
        if (!m) return;
        // A slow half-turn around the stop while Savvy talks about it.
        m.flyCameraAround({ camera: { center: { lat: stop.lat, lng: stop.lng, altitude: 0 }, range: 750, tilt: 58, heading: m.heading ?? 0 }, durationMillis: 30000, repeatCount: 0.5 });
      },
      setStops(stops, active, alts = []) {
        last.current.stops = stops;
        last.current.active = active;
        last.current.alts = alts;
        void drawStops(stops, active, alts);
      },
    }),
    [drawStops],
  );

  return (
    <div className={`overflow-hidden bg-[#f3ece2] ${className || "relative"}`}>
      <div ref={host} className="absolute inset-0" />
      {state === "ready" && can3d && (
        <button type="button" onClick={() => setMode((m) => (m === "2d" ? "3d" : "2d"))} className="btn absolute right-3 top-3 z-10 border-2 border-[#c5995e] bg-[#1a1614] text-[#faf6f1] shadow-lg hover:bg-[#2a211e]">
          {mode === "2d" ? <Box className="size-5" aria-hidden /> : <MapIcon className="size-5" aria-hidden />}
          {mode === "2d" ? "Fly in 3D" : "Back to 2D"}
        </button>
      )}
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
