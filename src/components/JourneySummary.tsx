import { durationLabel } from './AdventureStats';
import { SummaryMap } from './SummaryMap';
import type { Activity, World } from '../lib/route';
import { activityKind, timestamp } from '../lib/analysis';
import { metricLabel, paceLabel } from '../lib/format';
import { ActivityAnalysis } from './ActivityAnalysis';
import { ActivityTypeBadge } from './ActivityTypeBadge';
import { Button } from './ui/button';

type Metric = [string, string];
export function summaryMetrics(world: World, type?: string) {
  const { stats } = world.processed;
  const kind = activityKind(type);
  const pace: Metric = ['Avg. Moving Pace', paceLabel(stats.averageMovingPace)];
  const speed: Metric = [
    'Avg. Moving Speed',
    metricLabel(
      stats.averageMovingSpeed === undefined
        ? undefined
        : stats.averageMovingSpeed * 3.6,
      'km/h',
      1,
    ),
  ];
  const gain: Metric = ['Elevation gain', metricLabel(stats.ascent, 'm')];
  const primary: Metric[] = [
    ['Total distance', metricLabel(stats.distance / 1000, 'km', 2)],
    ['Moving time', durationLabel(stats.movingTime)],
    kind === 'cycling'
      ? speed
      : kind === 'running' || kind === 'walking'
        ? pace
        : gain,
  ];
  const secondary: Metric[] = [
    ['Elapsed time', durationLabel(stats.elapsedTime)],
    ['Recorded duration', durationLabel(stats.duration)],
    [
      'Moving distance',
      metricLabel(
        stats.movingDistance === undefined
          ? undefined
          : stats.movingDistance / 1000,
        'km',
        2,
      ),
    ],
    ['Elevation loss', metricLabel(stats.descent, 'm')],
    ['Minimum elevation', metricLabel(stats.minElevation, 'm')],
    ['Maximum elevation', metricLabel(stats.maxElevation, 'm')],
  ];
  if (kind !== 'unknown') {
    if (kind === 'hiking' || kind === 'trail-running') secondary.push(pace);
    else secondary.push(gain);
    secondary.push(
      kind === 'cycling'
        ? [
            'Avg. Elapsed Speed',
            metricLabel(
              stats.averageElapsedSpeed === undefined
                ? undefined
                : stats.averageElapsedSpeed * 3.6,
              'km/h',
              1,
            ),
          ]
        : ['Elapsed pace', paceLabel(stats.elapsedPace)],
    );
  }
  for (const [key, label, unit] of [
    ['heartRate', 'Heart Rate', 'bpm'],
    ['cadence', 'Cycling cadence', 'rpm'],
    ['power', 'Power', 'W'],
    ['temperature', 'Device temperature', '°C'],
  ] as const) {
    const sensor = stats.sensors[key];
    if (sensor?.average !== undefined)
      secondary.push([`Avg. ${label}`, metricLabel(sensor.average, unit)]);
    if (key !== 'temperature' && sensor?.max !== undefined)
      secondary.push([`Max. ${label}`, metricLabel(sensor.max, unit)]);
  }
  return {
    primary,
    secondary: secondary.filter(([, value]) => value !== 'Not available'),
  };
}
function Metrics({
  items,
  primary = false,
}: {
  items: Metric[];
  primary?: boolean;
}) {
  return (
    <dl
      className={`grid gap-x-4 gap-y-5 ${primary ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-2'}`}
    >
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{label}</dt>
          <dd
            className={`mt-1 break-words font-semibold tabular-nums text-foreground ${primary ? 'text-xl sm:text-3xl' : 'text-base sm:text-lg'}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function JourneySummary({
  world,
  activity,
  onReplay,
}: {
  world: World;
  activity?: Activity;
  onReplay?: () => void;
}) {
  const { primary, secondary } = summaryMetrics(world, activity?.type);
  const { stats, splits } = world.processed;
  const date = timestamp(activity?.recordedAt ?? activity?.segments[0][0].time);
  return (
    <section
      className="flex min-w-0 flex-col gap-5 bg-canvas p-4 sm:p-6"
      aria-label="Activity summary"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-eyebrow">The real journey</p>
          <h2
            tabIndex={-1}
            className="break-words text-2xl font-bold text-foreground"
          >
            {activity?.name ?? 'Activity summary'}
          </h2>
          <ActivityTypeBadge type={activity?.type} />
          {Number.isFinite(date) && (
            <p className="mt-2 text-sm text-muted">
              {new Date(date).toLocaleString('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
        {onReplay && <Button onClick={onReplay}>Replay Adventure</Button>}
      </header>
      <div className="order-2 border-b border-line pb-5 lg:order-none">
        <Metrics items={primary} primary />
      </div>
      <div className="contents lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-6">
        <div className="order-1 h-[280px] min-w-0 sm:h-[360px] lg:order-none">
          <SummaryMap world={world} />
        </div>
        <div className="order-3 min-w-0">
          <Metrics items={secondary} />
        </div>
      </div>
      <div className="order-4 space-y-4">
        {activity?.unsupportedExtensions && (
          <p className="ui-notice">
            Unsupported GPX extensions were ignored; only recognized sensor
            schemas are analyzed.
          </p>
        )}
        {!stats.availability.moving.available && !stats.partialTime && (
          <p className="ui-notice">
            Insufficient verified movement: long recording gaps or stationary
            intervals cannot establish an average moving pace or speed.
          </p>
        )}
        {stats.partialTime && (
          <p className="ui-notice">
            {stats.duration === undefined
              ? 'No valid timestamps.'
              : 'Partial or invalid timestamps.'}{' '}
            Moving averages require complete ordered timing. Recorded duration
            includes only valid adjacent intervals.
          </p>
        )}
        {stats.ascent === undefined ? (
          <p className="ui-notice">No continuous elevation recorded.</p>
        ) : (
          stats.partialElevation && (
            <p className="ui-notice">
              Partial elevation: gain and loss include recorded sections only.
            </p>
          )
        )}
        {Object.entries(stats.sensors).some(
          ([, sensor]) =>
            sensor?.max !== undefined && sensor.average === undefined,
        ) && (
          <p className="ui-notice">
            Sensor coverage is incomplete. Activity averages require at least
            80% recorded time coverage with gaps of at most 60 seconds.
          </p>
        )}
        <ActivityAnalysis
          activityType={activity?.type ?? ''}
          series={world.processed.chartSeries}
          distance={world.distance}
        />
        {splits.length > 0 && (
          <section aria-label="Kilometer splits" className="ui-panel">
            <h3 className="text-lg font-bold text-foreground">
              Kilometer splits
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-muted">
                    <th scope="col">Split</th>
                    <th scope="col">Distance</th>
                    <th scope="col">Moving time</th>
                    <th scope="col">Moving pace</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split) => (
                    <tr
                      key={split.kilometer}
                      className="border-t border-line transition-colors hover:bg-surface-muted"
                    >
                      <th scope="row" className="py-3 pr-2 font-medium">
                        {split.kilometer}
                        {split.partial ? ' (partial)' : ''}
                      </th>
                      <td>{metricLabel(split.distance / 1000, 'km', 2)}</td>
                      <td>{durationLabel(split.duration)}</td>
                      <td>{paceLabel(split.pace)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
