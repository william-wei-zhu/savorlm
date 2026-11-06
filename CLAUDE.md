# CLAUDE.md

@AGENTS.md

SavorLM v2: **Savvy**, a cute plush raccoon food guide (beret, chef jacket, guidebook), finds the city's most popular, most famous spots for any craving (a quick salad to a tasting menu) and walks you through them on a map, by voice or text. Every stop offers **four picks: a top pick and three more**. 21 US cities. Live at https://savorlm.com. Public repo `william-wei-zhu/savorlm` (rebuilt 2026-11-06 from scratch; the old `dishlm` repo stays private because its git history holds a hardcoded key). Built as a job-hunt showcase for restaurant / delivery / travel / maps roles. Follows William's Web App Building Standard, with the deviations noted below.

## Product rules (William, 2026-11-06)
- **Top spots = web consensus**, not awards: the places many independent best-of lists and local guides name. Any craving, any budget; fine dining welcome but not the point.
- **Never show "Michelin" (or awards) in the UI or in Savvy's lines** unless the user says it first. A test (`tests/core.test.ts`, "brand") fails if the word appears in `app/`, `components/` or `lib/brand.ts`. The original Michelin spine was removed.
- **Every stop shows exactly four picks** (top + three more) as a FIXED list under the photo (William, 2026-11-06: re-ordering the list on tap was overwhelming). Tapping a row highlights it ("Showing"), swaps the photo/details above, flies the map, and Savvy talks about it; the rows never move.
- **One URL per city**: `savorlm.com/<slug>` (`app/[city]/page.tsx`, prerendered for all 21 via `generateStaticParams`; unknown slug = `notFound()` because `dynamicParams` is unavailable with Cache Components; `export const instant = false` since the picker switches cities with `pushState`, not router navigation). Short forms (`nyc`, `sf`, `la`, `dc`, `philly`, `vegas`, `scottsdale`, ...) are permanent redirects from `SLUG_ALIASES` in `next.config.ts`. `app/sitemap.ts` + `app/robots.ts` list them.
- **Landing = city chooser** (BikeSim-style, William 2026-11-06): `/` opens "Where are we eating?" with the time-zone city as a wide "Near you" tile, then every city by region, each with a food badge (`public/cities/<slug>.webp`, made by `art/cities.py`: plush style, cream felt disc, never blue because of the chroma key). The map shows the US with badge pins; tapping a tile or pin goes to that city's URL. "All cities" goes back.
- **Savvy talks about one option at a time** (William, 2026-11-06): on arrival he speaks option 1's `intro`, then option 2's, then option 3's, the card and map switching to each (`showOption`), then back to option 1 before the next stop. Tapping any option takes over the voice (`userTook` ref) and he introduces that one; the tour keeps loading and waits for him (`talking` ref + `settle()`), so a tap never cancels remaining stops. The stop-level `line` is only a caption fallback. "Stop talking" under his bubble silences him for the rest of that answer (captions continue); the speaker button mutes for good.
- **Every option has a photo and a voice.** `/api/photo?ref=` (photo name the top pick's locate already returned: one media call), `?pid=` (place id), or `?q=name, address` (the other picks: a Text Search asking only for `places.photos`, then media), fetched lazily when a card or row thumbnail renders. **Failures are never cached** (2026-11-06 fix: a 429 from a daily cap used to be cached as "no photo" for 30 days, so some restaurants never showed a photo); the route has a 6 s limit, sends `no-store` on 503/504, caches a real miss 10 min and a hit 1 day. `components/photo.tsx` shows a shimmer, retries once, and falls back to a pin icon after 9 s, so nothing hangs. Daily caps remain the limit: SearchText 150/day covers locate + photo lookups (~13 per 3-stop tour, so ~11 full tours a day before photos and precise pins degrade to geocoded pins).
- **Link previews**: home uses `app/opengraph-image.png` (Savvy + wordmark); each city page sets its own `og:image` / `twitter:image` to `public/og/<slug>.jpg` (Savvy + the city badge + "SavorLM" + city name, rendered by `art/og.py`), title "SavorLM <City>", description = tagline + a city line. Re-run `cd art && python3 og.py` after changing Savvy, badges or cities.
- **Request box** is a 2-row textarea (William): Enter sends, Shift+Enter adds a line.
- **Onboarding after a city opens** (William, 2026-11-06: it wasn't obvious what to do): while nothing has been asked yet (`onboarding` = city view, no turns, no stops), Savvy's bubble shows three buttons: **Talk to me** (mic), **Type it** (scrolls to and focuses the textarea), and the city's first idea (runs it). Picking a city from the chooser unlocks audio inside the tap and Savvy greets out loud ("Austin! Tap one of my ideas, type what you're craving, or tap Talk..."). The ask box glows 3 times (`.ask-glow`, re-keyed per city) and its label reads "What are you craving? Type it or tap Talk"; ideas are headed "Or tap an idea to start". It all disappears after the first request.
- **Shareable lists**: when a search finishes, `/api/guide` saves exactly what it generated (`lib/server/tours.ts`, Firestore `tours/<10-char id>`, stops stored as JSON, `expireAt` 180 days via the `tours` TTL policy) and emits `{t:"share", id}`; the client applies `share` and the `done` title the moment they arrive (in `push`, not the narration queue, so Share never waits for Savvy to stop talking), swaps the address bar to `/t/<id>`, and shows "Share this list" (native share sheet, else copy). The title + Share area appears with the first stop ("Saving your link…" until the id arrives). `app/t/[id]/page.tsx` replays the saved list with no new search (params read inside `<Suspense>`, Cache Components), with its own preview (list title, the picks, the city image) and `noindex`. A `{t:"city"}` event tells the client which city the plan is for; if it differs from the screen, the app follows (URL + picker).
- **No 3D map** (removed 2026-11-06, William: unnecessary). The browser key is restricted to `maps-backend` only and `tile.googleapis.com` is disabled in `savorlm-app`.
- **US cities only** (`lib/cities.ts`): NYC, Boston, Philadelphia, DC, Atlanta, Nashville, New Orleans, Miami, Austin, Houston, Dallas, Chicago, Minneapolis, Denver, Phoenix & Scottsdale, Las Vegas, SF, LA, San Diego, Seattle, Portland. Grouped by region in the picker.

## Commands
```bash
npm run dev          # http://localhost:3000 (needs .env.local, see .env.example)
npm run build
npm test             # vitest: geo, Jev badge rules, consensus, cities + slugs, share ids, SSE parser, IP/origin guards, no-Michelin brand check
npm run typecheck
npx next typegen     # after adding a route: regenerates the typed PageProps<"/..."> route list

# Art (needs GEMINI_API_KEY in .env.local; Gemini image gemini-3.1-flash-image)
cd art && python3 poses.py base|edits [only,...]   # Savvy poses (from candidates/savvy-ref.png)
cd art && python3 key.py                          # chroma-key + export to public/savvy/ (also runs on import!)
cd art && python3 cities.py [slug,...]            # city food badges -> art/cities/raw-*.png
cd art && python3 og.py                           # link previews: app/opengraph-image.png + public/og/<slug>.jpg
```
Raw art (`art/poses/`, `art/cities/`, most of `art/candidates/`) is gitignored; only the scripts, `savvy-ref.png` and the exported files in `public/` are committed.

## Architecture (one Next.js app, idles at $0)
- Next.js 16 App Router (cacheComponents on: **no `export const runtime` in route files**, it errors), Tailwind v4, React 19, Node 24. Vercel project `savorlm`.
- GCP project **`savorlm-app`** (billing william-1): Firestore `(default)` in us-east4 (cache + usage counters only, deny-all rules in `firestore.rules`, deployed via the Rules REST API), service account `savorlm-server` (datastore.user), API keys `savorlm-gemini` (generativelanguage), `savorlm-places-server` (places + geocoding-backend), `savorlm-maps-browser` (maps-backend only, HTTP-referrer restricted to savorlm.com, *.vercel.app, localhost:3000). `tile.googleapis.com` is disabled. TTL policies on `expireAt` for `cache`, `usage`, `ips`, `tours`. Firestore holds the cache, usage counters and shared lists (`tours`).
- **No restaurant data is stored.** Everything comes from Exa at request time (`lib/server/exa.ts`, `type: "lite"`, highlights), cached in Firestore 3 to 24 h. Exa "Places" results arrive as venue pages whose highlights hold hours/address/phone (no structured place entity on `lite`, probed 2026-11-06).

### The guide pipeline (`lib/server/guide.ts`, streamed by `/api/guide` as SSE)
1. **plan** (Gemini `gemini-3.8-flash`, structured): kind tour/answer/chat, city, area, 1 to 4 stops (role, craving, tier special/any/quick, budget `none|$..$$$$`, area, named), up to 3 checks, an opening line. (An empty string in a schema enum is a 400: use "none".)
2. **discover** (2 Exa lite searches per stop): "most popular best-loved {craving} {restaurants|bars|spots} in {area, city}" (wants roundups) + "{craving} {restaurant|bar} {area, city}" (venue pages).
3. **extract** (`gemini-3.5-flash-lite`, temp 0, one call per phase): every venue each page names that fits the stop, with its page index.
4. **consensus** (`lib/guide/consensus.ts`, pure, tested): `normName`, `mergeMentions` counts distinct independent domains per venue (a venue's own site never counts), `popularity`. Top 5 go on.
5. **evidence** (1 Exa search per venue: hours, menu, rating) + **judge** (TypeSafe Jev `jev-1.14.0`, yes/no/unknown with calibrated probabilities; badge only for yes >= 0.6; `affordable` asks with the stop's budget; cached 7 days).
6. **pick** (`gemini-3.5-flash-lite`, structured): per stop 4 ranked options (fit first, then Jev checks, then consensus), each with a `why` (card text) and a spoken `intro` (names the place in its first sentence, max 32 words), plus facts (open_now/hours/rating/phone/address/cuisine/price) and source urls; a stop-level `line` is only a caption fallback. Code tops up to 4 options from the ranked candidates if the model returns fewer.
The first stop is picked alone so the camera can move while the rest are found near it (phase 2 discovers near stop 1's area). Measured 2026-11-06: first stop ~9 to 10 s, 2-stop tour ~20 s (phase 2 runs while Savvy narrates stop 1). The pick step on `gemini-3.8-flash` took ~7 s, on flash-lite ~4 s, hence `GEMINI_PICK_MODEL` defaults to flash-lite.
- Locating options (`toOption`): the top option per stop uses Places Text Search (`places.id, location, address, mapsUri, websiteUri, photos`: place id, maps link and its photo name in one call); the rest use the Geocoding API from their address (10k free/mo). Every lookup falls back to geocoding (name + area + city), so the Places daily cap never drops an option. If the first choice or a named runner-up could not be located, the caption line is rebuilt from the options actually on the card.
- A place appears in one stop only (dedupe by candidate key and by normalized final name).
- All outside text is wrapped (`<web_data>`, `<user_said>`) and declared untrusted.

Scene events (`lib/guide/scene.ts`): `city` (the plan's city), `say`, `fly`, `stop` (StopCard = index, role, line, hop, `options: Option[]`), `done` (outro + title), `share` (saved list id), `error`. The client director in `components/guide-app.tsx` plays them in order. `choice` (per stop index) holds the option on show; `showOption` recomputes hops, redraws pins and flies the map.

### Voice
`/api/hear` (Gemini `gemini-3.5-flash-lite` transcription, temp 0; recordings never stored), `/api/tts` (streamed PCM from `gemini-3.8-flash-lite-tts`, voice **Sadachbia**, mood tags single adverbs only). Mic VAD + WAV encoder (`lib/audio/recorder.ts`) and PCM engine (`lib/audio/engine.ts`) ported from HiBenny.

### The map (`components/map-view.tsx`)
- Styled 2D raster "parchment" map only (business POIs hidden, no mapId so styles apply), custom `OverlayView` pins: numbered burgundy medallions per stop (active one gold), small cream medallions `2.2, 2.3...` for the active stop's other options (labels on hover), city badge pins on the landing, dashed route, eased center+zoom "flights".
- Pricing (2026-11-03 list): Dynamic Maps $7/1k, 10k free/mo; Places Photos Enterprise (1k free); Text Search Pro 5k free; Geocoding 10k free. **Hard daily quota caps** (gcloud beta quotas; needed `--allow-high-percentage-quota-decrease --allow-quota-decrease-below-usage`): map loads 300, Places GetPlace 30, GetPhotoMedia 100 (raised 2026-11-06 so every option has a photo: ~2k/mo over the 1k free tier at most, about $14), SearchText 150, Geocoding 300. Over a cap the UI degrades (no photo, geocoded pin), never a bill.

### Savvy (the rig)
- Art: Gemini image from `art/candidates/savvy-ref.png` (chibi plush raccoon with beret; William asked for cuter on 2026-11-06). 12 poses + edit-variants talk2, talk-blink, listen-blink, wave2, dance2 sharing their base crop box (`art/key.py`). Served from `public/savvy/` (renamed from /guide/ to bust caches).
- `components/savvy.tsx` (HiBenny's rig): mood loops, voice bob/tilt, pop, lip flap, blinks, two-frame wave/dance cycles, tap = giggle + laugh. Lines open with a gesture then talk; binoculars while the map moves; `wow` when the pick is a local favorite (2+ guides), `point` otherwise; `dance` on the outro.
- Stands on an espresso medallion with a gold ring (`.savvy-stage`) so he reads on the cream map.

## Design
- An evening menu: the side panel (`.menu`) is always espresso + gold in both themes (deliberate). Fraunces / Figtree 600 / DM Mono. Component classes live in `@layer components` so utilities can override them.
- Ask box (2-row textarea + send + "Or just talk to Savvy") at the top of the panel under the city picker and "All cities". Tickets: the option on show with photo, "Top pick" / "Pick N of 4", "Local favorite · named by N guides", why, facts, Jev badges, Reserve / Directions / Call, sources (supporting pages first, then the lists that named it), then the fixed "Top picks · tap one to hear about it" list of all four with photo thumbnails and a "Showing" highlight. List title + "Share this list" above the tickets.
- Tagline: "Your foodie guide to the city's best dining spots".
- The whole page scrolls (William, 2026-11-06: do not freeze the top of the panel); on desktop the map column is `sticky top-0 h-dvh self-start` so it stays in view.
- Below `lg`, Savvy + bubble are `fixed` to the viewport bottom (William: "the raccoon is hiding down below" once the whole page scrolled); on desktop they sit inside the sticky map. Size steps `w-28 sm:w-40 lg:w-56 xl:w-64 2xl:w-72`.
- Mobile: single column must be `minmax(0,1fr)` or the map stretches to the panel's min-content.

## Guards
`lib/server/guard.ts`: per-IP burst, per-IP daily, global daily budget per kind (guide 1500, hear 2000, tts 8000, photo 4000), trusted client IP, strict origin. Fails closed in production without Firestore. Photos via `/api/photo` (302 to a Google-hosted URI).

## Gotchas
- `.env.local` has no `FIREBASE_SERVICE_ACCOUNT_B64`: dev runs with memory cache only.
- Headless Playwright screenshots of this page lag a few seconds; take a second one before judging, or read the DOM with `browser_evaluate`.
- The Playwright browser window is visible on William's screen and he sometimes clicks or talks in it: unexpected city jumps or requests there were his trusted input events, not bugs.
- After adding a route, run `npx next typegen` or `PageProps<"/new/[x]">` fails typecheck.
- "The `credentials` option is deprecated" in Vercel logs comes from firebase-admin and is harmless.
- Gemini 3.8 Flash `thinkingLevel` "low" (rejects "minimal"); INTEGER not NUMBER; no empty strings in enums.
- The Exa and TypeSafe keys were pasted in chat on 2026-11-06: rotate them.
