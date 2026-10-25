# ROUTALE — BIG BANG REBRAND PRD v1.0

**Date:** 2026-10-22  
**Status:** Implementation-ready plan pending repository audit  
**Working name:** Routale (Route + Tale)  
**Personality:** Sporty × Playful  
**Product direction:** Journey + Insight  
**Promise:** Every route has more to tell.  
**Design:** https://www.figma.com/design/5kRyJd18Wubcoupkg5rCwR  
**Handoff:** https://www.figma.com/design/5kRyJd18Wubcoupkg5rCwR?node-id=10-144

## 0. Instructions for GPT-6.1 Sol (Medium)

You are a senior frontend engineer implementing an existing React application rebrand. **Read this PRD and the repo's existing architecture before modifying code.** Implement in bounded vertical slices, one at a time. Do not propose a greenfield rewrite. Treat the existing code as authoritative about APIs, state and behavior; treat Figma as the intended visual language. Do not pretend a Figma mockup is working code. Avoid implementation speculation. If a design conflicts with current runtime behavior, preserve runtime safety and report the discrepancy.

**Operate efficiently:**

1. Read `package.json`, `src/App.tsx`, `src/index.css`, `design-system/gpx-pixel-adventure/MASTER.md`, and the relevant page/component files first; inspect only necessary dependencies/transitive imports. Do not dump the entire repository or generated outputs into context.
2. Before a slice, state at most 5 bullets: objective, files, risk, validation, outcome. Then implement without re-asking settled product decisions.
3. Edit existing components when possible. Avoid giant rewrites, speculative abstractions, dependency churn, or adding packages without a reason.
4. Run the **existing** scripts discovered in `package.json` (build, tests, format/check, knip if configured). Never assume scripts exist. Fix failures caused by your changes; distinguish pre-existing errors.
5. At the end of each slice, report changed files, decisions, tests, remaining risks, and a compact next-slice prompt. Stop at logical checkpoints so the next chat can resume with little context.
6. Never claim to have opened Figma, tested real browsers, installed GSAP, or changed code unless done and verified.
7. Changes to navigation, chart math, camera interpolation, licensing and external providers require special care; preserve user behavior and truthful attributions.

## 1. Product rationale and position

### Problem

GPX Pixel Adventure works as a route player and analytics view, but its former name, visual identity and hierarchy do not match a confident product. The initial page relies on standard upload-panel patterns; Journey's map interactions need discoverable tools; Summary is dense and duplicates data and its graphs are segregated.

### Vision

Routale turns a recorded trail into a story the user can **relive, understand and remember**. Unlike a social fitness tracker, this app begins with an existing GPX file. Unlike a one-off animation export, it makes evidence along the route explorable. Strava is a clarity benchmark, not a template or a source of copyable branding.

### Audience

Runners, hikers, cyclists, walkers and travelers who have GPX data and want a personal, browser-first, no-account playback and analysis experience. The activity type affects data emphasis only when supported by GPX data.

### Main jobs

1. Import valid GPX with clear validation and local processing.
2. Preview a 3D route; explore with camera controls before playback and when paused.
3. Relive route movement with coherent, controller-driven playback and camera motion.
4. See essential activity facts and map before optional deep data.
5. Inspect sensor/data trends at location along the route through one selectable multi-metric graph.

### Non-goals for this release

No social network, login, database, cloud sync, live tracking, new map provider contracts, custom GPS recording, automatic data enrichment, AI-generated route interpretation, video export, PNG sharing, new telemetry uploads, or major backend infrastructure. Sharing remains a future product option.

## 2. Canonical user journey

`Home / Import → Journey Preview → Journey Playing or Paused → Summary → Replay or New Import`.

- **Global Navbar** = brand mark/wordmark, beta state if retained, theme toggle; **no page navigation tabs**. Screen transitions remain app-state driven (confirm in `App.tsx`).
- **Footer** = concise brand tagline and accessible `Licenses & map credits` entry. Never make required map attribution inaccessible. Preserve provider-required inline/overlay attribution controls where necessary.
- A replay returns to Journey using the already imported activity; do not reparse the source file without reason. A new import intentionally resets the correct session state.
- No navigation that jumps ahead to unsupported states.

## 3. Art direction and design principles

**Style:** The Living Atlas, Sporty × Playful; original cartographic artwork, typographic clarity and purpose-driven motion. **Avoid:** giant rounded cards, shadows as a substitute for hierarchy, arbitrary gradients, decoration masquerading as data, gratuitous gamification, overly symmetrical layouts, and copied Strava components.

### Color foundations (proposal, verify contrast)

- Ink `#182E36`: titles, readable text and dark surfaces.
- Trail Green `#2B8C6B`: brand, route, state.
- Adventure Orange `#F28B39`: movement and highlighted performance; use sparingly.
- Twilight Violet `#7855B2`: discovery, secondary inspector emphasis.
- Lake Blue `#438BB7`: temperature/environment.
- Berry `#B65271`: heart-rate data.
- Canvas `#FAF9F4`, surface white, soft line `#D7DED7`.
  This is a functional palette inspired by triadic exploration, **not mathematically exact 120° hues**. Use WCAG-compliant contrast. Color is never the only meaning carrier; always pair with labels, patterns, or shape.

### Typography

The repo includes Kanit and `2005_iannnnnAMD`; inspect actual `src/index.css` and existing font usage before choosing. Keep body/data readable and tabular-numeric. Accent typeface can be used sparingly; do not assume Inter is final just because design exploration used it.

### SVG language

- Route stroke, active waypoint, endpoint, elevation contour, subtle terrain motifs. Existing assets: `public/assets/{cottage,landmark,pine,rock}.svg` — inspect their current visuals and licenses first.
- SVG should support a meaning or clear brand recognition and scale across resolutions. Avoid huge ambient decorative markup that slows startup.
- Favicon concept A (route mark) is preferred **but not formally finalized**. Verify 16/32/64px legibility and create production SVG/icon files only after review.

### Motion

Use CSS for trivial hover/focus where enough. GSAP can support complex opening SVG reveal and page/overlay transitions **only after verifying installation**; if needed, install `gsap @gsap/react` separately. Never let GSAP become a second independent Journey timeline. Respect `prefers-reduced-motion`; disable nonessential travel/decoration animations.

## 4. Home / Import Page

### Structure

Brand-directed editorial composition, story-forward headline, route SVG scene and one highly visible GPX drop/choose action. Layout should be breathable but not mostly blank. No technical volume label (`MAX 25 MB / 300,000 POINTS`) in default UI. Privacy copy: GPX processed locally, while map providers may receive requests for viewed geography.

### Function

- Click, keyboard and drag-and-drop GPX importing use one shared validation pipeline, not duplicated handlers.
- Preserve current validation limits internally; communicate only intelligible errors **after** invalid action. Ensure MIME checks do not reject valid GPX based solely on browser's missing/odd MIME value.
- Accessible file input, drag-over state, loading/parsing state, success, error and retry. Prevent double submission during processing.
- Success goes to Journey according to existing state transitions.
- Avoid rendering full GPX datasets onto Home unnecessarily.

### Acceptance

One import action via click or drop; clear errors for unsupported/large/broken files; keyboard access; clean focus order; responsive narrow view; no loss of file or parsed activity on successful transition.

## 5. Journey / Cinematic Playback

### Invariants

MapLibre GL JS remains map renderer; one Simulation Controller owns progress/time/speed/play/pause/restart. Camera follows confirmed rules: Free Camera before play and when paused; gesture control restricted during playback; reset/hand-off capped at 3s; math-based per-animation easing; playback/timing remains synchronized. Preserve 3D terrain/exaggeration and existing map styles when supported.

### Layout

- Thin activity identifier area: back, activity name, type, restrained distance/elevation info.
- Map dominant; overlays must not compete with route or MapLibre labels.
- Playback dock: play/pause/resume/replay; elapsed/simulated time; progress slider; speed cycle; Summary transition after completion/when available according to existing behavior.
- Current distance overlay: **transparent**, no background panel or glass; readable bold numerals + compact total and minimal accent. Test on Default, Satellite, Hybrid and dense urban backgrounds. Use a subtle text outline only if readability improves and does not deform glyphs.

### Map toolbar (from existing screenshot)

Five actions: Zoom out, Zoom in, Compass / reset bearing, Recenter, Layers/Map settings. Tooltips and accessible labels required. Align hit targets to at least 44×44 logical pixels. No new provider requirements.

### Map settings open state

Default / Satellite / Hybrid style selectors, 3D Terrain toggle, Terrain Exaggeration selector (1.5× shown as **design example**, not a forced default). Ensure actual capabilities and terms are reflected. Do not fake satellite availability where provider is not configured. Open settings should not hide active waypoint needlessly; dialog/drawer mobile alternative; ESC and focus restoration.

### Interaction policy

Camera gestures disabled during active playback; require Pause to manipulate camera. Style/layer switching during playing is permitted only if it does not reset simulation time or violate renderer state. Decide and test whether camera tools are disabled or pause-on-action, rather than silently altering playback. Map controls remain keyboard navigable and discernible.

### Acceptance

No map disappearance through summary transition; stable restart and replay; working toolbar; one source of time; camera limits preserved; settings don't introduce crashes or provider-license violations; map behavior respects mobile touch and reduced motion.

## 6. Summary / Activity narrative

### Progressive disclosure

P0: Activity identity, date/type, **Distance**, **Moving Time**, **Avg Pace** (where relevant and computable), prominent route map. P1: elevation gain, average HR, elapsed duration, temperature and appropriate sensor facts when present. P2: Explore the Data graph and Kilometer Splits. P3: full technical attributes / advanced diagnostics only when demanded.

Avoid showing identical facts repeatedly under synonyms (distance vs moving distance, moving vs elapsed time) without conceptual reason. Missing fields are omitted or shown as `—`, never fabricated. Activity type can influence emphasis, but not incorrectly rename data.

### Route map

Fit to route bounds with reasonable padding; preserve aspect ratio; support dense/looping activities. Favor static overview over duplicate map controls where possible. Preserve map attribution and correct map instance lifecycle.

## 7. Explore the Data — single selectable graph

### Metrics

Elevation (m), Pace (min/km), Heart Rate (bpm), Temperature (°C), Gradient (%). Show only metrics the dataset supports; allow up to 5 simultaneously. Selection as labeled checkboxes, not tab switching.

### X axis

Cumulative **distance (km)** by default; `Elapsed time` axis is a future or optional later slice, dependent on valid timestamps. Never mix X bases across plotted series. Handle repeated timestamps, GPS jitter and gaps carefully.

### Y axis policy

- One selected: physical unit, useful bounded domain, not forced 0 for all metrics (elevation range must remain truthful).
- Two selected with distinct units: dual Y axes only if readable, clearly mapped by labels/colors. Consider comparison mode as opt-in.
- Three or more selected: **Compare Trends** with normalized per-series values 0–100% and highly visible explanation. These percentages are not measured units or relative fitness scores. Actual data and units always appear in tooltip.
- Degenerate flat range: render a constant centered line rather than divide by zero; indicate constant metric. For pace, decide consistent faster-vs-higher meaning; an inverse display MUST be explicit and tested.
- Missing samples produce gaps; do not smooth or interpolate across gaps without explicit validated policy. Consider downsampling only for rendering, never change raw result values.
- All metrics are aligned by real distance/time coordinates; not equally spaced by arbitrary array index.

### Hover tooltip — designed state

A **floating popup** anchored to crosshair with `distance` heading, color/shape marker and all selected metric values in real units. Crosshair crosses plot at shared distance; active sample markers intersect each visible series. Position flips to stay within viewport without covering the focus. Tooltip is stable (no pointer flicker), and gives `—` where unavailable.

Example at 2.84km in Figma: Elevation 174.8m, Pace 8:31/km, HR 158bpm, Temperature 32°C, Gradient 0.4%. **All figures are illustrative and must not be hardcoded as real data.**

Interaction: hover updates; leaving hides if not pinned; click/tap may pin; ESC unpins; keyboard focus and arrow-key traversal for accessibility; mobile tap/drag scrubbing. Linked route highlight on map belongs to a later bounded slice unless data-model mapping is straightforward and low risk. Ensure chart events do not trigger rerender of the full MapLibre canvas on every mousemove.

### Accuracy checks

Unit formatting; sparse/missing sensor values; discontinuities; monotonic distance; pace interpretation and zero/near-zero speed; gradient spike control; stationary segments; min–max normalization edge cases. Compare against existing `analysis.ts`, `gpxSensors.ts`, and their tests.

## 8. Kilometer Splits

Source screenshot contains 7 rows: KM1 1km 8m33s 8:33/km; KM2 1km 8m04s 8:05/km; KM3 1km 8m47s 8:48/km; KM4 1km 8m28s 8:29/km; KM5 1km 8m30s 8:30/km; KM6 1km 8m19s 8:19/km; KM7 partial 0.48km 3m42s 7:43/km. **These are screenshot example values, not global defaults.**

Design: compact rows with `KM`, `Distance`, `Moving Time`, `Moving Pace`, optional pace profile bars. KM2 is fastest **complete** split for that example; exclude partial KM7 from fastest complete-km ranking. Avoid misleading bar direction: longer bar = faster pace, explicitly label as relative in-activity comparison; optionally omit bars entirely on compact/mobile layouts. Use actual split pipeline output, do not paste example data in production.

## 9. Shared application shell / legal

Navbar retains brand + optional Beta + theme; no Import/Journey/Summary tabs. Footer remains slim with tagline and `Licenses & map credits` dialog. Dialog should list _actually enabled_ basemap/terrain/imagery sources and their links; map attribution requirements may mandate an accessible control on map itself. Confirm OpenStreetMap, OpenMapTiles, MapTiler, Mapterhorn, EOX and applicable providers in actual code; do not automatically list unused services.

## 10. Component catalog / Storybook

Current Figma exploration has separate Button Storybook and Favicon Storybook boards. Button types: Primary / Energy / Secondary / Outline / Danger with Default / Hover / Pressed / Focus / Disabled specimens. Figma specimens do not mean React Storybook is installed. **Do not add `storybook` dependency unless explicitly scoped and justified.** First consolidate reusable `src/components/ui/button.tsx` variants and tokens; ensure semantic HTML and focus behavior. Map-control button, metric checkbox, tooltip, settings selector and odometer may become shared components only where reuse/consistency warrants it.

**Figma references**: Brand `node-id=10-2`, Home `10-32`, Journey `10-56`, Summary `10-92`, Handoff `10-144`, Button Storybook `11-2`, Favicon Storybook `11-76`. Source file key: `5kRyJd18Wubcoupkg5rCwR`.

## 11. Technical architecture and files

Reported dependencies (verify actual package lock): React 19, TypeScript 5.9, Vite 7, Tailwind 4, Zustand 5, MapLibre GL JS 6, Recharts 3, fast-xml-parser, Radix Slot, CVA, clsx, lucide-react; developer tools Vitest, Husky, lint-staged, Knip, Prettier. React Router remains listed in supplied dependencies although an earlier design iteration intended to remove its usage—**audit before changing anything**. GSAP status is **unverified**.

Relevant folders:

- `src/pages/ImportPage.tsx`, `JourneyPage.tsx`
- `src/components/{Navbar,Footer,JourneySummary,ActivityAnalysis,SummaryMap,ActivityTypeBadge,AdventureStats}.tsx`
- `src/components/ui/button.tsx`
- `src/renderer/RouteMap.tsx`, `src/hooks/useJourney.ts`
- `src/lib/{route,analysis,gpxSensors,map,mapStyles,camera,playback,simulation,motion,format}.ts`
- `src/stores/index.ts`, `src/App.tsx`, `src/index.css`
- `design-system/gpx-pixel-adventure/MASTER.md`
- `public/assets/{cottage,landmark,pine,rock}.svg`

Preserve data interfaces. Use granular Zustand selectors and derive metrics with memoization as appropriate. Never put GPU/map objects into serializable global state blindly. Avoid unnecessary per-frame React renders; throttle/persist only if profiling indicates need. Restore or update unit tests for logic changes and UI behavior checks for new states.

## 12. Migration and naming

Change visible product name to Routale; document legacy app name as `formerly GPX Pixel Adventure` in Handoff/README for discoverability. Audit `package.json`, `index.html`, metadata/title, favicon, browser tab, README, localization, share/export branding if present, color constants, accessibility labels, tests and build artifacts. Rename folders only when necessary; **do not bulk-rename identifiers/paths** unless there is a clear reason and all imports/tests are updated. Domain/social/trademark clearance must happen before public launch. Maintain copyright/attribution.

## 13. Mobile responsive constraints

Real designs and breakpoints need implementation decisions, not shrinking desktop panels. Home becomes single-column; Journey map remains dominant with safe-area-aware dock and settings sheet; Summary stacks activity/key stats, route and chart; multi-metric selector wraps/scrolls accessibly; tooltip anchors within screen and supports touch scrubbing; splits table uses concise responsive representation with all essential values retained. No horizontal page overflow at standard mobile widths (test 360/390/768/1440). Test landscape and tall devices where practical.

## 14. Accessibility, performance, quality

- 44×44 minimum tap targets for icon-only tools; descriptive `aria-label` and title/tooltip.
- Keyboard focus/ESC/restore for dialog, chart inspector and controls; reduced-motion preferences.
- Ensure WCAG AA contrast for text, keyboard operability, visible focus, color-independent chart semantics.
- Don’t animate map/JS canvas through CSS transforms or multiply independent animation clocks.
- GPX stays local; no unadvertised uploads. Explain third-party map requests.
- Avoid unbounded DOM/SVG from 300K points; use existing decimation/worker approach if present. Profiling rather than invented fps targets.
- Preserve existing tests; validate parsing, playback, camera, analysis, and responsive UI through available tools.

## 15. Delivery plan — token-efficient slices

Implement **in order**. Each slice may be a fresh medium-thinking session with this PRD + most recent checkpoint. Do not implement later slices early unless dependencies force it.

**S0 — Audit / decision reconciliation (no behavior changes)**
Read targeted files and MASTER; create `docs/routale/IMPLEMENTATION_CHECKLIST.md` with current state, dependencies, GSAP/Router actual status, maps/attribution and gaps. Note any Figma conflicts. Baseline build/tests. Deliver: exact file plan and small blockers list.

**S1 — Identity & tokens**
Update product display name, metadata/favicon placeholder, brand/color type tokens, UI button foundation and shared Navbar/Footer where safe. Scope to shell; no map or analysis refactor. Deliver: screenshot comparisons at desktop/mobile, build/tests.

**S2 — Home / Import**
Introduce editorial hero, SVG route, states and responsive layout; preserve validation and file lifecycle. Motion optional and reduced-motion safe. Deliver: import click/drop/error/loading regression tests, accessibility check.

**S3 — Journey shell & toolbar**
Implement map-first styling, compact activity header, transparent distance overlay, meaningful map-toolbar controls with tooltip/labels and settings panel. Preserve camera/timeline semantics. Deliver: toolbar/settings behavior tests + existing playback/camera tests.

**S4 — Summary information hierarchy**
Rearrange identity/hero facts/map/detail view and display missing-data states. Preserve calculations. Deliver: metric correctness and data-availability tests; responsive review.

**S5 — Explore the Data chart**
Metric selection, selected-series domain policy, normalized comparison, mixed-unit tooltip popup and input modes; handle missing/gap/flat series. Do not rewrite chart math and map behavior simultaneously. Deliver: graph data-model/unit tests, component interactions and visual review.

**S6 — Splits & last-mile UX**
Reuse real split calculations, responsive compact table with partial labeling and optional pace bars; sync route-highlight only if ready. Deliver: partial/fastest tests, device screenshots.

**S7 — Brand QA / release**
Check every screen in light/dark if both supported, keyboard, narrow widths, attribution, cross-page consistency, dead-code Knip, build/tests, and updated README/Master/Handoff. No premature provider migration. Produce changelog/migration notes and explicit unfinished items.

## 16. Definition of Done

1. Routale branding consistent; no accidental GPX Pixel Adventure product title except historic documentation.
2. Complete Import → Journey → Summary → Replay flow survives for sample GPX files.
3. Map tools, settings, camera handoff and controller single-clock invariants preserved.
4. Summary shows accurate P0 facts and conditionally shows data based on recorded samples.
5. Five-metric graph accepts multiple selections, correctly indicates units/normalization and shows actual-value hover popup; gaps and missing data are truthful.
6. Kilometer splits computed correctly, partial split distinguished and complete-split ranking not skewed.
7. No needless card-heavy UI, no broken mobile layout, accessible control semantics, reduced motion.
8. No license/attribution regressions; no false claim of third-party rights.
9. Relevant existing scripts pass or failures are documented accurately.
10. Docs handoff records changed paths, migration decisions and remaining debt.

## 17. Low-token copy-paste master prompt for each implementation slice

> You are implementing **Routale** in an existing React project. Read `docs/routale/ROUTALE_BIG_BANG_PRD_v1.md` and `design-system/gpx-pixel-adventure/MASTER.md`. Execute only **S{N}** of Section 15. Audit current code in the exact relevant files before editing. Preserve GPX parser, MapLibre, Simulation Controller, camera rules and real data math. Keep changes small and production-focused; avoid unrelated package churn. Use the existing scripts for verification. Summarize: changed files, UX decisions, tests run/results, unresolved risks and exact next-slice prompt. If PRD and source conflict, protect working behavior and report it.

**Important:** Copy the PRD into the repository at `docs/routale/ROUTALE_BIG_BANG_PRD_v1.md` before using this short prompt. No change to the user's repository has been made by creating this document.
