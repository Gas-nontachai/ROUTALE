import { describe, expect, it } from 'vitest';
import { bearing, routeCoordinates, visibleRoute } from './map';
import { createWorld, parseGpx } from './route';

const point = (lat: number, lon: number) =>
  `<trkpt lat="${lat}" lon="${lon}"/>`;
const world = createWorld(
  parseGpx(
    `<gpx><trk><trkseg>${point(0, 0)}${point(0, 0.01)}${point(0, 0.02)}</trkseg><trkseg>${point(1, 1)}${point(1, 1.01)}</trkseg></trk></gpx>`,
  ),
);

describe('MapLibre route data', () => {
  it('preserves route segments without drawing across gaps', () => {
    expect(routeCoordinates(world)).toHaveLength(2);
    expect(visibleRoute(world, world.distance)).toHaveLength(2);
  });

  it('interpolates the travelled line at the current route distance', () => {
    const segment = world.processed.segments[0],
      distance = (segment[1].distance + segment[2].distance) / 2,
      visible = visibleRoute(world, distance);

    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveLength(2);
    expect(visible[0][1][1]).toBeCloseTo(0);
    expect(visible[0][1][0]).toBeCloseTo(0.015);
  });

  it('draws partial progress on the very first edge', () => {
    const visible = visibleRoute(world, world.segments[0].at(-1)!.distance / 4);
    expect(visible[0]).toHaveLength(2);
    expect(visible[0][1][0]).toBeCloseTo(0.005);
  });

  it('calculates northbound bearing across the longitude wrap', () => {
    expect(
      bearing({ lat: 0, lon: 179.99 }, { lat: 0.01, lon: -179.99 }),
    ).toBeCloseTo(63.4, 0);
  });
});
