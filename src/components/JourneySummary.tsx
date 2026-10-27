import { Crown, FilePlus2, RotateCcw } from 'lucide-react';
import { durationLabel } from './AdventureStats';
import { SummaryMap } from './SummaryMap';
import type { Activity, World } from '../lib/route';
import { activityKind, timestamp } from '../lib/analysis';
import { metricLabel, paceLabel } from '../lib/format';
import { ActivityAnalysis } from './ActivityAnalysis';
import { ActivityTypeBadge } from './ActivityTypeBadge';
import { Button } from './ui/button';

type Metric = [string, string];
export function fastestCompleteSplit(splits: World['processed']['splits']) {
  return splits.reduce<World['processed']['splits'][number] | undefined>(
    (best, split) =>
      !split.partial &&
      split.pace !== undefined &&
      Number.isFinite(split.pace) &&
      split.pace > 0 &&
      (!best || split.pace < best.pace!)
        ? split
        : best,
    undefined,
  );
}
export function summaryMetrics(world: World, type?: string) {
  const { stats } = world.processed;
  const kind = activityKind(type);
  const pace: Metric = ['Moving pace', paceLabel(stats.averageMovingPace)];
  const speed: Metric = [
    'Moving speed',
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
    ['Distance', metricLabel(stats.distance / 1000, 'km', 2)],
    ['Moving time', durationLabel(stats.movingTime)],
    kind === 'cycling' ? speed : kind !== 'unknown' ? pace : gain,
  ];
  const secondary: Metric[] = [
    ['Elapsed time', durationLabel(stats.elapsedTime)],

    ['Elevation loss', metricLabel(stats.descent, 'm')],
    ['Min. elevation', metricLabel(stats.minElevation, 'm')],
    ['Max. elevation', metricLabel(stats.maxElevation, 'm')],
  ];
  if (stats.duration !== stats.elapsedTime)
    secondary.push(['Recorded duration', durationLabel(stats.duration)]);
  if (
    stats.movingDistance !== undefined &&
    stats.movingDistance !== stats.distance
  )
    secondary.push([
      'Moving distance',
      metricLabel(stats.movingDistance / 1000, 'km', 2),
    ]);
  if (kind !== 'unknown') {
    secondary.push(gain);
    secondary.push(
      kind === 'cycling'
        ? [
            'Elapsed speed',
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
    ['heartRate', 'HR', 'bpm'],
    ['cadence', 'Cadence', 'rpm'],
    ['power', 'Power', 'W'],
    ['temperature', 'device temp.', '°C'],
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
            {value === 'Not available' ? '—' : value}
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
  onImport,
}: {
  world: World;
  activity?: Activity;
  onReplay?: () => void;
  onImport?: () => void;
}) {
  const { primary, secondary } = summaryMetrics(world, activity?.type);
  const { stats, splits } = world.processed;
  const fastest = fastestCompleteSplit(splits);
  const details = secondary.filter(([label]) =>
    ['Elevation gain', 'Elapsed time', 'Avg. HR', 'Avg. device temp.'].includes(
      label,
    ),
  );
  const technical = secondary.filter((item) => !details.includes(item));
  const date = timestamp(activity?.recordedAt ?? activity?.segments[0][0].time);
  return (
    <section
      className="flex min-w-0 flex-col gap-5 bg-canvas p-4 sm:p-6"
      aria-label="Activity summary"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0">
            <h2
              tabIndex={-1}
              className="break-words text-2xl font-bold text-foreground sm:text-3xl"
            >
              {activity?.name ?? 'Activity summary'}
            </h2>
          </div>
          <ActivityTypeBadge type={activity?.type} />
          {Number.isFinite(date) && (
            <p className="text-sm text-muted sm:mb-1 sm:ml-auto sm:whitespace-nowrap sm:text-base">
              {new Date(date).toLocaleString('en', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onReplay && (
            <Button
              size="icon"
              onClick={onReplay}
              aria-label="Replay"
              title="Replay"
            >
              <RotateCcw size={20} aria-hidden="true" />
            </Button>
          )}
          {onImport && (
            <Button
              variant="outline"
              size="icon"
              onClick={onImport}
              aria-label="Import GPX"
              title="Import GPX"
            >
              <FilePlus2 size={20} aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>
      <div className="border-b border-line pb-6">
        <Metrics items={primary} primary />
      </div>
      <div className="contents lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-6">
        <div className="h-[280px] min-w-0 sm:h-[360px]">
          <SummaryMap world={world} />
        </div>
        <div className="min-w-0">
          {details.length > 0 && <h3 className="ui-eyebrow mb-4">Details</h3>}
          <Metrics items={details} />
          {technical.length > 0 && (
            <details open className="mt-6 border-t border-line pt-3">
              <summary className="min-h-11 text-sm font-medium">
                More stats
              </summary>
              <Metrics items={technical} />
            </details>
          )}
        </div>
      </div>
      <div className="order-4 space-y-4">
        {activity?.unsupportedExtensions && (
          <p className="ui-notice">Some GPX extensions aren’t supported.</p>
        )}
        {!stats.availability.moving.available && !stats.partialTime && (
          <p className="ui-notice">
            Moving averages unavailable: recording gaps or insufficient
            movement.
          </p>
        )}
        {stats.partialTime && (
          <p className="ui-notice">
            {stats.duration === undefined
              ? 'No valid timestamps.'
              : 'Partial or invalid timestamps.'}{' '}
            Moving averages need complete timing. Recorded time excludes invalid
            intervals.
          </p>
        )}
        {stats.ascent === undefined ? (
          <p className="ui-notice">Elevation unavailable.</p>
        ) : (
          stats.partialElevation && (
            <p className="ui-notice">
              Partial elevation: ascent and descent cover recorded sections
              only.
            </p>
          )
        )}
        {Object.entries(stats.sensors).some(
          ([, sensor]) =>
            sensor?.max !== undefined && sensor.average === undefined,
        ) && (
          <p className="ui-notice">
            Sensor averages need 80% time coverage with gaps ≤60 seconds.
          </p>
        )}
        <ActivityAnalysis
          activityType={activity?.type ?? ''}
          series={world.processed.series}
          distance={world.distance}
        />
        {splits.length > 0 && (
          <section aria-label="Kilometer splits" className="ui-panel">
            <h3 className="text-lg font-bold text-foreground">Splits</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead>
                  <tr className="text-muted">
                    <th scope="col">KM</th>
                    <th scope="col">Distance</th>
                    <th scope="col">Moving time</th>
                    <th scope="col" title="Moving pace">
                      Pace
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((split) => (
                    <tr key={split.kilometer} className="border-t border-line">
                      <th scope="row" className="py-3 pr-2 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {split.kilometer}
                          {split.partial ? ' (partial)' : ''}
                          {split === fastest && (
                            <span
                              role="img"
                              aria-label="Fastest full kilometer"
                              title="Fastest full kilometer"
                              className="text-primary"
                            >
                              <Crown size={16} aria-hidden="true" />
                            </span>
                          )}
                        </span>
                      </th>
                      <td>{metricLabel(split.distance / 1000, 'km', 2)}</td>
                      <td>
                        {split.duration === undefined
                          ? '—'
                          : durationLabel(split.duration)}
                      </td>
                      <td>
                        {split.pace === undefined ? '—' : paceLabel(split.pace)}
                      </td>
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
