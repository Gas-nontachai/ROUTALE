import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  Check,
  Footprints,
  Leaf,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdventureStats, durationLabel } from '../components/AdventureStats';
import { animationAt } from '../lib/route';
import { completionPresentation } from '../lib/motion';
import { useJourney } from '../hooks/useJourney';
import { JourneySummary } from '../components/JourneySummary';
import { useGpxStore, useWorldStore, useSimulationStore } from '../stores';

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
const RouteMap = lazy(() =>
  import('../renderer/RouteMap').then(({ RouteMap }) => ({
    default: RouteMap,
  })),
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

type JourneyPageProps = { onBack: () => void };

export function JourneyPage({ onBack }: JourneyPageProps) {
  const { activity } = useGpxStore();
  const { world } = useWorldStore();
  const simulation = useSimulationStore();
  const engine = useJourney(world, true);

  const mapContainer = useRef<HTMLDivElement>(null);
  const summaryContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engine) return;
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
  }, [engine]);
  useEffect(() => {
    if (simulation.status === 'Completed')
      summaryContainer.current
        ?.querySelector<HTMLElement>('h2')
        ?.focus({ preventScroll: true });
  }, [simulation.status]);
  const progress = world
    ? Math.min(100, (simulation.elapsed / world.duration) * 100)
    : 0;
  const currentPosition = world ? animationAt(world, simulation.elapsed) : null;
  if (!world || !activity || !engine) return null;
  return (
    <div className="simulation-page">
      <div className="simulation-heading">
        <div>
          <button
            className="back-link"
            onClick={() => {
              simulation.pause();
              onBack();
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
        <div className={`status-badge ${simulation.status.toLowerCase()}`}>
          <span />
          {simulation.status === 'Transitioning' ||
          simulation.status === 'Completing'
            ? simulation.status === 'Completing'
              ? 'Finishing journey'
              : 'Camera handoff'
            : simulation.status === 'Playing' && simulation.movement === 'loop'
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
            <div className="journey-summary-layer" ref={summaryContainer}>
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
                <Sparkles size={16} /> Explore freely · press play to follow the
                route.
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
              {km(simulation.distance)} <small>/ {km(world.distance)}</small>
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
                        {simulation.status === 'Completed' ? 'ARRIVED' : 'HERE'}
                      </small>
                    )}
                  </div>
                ),
            )}
          </div>
          <p className="world-note">
            <Leaf size={14} /> GPX elevation drives activity stats. Map terrain
            is a separate visual source.
          </p>
        </aside>
      </div>
      <section className="playback-panel" aria-label="Playback controls">
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
            onChange={(e) => simulation.setSpeed(Number(e.target.value))}
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
          <progress aria-label="Route progress" value={progress} max="100" />
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
            onChange={(event) => simulation.seek(Number(event.target.value))}
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
  );
}
