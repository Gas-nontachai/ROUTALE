import { describe, expect, it } from 'vitest';
import {
  bearing,
  routeBounds,
  routeCoordinates,
  visibleRoute,
  travelerFacing,
} from './map';
import { createWorld, parseGpx, unproject } from './route';

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

  it('bounds the entire route including disconnected segments, independent of playback progress', () => {
    const [southwest, northeast] = routeBounds(world);
    expect(southwest[0]).toBeCloseTo(0);
    expect(southwest[1]).toBeCloseTo(0);
    expect(northeast[0]).toBeCloseTo(1.01);
    expect(northeast[1]).toBeCloseTo(1);
    expect(visibleRoute(world, 0)).toEqual([]);
    for (const segment of routeCoordinates(world))
      for (const [lon, lat] of segment) {
        expect(lon).toBeGreaterThanOrEqual(southwest[0]);
        expect(lon).toBeLessThanOrEqual(northeast[0]);
        expect(lat).toBeGreaterThanOrEqual(southwest[1]);
        expect(lat).toBeLessThanOrEqual(northeast[1]);
      }
  });

  it('keeps start and finish marker coordinates at the GPX endpoints across segments', () => {
    const endpoints = world.spots.filter(
      (spot) => spot.type === 'start' || spot.type === 'finish',
    );
    expect(endpoints.map((spot) => spot.type)).toEqual(['start', 'finish']);
    for (const [index, point] of [
      world.processed.segments[0][0],
      world.processed.segments.at(-1)!.at(-1)!,
    ].entries()) {
      const coordinate = unproject(
        world,
        endpoints[index].x,
        endpoints[index].y,
      );
      expect(coordinate.lon).toBeCloseTo(point.lon, 8);
      expect(coordinate.lat).toBeCloseTo(point.lat, 8);
    }
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

describe('upright traveler directions', () => {
  it('faces four screen directions relative to camera bearing, including wraparound', () => {
    expect(
      [0, 90, 180, 270].map((heading) => travelerFacing(heading, 0)),
    ).toEqual(['back', 'right', 'front', 'left']);
    expect(
      [0, 90, 180, 270].map((heading) => travelerFacing(heading, 90)),
    ).toEqual(['left', 'back', 'right', 'front']);
    expect(travelerFacing(-1, 0)).toBe('back');
    expect(travelerFacing(719, 360)).toBe('back');
    expect(travelerFacing(44.9, 0)).toBe('back');
    expect(travelerFacing(45, 0)).toBe('right');
    expect(travelerFacing(315, 0)).toBe('back');
  });
});
