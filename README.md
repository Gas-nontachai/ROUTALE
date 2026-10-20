# Trailbound — GPX Pixel Adventure

A browser-only implementation of the MVP 1 PRD. Import a GPX, generate a seeded pixel forest, and replay the route with a four-direction animated adventurer and follow camera.

## Run

```sh
npm install
npm run dev
```

Open the URL Vite prints. Use **Try a sample trail**, or import your own GPX, then select **Generate my world**. The bundled `public/Lunch_Hike.gpx` is a synthetic demo, not a recorded hike.

```sh
npm test
npm run build
```

Deploy as a Vite static site on Vercel: build command `npm run build`, output directory `dist`. No environment variables, backend, database, or runtime APIs are required. This checkout has not been deployed.

## Implementation

- React, TypeScript, Vite, Tailwind, shadcn-style Radix Button, Lucide.
- Three Zustand stores for imported activity, generated world, and playback.
- `fast-xml-parser` in a Web Worker; track segments and route-only GPX supported. Invalid points split segments; no gap distance or connecting line is invented.
- Local geographic projection, iterative route simplification, cumulative geodesic distance, seven ordered spots. Playback follows every retained route point, not straight lines between the displayed spots. At a segment boundary, the character moves to the next segment without walking across the missing data.
- Seeded PixiJS terrain and hand-drawn pixel character. Trees and rocks are excluded from a buffer around the path. Graphics are generated locally; no external art assets or AI calls.
- A fixed simulation speed of 85 route meters per second. Progress is published at 10 Hz; rendering runs independently. Pauses when returning to import. Imported content is never persisted or transmitted.

## Limits

25 MB / 300,000 coordinate limit per file; WebGL required. The local projection is intended for walking/running-scale routes, rather than journeys spanning countries or poles. Timestamp data is parsed but does not determine playback speed. Fonts use an optional Google Fonts stylesheet with system fallbacks. Forest scenery is procedural and does not represent real terrain. Sharing, accounts, speed settings, scrubbing and export are outside MVP 1.
