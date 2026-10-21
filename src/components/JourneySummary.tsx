import { RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { durationLabel } from './AdventureStats';
import type { World } from '../lib/route';

export function JourneySummary({
  world,
  name,
  replay,
}: {
  world: World;
  name: string;
  replay: () => void;
}) {
  const { stats } = world.processed;
  const start = world.processed.segments[0][0],
    finish = world.processed.segments.at(-1)!.at(-1)!;
  const coordinate = (p: { lat: number; lon: number }) =>
    `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  return (
    <section className="journey-summary" aria-label="Journey summary">
      <div className="eyebrow">ONE JOURNEY. EVERY FOOTSTEP.</div>
      <h2 tabIndex={-1}>{name}</h2>
      <p>Your journey, remembered.</p>
      <svg
        className="summary-route"
        viewBox={`0 0 ${world.width} ${world.height}`}
        role="img"
        aria-label="Route overview, with start and finish markers"
      >
        {world.segments.map((segment, i) => (
          <polyline
            key={i}
            points={segment.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[world.segments[0][0], world.segments.at(-1)!.at(-1)!].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={18} fill={i ? '#ca543c' : '#347a5b'} />
            <text x={p.x + 25} y={p.y - 25} fontSize="40">
              {i ? 'Finish' : 'Start'}
            </text>
          </g>
        ))}
      </svg>
      <dl className="summary-statistics">
        {[
          ['Total distance', `${(stats.distance / 1000).toFixed(2)} km`],
          ['Moving time', durationLabel(stats.movingTime)],
          ['Recorded duration', durationLabel(stats.duration)],
          [
            'Elevation gain',
            stats.ascent === undefined
              ? 'Not available'
              : `${Math.round(stats.ascent)} m`,
          ],
          [
            'Average speed',
            stats.averageSpeed === undefined
              ? 'Not available'
              : `${(stats.averageSpeed * 3.6).toFixed(1)} km/h`,
          ],
          [
            'Average pace',
            !stats.averageSpeed
              ? 'Not available'
              : `${durationLabel(1000 / stats.averageSpeed)} / km`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="summary-endpoints">
        Start: {coordinate(start)}
        <br />
        Finish: {coordinate(finish)}
      </p>
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
      <Button onClick={replay}>
        <RotateCcw size={16} />
        Replay journey
      </Button>
    </section>
  );
}
