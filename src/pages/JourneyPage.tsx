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
  ChartNoAxesCombined,
  ChevronLeft,
  Footprints,
  Mountain,
  Pause,
  Play,
} from 'lucide-react';
import { completionPresentation } from '../lib/motion';
import { useJourney } from '../hooks/useJourney';
import { ActivityTypeBadge } from '../components/ActivityTypeBadge';
import { Button } from '../components/ui/button';
import { JourneySummary } from '../components/JourneySummary';
import { PreviewRatioPicker } from '../components/PreviewRatioPicker';
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
        Map unavailable. Playback still works.
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
  const headerContainer = useRef<HTMLElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const summaryContainer = useRef<HTMLDivElement>(null);
  const [previewRatio, setPreviewRatio] = useState('16:9');

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe((frame) => {
      const map = mapContainer.current;
      const header = headerContainer.current;
      const summary = summaryContainer.current;
      const view = completionPresentation(frame.completionProgress);
      if (header) header.style.display = view.summary ? 'none' : '';
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
  const ascent = world.processed.stats.ascent;
  const progress =
    world.duration > 0
      ? Math.min(100, Math.max(0, (simulation.elapsed / world.duration) * 100))
      : 0;
  const handleImport = () => {
    simulation.restart();
    simulation.setSpeed(1);
    useGpxStore
      .getState()
      .set({ activity: null, originalFile: null, status: 'idle', error: '' });
    useWorldStore.setState({
      world: null,
      geography: null,
      status: 'idle',
      stage: '',
    });
    onBack();
  };
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
      <header
        ref={headerContainer}
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 py-1"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={handleImport}
            aria-label="Import GPX"
            title="Import GPX"
            className="shrink-0"
          >
            <ChevronLeft size={22} />
          </Button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-3">
              <h1 className="min-w-0 truncate text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                {activity.name}
              </h1>
              <ActivityTypeBadge type={activity.type} />
            </div>

            <div className="flex shrink-0 items-center gap-5 text-sm font-medium leading-none text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Footprints size={16} />
                {km(world.processed.stats.distance ?? activity.distance)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mountain size={16} aria-label="Elevation gain" role="img" />
                {ascent === undefined ? '—' : `${Math.round(ascent)} m`}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div
        className="relative flex min-h-[240px] flex-1 items-center justify-center lg:min-h-0"
        style={{ containerType: 'size' }}
      >
        <section
          aria-label="3D journey map"
          className="relative min-w-0 overflow-hidden rounded-sm border border-line bg-surface-muted"
          style={{
            aspectRatio: previewRatio.replace(':', ' / '),
            width: `min(100cqw, calc(100cqh * ${previewRatio.replace(':', ' / ')}))`,
          }}
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
                    Loading map…
                  </div>
                }
              >
                <RouteMap engine={engine} />
              </Suspense>
            </MapBoundary>
          </div>
          {!isCompleted && (
            <div className="pointer-events-none absolute bottom-5 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-2">
              <div className="distance-overlay px-3 py-2 sm:px-4">
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Distance
                </p>
                <strong className="mt-1 block text-4xl font-bold leading-tight tabular-nums sm:text-5xl">
                  {(simulation.distance / 1000).toFixed(2)}
                  <span className="ml-2 text-lg">km</span>
                  <span className="ml-3 text-xs font-medium">
                    / {km(world.distance)}
                  </span>
                </strong>
                <div className="mt-3 h-1 w-12 bg-energy" />
              </div>
            </div>
          )}
        </section>
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
              onImport={handleImport}
            />
          )}
        </div>
      </div>

      {!isCompleted && (
        <section
          aria-label="Playback controls"
          className="shrink-0 rounded-sm border border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground"
        >
          <div className="flex w-full flex-wrap items-center gap-3">
            {/* Play / Pause */}
            <Button
              variant="primary"
              size="icon"
              type="button"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
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
              aria-label={`Playback speed: ${simulation.speed}×`}
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

            <PreviewRatioPicker
              value={previewRatio}
              onChange={setPreviewRatio}
            />

            {/* Summary */}
            <Button
              variant="outline"
              type="button"
              size="icon"
              onClick={() => simulation.showSummary()}
              className="ml-auto shrink-0 sm:ml-0"
              aria-label="Summary"
              title="Summary"
            >
              <ChartNoAxesCombined size={20} aria-hidden="true" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
