import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  FileCheck2,
  Footprints,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Map,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trees,
  Upload,
  X,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { AdventureStats, durationLabel } from './components/AdventureStats';
import { loadGeography } from './lib/geography';
import { Forest } from './renderer/PixelWorld';
import { createWorld, type Activity, type World } from './lib/route';
import {
  useGpxStore,
  useWorldStore,
  useSimulationStore,
  useRouteStore,
} from './stores';
const demoSegments = [
  Array.from({ length: 100 }, (_, i) => ({
    lat: 18.795 + (i / 99) * 0.022,
    lon:
      98.97 +
      Math.sin((i / 99) * Math.PI * 2) * 0.006 +
      Math.sin((i / 99) * Math.PI * 6) * 0.0013,
  })),
];
const previewWorld = createWorld({
  segments: demoSegments,
  distance: 4000,
  count: 100,
  name: 'Preview',
  ascent: 140,
  seed: 82411,
});
const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
export default function App() {
  const { activity, status, error, set } = useGpxStore();
  const {
    world,
    geography,
    exaggeration,
    status: worldStatus,
    stage,
    setWorld,
    setGeography,
    setExaggeration,
    generation,
  } = useWorldStore();
  const setProcessed = useRouteStore((s) => s.setProcessed);
  const simulation = useSimulationStore();
  const [screen, setScreen] = useState<'import' | 'generating' | 'world'>(
    'import',
  );
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  const [mapConsent, setMapConsent] = useState(false);
  const [importStage, setImportStage] = useState('Reading your trail…');
  const [dragging, setDragging] = useState(false);
  const [filename, setFilename] = useState('');
  const [help, setHelp] = useState(false);
  const helpDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
  }, [help]);
  const input = useRef<HTMLInputElement>(null),
    worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  useEffect(
    () => () => {
      worker.current?.terminate();
      requestId.current++;
    },
    [],
  );
  async function importFile(file: File) {
    const id = ++requestId.current;
    worker.current?.terminate();
    set({ error: '', status: 'loading', activity: null, originalFile: file });
    setImportStage('Reading and validating GPX…');
    setFilename(file.name);
    if (!/\.gpx$/i.test(file.name)) {
      set({
        status: 'error',
        error: 'Please choose a .gpx file exported from your activity app.',
      });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      set({ status: 'error', error: 'Choose a GPX file smaller than 25 MB.' });
      return;
    }
    try {
      const xml = await file.text();
      if (id !== requestId.current) return;
      const current = new Worker(
        new URL('./lib/gpx.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = current;
      const timeout = window.setTimeout(() => {
        current.terminate();
        if (id === requestId.current)
          set({
            status: 'error',
            error:
              'Processing took too long. Please split this route into a smaller GPX file.',
          });
      }, 30000);
      current.onmessage = ({
        data,
      }: MessageEvent<{
        activity: Activity;
        world: World;
        error?: string;
        stage?: string;
      }>) => {
        if (data.stage) {
          if (id === requestId.current) setImportStage(data.stage);
          return;
        }
        window.clearTimeout(timeout);
        current.terminate();
        if (id !== requestId.current) return;
        if (data.error) set({ status: 'error', error: data.error });
        else {
          set({ activity: data.activity, status: 'ready', error: '' });
          setWorld(data.world);
          setProcessed(data.world.processed);
          simulation.restart();
        }
      };
      current.onerror = () => {
        window.clearTimeout(timeout);
        current.terminate();
        if (id === requestId.current)
          set({
            status: 'error',
            error: 'Could not process this file. Try a smaller GPX export.',
          });
      };
      current.postMessage({ xml, filename: file.name });
    } catch {
      if (id === requestId.current)
        set({
          status: 'error',
          error: 'This file could not be read. Please try again.',
        });
    }
  }
  async function loadDemo(smart = false) {
    try {
      const response = await fetch(
        smart ? '/Smart_Route.gpx' : '/Lunch_Hike.gpx',
      );
      if (!response.ok) throw new Error();
      await importFile(
        new File(
          [await response.text()],
          smart ? 'Smart_Route.gpx' : 'Lunch_Hike.gpx',
          { type: 'application/gpx+xml' },
        ),
      );
    } catch {
      set({
        status: 'error',
        error: 'The sample could not be loaded. Try importing your own GPX.',
      });
    }
  }
  const progress = world
    ? Math.min(100, (simulation.elapsed / world.duration) * 100)
    : 0;
  async function startAdventure() {
    if (!world || status !== 'ready' || worldStatus === 'loading') return;
    simulation.restart();
    if (mapConsent) {
      setScreen('generating');
      generation('loading', 'Preparing the geographic area…');
      try {
        setGeography(
          await loadGeography(world, (message) =>
            generation('loading', message),
          ),
        );
      } catch {
        setGeography({
          features: [],
          terrain: [],
          mapStatus: 'Map loading failed. Showing procedural scenery.',
          demStatus:
            'Using GPX elevation where available; otherwise flat ground.',
        });
      }
      generation('ready', 'World ready');
    } else setGeography(null);
    setScreen('world');
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Trailbound home">
          <span className="brand-icon">
            <Trees size={25} />
          </span>
          <span>
            TRAILBOUND
            <span className="brand-sub">
              A LITTLE ADVENTURE, FROM YOUR OWN.
            </span>
          </span>
        </a>
        <div className="header-right">
          <span className="edition">
            <span /> GPX PIXEL ADVENTURE
          </span>
          <button className="text-button" onClick={() => setHelp(true)}>
            How it works <span>↗</span>
          </button>
        </div>
      </header>
      <main>
        {screen === 'import' ? (
          <>
            <div className="page-heading">
              <div className="eyebrow">
                <span /> REAL TRAILS. LITTLE WORLDS.
              </div>
              <h1>
                Your journey.
                <br />A whole new <em>world.</em>
              </h1>
              <p>
                Turn the trail you took into a pixel adventure.
                <br className="desktop-break" /> Bring a GPX file. We’ll bring
                the forest.
              </p>
            </div>
            <div className="adventure-layout">
              <section className="import-panel" aria-labelledby="import-title">
                <div className="panel-top">
                  <span className="step-number">01</span>
                  <span>EVERY ADVENTURE STARTS SOMEWHERE</span>
                </div>
                <h2 id="import-title">Bring your trail.</h2>
                <p className="muted">
                  A morning run, a mountain hike, a walk to remember.
                </p>
                <div
                  className={`dropzone ${dragging ? 'dragging' : ''} ${status === 'ready' ? 'has-file' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void importFile(file);
                  }}
                >
                  <div className="upload-icon">
                    {status === 'loading' ? (
                      <LoaderCircle className="spin" size={29} />
                    ) : status === 'ready' ? (
                      <FileCheck2 size={29} />
                    ) : (
                      <Upload size={29} />
                    )}
                  </div>
                  <strong>
                    {status === 'loading'
                      ? importStage
                      : status === 'ready'
                        ? 'Your trail is packed.'
                        : 'Drop your GPX file here'}
                  </strong>
                  <span className="drop-detail">
                    {status === 'ready'
                      ? filename
                      : 'or choose one from your device'}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => input.current?.click()}
                    disabled={status === 'loading'}
                  >
                    <Upload size={15} />
                    {status === 'ready'
                      ? 'Choose another file'
                      : 'Choose GPX file'}
                  </Button>
                  <input
                    ref={input}
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Choose GPX file"
                    type="file"
                    accept=".gpx,application/gpx+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importFile(file);
                      e.target.value = '';
                    }}
                  />
                  <small>.GPX FILES · UP TO 25 MB</small>
                </div>
                <div aria-live="polite">
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                  {activity && status === 'ready' && (
                    <div className="activity-summary">
                      <div>
                        <Check size={16} />
                        <strong>{activity.name}</strong>
                      </div>
                      <p>
                        {activity.count.toLocaleString()} GPS points{' '}
                        <span>·</span>{' '}
                        {km(
                          world?.processed.stats.distance ?? activity.distance,
                        )}{' '}
                        <span>·</span> {activity.segments.length} segment
                        {activity.segments.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
                <label className="map-consent">
                  <input
                    type="checkbox"
                    checked={mapConsent}
                    onChange={(e) => setMapConsent(e.target.checked)}
                  />
                  <span>
                    <strong>Use real map + terrain data</strong>
                    <small>
                      Optional: sends this trail’s geographic bounds to
                      OpenStreetMap via Private.coffee’s Overpass service and a
                      64-point area grid to Open-Meteo. Your GPX file stays
                      here. Leave off for local-only scenery.
                    </small>
                  </span>
                </label>
                <Button
                  className="generate-button"
                  disabled={status !== 'ready'}
                  onClick={startAdventure}
                >
                  <Sparkles size={17} /> Generate my world{' '}
                  <ArrowRight size={18} />
                </Button>
                <div className="sample-line">
                  Just looking around?{' '}
                  <button
                    onClick={() => void loadDemo()}
                    disabled={status === 'loading'}
                  >
                    Try a sample trail <ArrowRight size={13} />
                  </button>
                </div>
                <button
                  className="smart-demo-link"
                  onClick={() => void loadDemo(true)}
                  disabled={status === 'loading'}
                >
                  Try the smart demo: 6 laps + a rest + a return hike ↗
                </button>
                <div className="privacy">
                  <LockKeyhole size={14} />
                  <span>
                    Your GPX stays in your browser. External data is optional.
                  </span>
                </div>
              </section>
              <section
                className="preview-panel"
                aria-label="Pixel world preview"
              >
                <div className="preview-title">
                  <span>
                    <span className="live-dot" /> A LITTLE PREVIEW OF WHAT’S
                    AHEAD
                  </span>
                  <span>FOREST / 01</span>
                </div>
                <div className="preview-scene">
                  <Forest world={previewWorld} preview />
                  <div className="scene-grain" />
                  <div className="world-tag">
                    <Trees size={15} /> THE MOSSWOOD FOREST
                  </div>
                  <div className="floating-label">
                    <span className="pixel-spark">✦</span> A trail worth
                    reliving.
                  </div>
                  <div className="scene-coordinates">
                    18°47′ N &nbsp; 98°58′ E
                  </div>
                </div>
                <div className="preview-caption">
                  <span className="caption-icon">
                    <Footprints size={21} />
                  </span>
                  <div>
                    <strong>Same footsteps. Different magic.</strong>
                    <p>Your real route, reimagined in a living pixel forest.</p>
                  </div>
                  <span className="little-star">✧</span>
                </div>
              </section>
            </div>
            <div className="how-strip">
              <div>
                <span className="feature-icon">
                  <Map size={20} />
                </span>
                <div>
                  <strong>Your route, reimagined</strong>
                  <p>Built from your actual GPS coordinates.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Trees size={21} />
                </span>
                <div>
                  <strong>A forest of your own</strong>
                  <p>A unique world, grown around your trail.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Play size={19} />
                </span>
                <div>
                  <strong>Walk it all over again</strong>
                  <p>Press play. Let your little adventurer wander.</p>
                </div>
              </div>
            </div>
          </>
        ) : screen === 'generating' ? (
          <section className="generation-screen" aria-live="polite">
            <Trees size={44} />
            <div className="eyebrow">BUILDING YOUR LITTLE WORLD</div>
            <h1>Growing a real adventure.</h1>
            <p>{stage}</p>
            <progress aria-label="Loading geographic data" />
            <ol>
              <li>
                <Check size={16} /> GPX validated; original preserved
              </li>
              <li>
                <Check size={16} /> Movement analyzed; animation route prepared
              </li>
              <li>
                <LoaderCircle size={16} className="spin" /> Map features + DEM
                grid loading
              </li>
              <li>
                <Trees size={16} /> Terrain and sprites render next
              </li>
            </ol>
            <small>
              Providers may take up to 25 seconds. Unavailable data falls back
              to local scenery.
            </small>
          </section>
        ) : (
          world &&
          activity && (
            <div className="simulation-page">
              <div className="simulation-heading">
                <div>
                  <button
                    className="back-link"
                    onClick={() => {
                      simulation.setStatus(
                        simulation.status === 'Playing'
                          ? 'Paused'
                          : simulation.status,
                      );
                      setScreen('import');
                    }}
                  >
                    <ArrowLeft size={14} /> Back to your trail
                  </button>
                  <h1>{activity.name}</h1>
                  <p>
                    {km(world?.processed.stats.distance ?? activity.distance)}{' '}
                    <span>·</span> {activity.count.toLocaleString()} GPS points{' '}
                    <span>·</span> Forest adventure
                  </p>
                </div>
                <div
                  className={`status-badge ${simulation.status.toLowerCase()}`}
                >
                  <span />
                  {simulation.status === 'Playing' &&
                  simulation.movement === 'stay'
                    ? 'Resting'
                    : simulation.status === 'Playing' &&
                        simulation.movement === 'loop'
                      ? 'Fast laps'
                      : simulation.status}
                </div>
              </div>
              <div className="geography-banner">
                <span>
                  {geography
                    ? geography.mapStatus
                    : 'Local mode · procedural scenery. No route location was sent to map providers.'}
                </span>
                <span>
                  {geography
                    ? geography.demStatus
                    : world.processed.stats.minElevation === undefined
                      ? 'No GPX elevation · flat terrain fallback.'
                      : 'GPX-derived terrain estimate · surrounding terrain is illustrative.'}
                </span>
                <div>
                  <label htmlFor="terrain-height">Visual height</label>
                  <select
                    id="terrain-height"
                    value={exaggeration}
                    onChange={(e) => {
                      if (simulation.status === 'Playing')
                        simulation.setStatus('Paused');
                      setExaggeration(Number(e.target.value));
                    }}
                  >
                    <option value="0">Flat</option>
                    <option value="1">1×</option>
                    <option value="2">2×</option>
                  </select>
                </div>
              </div>
              <div className="simulation-layout">
                <section className="world-panel">
                  <div className="world-toolbar">
                    <span>
                      <Trees size={15} />{' '}
                      {geography?.features.length
                        ? 'REAL-WORLD PIXEL MAP'
                        : 'PIXEL TERRAIN'}
                    </span>
                    <span>
                      <Compass size={14} /> N ↗
                    </span>
                  </div>
                  <div className="simulation-canvas">
                    <Forest
                      world={world}
                      geography={geography}
                      exaggeration={exaggeration}
                    />
                    <div className="camera-label">
                      <span /> FOLLOW CAMERA
                    </div>
                    {simulation.status === 'Ready' && (
                      <div className="ready-note">
                        <Sparkles size={16} /> Your next little adventure is
                        ready.
                      </div>
                    )}
                    {simulation.status === 'Completed' && (
                      <div className="completed-note">
                        <span>✦</span>
                        <h2>Trail conquered.</h2>
                        <p>Every step, a little bit of magic.</p>
                        <Button onClick={simulation.restart}>
                          <RotateCcw size={15} /> Walk it again
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="journey-panel">
                  <div className="eyebrow">YOUR ADVENTURE</div>
                  <h2>One step at a time.</h2>
                  <div className="mini-map">
                    <svg
                      viewBox={`0 0 ${world.width} ${world.height}`}
                      aria-label="Overview of your full route"
                      role="img"
                    >
                      {world.segments.map((s, i) => (
                        <polyline
                          key={i}
                          points={s.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#b6c88d"
                          strokeWidth="17"
                          strokeLinejoin="round"
                        />
                      ))}
                      {world.spots.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={
                            p.type === 'start' || p.type === 'finish' ? 25 : 16
                          }
                          fill={
                            p.distance <= simulation.distance
                              ? '#ecc576'
                              : '#6b8556'
                          }
                        />
                      ))}
                    </svg>
                    <span>YOUR TRAIL MAP</span>
                  </div>
                  <div className="journey-stat">
                    <span>
                      <Footprints size={16} /> Distance traveled
                    </span>
                    <strong>
                      {km(simulation.distance)}{' '}
                      <small>/ {km(world.distance)}</small>
                    </strong>
                  </div>
                  <div className="journey-stat">
                    <span>
                      <Mountain size={16} /> Elevation gain
                    </span>
                    <strong>
                      {world.processed.stats.ascent === undefined
                        ? '—'
                        : Math.round(world.processed.stats.ascent)}{' '}
                      <small>m</small>
                    </strong>
                  </div>
                  <div className="waypoint-list">
                    {world.spots.map((p, i) => (
                      <div
                        key={i}
                        className={
                          p.distance <= simulation.distance ? 'reached' : ''
                        }
                      >
                        <span>
                          {p.distance <= simulation.distance ? (
                            <Check size={11} />
                          ) : p.type === 'finish' ? (
                            '⚑'
                          ) : p.type === 'rest' ? (
                            'z'
                          ) : p.type === 'loop' ? (
                            '↻'
                          ) : (
                            '▲'
                          )}
                        </span>
                        <span>
                          {p.label}
                          {p.duration !== undefined && (
                            <small> · {durationLabel(p.duration)}</small>
                          )}
                        </span>
                        {i === simulation.waypoint && (
                          <small>
                            {simulation.status === 'Completed'
                              ? 'ARRIVED'
                              : 'HERE'}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="world-note">
                    <Leaf size={14} />{' '}
                    {geography?.features.length
                      ? 'Real map positions; stylized assets. Unmapped areas remain illustrative.'
                      : 'Procedural scenery, not a real map.'}
                  </p>
                </aside>
              </div>
              <section
                className="playback-panel"
                aria-label="Playback controls"
              >
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Restart adventure"
                  title="Restart adventure"
                  onClick={simulation.restart}
                >
                  <RotateCcw size={18} />
                </Button>
                <Button
                  className="play-button"
                  disabled={simulation.status === 'Completed'}
                  onClick={() =>
                    simulation.setStatus(
                      simulation.status === 'Playing' ? 'Paused' : 'Playing',
                    )
                  }
                >
                  {simulation.status === 'Playing' ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}{' '}
                  {simulation.status === 'Playing'
                    ? 'Pause'
                    : simulation.status === 'Paused'
                      ? 'Resume'
                      : 'Play'}
                </Button>
                <label className="speed-control">
                  Speed
                  <select
                    aria-label="Playback speed"
                    value={simulation.speed}
                    onChange={(e) =>
                      simulation.setSpeed(Number(e.target.value))
                    }
                  >
                    {[0.5, 1, 2, 4, 8].map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                </label>
                <div className="progress-area">
                  <div>
                    <span>
                      {simulation.status === 'Completed'
                        ? 'You made it. Welcome to the finish.'
                        : simulation.movement === 'stay'
                          ? 'Resting briefly · recorded rest time is preserved.'
                          : simulation.movement === 'loop'
                            ? 'Repeated laps · compressed playback.'
                            : simulation.movement === 'backtracking'
                              ? 'Following the return trail.'
                              : 'A little closer to the finish.'}
                    </span>
                    <strong>{progress.toFixed(0)}%</strong>
                  </div>
                  <progress
                    aria-label="Route progress"
                    value={progress}
                    max="100"
                  />
                </div>
                <div className="playback-end">
                  <span>⚑</span>
                  <small>
                    THE FINISH
                    <br />
                    <strong>{km(world.distance)}</strong>
                  </small>
                </div>
              </section>
              <AdventureStats
                world={world}
                geography={geography}
                distance={simulation.distance}
              />
              {geography && (
                <p className="attribution">
                  Map data ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap contributors · ODbL
                  </a>
                  . Elevation:{' '}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo · Copernicus GLO-90 · CC BY 4.0
                  </a>
                  . Pixel sprites are original Trailbound artwork.
                </p>
              )}
            </div>
          )
        )}
      </main>
      <footer>
        <span>
          <Trees size={14} /> MADE FOR THE WANDERERS.
        </span>
        <span>
          A little less scrolling. A little more exploring. <Leaf size={13} />
        </span>
        <span>
          FRONTEND ONLY <span className="footer-dot">◆</span> MVP 1.1
        </span>
      </footer>
      {help && (
        <dialog
          ref={helpDialog}
          className="modal-backdrop"
          aria-labelledby="help-title"
          onClose={() => setHelp(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelp(false);
          }}
        >
          <section className="help-dialog">
            <Button
              autoFocus
              variant="ghost"
              size="icon"
              className="close-dialog"
              onClick={() => setHelp(false)}
              aria-label="Close instructions"
            >
              <X size={20} />
            </Button>
            <div className="eyebrow">YOUR NEXT LITTLE ADVENTURE</div>
            <h2 id="help-title">From trail to tiny world.</h2>
            <p>Export a GPX file from your activity app, then:</p>
            <ol>
              <li>
                <Upload size={18} />
                <span>
                  <strong>Bring your trail</strong>Choose or drop a GPX file.
                  The original remains in this browser.
                </span>
              </li>
              <li>
                <Trees size={18} />
                <span>
                  <strong>Grow your world</strong>Keep local scenery, or opt in
                  to map bounds and DEM grid requests. Real features use
                  OpenStreetMap; missing data uses a labeled fallback.
                </span>
              </li>
              <li>
                <Play size={18} />
                <span>
                  <strong>Relive the journey</strong>Play, pause, restart, or
                  change speed. Rest areas pause briefly; after two laps,
                  repeated loops speed up. Real activity statistics stay intact.
                </span>
              </li>
            </ol>
            <a className="sample-download" href="/Lunch_Hike.gpx" download>
              <ArrowDownToLine size={15} /> Download sample GPX{' '}
              <ChevronRight size={14} />
            </a>
          </section>
        </dialog>
      )}
    </div>
  );
}
