import smartDemo from '../../public/Smart_Route.gpx?raw';
import { describe, expect, it } from 'vitest';
import { analyzeRoute } from './analysis';
import { animationAt, createWorld, parseGpx, type GPSPoint } from './route';
const origin = Date.parse('2026-10-20T00:00:00Z');
const p = (
  x: number,
  y: number,
  seconds?: number,
  elevation?: number,
): GPSPoint => ({
  lat: y / 111195,
  lon: x / 111195,
  ...(seconds === undefined
    ? {}
    : { time: new Date(origin + seconds * 1000).toISOString() }),
  ...(elevation === undefined ? {} : { elevation }),
});
function activity(points: GPSPoint[]) {
  return parseGpx(
    `<gpx><trk><trkseg>${points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.time ? `<time>${p.time}</time>` : ''}${p.elevation !== undefined ? `<ele>${p.elevation}</ele>` : ''}</trkpt>`).join('')}</trkseg></trk></gpx>`,
  );
}
function laps(count: number, reverse = false, approach = false) {
  const points: GPSPoint[] = approach
    ? Array.from({ length: 20 }, (_, i) => p(-200 + i * 10, 0, i * 3))
    : [];
  for (let lap = 0; lap < count; lap++)
    for (let i = 0; i < 40; i++) {
      const t = reverse && lap % 2 ? (40 - i) % 40 : i;
      const x = t < 10 ? t * 10 : t < 20 ? 100 : t < 30 ? 300 - t * 10 : 0;
      const y =
        t < 10 ? 0 : t < 20 ? (t - 10) * 10 : t < 30 ? 100 : 400 - t * 10;
      points.push(
        p(
          x + Math.sin(i * 2) * 0.5,
          y + Math.cos(i * 2) * 0.5,
          points.length * 3,
          100 + Math.sin((i / 40) * Math.PI * 2) * 3,
        ),
      );
    }
  points.push(p(0, 0, points.length * 3, 100));
  return points;
}
describe('smart route analysis', () => {
  it('precomputes moving time and averages only with complete monotonic timestamps', () => {
    const result = analyzeRoute(
      activity([p(0, 0, 0), p(100, 0, 60), p(100, 0, 120), p(200, 0, 180)]),
    );
    expect(result.stats.duration).toBe(180);
    expect(result.stats.movingTime).toBe(120);
    expect(result.stats.averageSpeed).toBeCloseTo(200 / 180, 4);
    for (const points of [
      [p(0, 0, 0), p(100, 0), p(200, 0, 180)],
      [p(0, 0, 60), p(100, 0, 30), p(200, 0, 180)],
    ]) {
      const partial = analyzeRoute(activity(points));
      expect(partial.stats.partialTime).toBe(true);
      expect(partial.stats.movingTime).toBeUndefined();
      expect(partial.stats.averageSpeed).toBeUndefined();
    }
  });
  it('counts all six laps in the combined demo next to a rest and out-and-back hike', () => {
    const world = createWorld(parseGpx(smartDemo));
    expect(
      world.processed.movements.find((m) => m.type === 'loop')?.loopCount,
    ).toBe(6);
    expect(
      world.processed.movements.filter((m) => m.type === 'stay'),
    ).toHaveLength(1);
    expect(
      world.processed.movements.some((m) => m.type === 'backtracking'),
    ).toBe(true);
  });
  it('compresses a timed rest area into a two-second idle without modifying the original', () => {
    const points = [
      p(-100, 0, 0, 100),
      p(0, 0, 60, 105),
      ...Array.from({ length: 40 }, (_, i) =>
        p(Math.sin(i) * 10, Math.cos(i) * 10, 75 + i * 15, 105),
      ),
      p(100, 0, 750, 110),
    ];
    const original = activity(points),
      before = structuredClone(original),
      world = createWorld(original);
    expect(original).toEqual(before);
    const rests = world.processed.movements.filter((m) => m.type === 'stay');
    expect(rests).toHaveLength(1);
    expect(rests[0].duration).toBeGreaterThanOrEqual(300);
    const rest = world.steps.find((s) => s.type === 'stay')!;
    expect(rest.end - rest.start).toBe(2);
    const middle = animationAt(world, (rest.start + rest.end) / 2);
    expect(middle.x).toBe(rest.from.x);
    expect(middle.y).toBe(rest.from.y);
    expect(middle.movement).toBe('stay');
    expect(world.processed.stats.duration).toBe(750);
    expect(world.distance).toBeCloseTo(original.distance, 5);
    expect(world.duration).toBeGreaterThanOrEqual(20);
    expect(world.duration).toBeLessThanOrEqual(180);
  });
  it('counts repeated ordered laps with GPS jitter and accelerates only laps after the first two', () => {
    const world = createWorld(activity(laps(10)));
    const loops = world.processed.movements.filter((m) => m.type === 'loop');
    expect(loops).toHaveLength(1);
    expect(loops[0].loopCount).toBe(10);
    expect(world.steps.some((s) => s.type === 'loop')).toBe(true);
    const normal = world.steps.find((s) => s.type === 'normal')!;
    const compressed = world.steps.find((s) => s.type === 'loop')!;
    const speed = (s: typeof normal) =>
      (s.to.distance - s.from.distance) / (s.end - s.start);
    expect(speed(compressed)).toBeCloseTo(speed(normal) * 12, 3);
    expect(world.spots.find((s) => s.type === 'loop')?.label).toBe('10 laps');
    expect(animationAt(world, world.duration).distance).toBeCloseTo(
      world.distance,
    );
  });
  it('detects repeated laps after an approach, without matching opposite-direction laps', () => {
    const approach = analyzeRoute(activity(laps(4, false, true)));
    expect(
      approach.movements.some((m) => m.type === 'loop' && m.loopCount === 4),
    ).toBe(true);
    expect(
      analyzeRoute(activity(laps(2, true))).movements.filter(
        (m) => m.type === 'loop',
      ),
    ).toHaveLength(0);
  });
  it('preserves an out-and-back hike, including its elevation, instead of classifying it as a loop or rest', () => {
    const points = Array.from({ length: 81 }, (_, i) => {
      const x = i <= 40 ? i * 15 : (80 - i) * 15;
      return p(x, 0, i * 20, 100 + x / 5);
    });
    const world = createWorld(activity(points));
    expect(
      world.processed.movements.some((m) => m.type === 'backtracking'),
    ).toBe(true);
    expect(
      world.processed.movements.filter(
        (m) => m.type === 'loop' || m.type === 'stay',
      ),
    ).toHaveLength(0);
    expect(world.steps.some((s) => s.type === 'backtracking')).toBe(true);
    expect(world.duration).toBeGreaterThanOrEqual(20);
    expect(world.duration).toBeLessThanOrEqual(180);
    expect(world.processed.stats.ascent).toBeGreaterThan(100);
    expect(world.processed.stats.descent).toBeGreaterThan(100);
    expect(world.spots.find((s) => s.type === 'summit')?.label).toBe(
      'Track high point',
    );
  });
  it('rejects a track whose only movement is a GPS spike', () => {
    expect(() =>
      createWorld(activity([p(0, 0, 0), p(1000, 1000, 10), p(0, 0, 20)])),
    ).toThrow('No walkable route remains');
  });
  it('filters an isolated implausible GPS spike but keeps plausible sharp turns', () => {
    const original = activity([
      p(0, 0, 0),
      p(10, 0, 10),
      p(1000, 1000, 20),
      p(20, 0, 30),
      p(30, 0, 40),
    ]);
    const result = analyzeRoute(original);
    expect(result.stats.filteredPoints).toBe(1);
    expect(result.stats.distance).toBeLessThan(40);
    expect(original.segments[0]).toHaveLength(5);
    expect(
      analyzeRoute(activity([p(0, 0, 0), p(20, 30, 30), p(40, 0, 60)])).stats
        .filteredPoints,
    ).toBe(0);
  });
  it('does not invent missing time or elevation, and preserves elevation gaps in the animation route', () => {
    const world = createWorld(
      activity([p(0, 0, 0, 100), p(10, 0, undefined), p(20, 0, 120, 120)]),
    );
    expect(world.processed.stats.duration).toBeUndefined();
    expect(world.processed.stats.ascent).toBeUndefined();
    expect(world.processed.stats.partialTime).toBe(true);
    expect(world.processed.stats.partialElevation).toBe(true);
    expect(world.segments[0]).toHaveLength(3);
    expect(world.segments[0][1].elevation).toBeUndefined();
    expect(
      world.processed.movements.filter((m) => m.type === 'stay'),
    ).toHaveLength(0);
    const flat = createWorld(activity([p(0, 0), p(100, 0)]));
    expect(flat.processed.stats.maxElevation).toBeUndefined();
    expect(flat.spots.some((s) => s.type === 'summit')).toBe(false);
  });
  it('preserves elevation bends even on a straight geographic route', () => {
    const world = createWorld(
      activity(
        Array.from({ length: 11 }, (_, i) =>
          p(i * 30, 0, i * 20, i <= 5 ? i * 15 : (10 - i) * 15),
        ),
      ),
    );
    expect(world.segments[0].length).toBeGreaterThan(2);
    expect(
      world.spots.find((s) => s.type === 'summit')!.elevation,
    ).toBeGreaterThan(50);
  });
});
