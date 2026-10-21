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
  Footprints,
  Mountain,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { completionPresentation } from '../lib/motion';
import { useJourney } from '../hooks/useJourney';
import { ActivityTypeBadge } from '../components/ActivityTypeBadge';
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

const control =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700';

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
        className="grid h-full place-items-center bg-stone-100 p-6 text-center text-sm text-stone-600"
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto !bg-[#F7F8F3] !text-[#20372F] lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              simulation.pause();
              onBack();
            }}
            aria-label="Back to your trail"
            title="Back to your trail"
            className="grid size-9 shrink-0 place-items-center rounded-lg !text-[#244638] transition hover:!bg-[#E6EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#367047]"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Activity name & type */}
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="min-w-0 truncate text-xl font-extrabold tracking-tight !text-[#19392C] sm:text-2xl">
                {activity.name}
              </h1>
              <ActivityTypeBadge type={activity.type} />
            </div>

            {/* Activity stats */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs !text-[#52665C]">
              <span className="inline-flex items-center gap-1">
                <Footprints size={14} />
                {km(world.processed.stats.distance ?? activity.distance)}
              </span>

              <span className="inline-flex items-center gap-1">
                <Mountain size={14} />
                {ascent === undefined ? '—' : `${Math.round(ascent)} m`} gain
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg !bg-[#356B42] px-5 text-sm font-semibold !text-white shadow-sm transition hover:!bg-[#285637] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        >
          {isCompleted ? (
            <RotateCcw size={17} />
          ) : isPlaying ? (
            <Pause size={17} />
          ) : (
            <Play size={17} fill="currentColor" />
          )}

          {isCompleted
            ? 'Replay Simulation'
            : isPlaying
              ? 'Pause'
              : isReady
                ? 'Start Simulation'
                : 'Resume Simulation'}
        </button>
      </header>

      {/* Fill the remaining viewport height with the map. */}
      <div className="min-h-[360px] shrink-0 sm:min-h-[420px] lg:min-h-0 lg:flex-1">
        <section
          aria-label="3D journey map"
          className="relative h-full min-h-[360px] min-w-0 overflow-hidden rounded-xl border border-[#DBE4D9] bg-[#E9EEE7] shadow-sm lg:min-h-0"
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
                    className="grid h-full place-items-center text-sm text-stone-600"
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
            className="invisible absolute inset-0 z-20 overflow-y-auto bg-[#F7F8F3] opacity-0"
            aria-label="Journey summary"
            inert
          >
            <JourneySummary world={world} />
          </div>
          {!isCompleted && (
            <div className="pointer-events-none absolute bottom-5 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-2">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 sm:px-4 sm:py-3">
                <Footprints size={22} className="shrink-0 !text-[#356B42]" />
                <div>
                  <p className="text-[11px] font-medium !text-[#65776C]">
                    Distance
                  </p>
                  <strong className="text-lg font-bold leading-tight !text-[#19392C] sm:text-xl">
                    {km(simulation.distance)}
                    <span className="ml-1 text-xs font-normal !text-[#65776C]">
                      / {km(world.distance)}
                    </span>
                  </strong>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Playback controls: do not show while the Summary View is active. */}
      {!isCompleted && (
        <section
          aria-label="Playback controls"
          className="shrink-0 rounded-xl border border-[#DEE6DB] bg-white p-3 text-[#233B31] shadow-sm sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlayback}
              disabled={isCompleted}
              aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-[#356B42] text-white transition-colors hover:bg-[#285637] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B42] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? (
                <Pause size={21} />
              ) : (
                <Play size={21} fill="currentColor" />
              )}
            </button>

            {/* Time */}
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {time(simulation.elapsed)} / {time(world.duration)}
            </span>

            {/* Speed toggle */}
            <button
              type="button"
              aria-label={`Playback speed ${simulation.speed}x. Click to change speed`}
              title="Change playback speed"
              onClick={() => {
                const speeds = [0.5, 1, 2, 4, 8];
                const currentIndex = speeds.indexOf(simulation.speed);
                const nextSpeed = speeds[(currentIndex + 1) % speeds.length];

                simulation.setSpeed(nextSpeed);
              }}
              className="inline-flex h-9 min-w-14 shrink-0 items-center justify-center rounded-lg border border-[#D5E4D8] bg-[#F0F7F1] px-3 text-xs font-bold text-[#356B42] tabular-nums transition-colors hover:bg-[#E2EFE4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B42] active:bg-[#D5E7D8]"
            >
              {simulation.speed}x
            </button>

            {/* Timeline + Progress */}
            <div className="order-last flex w-full min-w-0 items-center gap-3 sm:order-none sm:w-auto sm:flex-1">
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
                className="h-2 w-full min-w-0 flex-1 cursor-pointer accent-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                {progress.toFixed(0)}%
              </span>
            </div>

            {/* Actions */}
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
              <button
                type="button"
                aria-label="Restart adventure"
                title="Restart adventure"
                onClick={() => simulation.restart()}
                className={control}
              >
                <RotateCcw size={17} />
              </button>

              <button
                type="button"
                onClick={() => simulation.showSummary()}
                disabled={isCompleted}
                className={control}
              >
                Summary
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
