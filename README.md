<p align="center">
  <img src="app/opengraph-image.png" alt="SavorLM" width="520" />
</p>

<h1 align="center">SavorLM</h1>
<p align="center">Your raccoon guide to the city's best bites. <a href="https://savorlm.com">savorlm.com</a></p>

Tell Savvy what you're craving ("famous brisket for lunch, then a Rainey Street bar", or just "a quick healthy salad near Pike Place"), by voice or by typing. He finds the places people love most in 21 US cities and walks you through them on the map. Every stop comes with the top 3 to 5 options, live hours, a calibrated fit check, and the sources behind it.

## Why it's built this way

| Decision | Why |
| --- | --- |
| **"Top spots" = web consensus.** Savvy reads best-of lists and local guides live and counts how many independent sites name each place. | Popular and famous is what people actually ask for, from a salad to a tasting menu. The count is explainable: "named by 9 guides". |
| **Store nothing.** No restaurant database at all; Exa search at request time, cached a few hours. | The previous version kept 6,700 scraped dishes in Postgres. It went stale and cost money idle. |
| **3 to 5 options per stop**, Savvy narrates his favorite. | One answer feels like a coin flip; a short ranked list is how people really choose. |
| **Fit claims checked by TypeSafe Jev**, not by the LLM. | "Date-night vibe 83%" is a calibrated yes/no over the sources. Below 60%, no badge. |
| **A fixed pipeline, not a free-running agent loop**: plan, discover, extract, consensus, judge, pick. | A known number of calls per tour, predictable cost, and the first stop streams while the rest load. |
| **2D map by default, 3D on request**, with hard Google quota caps. | Same per-load price, but 3D has half the free tier. Caps keep the bill at $0. |

## Architecture

```
browser ──(text or voice)──▶ /api/hear (Gemini transcription)
   │
   └──▶ /api/guide  (server-sent events: say · fly · stop · done)
          1. plan      Gemini 3.8 Flash, structured output
          2. discover  Exa: best-of roundups + venue pages, per stop
          3. extract   Gemini Flash-Lite: which venues each page names
          4. consensus count independent sites per venue (pure, tested)
          5. judge     Exa evidence per venue + TypeSafe Jev yes/no/unknown
          6. pick      Gemini Flash-Lite: 3 to 5 ranked options, spoken line
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
