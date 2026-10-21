import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { durationLabel } from './AdventureStats';
import type { World } from '../lib/route';

export function JourneySummary({
  world,
  name,
  activityType,
  replay,
}: {
  world: World;
  name: string;
  activityType?: string;
  replay: () => void;
}) {
  const { stats } = world.processed;
  return (
    <section className="journey-summary" aria-label="Journey summary">
      <header className="summary-header">
        <div className="summary-title">
          <h2 tabIndex={-1}>{name}</h2>
          <span className="summary-type">{activityType || 'GPX activity'}</span>
        </div>
        <Button
          variant="outline"
          className="summary-replay"
          onClick={replay}
          aria-label="Replay journey"
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span>Replay</span>
        </Button>
      </header>
      <div className="summary-map-space" aria-hidden="true" />
      <dl className="summary-statistics">
        {[
          ['Total distance', `${(stats.distance / 1000).toFixed(2)} km`],
          ['Moving time', durationLabel(stats.movingTime)],
          [
            'Avg. pace',
            !stats.averageSpeed
              ? 'Not available'
              : `${durationLabel(1000 / stats.averageSpeed)} / km`,
          ],
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
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {stats.partialTime && (
        <p>
          Timestamp coverage is incomplete. Moving time and average speed are
          unavailable.
        </p>
      )}
      {stats.partialElevation && (
        <p>
          Elevation coverage is incomplete; gain includes only recorded adjacent
          samples.
        </p>
      )}
    </section>
  );
}
