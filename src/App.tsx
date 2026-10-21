import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
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
import { animationAt, type Activity, type World } from './lib/route';
import { completionPresentation } from './lib/motion';
import { useJourney } from './hooks/useJourney';
import { JourneySummary } from './components/JourneySummary';
import { useGpxStore, useWorldStore, useSimulationStore } from './stores';
const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
const RouteMap = lazy(() =>
  import('./renderer/RouteMap').then(({ RouteMap }) => ({ default: RouteMap })),
);
class MapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="map-loading" role="alert">
        Map unavailable. Playback controls and your journey summary are still
        available.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const { activity, status, error, set } = useGpxStore();
  const { world, setWorld } = useWorldStore();
  const simulation = useSimulationStore();
  const [screen, setScreen] = useState<'import' | 'world'>('import');
  const engine = useJourney(world, screen === 'world');
  const mapContainer = useRef<HTMLDivElement>(null);
  const summaryContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engine || screen !== 'world') return;
    return engine.subscribe((frame) => {
      const map = mapContainer.current,
        summary = summaryContainer.current;
      const view = completionPresentation(frame.completionProgress);
      map?.parentElement?.classList.toggle('show-summary', view.summary);
      if (map) {
        map.style.opacity = String(view.opacity);
        map.inert = view.summary;
      }
      if (summary) {
        summary.style.opacity = String(view.summary ? view.opacity : 0);
        summary.style.transform = `translateY(${engine.journey.reducedMotion ? 0 : (1 - view.opacity) * 12}px)`;
        summary.style.visibility = view.summary ? 'visible' : 'hidden';
        summary.inert = frame.phase !== 'Completed';
      }
    });
  }, [engine, screen]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (simulation.status === 'Completed')
      summaryContainer.current
        ?.querySelector<HTMLElement>('h2')
        ?.focus({ preventScroll: true });
  }, [simulation.status]);
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
          simulation.restart();
          setScreen('world');
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
  const currentPosition = world ? animationAt(world, simulation.elapsed) : null;
  function startAdventure() {
    if (!world || status !== 'ready') return;
    simulation.restart();
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
            <span /> REAL-WORLD GPX SIMULATION
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
                <span /> REAL TRAILS. REAL TERRAIN.
              </div>
              <h1>
                Your journey.
                <br />
                On the <em>map.</em>
              </h1>
              <p>
                Bring your GPX route to a real-world map.
                <br className="desktop-break" /> Follow every turn, climb, and
                kilometer.
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
                        ? 'GPX ready.'
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
                <Button
                  className="generate-button"
                  disabled={status !== 'ready'}
                  onClick={startAdventure}
                >
                  <Map size={17} /> Preview route on map{' '}
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
                  Try the smart demo: 6 laps + a return hike ↗
                </button>
                <div className="privacy">
                  <LockKeyhole size={14} />
                  <span>
                    GPX stays local. Map providers receive requests for the area
                    you view.
                  </span>
                </div>
              </section>
            </div>
            <div className="how-strip">
              <div>
                <span className="feature-icon">
                  <Map size={20} />
                </span>
                <div>
                  <strong>Your route, mapped</strong>
                  <p>Every segment stays true to the GPX.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Trees size={21} />
                </span>
                <div>
                  <strong>Real terrain</strong>
                  <p>Mapterhorn elevation on OpenFreeMap.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Play size={19} />
                </span>
                <div>
                  <strong>Follow the journey</strong>
                  <p>Watch the route progress with a steady camera.</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          world &&
          activity &&
          engine && (
            <div className="simulation-page">
              <div className="simulation-heading">
                <div>
                  <button
                    className="back-link"
                    onClick={() => {
                      simulation.pause();
                      setScreen('import');
                    }}
                  >
                    <ArrowLeft size={14} /> Back to your trail
                  </button>
                  <h1>{activity.name}</h1>
                  <p>
                    {km(world?.processed.stats.distance ?? activity.distance)}{' '}
                    <span>·</span> {activity.count.toLocaleString()} GPS points{' '}
                    <span>·</span> 3D route simulation
                  </p>
                </div>
                <div
                  className={`status-badge ${simulation.status.toLowerCase()}`}
                >
                  <span />
                  {simulation.status === 'Transitioning' ||
                  simulation.status === 'Completing'
                    ? simulation.status === 'Completing'
                      ? 'Finishing journey'
                      : 'Camera handoff'
                    : simulation.status === 'Playing' &&
                        simulation.movement === 'loop'
                      ? 'Fast laps'
                      : simulation.status}
                </div>
              </div>
              <div className="simulation-layout">
                <section className="world-panel">
                  <div className="simulation-canvas">
                    <div className="journey-map-layer" ref={mapContainer}>
                      <MapBoundary key={world.seed}>
                        <Suspense
                          fallback={
                            <div className="map-loading" role="status">
                              Loading map engine…
                            </div>
                          }
                        >
                          <RouteMap engine={engine} />
                        </Suspense>
                      </MapBoundary>
                    </div>
                    <div
                      className="journey-summary-layer"
                      ref={summaryContainer}
                    >
                      <JourneySummary
                        world={world}
                        name={activity.name}
                        activityType={activity.type}
                        replay={() => {
                          simulation.restart();
                          simulation.begin();
                        }}
                      />
                    </div>
                    {simulation.status === 'Ready' && (
                      <div className="ready-note">
                        <Sparkles size={16} /> Explore freely · press play to
                        follow the route.
                      </div>
                    )}
                  </div>
                </section>
                <aside className="journey-panel">
                  <div className="eyebrow">YOUR ADVENTURE</div>
                  <h2>On the trail.</h2>
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
                  <div className="journey-stat">
                    <span>
                      <Mountain size={16} /> Current elevation
                    </span>
                    <strong>
                      {currentPosition?.elevation === undefined
                        ? '—'
                        : `${Math.round(currentPosition.elevation)} m`}
                    </strong>
                  </div>
                  <div className="waypoint-list">
                    {world.spots.map(
                      (p, i) =>
                        p.type !== 'rest' && (
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
                        ),
                    )}
                  </div>
                  <p className="world-note">
                    <Leaf size={14} /> GPX elevation drives activity stats. Map
                    terrain is a separate visual source.
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
                    simulation.status === 'Playing' ||
                    simulation.status === 'Transitioning' ||
                    simulation.status === 'Completing'
                      ? simulation.pause()
                      : simulation.begin()
                  }
                >
                  {simulation.status === 'Playing' ||
                  simulation.status === 'Transitioning' ||
                  simulation.status === 'Completing' ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}{' '}
                  {simulation.status === 'Playing' ||
                  simulation.status === 'Transitioning' ||
                  simulation.status === 'Completing'
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
                  <input
                    className="timeline-scrubber"
                    type="range"
                    aria-label="Seek route timeline"
                    min="0"
                    max={world.duration}
                    step={Math.max(0.01, world.duration / 1000)}
                    value={Math.min(world.duration, simulation.elapsed)}
                    disabled={
                      simulation.status === 'Transitioning' ||
                      simulation.status === 'Completing'
                    }
                    onChange={(event) =>
                      simulation.seek(Number(event.target.value))
                    }
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
              <div className="summary-actions">
                <Button
                  variant="outline"
                  onClick={simulation.showSummary}
                  disabled={simulation.status === 'Completed'}
                >
                  {simulation.status === 'Completing'
                    ? 'Skip transition'
                    : 'View journey summary'}
                </Button>
              </div>
              <AdventureStats world={world} distance={simulation.distance} />
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
          FRONTEND ONLY <span className="footer-dot">◆</span> 3D JOURNEY 1.3
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
            <div className="eyebrow">YOUR ROUTE, ON THE MAP</div>
            <h2 id="help-title">From GPX to real terrain.</h2>
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
                  <strong>Preview the route</strong>Map tiles receive requests
                  for the area shown. GPX processing and activity statistics
                  stay in this browser.
                </span>
              </li>
              <li>
                <Play size={18} />
                <span>
                  <strong>Follow the journey</strong>Play, pause, seek, restart,
                  or change speed. Route gaps and GPX-derived statistics stay
                  intact.
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
