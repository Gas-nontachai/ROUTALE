# GPX Pixel Adventure v1.3 — 3D Journey Experience

A local GPX journey player built with React, TypeScript, MapLibre and Zustand. Import a GPX, preview its route, play the journey, then crossfade into its precomputed summary. Replay uses the same data without importing again.

## Run and check

```sh
npm ci
npm run dev
npm test
npm run build
npm run format:check
```

No API keys are required. OpenFreeMap supplies the base map and Mapterhorn supplies terrain. Terrain failures fall back to 2D; base-style failures try an attributed OpenStreetMap raster fallback. Both sample GPX files are synthetic fixtures. **Try the smart demo** includes six laps, a rest and an out-and-back hike.

Use Play, Pause, Resume, Restart, the seek slider or speed selection (0.5×–8×). Native buttons and the slider support keyboard operation. **View journey summary** works before playback or when the map cannot render; **Skip transition** completes the reveal immediately. Replay starts a fresh journey. Ready and Paused allow zoom, pan, rotate and tilt with mouse, keyboard, touch or trackpad. Pause freezes GPX time before enabling exploration. Reset returns progress to zero and keeps the current view. Reduced motion skips animated handoff, keeps a static playback camera, removes the character stride and reveals the summary immediately at completion.

## Data and statistics

- The original `File` stays unmodified in memory, retaining the exact source XML and metadata. Parsed, validated segments, quality-filtered activity points and simplified playback points are separate. Playback points retain their source segment and raw point index.
- A Web Worker parses and validates GPX, rejects entities, filters isolated implausible spikes, detects rest areas and ordered laps, computes statistics and prepares the character route. Limits remain 25 MB, 300,000 points and a 30-second processing deadline.
- Invalid coordinates split segments. Separate track segments are never connected by invented route lines or distances. Their playback positions may jump across unrecorded gaps.
- Summary statistics are ready before playback: distance, recorded duration, moving time, average speed/pace and elevation. The simplified overview geometry and start/finish points are also ready before rendering. Missing values display **Not available**. Duration sums positive consecutive intervals; moving time and averages require complete, monotonic timestamps. Average speed/pace use recorded duration, including rests. Moving time excludes detected dwell intervals and edges below 0.3 m/s.
- Rest detection is heuristic: at least five minutes within an anchored 25–30 m area, including possible wandering. A dwell normally uses two replay seconds; recordings with many rests share a bounded dwell budget. Recorded statistics retain that activity. Ordered repeated laps retain every lap; laps after the first two run at 12× relative speed. Backtracking is preserved.
- Elevation uses a local median where neighboring samples exist. Missing elevation is never replaced with map terrain. GPS optimization and playback compression do not mutate the source file.

## One journey, one timeline

`src/lib/motion.ts` centralizes playback easing and motion limits. `src/lib/journey.ts` prepares deterministic playback samples; `src/lib/camera.ts` calculates adaptive handoffs independently of rendering. `src/lib/playback.ts` owns the state machine and logical simulation, handoff and completion times. `src/lib/simulation.ts` bridges Zustand commands and published state. `src/hooks/useJourney.ts` owns the sole application RAF scheduler. Simulation time advances only while Playing; handoff and completion time advance in real seconds. The renderer subscribes directly; UI state is published at 10 Hz.

Playback duration is prepared once, between 20 and 180 seconds, using distance, turns, elevation, spots and rests. Automatic camera modes are Follow, Wide at rests (holding the incoming zoom) and Scenic near the track high point. Preview starts at 60° pitch, with a bearing across the route or toward its high point. The bearing stays steady during playback; GPS turns and elapsed-time blocks no longer force rotation or Top-down views. Camera samples bound position speed/acceleration, angular speed/acceleration, pitch and zoom. Playback limits apply in journey seconds; speed selection accelerates route playback and its camera, but does not accelerate handoff or the completion reveal. Free exploration never rewrites the prepared camera path. The camera brakes before the finish and settles without a final bearing spin.

Camera ownership is explicit: Ready/Paused belong to the user; Transitioning/Playing/Completing belong to the controller; Completed belongs to summary UI. The renderer enables all gestures, including touch pitch, only for the user owner. Play/Resume stops map inertia and disables gestures synchronously, then samples the actual current map camera. No MapLibre `easeTo`/`flyTo` competes with playback. `jumpTo` only applies controller-evaluated frames; Reset never calls it.

Play and Resume use the same handoff builder, preserving whether the request was initial or resumed. Near-identical cameras resume immediately. Otherwise duration combines normalized geographic distance (log scale), zoom-level difference, shortest bearing difference and pitch difference, between 0.25 and 3 real seconds. Returns within 5 km, including cursor zoom that shifts the focus, interpolate directly without zoom overshoot; geographic travel and large angle changes zoom out, reposition overhead and zoom in. Position/bearing use smoothstep, zoom/pitch/elevation use smootherstep. Every phase ends exactly at the next phase's starting pose. Character position and GPX progress remain fixed throughout handoff.

Terrain samples are frozen for the playback session to avoid asynchronous DEM updates causing camera jitter or changing an unchanged-camera Resume into a new flight. Loaded elevation and a 300 m clearance budget constrain zoom; the overhead travel phase uses a conservative 20 km terrestrial elevation ceiling (covering the app's maximum 2× relief). Missing DEM does not invent a 20 km mountain for playback: the zoom bound uses only sampled relief. The 20 km bound is reserved for long-distance overhead travel; MapLibre also keeps its camera above available drawn terrain. Targets use sampled map elevation, never GPX altitude as an extra marker offset. This is a bounded DEM survey, not a continuous collision solver; real-device testing near very steep cliffs is still required. Controller-owned frames set focus elevation explicitly; user gestures restore terrain clamping after ownership is released without moving the view on Reset.

Pause saves the playback camera snapshot and grants free exploration. Resume returns to that snapshot at the paused GPX time. Pausing a handoff retains its intended playback target; resuming finishes rejoining that target rather than leaving the camera mid-flight. Reset cancels all pending transitions, resets progress, preserves the actual map pose and returns ownership to the user. Invalid/repeated Play requests are ignored. Seek pauses at the selected time; Resume handles any camera difference.

Completion is part of the same timeline. The traveler stops, the map remains mounted, and the summary crossfades with eased opacity and a subtle translation. The summary uses a local SVG overview and precomputed activity statistics, so it does not depend on terrain or map loading. A rendering error boundary preserves controls and summary access.

Terrain defaults to 1.5× relief, selectable between 1.0× and 2.0× in Ready or Paused. A separate Terrarium DEM source supplies subtle, map-anchored hillshade beneath labels and the route. The status stays loading until MapLibre reports drawn DEM coverage at the view center (including valid zero-meter terrain). Source failures or a 20-second DEM timeout disable terrain and hillshade, flatten the camera, and allow retry with fresh sources. A hillshade-only failure leaves terrain usable. Loading uses MapLibre render events, not another animation clock.

The character is a small SVG traveler anchored by its feet to the terrain, using MapLibre’s terrain projection and subpixel positioning; its stride and direction come from journey time. Route lines are draped by MapLibre, and route circles align to the map surface. GPX elevations are never added again as marker offsets, so exaggeration does not double their height. It is not a custom 3D model. Lower-core devices request a lower terrain zoom ceiling. MapLibre is lazy-loaded and disposed on exit.

## Privacy and limits

GPX files and timestamps stay in the browser. Map providers receive requests for the area viewed; visible MapLibre attribution identifies providers. MapLibre requires WebGL and maps require network access. No accounts, cloud storage, video export or sharing are included. This checkout has not been deployed.

Movement detection cannot reliably infer intent from severe GPS noise, very small loops or sparse recordings. Local projection suits activity-scale routes, not transcontinental or polar tracks. Camera samples are baked at 30 Hz and interpolated at render time. Production traffic should review provider usage policies; the OpenStreetMap raster fallback is intended for light usage.

Unit and integration tests exercise all four handoff factors, near thresholds, angular/date-line wraparound, flight continuity, clearance, initial/resumed handoffs, unchanged-camera Resume, frozen progress, Reset in every state, repeated commands, missing DEM and completion. Existing tests cover validation, missing data, source preservation, loops, stops, backtracking, progressive route rendering, adaptive duration, deterministic evaluation, pause/resume, constrained camera motion, reduced motion and completion. Browser checks use synthetic routes. `src/lib/fixtures/alpine-terrain.gpx` supplies synthetic geometry near Chamonix without GPX elevation or timestamps: visible mountains must come from DEM, while activity elevations remain unavailable. It is a rendering fixture, not a navigable trail. The older Chiang Mai samples include synthetic elevations and need not match actual relief at their coordinates. Real-device frame-rate and motion-comfort testing remain outstanding.

Provider setup follows the [MapLibre terrain example](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/) and [OpenFreeMap quick start](https://openfreemap.org/quick_start/).

## Formatting, Git hooks and CI/CD

Use Node.js 24 (`nvm use`) and `npm ci`. Installation runs `prepare` to enable Husky. `npm run format` formats supported project files with Prettier; `npm run format:check` checks without changing files. Build output, dependencies, generated hook files, the lockfile and GPX fixtures are excluded.

The pre-commit hook runs `format:check` and the test suite. It does not change files or stage edits. If formatting fails, run `npm run format`, review and stage the formatted changes, then commit again.

GitHub Actions runs formatting checks, tests and the production build for pull requests and pushes to `main`. CI uses Node.js 24, `npm ci` and npm caching; Husky is disabled on runners.

Production deployment uses Vercel after checks pass on `main`. Deployment stays skipped until both Vercel repository variables are configured. In GitHub **Settings → Secrets and variables → Actions**, add:

| Type     | Name                | Value                                            |
| -------- | ------------------- | ------------------------------------------------ |
| Secret   | `VERCEL_TOKEN`      | A Vercel access token authorized for the project |
| Variable | `VERCEL_ORG_ID`     | The Vercel team/account ID                       |
| Variable | `VERCEL_PROJECT_ID` | The Vercel project ID                            |

Create or link the Vercel project once (`vercel link`); the two IDs are in the ignored `.vercel/project.json`. The workflow uses a pinned Vercel CLI to pull production settings, build and deploy prebuilt output. Set Vercel's framework to Vite, build command to `npm run build`, output directory to `dist`, and Node.js version to 24.x. If the project also has Vercel's automatic Git deployments enabled, disable those to avoid duplicate deployments outside this workflow's checks.

Pull requests never receive Vercel deployment credentials. Pushes to `main` deploy after checks pass; **Run workflow** on `main` can rerun the same pipeline manually. No GitHub remote, repository settings or Vercel credentials are configured by this local setup.

Workflow references: [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs), [Vercel custom workflows](https://vercel.com/kb/guide/using-vercel-cli-for-custom-workflows), [Husky](https://typicode.github.io/husky/get-started.html).
