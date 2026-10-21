import { describe, expect, it } from 'vitest';
import { createWorld, meters, parseGpx, positionAt, random } from './route';
import { useSimulationStore } from '../stores';
const point = (lat: number, lon: number, extra = '') =>
  `<trkpt lat="${lat}" lon="${lon}">${extra}</trkpt>`;
const gpx = (...segments: string[]) =>
  `<gpx><trk><name>Test hike</name>${segments.map((s) => `<trkseg>${s}</trkseg>`).join('')}</trk></gpx>`;
describe('GPX import and route geometry', () => {
  it('reads metadata, elevation, timestamps and physical distances', () => {
    const activity = parseGpx(
      gpx(
        point(18, 99, '<ele>100</ele><time>2026-10-18T07:00:00Z</time>') +
          point(18.01, 99, '<ele>125</ele>'),
      ),
    );
    expect(activity.name).toBe('Test hike');
    expect(activity.count).toBe(2);
    expect(activity.ascent).toBe(25);
    expect(activity.distance).toBeCloseTo(1111.95, 0);
    expect(activity.segments[0][0].time).toBe('2026-10-18T07:00:00Z');
  });
  it('preserves GPX activity type without guessing when absent', () => {
    const xml = gpx(point(1, 2) + point(1.01, 2));
    expect(
      parseGpx(xml.replace('<name>', '<type>Hiking</type><name>')).type,
    ).toBe('Hiking');
    expect(parseGpx(xml).type).toBe('');
    expect(
      parseGpx(
        '<gpx><rte><type>Cycling</type><rtept lat="1" lon="2"/><rtept lat="1.01" lon="2"/></rte></gpx>',
      ).type,
    ).toBe('Cycling');
  });
  it('rejects malformed XML, entities, non GPX, missing coordinates and stationary tracks', () => {
    for (const xml of [
      '<gpx>',
      '<test/>',
      '<!DOCTYPE gpx><gpx/>',
      '<gpx><trk><trkseg><trkpt/><trkpt/></trkseg></trk></gpx>',
      gpx(point(0, 0) + point(0, 0)),
    ])
      expect(() => parseGpx(xml)).toThrow();
  });
  it('never joins separate segments or bridges invalid coordinates', () => {
    const activity = parseGpx(
      gpx(point(0, 0) + point(0, 0.01), point(10, 10) + point(10, 10.01)),
    );
    const world = createWorld(activity);
    expect(world.segments).toHaveLength(2);
    expect(activity.distance).toBeLessThan(2300);
    const boundary = world.segments[0].at(-1)!.distance;
    const next = positionAt(world, boundary + 1);
    expect(
      Math.hypot(
        next.x - world.segments[1][0].x,
        next.y - world.segments[1][0].y,
      ),
    ).toBeLessThan(1);
    const invalid = parseGpx(
      gpx(
        point(0, 0) +
          point(0, 0.01) +
          '<trkpt lat="999" lon="0"/>' +
          point(2, 2) +
          point(2, 2.01),
      ),
    );
    expect(invalid.segments).toHaveLength(2);
  });
  it('supports namespaces and route-only GPX', () => {
    expect(
      parseGpx(
        '<g:gpx xmlns:g="urn:gpx"><g:rte><g:name>A route</g:name><g:rtept lat="1" lon="2"/><g:rtept lat="1.01" lon="2"/></g:rte></g:gpx>',
      ).name,
    ).toBe('A route');
  });
  it('keeps shapes proportional, preserves corners, and places spots along the route', () => {
    const world = createWorld(
      parseGpx(gpx(point(0, 0) + point(0, 0.01) + point(0.01, 0.01))),
    );
    const [a, b, c] = world.segments[0];
    expect(b.x - a.x).toBeCloseTo(b.y - c.y, 0);
    expect(world.segments[0]).toHaveLength(3);
    expect(positionAt(world, 0)).toEqual(a);
    expect(positionAt(world, world.distance).x).toBe(c.x);
    for (const spot of world.spots)
      expect(spot.x === b.x || spot.y === a.y).toBe(true);
  });
  it('unwraps the date line and handles straight routes', () => {
    const activity = parseGpx(
      gpx(point(0, 179.99) + point(0, -179.99) + point(0.01, -179.99)),
    );
    const world = createWorld(activity);
    expect(activity.distance).toBeLessThan(3400);
    expect(world.width).toBeCloseTo(1800);
    expect(world.height).toBeGreaterThanOrEqual(1000);
    expect(
      meters({ lat: 0, lon: 179.99 }, { lat: 0, lon: -179.99 }),
    ).toBeCloseTo(2223.9, 0);
  });
  it('simplifies a large straight track and keeps deterministic worlds', () => {
    const xml = gpx(
      Array.from({ length: 10000 }, (_, i) => point(18 + i / 1e6, 99)).join(''),
    );
    const a = createWorld(parseGpx(xml)),
      b = createWorld(parseGpx(xml));
    expect(a.segments[0]).toHaveLength(2);
    expect(a).toEqual(b);
    const r1 = random(a.seed),
      r2 = random(a.seed);
    expect([r1(), r1()]).toEqual([r2(), r2()]);
  });
});
describe('playback requests', () => {
  it('allows supported speed changes and preserves speed across reset', () => {
    const state = useSimulationStore.getState();
    state.setSpeed(4);
    state.setSpeed(99);
    expect(useSimulationStore.getState().speed).toBe(4);
    state.restart();
    expect(useSimulationStore.getState().elapsed).toBe(0);
    expect(useSimulationStore.getState().status).toBe('Ready');
    expect(useSimulationStore.getState().speed).toBe(4);
    state.setSpeed(1);
  });
});
