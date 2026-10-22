import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  Footprints,
  Mountain,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { completionPresentation } from '../lib/motion';
import { useJourney } from '../hooks/useJourney';
import { ActivityTypeBadge } from '../components/ActivityTypeBadge';
import { Button } from '../components/ui/button';
import { JourneySummary } from '../components/JourneySummary';
import { useGpxStore, useWorldStore, useSimulationStore } from '../stores';

const RouteMap = lazy(() =>
  import('../renderer/RouteMap').then(({ RouteMap }) => ({
    default: RouteMap,
  })),
);

const km = (meters: number) => `${(meters / 1000).toFixed(2)} km`;
const time = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const mins = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`;
};

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
      <div
        role="alert"
        className="grid h-full place-items-center bg-surface-muted p-6 text-center text-sm text-muted"
      >
        Map unavailable. Playback controls are still available.
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
      const map = mapContainer.current;
      const summary = summaryContainer.current;
      const view = completionPresentation(frame.completionProgress);
      if (map) {
        map.style.opacity = String(view.opacity);
        map.style.visibility =
          view.summary && view.opacity <= 0 ? 'hidden' : 'visible';
        map.inert = view.summary;
      }
      if (summary) {
        summary.style.pointerEvents = view.summary ? 'auto' : 'none';
        summary.style.opacity = String(view.summary ? view.opacity : 0);
        summary.style.transform = `translateY(${engine.journey.reducedMotion ? 0 : (1 - view.opacity) * 12}px)`;
        summary.style.visibility = view.summary ? 'visible' : 'hidden';
        summary.inert = frame.phase !== 'Completed';
      }
    });
  }, [engine]);

  useEffect(() => {
    if (simulation.status === 'Completed') {
      summaryContainer.current
        ?.querySelector<HTMLElement>('h2')
        ?.focus({ preventScroll: true });
    }
  }, [simulation.status]);

  if (!world || !activity || !engine) return null;

  const isPlaying =
    simulation.status === 'Playing' ||
    simulation.status === 'Transitioning' ||
    simulation.status === 'Completing';
  const isCompleted = simulation.status === 'Completed';
  const isReady = simulation.status === 'Ready';
  const progress =
    world.duration > 0
      ? Math.min(100, Math.max(0, (simulation.elapsed / world.duration) * 100))
      : 0;
  const ascent = world.processed.stats.ascent;

  const handleReplay = () => {
    simulation.restart();
    simulation.begin();
  };

  const togglePlayback = () => {
    if (isCompleted) {
      handleReplay();
    } else if (isPlaying) {
      simulation.pause();
    } else {
      simulation.begin();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-canvas text-foreground lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => {
              simulation.pause();
              onBack();
            }}
            aria-label="Back to your trail"
            title="Back to your trail"
            className="shrink-0"
          >
            <ChevronLeft size={22} />
          </Button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            {/* Left: Activity name & type */}
            <div className="flex min-w-0 flex-wrap items-baseline gap-3">
              <h1 className="min-w-0 truncate text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                {activity.name}
              </h1>

              <ActivityTypeBadge type={activity.type} />
            </div>

            {/* Right: Activity stats */}
            <div className="flex shrink-0 items-center gap-5 text-sm font-medium leading-none text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Footprints size={16} />
                {km(world.processed.stats.distance ?? activity.distance)}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Mountain size={16} />
                {ascent === undefined ? '—' : `${Math.round(ascent)} m`} gain
              </span>
            </div>
          </div>
        </div>
        {isCompleted && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={togglePlayback}
            className="hidden shrink-0 sm:inline-flex"
          >
            <RotateCcw size={17} />
            {'Replay'}
          </Button>
        )}
      </header>

      {/* Fill the remaining viewport height with the map. */}
      <div className="min-h-[240px] flex-1 lg:min-h-0">
        <section
          aria-label="3D journey map"
          className="relative h-full min-h-[240px] min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted shadow-sm lg:min-h-0"
        >
          <div
            ref={mapContainer}
            className="absolute inset-0 transition-opacity duration-300"
          >
            <MapBoundary key={world.seed}>
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="grid h-full place-items-center text-sm text-muted"
                  >
                    Loading map engine…
                  </div>
                }
              >
                <RouteMap engine={engine} />
              </Suspense>
            </MapBoundary>
          </div>
          <div
            ref={summaryContainer}
            className="invisible absolute inset-0 z-20 overflow-y-auto bg-canvas opacity-0 [transition:opacity_300ms,transform_300ms] motion-reduce:[transition:none]"
            aria-label="Journey summary"
            inert
          >
            {(simulation.completion > 0 || isCompleted) && (
              <JourneySummary
                world={world}
                activity={activity}
                onReplay={handleReplay}
              />
            )}
          </div>
          {!isCompleted && (
            <div className="pointer-events-none absolute bottom-5 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-2">
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/95 px-3 py-2 text-foreground shadow-sm sm:px-4 sm:py-3">
                <Footprints size={26} className="shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted">Distance</p>
                  <strong className="text-lg font-bold leading-tight text-foreground sm:text-xl">
                    {km(simulation.distance)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      / {km(world.distance)}
                    </span>
                  </strong>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {!isCompleted && (
        <section
          aria-label="Playback controls"
          className="shrink-0 rounded-xl border border-line bg-surface p-3 text-foreground shadow-sm"
        >
          <div className="flex w-full flex-wrap items-center gap-3">
            {/* Play / Pause */}
            <Button
              variant="primary"
              size="icon"
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
              className="size-11 shrink-0"
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </Button>

            {/* Time */}
            <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
              {time(simulation.elapsed)}
              <span className="mx-1 text-muted">/</span>
              {time(world.duration)}
            </span>

            {/* Timeline */}
            <div className="order-last flex min-w-0 basis-full items-center gap-3 sm:order-none sm:flex-1 sm:basis-auto">
              <input
                type="range"
                aria-label="Seek route timeline"
                min={0}
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
                className="h-11 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              />

              <span className="w-10 shrink-0 text-right text-xs font-medium text-muted tabular-nums">
                {progress.toFixed(0)}%
              </span>
            </div>

            {/* Speed */}
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={`Playback speed ${simulation.speed}x. Click to change speed`}
              title="Change playback speed"
              onClick={() => {
                const speeds = [0.5, 1, 2, 4, 8];
                const index = speeds.indexOf(simulation.speed);
                simulation.setSpeed(speeds[(index + 1) % speeds.length]);
              }}
              className="size-11 shrink-0"
            >
              {simulation.speed}x
            </Button>

            {/* Summary */}
            <Button
              variant="outline"
              type="button"
              onClick={() => simulation.showSummary()}
              className="ml-auto shrink-0 sm:ml-0"
            >
              Summary
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
