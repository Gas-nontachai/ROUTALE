import type { World } from '../lib/route';
import type { Geography } from '../lib/geography';
const value = (n: number | undefined, suffix = ' m') =>
  n === undefined
    ? 'Not available'
    : `${Math.round(n).toLocaleString()}${suffix}`;
export function durationLabel(seconds: number | undefined) {
  if (seconds === undefined) return 'Not available';
  const h = Math.floor(seconds / 3600),
    m = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
export function AdventureStats({
  world,
  geography,
  distance,
}: {
  world: World;
  geography: Geography | null;
  distance: number;
}) {
  const { stats, movements } = world.processed;
  const min = stats.minElevation ?? 0,
    range = Math.max(1, (stats.maxElevation ?? min) - min);
  return (
    <section
      className="adventure-details"
      aria-label="Original activity statistics and elevation"
    >
      <div className="statistics-heading">
        <div>
          <div className="eyebrow">THE REAL JOURNEY</div>
          <h2>All the footsteps count.</h2>
        </div>
        <p>
          Quality-filtered activity statistics.
          <br />
          Rest and lap compression never change these numbers.
        </p>
      </div>
      <dl className="statistics-grid">
        {[
          ['Total distance', `${(stats.distance / 1000).toFixed(2)} km`],
          ['Recorded duration', durationLabel(stats.duration)],
          ['Elevation gain', value(stats.ascent)],
          ['Elevation loss', value(stats.descent)],
          ['Lowest elevation', value(stats.minElevation)],
          ['Track high point', value(stats.maxElevation)],
          [
            'Rest areas',
            String(movements.filter((m) => m.type === 'stay').length),
          ],
          [
            'Repeated loop groups',
            String(movements.filter((m) => m.type === 'loop').length),
          ],
        ].map(([label, v]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="profile-heading">
        <strong>Elevation profile</strong>
        <span>Filtered GPX elevation · meters</span>
      </div>
      {stats.minElevation !== undefined ? (
        <svg
          className="elevation-profile"
          viewBox="0 0 1000 150"
          preserveAspectRatio="none"
          role="img"
          aria-label={`GPX elevation profile from ${Math.round(min)} to ${Math.round(stats.maxElevation!)} meters`}
        >
          {[30, 75, 120].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="1000"
              y2={y}
              stroke="#d4dcc5"
              strokeDasharray="4 5"
            />
          ))}
          {world.segments.flatMap((segment, s) => {
            const runs: string[][] = [[]];
            for (const p of segment) {
              if (p.elevation === undefined) {
                if (runs[runs.length - 1].length) runs.push([]);
                continue;
              }
              runs[runs.length - 1].push(
                `${(p.distance / world.distance) * 1000},${130 - ((p.elevation - min) / range) * 110}`,
              );
            }
            return runs
              .filter((r) => r.length > 0)
              .map((r, i) => (
                <polyline
                  key={`${s}-${i}`}
                  points={r.join(' ')}
                  fill="none"
                  stroke="#65874b"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ));
          })}
          <line
            x1={(distance / world.distance) * 1000}
            y1="0"
            x2={(distance / world.distance) * 1000}
            y2="150"
            stroke="#ba934d"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="no-elevation">
          No GPX elevation recorded.{' '}
          {geography?.terrain.length
            ? 'The world uses DEM terrain; no DEM values are added to activity statistics.'
            : 'Flat terrain is used until DEM is enabled.'}
        </div>
      )}
      <div className="profile-scale">
        <span>{value(stats.minElevation)}</span>
        <span>
          High point: {value(stats.maxElevation)} · not a confirmed summit
        </span>
        <span>{(world.distance / 1000).toFixed(2)} km</span>
      </div>
      <p className="quality-note">
        {stats.filteredPoints} isolated GPS spike
        {stats.filteredPoints === 1 ? '' : 's'} excluded from quality
        statistics. Original GPX coordinates are retained in memory.{' '}
        {stats.partialTime
          ? 'Timestamp coverage is incomplete or non-monotonic; duration sums only valid consecutive intervals. '
          : ''}
        {stats.partialElevation
          ? 'Elevation coverage is incomplete; missing values stay unknown.'
          : 'Elevation noise uses a local median filter.'}
      </p>
      {movements.length > 0 && (
        <div className="movement-summary">
          {movements.map((m, i) => (
            <span key={i}>
              {m.type === 'stay'
                ? `Rest area · ${durationLabel(m.duration)} recorded → 2s replay`
                : m.type === 'loop'
                  ? `${m.loopCount} laps · first two at normal speed, remainder at 12×`
                  : 'Backtracking · outward and return paths preserved'}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
