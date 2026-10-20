# Trailbound — GPX Pixel Adventure 1.1

A client-side GPX adventure: quality-filtered movement analysis, compressed replay, opt-in OpenStreetMap and DEM data, and a height-aware isometric pixel world. No backend, account, database, cloud storage, or new runtime dependency.

## Run and check

```sh
npm install
npm run dev
npm run format
npm run format:check
npm test
npm run build
```

Import a GPX or choose **Try a sample trail**. **Try the smart demo** includes six repeated laps, a timed rest area, and an out-and-back hike. Both bundled GPX files are synthetic fixtures, not recorded activities.

Choose **Generate my world**, then play, pause, restart, or change replay speed (0.5×–8×). **Visual height** switches between flat, 1× and 2× elevation rendering and pauses playback while the terrain rebuilds. This visual scale does not change measured heights or statistics.

Deploy as a Vite static app on Vercel: build `npm run build`, output `dist`, no environment variables. This checkout has not been deployed.

## Original data, analysis and replay

- The original `File` is retained unmodified in the GPX store. Parsed, validated track segments remain separate from quality-filtered route points and the animation timeline. Invalid coordinates split segments; no gap distance or walking line is invented.
- Parsing, filtering, movement analysis, simplification and timeline generation run in a Web Worker. Input limits: 25 MB, 300,000 points, 30-second processing deadline.
- Isolated GPS spikes are filtered conservatively using distance, neighbor geometry and timestamp speed where available. Elevations use a three-point median only where all neighboring elevations exist. Missing elevations and timestamps remain unknown.
- Statistics derive from the quality-filtered activity before compression. Duration sums valid positive consecutive time intervals within each segment; incomplete or non-monotonic time is marked partial. Elevation gain/loss use only adjacent known values. The full original input is still retained.
- Rest detection: an anchored 25 m area, up to 5 m adaptive noise allowance, and at least 5 minutes of consecutive increasing timestamps. An area may include wandering; no claim of being motionless is made. Replay idles for 2 seconds, then resumes from the rest area.
- Lap detection: spatial returns plus ordered, distance-resampled shape matching, with 25 m mean / 50 m maximum matching tolerances and lap lengths within 20%. Counts are preserved; first two laps play normally, remaining laps at 12×. Return-point scoring accounts for expected lap length so a rest near the end does not absorb a lap.
- Backtracking: matching reversed movement around a turnaround is preserved at ordinary replay speed. Significant backtracking overlap prevents loop classification.
- Simplification preserves segment boundaries, movement transitions, spots, missing-elevation boundaries, geographic corners and elevation bends. Character movement follows a separate timeline. Source distance advances through compressed activity while progress reports animation time.
- Spots: Start, Finish, Rest area, lap count and **Track high point**. The track high point is not presented as a verified mountain summit. OSM landmarks are identified separately by their source.

## Real-world geography and privacy

External geographic data is **off by default**. Generating in local mode makes no map/DEM request. An unchecked, explicit option explains the data sent before enabling these requests:

- [OpenStreetMap via Private.coffee’s Overpass service](https://overpass.private.coffee/): bounding rectangle for the activity area, not the GPX file or its timestamps. One bounded query fetches roads, footpaths, buildings, forest/grass/water areas and landmarks. Map attribution: OSM contributors, ODbL.
- [Open-Meteo elevation](https://github.com/open-meteo/open-meteo/blob/main/openapi/elevation.yml): an 8 × 8 coordinate grid across that area, requesting the provider's 90 m DEM source. This is a coarse terrain preview, not a survey. Attribution: Open-Meteo / Copernicus GLO-90, CC BY 4.0. The public Open-Meteo endpoint is intended for non-commercial use; commercial deployment needs an appropriate provider plan.

Only a small, five-minute in-memory request cache is used. The application does not persist routes or responses; external providers receive the disclosed geographic area and may log requests under their own policies. Browser HTTP caching remains subject to provider headers. Interface text and world labels use the bundled `src/assets/fonts/2005_iannnnnAMD-fixed.ttf`, with system fallbacks. No font-provider requests are made.

Each provider has an independent 25-second timeout, response validation, and a clear fallback message. Data access is bounded to local areas (latitude/longitude spans at most 0.18°, not crossing the date line) to avoid unbounded public API queries. Larger routes still replay locally. Overpass way geometry and tagged landmark nodes are supported; relation-only multipolygons may be absent and are treated as incomplete map coverage.

## Terrain and artwork

The PixiJS renderer uses layered isometric terrain tiles. Visual height is `(elevation − minimum) × visual scale × exaggeration`. DEM heights are interpolated across the grid. Without DEM, known GPX elevations provide an explicitly labeled estimate around the route; with neither source, the world stays flat. Measured GPX heights drive the trail and character where available. DEM values never fill activity statistics.

Custom, reusable image assets live in `public/assets`: a detailed pixel cottage, pine, rock and landmark marker. Buildings use the designed cottage image at their real map positions; they are not colored footprint boxes or downsampled map imagery. Assets represent feature classes, not the real architecture of each building. In real-map mode trees mark mapped forest; water and buildings suppress decorative trees. In local mode the seeded forest is illustrative. The character uses a four-direction pixel walk and an idle/rest animation. No AI API or remote art assets are used.

## Verification and limits

Tests cover import validation, segmented routes, date-line projection, large straight tracks, data preservation, GPS spikes, timed rests, noisy repeated laps, direction changes, approach paths, combined rest/loop/return activity, missing data, elevation bends, geographic transforms, map classification, DEM interpolation, provider failure, caching and playback state. Browser QA uses synthetic files only.

Movement detection is heuristic: irregular loops, severe GPS drift, sparse turnarounds or elevation errors can be missed. It never claims to know real intent. Local geographic projection is intended for activity-scale routes, not transcontinental/polar trips. OSM coverage and public-provider availability vary. Some terrain/landmark placement is deliberately stylized. WebGL is required. The PixiJS production bundle triggers Vite's default 500 kB chunk advisory; it is not a build failure. Real-device 60 FPS benchmarking and commercial provider setup are not included.

Character creation, accounts, multiplayer, sharing, scrubbing and video export remain out of scope.

Latest local check: 24 tests and the production build pass. Desktop/mobile browser checks verified completion, restart, pause/resume, playback speed and visual height controls. A live Open-Meteo DEM request succeeded. Both the main Overpass service (HTTP 406) and the selected Private.coffee service (timeout) were unavailable during testing; live OSM feature rendering is therefore unverified, although classification, projected placement and provider fallbacks have automated coverage.

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
