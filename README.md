<p align="center">
  <img src="app/opengraph-image.png" alt="SavorLM" width="520" />
</p>

<h1 align="center">SavorLM</h1>
<p align="center">Your foodie guide to the city's best dining spots. <a href="https://savorlm.com">savorlm.com</a></p>

Tell Savvy what you're craving ("famous brisket for lunch, then a Rainey Street bar", or just "a quick healthy salad near Pike Place"), by voice or by typing. He finds the places people love most in 21 US cities and walks you through them on the map. Every stop comes with four picks (a top pick and three more), live hours, a calibrated fit check, and the sources behind it.

## Why it's built this way

| Decision | Why |
| --- | --- |
| **"Top spots" = web consensus.** Savvy reads best-of lists and local guides live and counts how many independent sites name each place. | Popular and famous is what people actually ask for, from a salad to a tasting menu. The count is explainable: "named by 9 guides". |
| **Store nothing.** No restaurant database at all; Exa search at request time, cached a few hours. | The previous version kept 6,700 scraped dishes in Postgres. It went stale and cost money idle. |
| **Four picks per stop** (a top pick and three more), in a fixed list. | One answer feels like a coin flip; a short, stable list is how people really choose. |
| **Fit claims checked by TypeSafe Jev**, not by the LLM. | "Date-night vibe 83%" is a calibrated yes/no over the sources. Below 60%, no badge. |
| **A fixed pipeline, not a free-running agent loop**: plan, discover, extract, consensus, judge, pick. | A known number of calls per tour, predictable cost, and the first stop streams while the rest load. |
| **One URL per city** (savorlm.com/miami) and a city chooser landing page. | Shareable, linkable, indexable; the landing shows every city with a food badge. |
| **A styled 2D map** with hard Google quota caps. | The cheapest Maps SKU; caps keep the bill at $0. |

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
          6. pick      Gemini Flash-Lite: 4 ranked picks, a spoken intro each
   │
   ├──▶ /api/tts    Gemini TTS, streamed PCM (Savvy starts talking in ~0.5 s)
   └──▶ /api/photo  Google Places photo redirect (nothing stored)

Firestore: short-lived cache + per-IP / global daily budgets (TTL deletes both)
```

## Stack

Next.js 16 on Vercel · Gemini (planning, narration, voice, transcription) · Exa · TypeSafe Jev · Google Maps JS and Places · Firestore. Savvy's art is generated with Gemini image and animated with a frame rig (gestures, lip flap, blinks, two-frame cycles) that responds to his own voice loudness.

## Run it

```bash
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
npm test
```

Built by [William Zhu](https://www.linkedin.com/in/william-wei-zhu/).
