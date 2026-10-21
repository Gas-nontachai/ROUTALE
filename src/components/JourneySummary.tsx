import { durationLabel } from './AdventureStats';
import { SummaryMap } from './SummaryMap';
import type { World } from '../lib/route';

export function JourneySummary({ world }: { world: World }) {
  const { stats } = world.processed;
  const primary = [
    ['Total distance', `${(stats.distance / 1000).toFixed(2)} km`],
    ['Moving time', durationLabel(stats.movingTime)],
    [
      'Avg. pace',
      !stats.averageSpeed
        ? 'Not available'
        : `${durationLabel(1000 / stats.averageSpeed)} / km`,
    ],
  ];
  const secondary = [
    [
      'Elevation gain',
      stats.ascent === undefined
        ? 'Not available'
        : `${Math.round(stats.ascent)} m`,
    ],
    ['Elapsed time', durationLabel(stats.duration)],
    [
      'Avg. speed',
      stats.averageSpeed === undefined
        ? 'Not available'
        : `${(stats.averageSpeed * 3.6).toFixed(1)} km/h`,
    ],
  ];

  return (
    <section
      className="flex min-h-full flex-col gap-4 bg-[#F7F8F3] p-4 sm:p-5"
      aria-label="Journey summary"
    >
      <div className="h-[260px] shrink-0 sm:h-[330px] lg:min-h-[260px] lg:flex-1">
        <SummaryMap world={world} />
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-4 border-b border-[#D8E1D8] pb-4">
        {primary.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-[#65776C]">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-[#19392C] sm:text-2xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
        {secondary.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-[#65776C]">{label}</dt>
            <dd className="mt-1 text-base font-semibold text-[#19392C] sm:text-lg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {stats.partialTime && (
        <p className="text-xs text-stone-600">
          Timestamp coverage is incomplete. Moving time and average speed are
          unavailable.
        </p>
      )}
      {stats.partialElevation && (
        <p className="text-xs text-stone-600">
          Elevation coverage is incomplete; gain includes only recorded adjacent
          samples.
        </p>
      )}
    </section>
  );
}
