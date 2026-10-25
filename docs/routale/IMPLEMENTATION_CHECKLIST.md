# Routale implementation checkpoints

## S0 — audit (2026-10-22)

- App navigation is local state in App; Summary is driven by the simulation completion transition. Preserve both.
- React 19, TypeScript 5.9, Vite 7, Tailwind 4, Zustand 5, MapLibre 6 and Recharts 3 are installed. GSAP is absent and unnecessary for this release. React Router is installed but unused; defer package removal.
- Existing worker validates GPX with a 25 MB file limit, point limits, timeout and request cancellation. Click/drop already share importFile.
- Existing Journey engine owns time, playback and camera handoff. Existing toolbar has all five actions but hides them behind hover. Styles/terrain are deliberately restricted to user camera ownership.
- Providers: OpenFreeMap/OpenMapTiles/OpenStreetMap basemap, Mapterhorn DEM, EOX Sentinel-2 imagery; OSM raster fallback. No MapTiler integration. Existing inline attribution was disabled; restore it alongside a native credits dialog.
- Existing analysis already filters invalid data, marks gaps, downsamples each metric and calculates real splits. Preserve math; align chart series by recorded source index/distance rather than array position.
- Figma Home/Journey/Summary inspected. Maps, plotted data and tooltip figures are illustrative: real map/chart replace these mock assets. Keep bundled Kanit for readable local typography. Favicon proposal remains unapproved; no new production icon.
- Baseline: 14 test files / 112 tests pass; production build passes with existing large-chunk warning. Host Node 26 differs from documented Node 24.

## File plan

S1: Navbar, Footer, Button, index.css, index.html, package metadata, README, MASTER.
S2: ImportPage and local Figma route SVG; retain worker lifecycle.
S3: JourneyPage and RouteMap toolbar/settings; preserve engine; SummaryMap attribution.
S4: JourneySummary and its metric tests; preserve calculations and technical facts behind disclosure.
S5: ActivityAnalysis and chart alignment/normalization helper with focused tests.
S6: Split presentation and complete-split ranking tests.
S7: format, tests, build, Knip, browser flow/responsive checks and handoff.

## Decisions / limits

No backend, provider migration, GSAP, Storybook, telemetry, sharing or new dependencies. No extra animation clock. Camera/style actions remain disabled while playing; settings explain Pause. Linked chart/map highlight is deferred as permitted by PRD. Domain/trademark clearance and real-device performance are release-owner tasks.

## S1–S7 implementation outcomes

| Slice | Changed paths / outcome                                                                                                                                                                                                                                                                                                         | Verification                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1    | `Navbar`, `Footer`, `ui/button`, `index.css`, HTML/package metadata. Routale wordmark, contrast-adjusted semantic tokens, Energy variant, native credits dialog with focus return and actual provider links; font license distributed publicly.                                                                                 | Existing button tests; light/dark contrast tests now include Energy; Chrome Home/credits Escape/focus check.                                                                                                                     |
| S2    | `ImportPage`, `public/assets/routale/route.svg`. Responsive editorial composition and original Figma Home artwork at its natural 540×300 aspect. One choose/drop pipeline, no default technical limits, local-processing copy, duplicate guard.                                                                                 | New ImportPage tests cover odd MIME/uppercase GPX, choose/drop, loading/duplicate, source preservation, unsupported/large files, malformed GPX, retry and worker failure. Native picker imports synthetic fixtures successfully. |
| S3    | `JourneyPage`, `RouteMap`, `SummaryMap`, CSS. Persistent five-action toolbar, settings Escape/close restoration, container-height-bounded settings, transparent distance halo, safe-area dock, inline attribution on both maps.                                                                                                 | Existing camera/playback/terrain tests. Chrome rendered DEM terrain, Satellite switch, Play/Pause, camera disabled/enabled, settings and Summary transition. Network-dependent terrain fallback remains functional.              |
| S4    | `JourneySummary` and tests. Hero facts precede map, sparse details and technical disclosure, dashes for absent measurements. Hiking/trail running use moving pace; cycling retains speed. New import intentionally clears GPX/world/playback and restores speed; Replay reuses parsed data.                                     | Metric tests and native browser Summary/New import/Replay. Replay releases overview, leaving one map canvas. No calculations changed.                                                                                            |
| S5    | `ActivityAnalysis`, `lib/chartComparison` and tests. Five labeled checkboxes, distance alignment using original source coordinates, one/two physical axes, normalized 3–5 trends, constant series centered, gaps retained. Popup with real units, crosshair/markers, keyboard traversal/pinning/ESC and pointer/touch handlers. | Alignment, gaps, extrema/downsampling, flat/missing normalization, pace direction and nearest-distance tests. Chrome dual axes and all-five comparison, actual tooltip values, End/Enter/Escape; light/dark visual checks.       |
| S6    | Summary split presentation and tests. Compact real splits, partial labels and fastest complete kilometer. Optional pace bars omitted.                                                                                                                                                                                           | Tests exclude partial, nonfinite, missing and invalid pace from complete-kilometer ranking; synthetic run verified in Chrome.                                                                                                    |
| S7    | README, MASTER, copied PRD and this handoff. Original parser, movement math, camera engine, terrain calibration, map providers and persistent map-style key preserved.                                                                                                                                                          | 16 files / 121 tests; build, Knip, formatting and whitespace checks. Existing large-bundle warning remains.                                                                                                                      |

### Browser evidence

Chrome with synthetic data only: existing `alpine-terrain.gpx` (no recorded elevation/timing) and a temporary 141-point sensor run (elevation, pace, HR, temperature, gradient with a sensor gap). Data shown in the UI came from parsing these inputs; Figma values are never hardcoded. Inspected Home, terrain Journey, settings, Summary and Replay; light/dark Home and chart; 390px Home/Summary/Journey, 360px chart, 768px chart/splits, 1440px desktop, 844×390 landscape. Measured no page horizontal overflow at those widths. Short landscape Journey scrolls to the dock. Mobile settings were fully inside the map with internal scrolling available. Keyboard chart reads original units; complete metric choice can also be cleared to an empty-selection prompt.

The browser extension's automated file upload permission was unavailable. Native Chrome picker succeeded without changing extension permissions. Browser hot reloads during development reset in-memory activity; production import/replay checks were repeated after code stabilized. Screenshot evidence is in `/tmp/routale-summary.png` (synthetic data, desktop comparison).

### Release limits / deferred decisions

- Favicon concept A is still pending design review. No proposed mark was silently promoted to a production icon. Brand wordmark and metadata are implemented.
- Linked chart/map highlighting, elapsed-time chart axis, optional split bars, GSAP and Storybook are deliberately deferred as allowed by the PRD. No dependencies or plugins were added.
- Real-device touch scrubbing, screen-reader sessions, reduced-motion browser emulation and frame-rate/motion comfort were not tested in this run. Existing reduced-motion CSS and engine tests remain intact. Dense five-line comparison is necessarily more crowded on narrow screens; users can deselect metrics.
- Provider networks can fail; existing 2D fallback and tile-error states remain. Provider contracts/terms and domain/trademark clearance require release-owner review before public launch.
- Host verification used Node 26.10.0; project guidance/CI targets Node 24. Production bundle warning predates this change; no unrelated bundler refactor.
- Formatting-only normalization was applied to the supplied root PRD, its canonical docs copy and existing `knip.jsonc` so format:check can pass.

### Resume prompt

Read `docs/routale/ROUTALE_BIG_BANG_PRD_v1.md` and this checklist. Core rebrand S0–S6 is implemented; continue S7 release review with approved favicon artwork and real-device accessibility/touch/performance evidence. Preserve the single simulation controller, actual activity math and provider attribution. Do not reimplement completed slices or add deferred features without a new request.
