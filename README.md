<p align="center">
  <img src="app/opengraph-image.png" alt="SavorLM" width="520" />
</p>

<h1 align="center">SavorLM</h1>
<p align="center">Your raccoon guide to Michelin nights out. <a href="https://savorlm.com">savorlm.com</a></p>

Tell Savvy what you're craving ("my anniversary in North Beach: a starred dinner, then cocktails"), by voice or by typing. He plans the evening around Michelin Guide restaurants and the best places nearby, then walks you through it on the map: he talks while the camera moves, every stop lands as a ticket with live hours, a calibrated fit check, and its sources.

## Why it's built this way

| Decision | Why |
| --- | --- |
| **Store almost nothing.** A 230 KB Michelin "spine" (name, distinction, location) is the only restaurant data. | The previous version kept 6,700 scraped dishes in Postgres + pgvector. It went stale and cost money idle. Live search is fresher and free when nobody is using it. |
| **Live data from Exa at request time** (hours, open now, ratings, menus, news). | One search call returns venue pages with hours and contact details, so Savvy can check a place is open before recommending it. Cached a few hours. |
| **Fit claims checked by TypeSafe Jev**, not by the LLM. | "Date-night vibe 83%" is a calibrated yes/no over the sources. Below 60%, no badge. The language model never asserts a fit on its own. |
| **A fixed pipeline, not a free-running agent loop**: plan, gather, judge, pick. | A known number of calls per tour, predictable cost, and the first stop streams in ~7 s while the rest load near it. |
| **Michelin-first, open-world around it.** | Michelin is the trust signal; bars, coffee and dessert come from the open web near the first stop, in any city. |
| **2D map by default, 3D on request**, with hard Google quota caps. | Same per-load price, but 3D has half the free tier. Caps keep the bill at $0. |

## Architecture

```
browser ──(text or voice)──▶ /api/hear (Gemini transcription)
   │
   └──▶ /api/guide  (server-sent events: say · fly · stop · done)
          1. plan    Gemini 3.8 Flash, structured output
          2. gather  Michelin spine filter ─┬─▶ Exa search (live evidence)
                                            └─▶ Exa search near the last stop (open world)
          3. judge   TypeSafe Jev: yes / no / unknown + confidence per check
          4. pick    Gemini: one place per stop, spoken line, facts from evidence only
   │
   ├──▶ /api/tts    Gemini TTS, streamed PCM (Savvy starts talking in ~0.5 s)
   └──▶ /api/photo  Google Places photo redirect (nothing stored)

Firestore: short-lived cache + per-IP / global daily budgets (TTL deletes both)
```

## Stack

Next.js 16 on Vercel · Gemini (planning, narration, voice, transcription) · Exa · TypeSafe Jev · Google Maps JS (2D + photorealistic 3D) and Places · Firestore. Savvy's art is generated with Gemini image and animated with a frame rig (gestures, lip flap, blinks, two-frame cycles) that responds to his own voice loudness.

## Run it

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
npm test
```

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/).
