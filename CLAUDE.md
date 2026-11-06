# CLAUDE.md

@AGENTS.md

SavorLM v2: **Savvy**, a cute plush raccoon food guide (beret, chef jacket, guidebook), plans a night out around Michelin Guide restaurants and walks you through it on a map, by voice or text. Live at https://savorlm.com. Public repo `william-wei-zhu/savorlm` (rebuilt 2026-11-06 from scratch; the old `dishlm` repo stays private because its git history holds a hardcoded key). Built as a job-hunt showcase for restaurant / delivery / travel / maps roles. Follows William's Web App Building Standard, with the deviations noted below.

## Commands
```bash
npm run dev          # http://localhost:3000 (needs .env.local, see .env.example)
npm run build
npm test             # vitest: geo, Jev badge rules, spine lookups, SSE parser, IP/origin guards
npm run typecheck
npm run spine -- ../dishlm/data/seed_restaurants.json [city,...]   # (re)build data/michelin/<city>.json
cd art && python3 poses.py base|edits [only,...] && python3 key.py # regenerate / export Savvy frames
```

## Architecture (one Next.js app, idles at $0)
- Next.js 16 App Router (cacheComponents on: **no `export const runtime` in route files**, it errors), Tailwind v4, React 19, Node 24. Vercel project `savorlm`.
- GCP project **`savorlm-app`** (billing william-1): Firestore `(default)` in us-east4 (cache + usage counters only, deny-all rules in `firestore.rules`, deployed via the Rules REST API), service account `savorlm-server` (datastore.user), API keys `savorlm-gemini` (generativelanguage), `savorlm-places-server` (places), `savorlm-maps-browser` (maps-backend + tile, HTTP-referrer restricted). TTL policies on `expireAt` for `cache`, `usage`, `ips`, `tours`.
- **No database of restaurants beyond the spine.** `data/michelin/<city>.json` (~440 spots, 12 cities, ~230 KB, bundled): name, distinction, cuisine, price, address, lat/lng, Google place id, maps url, website. Facts only, no guide text. Seeded from DishLM's 2025 list, geocoded by `scripts/spine.mts` (Places Text Search, re-runs only pay for new names). `tokyo.json` is empty: add it with Exa + the script.
- Everything live (hours, open now, rating, phone, menus, news) comes from **Exa** at request time (`lib/server/exa.ts`, `type: "lite"`, highlights), cached in Firestore 3 to 12 h. Probed 2026-11-06: Exa Places results arrive as venue pages whose highlights hold hours/address/phone; no structured place entity came back on `lite`, so Gemini extracts the facts and the parser also accepts a place entity if Exa adds one.

### The guide pipeline (`lib/server/guide.ts`, streamed by `/api/guide` as SSE)
A fixed pipeline, not a free tool loop, so cost per tour is known and the first stop streams early:
1. **plan** (Gemini `gemini-3.8-flash`, structured): kind tour/answer/chat, city, area, 1 to 4 stops (role, michelin required/preferred/no, distinctions, cuisine, Exa query, named), up to 3 checks, an opening line.
2. **gather**: Michelin stops filter the spine (`findSpots`: distinction, cuisine words, within 3 km of the previous stop) then one Exa search per candidate for evidence; other stops are an Exa search near the previous stop. "Best of" roundups are filtered (`isRoundup`), and the pick step may choose one venue named inside a list article.
3. **judge**: TypeSafe Jev (`jev-1.14.0`, `lib/server/jev.ts` ported from AI Discussion Club) answers each check yes/no/unknown with calibrated probabilities over the evidence. A badge shows only for "yes" at >= 0.6 (`badgeFrom`, tested). Cached 7 days.
4. **pick** (Gemini, structured): one candidate per stop, the spoken line (max 32 words, only facts from evidence), open_now/hours/rating/phone extraction, source urls (kept only if they are in that candidate's evidence), outro + tour title.
The first stop is picked alone so the camera can move while the rest are gathered near it. All outside text is wrapped (`<web_data>`, `<user_said>`) and declared untrusted. Typical timings: first line ~3 s, first stop ~7 s, 3-stop tour ~13 s.

Scene events (`lib/guide/scene.ts`): `say`, `fly` (camera shot), `stop` (StopCard + shot), `done` (outro + title), `error`. The client director in `components/guide-app.tsx` plays them in order: speech runs while the camera moves, each stop waits for the previous line to finish.

### Voice
`/api/hear` (Gemini `gemini-3.5-flash-lite` transcription, temp 0; recordings never stored), `/api/tts` (streamed PCM from `gemini-3.8-flash-lite-tts`, voice **Sadachbia**, mood tags are single adverbs only: longer tags get read aloud, learned on HiBenny). Mic VAD + WAV encoder (`lib/audio/recorder.ts`) and the PCM engine (`lib/audio/engine.ts`) are ported from HiBenny; end-silence 1.6 s (2.2 s just after speech starts).

### The map (`components/map-view.tsx`)
- **2D by default** (William, 2026-11-06, cost): styled raster map ("parchment" JSON style, business POIs hidden, no mapId so styles apply), custom HTML pins via `OverlayView` (gold-ringed medallions, stars/B/number), dashed burgundy route, eased center+zoom "flights".
- **"Fly in 3D" button** switches to the photorealistic `Map3DElement` (SATELLITE mode, `flyCameraTo` / `flyCameraAround`, `Marker3DInteractiveElement` with `RELATIVE_TO_MESH` + `drawsWhenOccluded` so pins sit above rooftops; at 60 m RELATIVE_TO_GROUND they hid inside Midtown towers). Only people who press it use 3D loads.
- Pricing checked 2026-11-03 list: 2D Dynamic Maps $7/1k loads, 10k free/mo; 3D Immersive Maps $7/1k, 5k free/mo; Places Photos is Enterprise (1k free). **Hard daily quota caps** (gcloud beta quotas, 2026-11-06): 3D loads 150/day, 2D loads 300/day, Places GetPlace 30/day, GetPhotoMedia 30/day, SearchText 150/day. Over a cap, Google returns errors and the UI degrades (no photo, map error card), never a bill.

### Savvy (the rig)
- Art: Gemini image (`gemini-3.1-flash-image`) from `art/candidates/savvy-ref.png` (William picked plush style; 2026-11-06 he asked for cuter, so the chibi beret version replaced the first plush one). 12 poses (wave, listen, talk, think, point, wow, cheer, taste, laugh, clap, dance, look) + edit-variants talk2, talk-blink, listen-blink, wave2, dance2 that reuse their base crop box (`art/key.py`, blue chroma key copied from HiBenny). Served from **`public/savvy/`** (renamed from /guide/ so browsers and the image optimizer drop the old art).
- `components/savvy.tsx` (HiBenny's Benny rig): CSS mood loop per pose, per-frame voice bob/tilt from real loudness, pop on pose change, lip flap (talk2 when quiet), blinks, **two-frame cycles** for wave and dance, tap = giggle + laugh pose.
- Choreography: every line opens with a gesture (`gesture(first, then)`) then settles to talk; binoculars (`look`) during flights; `wow` for Michelin arrivals, `point` for local picks, `dance` on the outro then `cheer`.
- He stands on an espresso medallion with a gold ring (`.savvy-stage`): on the parchment map his cream jacket disappeared (William: "I can barely see the raccoon").

## Design
- An evening menu: the side panel (`.menu`) is always espresso + gold in both themes (a deliberate deviation: the panel is the printed menu; the map, bubble and subpages follow the theme). Fraunces (display), Figtree 600 body, DM Mono kickers. Tokens in `app/globals.css`; component classes live in `@layer components` so Tailwind utilities (like `p-0`) can override them (unlayered `.btn` padding once squeezed icons to 9 px).
- The ask box (text + "Or just talk to Savvy") sits at the top of the panel under the city picker (William couldn't find the bottom composer). Suggested requests are menu rows with a gold chevron ring. Tickets: photo with name overlay, punched notches, Jev badges with %, Reserve / Directions / Call, sources.
- Intro: gold rings draw in, Savvy pops through, wordmark rises (once per load, honors reduced motion).
- Mobile: single column must be `minmax(0,1fr)` or the map section stretches to the panel's min-content (418 px on a 390 px phone).

## Guards
`lib/server/guard.ts` (HiBenny pattern): per-IP burst, per-IP daily, global daily budget per kind (guide 1500, hear 2000, tts 8000, photo 4000), trusted client IP, strict origin (`lib/server/origin.ts`). Without Firestore creds the guard fails closed in production and open in dev. Photos go through `/api/photo` (302 to a Google-hosted URI, cached a day); nothing is stored.

## Gotchas
- `.env.local` has no `FIREBASE_SERVICE_ACCOUNT_B64`, so dev runs with memory cache only and no usage counters.
- Headless Playwright screenshots of this page lag a few seconds behind (WebGL map); take a second screenshot before judging a frozen intro.
- Gemini `thinkingLevel` "low" (3.8 Flash rejects "minimal"). INTEGER not NUMBER in schemas.
- The Exa and TypeSafe keys were pasted in chat on 2026-11-06: rotate them.
